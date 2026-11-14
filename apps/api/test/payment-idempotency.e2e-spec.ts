import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { assertTestDatabase, signTestToken } from './test-utils';

describe('Payment Idempotency (Integration Test - Task 8 & Task 10.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testUserId: number;
  let accessToken: string;
  let createdOrderIds: number[] = [];

  beforeAll(async () => {
    assertTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Chuẩn bị User test
    let user = await prisma.user.findFirst({ where: { email: 'test_idempotency@brewlite.vn' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test_idempotency@brewlite.vn',
          name: 'Test Idempotency User',
          password: 'hashed_password_123',
        },
      });
    }
    testUserId = user.id;
    accessToken = await signTestToken(app, user);
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test
    for (const orderId of createdOrderIds) {
      await prisma.payment.deleteMany({ where: { orderId } });
      await prisma.order.deleteMany({ where: { id: orderId } });
    }
    await prisma.procPaymentKey.deleteMany({
      where: { key: { startsWith: 'test-idemp-' } },
    });
    await prisma.user.deleteMany({ where: { email: 'test_idempotency@brewlite.vn' } });
    await app.close();
  });

  async function createTestOrder(): Promise<number> {
    const order = await prisma.order.create({
      data: {
        userId: testUserId,
        total: 50000,
        status: 'PENDING',
      },
    });
    createdOrderIds.push(order.id);
    return order.id;
  }

  it('1. Báo lỗi 400 Bad Request nếu thiếu Idempotency-Key trong Header', async () => {
    const orderId = await createTestOrder();

    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        orderId,
        amount: 50000,
        method: 'WALLET',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Thiếu Idempotency-Key trong Header');
  });

  it('2. Thanh toán lần đầu với Idempotency-Key mới -> Xử lý thật và lưu cache (fromCache: false)', async () => {
    const orderId = await createTestOrder();
    const key = `test-idemp-${Date.now()}`;

    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', key)
      .send({
        orderId,
        amount: 50000,
        method: 'WALLET',
      });

    expect([200, 201]).toContain(response.status);
    expect(response.body.fromCache).toBe(false);
    expect(response.body.idempotencyKey).toBe(key);
    expect(response.body.payment).toBeDefined();

    // Kiểm tra đã lưu key vào bảng ProcPaymentKey trong PostgreSQL
    const savedKey = await prisma.procPaymentKey.findUnique({ where: { key } });
    expect(savedKey).not.toBeNull();
  });

  it('3. Gửi lặp lại chính xác cùng Idempotency-Key -> Nhận kết quả từ cache (fromCache: true) mà không tạo giao dịch trùng', async () => {
    const orderId = await createTestOrder();
    const key = `test-idemp-repeat-${Date.now()}`;

    // Lần 1: Gọi lần đầu
    const res1 = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', key)
      .send({
        orderId,
        amount: 50000,
        method: 'WALLET',
      });

    expect([200, 201]).toContain(res1.status);
    expect(res1.body.fromCache).toBe(false);

    // Đếm số lượng bản ghi thanh toán trước lần 2
    const countBefore = await prisma.payment.count({ where: { orderId } });

    // Lần 2: Gửi lặp lại cùng key
    const res2 = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', key)
      .send({
        orderId,
        amount: 50000,
        method: 'WALLET',
      });

    expect([200, 201]).toContain(res2.status);
    expect(res2.body.fromCache).toBe(true);
    expect(res2.body.idempotencyKey).toBe(key);
    expect(res2.body.message).toBe(res1.body.message);

    // Số lượng bản ghi trong database không bị tăng lên (chống trùng lặp tuyệt đối)
    const countAfter = await prisma.payment.count({ where: { orderId } });
    expect(countAfter).toBe(countBefore);
  });

  // ---------- Task 10.2 mở rộng: lỗi/retry, cùng key/khác key, state machine, điểm thưởng ----------

  const pay = (orderId: number, key: string, amount = 50000) =>
    request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', key)
      .send({ orderId, amount, method: 'WALLET' });

  const getPoints = async () =>
    (await prisma.user.findUniqueOrThrow({ where: { id: testUserId } })).rewardPoints;

  it('4. 5 request song song cùng key -> chỉ 1 payment thật, điểm thưởng chỉ cộng 1 lần', async () => {
    const orderId = await createTestOrder();
    const key = `test-idemp-parallel-${Date.now()}`;
    const pointsBefore = await getPoints();

    const responses = await Promise.all(Array.from({ length: 5 }, () => pay(orderId, key)));

    // Không request nào được lỗi 5xx; ít nhất 1 request xử lý thật
    expect(responses.every((r) => r.status < 500)).toBe(true);
    expect(responses.filter((r) => [200, 201].includes(r.status) && r.body.fromCache === false)).toHaveLength(1);

    expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
    expect(await prisma.procPaymentKey.count({ where: { key } })).toBe(1);
    // 50.000đ -> 5 điểm, đúng 1 lần
    expect(await getPoints()).toBe(pointsBefore + 5);
  });

  it('5. Đơn đã thanh toán, gửi lại với KEY KHÁC -> bị từ chối, không tạo payment/điểm thứ hai', async () => {
    const orderId = await createTestOrder();
    const first = await pay(orderId, `test-idemp-first-${Date.now()}`);
    expect([200, 201]).toContain(first.status);
    const pointsAfterFirst = await getPoints();

    const second = await pay(orderId, `test-idemp-second-${Date.now()}`);

    expect([400, 409]).toContain(second.status);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
    expect(await getPoints()).toBe(pointsAfterFirst);
  });

  it('6. Cùng key nhưng payload khác (amount khác) -> không xử lý như request mới', async () => {
    const orderId = await createTestOrder();
    const key = `test-idemp-payload-${Date.now()}`;
    const first = await pay(orderId, key, 50000);
    expect([200, 201]).toContain(first.status);

    const second = await pay(orderId, key, 99999);

    // Hoặc trả lại cache của lần đầu, hoặc báo xung đột; tuyệt đối không tạo payment mới
    expect([200, 201, 400, 409, 422]).toContain(second.status);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
  });

  it('7. Thanh toán lỗi (sai số tiền) -> không tạo payment, không cộng điểm; retry đúng số tiền thì thành công', async () => {
    const orderId = await createTestOrder();
    const pointsBefore = await getPoints();

    const bad = await pay(orderId, `test-idemp-bad-${Date.now()}`, 1);
    expect(bad.status).toBe(400);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PENDING');
    expect(await getPoints()).toBe(pointsBefore);

    // Retry với key mới (lần lỗi trước không được "khóa" đơn hàng)
    const retry = await pay(orderId, `test-idemp-retry-${Date.now()}`, 50000);
    expect([200, 201]).toContain(retry.status);
    expect(retry.body.fromCache).toBe(false);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
    expect(await getPoints()).toBe(pointsBefore + 5);
  });

  it('8. State machine: thanh toán xong đơn rời PENDING; đơn không tồn tại/đã hủy không thanh toán được', async () => {
    const orderId = await createTestOrder();
    const ok = await pay(orderId, `test-idemp-state-${Date.now()}`);
    expect([200, 201]).toContain(ok.status);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).not.toBe('PENDING');

    const missing = await pay(2147483647, `test-idemp-missing-${Date.now()}`);
    expect([400, 404]).toContain(missing.status);

    const cancelledId = await createTestOrder();
    await prisma.order.update({ where: { id: cancelledId }, data: { status: 'CANCELLED' } });
    const cancelled = await pay(cancelledId, `test-idemp-cancelled-${Date.now()}`);
    expect([400, 409]).toContain(cancelled.status);
    expect(await prisma.payment.count({ where: { orderId: cancelledId } })).toBe(0);
  });
});
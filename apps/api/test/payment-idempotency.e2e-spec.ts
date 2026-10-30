import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Payment Idempotency (Integration Test - Task 8 & Task 10.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testUserId: number;
  let accessToken: string;
  let createdOrderIds: number[] = [];

  beforeAll(async () => {
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
    accessToken = await app.get(JwtService).signAsync(
      { sub: user.id, email: user.email },
      { secret: 'BREWLITE_SECRET_KEY_2026' },
    );
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
});

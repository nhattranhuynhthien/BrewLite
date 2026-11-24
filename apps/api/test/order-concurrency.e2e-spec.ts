import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { assertTestDatabase, signTestToken } from './test-utils';

describe('Order Concurrency & Stock Locking (Integration Test - Task 10.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testUserId: number;
  let testProductId: number;
  let authToken: string;
  const extraProductIds: number[] = [];
  const extraUserIds: number[] = [];
  const createdPaymentKeys: string[] = [];

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
    let user = await prisma.user.findFirst({ where: { email: 'test_concurrency@brewlite.vn' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test_concurrency@brewlite.vn',
          name: 'Test Concurrency User',
          password: 'hashed_password_123',
        },
      });
    }
    testUserId = user.id;

    // Tạo token JWT hợp lệ để vượt qua AuthGuard của POST /orders
    authToken = await signTestToken(app, user);

    // Tạo sản phẩm có số lượng tồn kho giới hạn = 5
    const product = await prisma.product.create({
      data: {
        name: `Test Coffee Stock-${Date.now()}`,
        price: 35000,
        stock: 5,
        description: 'Testing stock limits',
      },
    });
    testProductId = product.id;
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test
    const userIdsToClean = [testUserId, ...extraUserIds].filter((id): id is number => Boolean(id));
    if (userIdsToClean.length) {
      const orders = await prisma.order.findMany({ where: { userId: { in: userIdsToClean } } });
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length) {
        await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      }
    }
    if (extraProductIds.length) {
      await prisma.orderItem.deleteMany({ where: { productId: { in: extraProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: extraProductIds } } });
    }
    if (testProductId) {
      await prisma.orderItem.deleteMany({ where: { productId: testProductId } });
      await prisma.product.deleteMany({ where: { id: testProductId } });
    }
    if (createdPaymentKeys.length) {
      await prisma.procPaymentKey.deleteMany({ where: { key: { in: createdPaymentKeys } } });
    }
    if (userIdsToClean.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIdsToClean } } });
    }
    await app.close();
  });

  it('1. Chặn đặt hàng khi số lượng vượt quá tồn kho (Trả về lỗi 400 Bad Request)', async () => {
    // Sản phẩm hiện có stock = 5, nhưng khách yêu cầu mua 10 món
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        userId: testUserId,
        items: [{ productId: testProductId, quantity: 10 }],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('không đủ hàng');

    // Tồn kho trong CSDL vẫn phải giữ nguyên là 5
    const currentProduct = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(currentProduct?.stock).toBe(5);
  });

  it('2. Đặt hàng thành công khi số lượng hợp lệ và tự động trừ tồn kho (Optimistic/Atomic decrement)', async () => {
    // Mua 3 món (trong khi tồn kho = 5)
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        userId: testUserId,
        items: [{ productId: testProductId, quantity: 3 }],
      });

    expect([200, 201]).toContain(response.status);
    expect(response.body.orderId).toBeDefined();

    // Tồn kho trong CSDL phải giảm từ 5 xuống còn 2
    const currentProduct = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(currentProduct?.stock).toBe(2);
  });

  it('3. Khi tồn kho chỉ còn 2, tiếp tục yêu cầu mua 3 món sẽ bị chặn ngay lập tức', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        userId: testUserId,
        items: [{ productId: testProductId, quantity: 3 }],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('không đủ hàng');

    // Tồn kho vẫn là 2, không bị âm
    const currentProduct = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(currentProduct?.stock).toBe(2);
  });

  // ---------- Task 10.3 mở rộng: request song song thật, tổng bán ≤ stock, rollback ----------

  async function createProduct(stock: number): Promise<number> {
    const product = await prisma.product.create({
      data: {
        name: `Test Coffee Parallel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        price: 35000,
        stock,
        description: 'Parallel stock test',
      },
    });
    extraProductIds.push(product.id);
    return product.id;
  }

  const placeOrder = (items: { productId: number; quantity: number }[]) =>
    request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ userId: testUserId, items });

  const isOk = (status: number) => [200, 201].includes(status);

  it('4. 10 request song song, mỗi request mua 1, stock = 5 -> đúng 5 thành công, stock về 0', async () => {
    const productId = await createProduct(5);
    const ordersBefore = await prisma.order.count({ where: { userId: testUserId } });

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => placeOrder([{ productId, quantity: 1 }])),
    );

    const ok = responses.filter((r) => isOk(r.status));
    const rejected = responses.filter((r) => [400, 409].includes(r.status));
    expect(ok).toHaveLength(5);
    expect(rejected).toHaveLength(5); // không có 5xx

    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.stock).toBe(0); // không âm

    // Tổng lượng bán đúng bằng stock ban đầu, và chỉ đơn thành công mới được tạo
    const sold = await prisma.orderItem.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    expect(sold._sum.quantity).toBe(5);
    expect(await prisma.order.count({ where: { userId: testUserId } })).toBe(ordersBefore + 5);
  });

  it('5. 4 request song song, mỗi request mua 2, stock = 5 -> đúng 2 thành công, stock còn 1', async () => {
    const productId = await createProduct(5);

    const responses = await Promise.all(
      Array.from({ length: 4 }, () => placeOrder([{ productId, quantity: 2 }])),
    );

    expect(responses.filter((r) => isOk(r.status))).toHaveLength(2);
    expect(responses.filter((r) => [400, 409].includes(r.status))).toHaveLength(2);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(product.stock).toBe(1);
    const sold = await prisma.orderItem.aggregate({ where: { productId }, _sum: { quantity: true } });
    expect(sold._sum.quantity).toBe(4);
  });

  it('6. Rollback: đơn nhiều món, món thứ 2 thiếu hàng -> món 1 không bị trừ kho, không tạo đơn', async () => {
    const productA = await createProduct(3);
    const productB = await createProduct(1);
    const ordersBefore = await prisma.order.count({ where: { userId: testUserId } });

    const response = await placeOrder([
      { productId: productA, quantity: 2 }, // đủ hàng
      { productId: productB, quantity: 2 }, // thiếu hàng
    ]);

    expect(response.status).toBe(400);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productA } })).stock).toBe(3);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productB } })).stock).toBe(1);
    expect(await prisma.order.count({ where: { userId: testUserId } })).toBe(ordersBefore);
    expect(await prisma.orderItem.count({ where: { productId: { in: [productA, productB] } } })).toBe(0);
  });

  it('7. Song song đơn nhiều món đan chéo (A,B) và (B,A) -> không deadlock, stock không âm', async () => {
    const productA = await createProduct(3);
    const productB = await createProduct(3);

    const responses = await Promise.all([
      ...Array.from({ length: 4 }, () =>
        placeOrder([{ productId: productA, quantity: 1 }, { productId: productB, quantity: 1 }]),
      ),
      ...Array.from({ length: 4 }, () =>
        placeOrder([{ productId: productB, quantity: 1 }, { productId: productA, quantity: 1 }]),
      ),
    ]);

    expect(responses.every((r) => r.status < 500)).toBe(true);
    expect(responses.filter((r) => isOk(r.status))).toHaveLength(3);

    for (const id of [productA, productB]) {
      expect((await prisma.product.findUniqueOrThrow({ where: { id } })).stock).toBe(0);
    }
  });

  async function createSignedUser(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `race-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@brewlite.vn`,
        name: `Race ${label}`,
        password: 'hashed_password_123',
      },
    });
    extraUserIds.push(user.id);
    const token = await signTestToken(app, user);
    return { user, token };
  }

  it('8. Hai người dùng khác nhau đặt cùng lúc 1 ly cuối cùng (stock = 1) -> đúng 1 người tạo đơn PENDING, người kia bị chặn, và người thắng có thể thanh toán lại từ đơn PENDING', async () => {
    const productId = await createProduct(1);
    const userA = await createSignedUser('A');
    const userB = await createSignedUser('B');

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ items: [{ productId, quantity: 1 }] }),
      request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ items: [{ productId, quantity: 1 }] }),
    ]);

    const attempts = [
      { who: userA, res: resA },
      { who: userB, res: resB },
    ];
    const winners = attempts.filter((a) => isOk(a.res.status));
    const losers = attempts.filter((a) => [400, 409].includes(a.res.status));
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);

    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(0);

    const winner = winners[0];
    const loser = losers[0];
    expect(winner.res.body.order.status).toBe('PENDING');

    // Khi người thắng chưa thanh toán (PENDING), người thua thử đặt lại vẫn bị chặn vì kho đang được giữ
    const loserRetry = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${loser.who.token}`)
      .send({ items: [{ productId, quantity: 1 }] });
    expect(loserRetry.status).toBe(400);

    // Người thắng quay lại từ Lịch sử và thanh toán đơn PENDING hiện có
    const payKey = `resume-pay-${Date.now()}`;
    createdPaymentKeys.push(payKey);
    const resumePay = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${winner.who.token}`)
      .set('Idempotency-Key', payKey)
      .send({
        orderId: winner.res.body.orderId,
        method: 'MOMO',
        amount: winner.res.body.order.total,
      });
    expect(resumePay.status).toBe(201);
    expect(resumePay.body.orderStatus).toBe('PAID');
  });

  it('9. Nếu người đặt được ly cuối (PENDING) hủy đơn thay vì thanh toán, tồn kho trả về 1 để người sau đặt lại thành công', async () => {
    const productId = await createProduct(1);
    const userA = await createSignedUser('CancelA');
    const userB = await createSignedUser('RetryB');

    const orderA = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ items: [{ productId, quantity: 1 }] });
    expect(orderA.status).toBe(201);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(0);

    const cancelA = await request(app.getHttpServer())
      .patch(`/orders/${orderA.body.orderId}/cancel`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(cancelA.status).toBe(200);
    expect(cancelA.body.status).toBe('CANCELLED');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(1);

    const orderB = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ items: [{ productId, quantity: 1 }] });
    expect(orderB.status).toBe(201);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(0);
  });
});
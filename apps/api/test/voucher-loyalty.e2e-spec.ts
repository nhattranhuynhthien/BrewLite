import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { randomUUID } from 'node:crypto';
import { assertTestDatabase, signTestToken } from './test-utils';
 
describe('Voucher & Loyalty Points (Integration Test - Task 10.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const prefix = `test-loyalty-${randomUUID()}`;
  const voucherCode = `${prefix}-voucher`;
  let testUserId: number;
  let testProductId: number;
  let testToppingId: number;
  let authToken: string;
 
  beforeAll(async () => {
    assertTestDatabase();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
 
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
 
    prisma = app.get<PrismaService>(PrismaService);
 
    // Chuẩn bị User test có sẵn 10 điểm thưởng
    const user = await prisma.user.create({
        data: {
          email: `${prefix}@test.local`,
          name: 'Test Voucher Loyalty User',
          password: 'hashed_password_123',
          rewardPoints: 10, // 10 điểm thưởng
        },
      });
    testUserId = user.id;
 
    authToken = await signTestToken(app, user);
 
    // Chuẩn bị sản phẩm test (giá 100.000 VNĐ, tồn kho 50)
    const product = await prisma.product.create({
      data: {
        name: `Test Coffee Voucher-${Date.now()}`,
        price: 100000,
        stock: 50,
        description: 'Voucher and points test product',
      },
    });
    testProductId = product.id;
 
    await prisma.$queryRaw`
      SELECT setval(
        pg_get_serial_sequence('"Topping"', 'id'),
        COALESCE((SELECT MAX("id") FROM "Topping"), 1)
      )
    `;
    const topping = await prisma.topping.create({
      data: { name: `Test topping-${Date.now()}`, price: 5000 },
    });
    testToppingId = topping.id;
 
    // Chuẩn bị Voucher giảm giá: giảm 20%, tối đa 30.000đ, 2 lượt dùng
    await prisma.promotion.upsert({
      where: { code: voucherCode },
      update: { discountPct: 20, maxDiscount: 30000, usageLimit: 2 },
      create: {
        code: voucherCode,
        discountPct: 20,
        maxDiscount: 30000,
        usageLimit: 2,
      },
    });
  });
 
  afterAll(async () => {
    if (!prisma) { await app?.close(); return; }
    if (testProductId) {
      await prisma.orderItem.deleteMany({ where: { productId: testProductId } });
      await prisma.product.deleteMany({ where: { id: testProductId } });
    }
    if (testToppingId) {
      await prisma.topping.deleteMany({ where: { id: testToppingId } });
    }
    if (testUserId) {
      const orders = await prisma.order.findMany({ where: { userId: testUserId } });
      for (const order of orders) {
        await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
        await prisma.payment.deleteMany({ where: { orderId: order.id } });
      }
      await prisma.order.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    await prisma.promotion.deleteMany({ where: { code: voucherCode } });
    await prisma.procPaymentKey.deleteMany({ where: { key: { startsWith: prefix } } });
    await app.close();
  });
 
  it('1. Áp dụng Voucher giảm giá và trừ số lượt dùng của Voucher', async () => {
    // Đơn hàng 1 món = 100.000đ. Voucher giảm 20% = 20.000đ -> Còn lại 80.000đ
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 1 }],
        voucherCode: voucherCode,
      });
 
    expect([200, 201]).toContain(response.status);
    expect(response.body.order.total).toBe(80000);
 
    // Kiểm tra Voucher bị giảm usageLimit từ 2 xuống 1
    const promo = await prisma.promotion.findUnique({ where: { code: voucherCode } });
    expect(promo?.usageLimit).toBe(1);
  });
 
  it('2. Áp dụng điểm thưởng để giảm giá và trừ điểm của User', async () => {
    // User đang có 10 điểm, dùng 5 điểm -> Giảm 5.000đ. Đơn 1 món 100.000đ -> Còn 95.000đ
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 1 }],
        pointsToUse: 5,
      });
 
    expect([200, 201]).toContain(response.status);
    expect(response.body.order.total).toBe(95000);
 
    // Kiểm tra điểm thưởng của User bị trừ từ 10 xuống 5
    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user?.rewardPoints).toBe(5);
  });
 
  it('3. Báo lỗi 400 nếu dùng số điểm thưởng vượt quá số điểm hiện có', async () => {
    // User hiện chỉ còn 5 điểm, nhưng yêu cầu dùng 20 điểm
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 1 }],
        pointsToUse: 20,
      });
 
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('không đủ điểm thưởng');
  });
 
  it('4. Thanh toán đơn hàng thành công sẽ tích lũy điểm thưởng (1 điểm / 10.000đ)', async () => {
    // Tạo đơn hàng 60.000đ
    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 1 }],
        pointsToUse: 40,
      });
    expect(orderRes.status).toBe(400);
    // Tạo đơn sạch không dùng điểm: 100.000đ
    const cleanOrderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 1 }],
      });
 
    const orderId = cleanOrderRes.body.orderId;
    const paymentKey = `${prefix}-${randomUUID()}`;
 
    // Thanh toán đơn 100.000đ -> Kỳ vọng tích 10 điểm
    const payRes = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${authToken}`)
      .set('idempotency-key', paymentKey)
      .send({
        orderId,
        amount: 100000,
        method: 'WALLET',
      });
 
    expect([200, 201]).toContain(payRes.status);
    expect(payRes.body.rewardPointsAdded).toBe(10);
 
    // Kiểm tra điểm user đã tăng thêm 10 (từ 5 ban đầu lên 15)
    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user?.rewardPoints).toBe(15);
  });
 
  it('5. Lưu tùy chọn và tính giá từ dữ liệu backend, không lấy giá client', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{
          productId: testProductId,
          quantity: 1,
          size: 'L',
          toppingIds: [testToppingId],
          note: 'Ít đá',
          price: 1,
        }],
      });
 
    expect([200, 201]).toContain(response.status);
    expect(response.body.order.total).toBe(115000);
    expect(response.body.order.items[0]).toMatchObject({
      size: 'L',
      note: 'Ít đá',
      unitPrice: 115000,
      toppings: [{ id: testToppingId, price: 5000 }],
    });
  });
 
  it('6. Từ chối size không được hỗ trợ trước khi trừ tồn kho', async () => {
    const stockBefore = (await prisma.product.findUniqueOrThrow({ where: { id: testProductId } })).stock;
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 1, size: 'XXL' }],
      });
 
    expect(response.status).toBe(400);
    expect((await prisma.product.findUnique({ where: { id: testProductId } }))?.stock).toBe(stockBefore);
  });
 
  it('7. Chỉ một request đồng thời dùng được lượt voucher cuối cùng', async () => {
    await prisma.promotion.update({
      where: { code: voucherCode },
      data: { usageLimit: 1 },
    });
    const ordersBefore = await prisma.order.count({ where: { userId: testUserId } });
    const stockBefore = (await prisma.product.findUnique({ where: { id: testProductId } }))?.stock;
 
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ productId: testProductId, quantity: 1 }], voucherCode: voucherCode }),
      request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ productId: testProductId, quantity: 1 }], voucherCode: voucherCode }),
    ]);
 
    expect(responses.filter((response) => [200, 201].includes(response.status))).toHaveLength(1);
    expect(responses.filter((response) => [400, 409].includes(response.status))).toHaveLength(1);
    expect(responses.every((response) => [200, 201, 400, 409].includes(response.status))).toBe(true);
    expect((await prisma.promotion.findUnique({ where: { code: voucherCode } }))?.usageLimit).toBe(0);
    expect(await prisma.order.count({ where: { userId: testUserId } })).toBe(ordersBefore + 1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: testProductId } })).stock).toBe(stockBefore - 1);
  });
 
  it('8. Chỉ một request đồng thời dùng được số điểm còn lại', async () => {
    await prisma.user.update({
      where: { id: testUserId },
      data: { rewardPoints: 5 },
    });
    const ordersBefore = await prisma.order.count({ where: { userId: testUserId } });
    const stockBefore = (await prisma.product.findUniqueOrThrow({ where: { id: testProductId } })).stock;
 
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ productId: testProductId, quantity: 1 }], pointsToUse: 5 }),
      request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: [{ productId: testProductId, quantity: 1 }], pointsToUse: 5 }),
    ]);
 
    expect(responses.filter((response) => [200, 201].includes(response.status))).toHaveLength(1);
    expect(responses.filter((response) => [400, 409].includes(response.status))).toHaveLength(1);
    expect(responses.every((response) => [200, 201, 400, 409].includes(response.status))).toBe(true);
    expect((await prisma.user.findUnique({ where: { id: testUserId } }))?.rewardPoints).toBe(0);
    expect(await prisma.order.count({ where: { userId: testUserId } })).toBe(ordersBefore + 1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: testProductId } })).stock).toBe(stockBefore - 1);
  });
});

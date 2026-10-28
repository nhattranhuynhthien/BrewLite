import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Voucher & Loyalty Points (Integration Test - Task 10.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let testUserId: number;
  let testProductId: number;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Chuẩn bị User test có sẵn 10 điểm thưởng
    let user = await prisma.user.findFirst({ where: { email: 'test_voucher_loyalty@brewlite.vn' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test_voucher_loyalty@brewlite.vn',
          name: 'Test Voucher Loyalty User',
          password: 'hashed_password_123',
          rewardPoints: 10, // 10 điểm thưởng
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { rewardPoints: 10 },
      });
    }
    testUserId = user.id;

    authToken = await jwtService.signAsync(
      { sub: testUserId, email: user.email },
      { secret: 'BREWLITE_SECRET_KEY_2026' },
    );

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

    // Chuẩn bị Voucher giảm giá: giảm 20%, tối đa 30.000đ, 2 lượt dùng
    await prisma.promotion.upsert({
      where: { code: 'TESTGIAM20' },
      update: { discountPct: 20, maxDiscount: 30000, usageLimit: 2 },
      create: {
        code: 'TESTGIAM20',
        discountPct: 20,
        maxDiscount: 30000,
        usageLimit: 2,
      },
    });
  });

  afterAll(async () => {
    if (testProductId) {
      await prisma.orderItem.deleteMany({ where: { productId: testProductId } });
      await prisma.product.deleteMany({ where: { id: testProductId } });
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
    await prisma.promotion.deleteMany({ where: { code: 'TESTGIAM20' } });
    await prisma.procPaymentKey.deleteMany({ where: { key: { startsWith: 'test-loyalty-' } } });
    await app.close();
  });

  it('1. Áp dụng Voucher giảm giá và trừ số lượt dùng của Voucher', async () => {
    // Đơn hàng 1 món = 100.000đ. Voucher giảm 20% = 20.000đ -> Còn lại 80.000đ
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 1 }],
        voucherCode: 'TESTGIAM20',
      });

    expect([200, 201]).toContain(response.status);
    expect(response.body.order.total).toBe(80000);

    // Kiểm tra Voucher bị giảm usageLimit từ 2 xuống 1
    const promo = await prisma.promotion.findUnique({ where: { code: 'TESTGIAM20' } });
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
        pointsToUse: 40, // Dùng 40 điểm (vượt quá) -> Nên không dùng điểm để tổng là 100k
      });
    // Tạo đơn sạch không dùng điểm: 100.000đ
    const cleanOrderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 1 }],
      });

    const orderId = cleanOrderRes.body.orderId;
    const paymentKey = `test-loyalty-${Date.now()}`;

    // Thanh toán đơn 100.000đ -> Kỳ vọng tích 10 điểm
    const payRes = await request(app.getHttpServer())
      .post('/payments')
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
});

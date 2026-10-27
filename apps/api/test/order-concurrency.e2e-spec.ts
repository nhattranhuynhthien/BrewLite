import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Order Concurrency & Stock Locking (Integration Test - Task 10.3)', () => {
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
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

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
    authToken = await jwtService.signAsync(
      { sub: testUserId, email: user.email },
      { secret: 'BREWLITE_SECRET_KEY_2026' },
    );

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
});


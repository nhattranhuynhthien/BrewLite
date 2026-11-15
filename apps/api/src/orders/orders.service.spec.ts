import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from './order-status';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  const prisma = {
    product: {
      findMany: jest.fn(),
    },
    topping: {
      findMany: jest.fn(),
    },
    promotion: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects an invalid state transition without updating the order', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 1,
      status: OrderStatus.PENDING,
    });

    await expect(
      service.update(1, { status: OrderStatus.PREPARING }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('updates an order through an allowed state transition', async () => {
    const updatedOrder = { id: 1, status: OrderStatus.PAID };
    prisma.order.findUnique
      .mockResolvedValueOnce({ id: 1, status: OrderStatus.PENDING })
      .mockResolvedValueOnce(updatedOrder);

    await expect(
      service.update(1, { status: OrderStatus.PAID }),
    ).resolves.toBe(updatedOrder);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: OrderStatus.PENDING },
      data: { status: OrderStatus.PAID },
    });
  });

  it('does not overwrite a status changed by a concurrent update', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 1,
      status: OrderStatus.PENDING,
    });
    prisma.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update(1, { status: OrderStatus.PAID }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.order.findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns only the authenticated user’s orders, newest first', async () => {
    prisma.order.findMany.mockResolvedValue([]);

    await service.findByUser(42);

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { userId: 42 },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true } },
        payment: true,
      },
    });
  });

  it('only returns order details when the authenticated user owns the order', async () => {
    const order = { id: 7, userId: 42, items: [], payment: [] };
    prisma.order.findFirst.mockResolvedValue(order);

    await expect(service.findForUser(7, 42)).resolves.toBe(order);
    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { id: 7, userId: 42 },
      include: {
        items: { include: { product: true } },
        payment: true,
      },
    });
  });

  it('does not expose another user’s order', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(service.findForUser(7, 12)).rejects.toThrow('Không tìm thấy đơn hàng 7');
  });

  it('quotes non-GIAM10 voucher discounts and caps points from server data', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'Cà phê sữa', price: 35001, stock: 5, isAvailable: true },
    ]);
    prisma.topping.findMany.mockResolvedValue([{ id: 3, name: 'Thạch', price: 5000 }]);
    prisma.promotion.findUnique.mockResolvedValue(null);
    prisma.promotion.findFirst.mockResolvedValue({
      id: 9,
      code: 'VIP20',
      discountPct: 20,
      maxDiscount: 50000,
      usageLimit: 4,
    });

    const result = await service.quote({
      items: [{ productId: 1, quantity: 2, size: 'M', toppingIds: [3] }],
      voucherCode: 'vip20',
      pointsToUse: 500,
    });

    // (35001 + 5000 + 5000) * 2 = 90002; 20% = round(18000.4) = 18000; after voucher = 72002; max points = 72
    expect(result).toEqual({
      subtotal: 90002,
      voucherCode: 'VIP20',
      voucherDiscount: 18000,
      voucher: { code: 'VIP20', discountPct: 20, maxDiscount: 50000 },
      totalAfterVoucher: 72002,
      pointsToUse: 72,
      pointsDiscount: 72000,
      total: 2,
      earnedPoints: 0,
    });
  });

  it('rejects quote when cumulative quantity across variants exceeds product stock', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'Trà đào', price: 45000, stock: 2, isAvailable: true },
    ]);

    await expect(
      service.quote({
        items: [
          { productId: 1, quantity: 1, size: 'M' },
          { productId: 1, quantity: 2, size: 'L' },
        ],
      }),
    ).rejects.toThrow('Chỉ còn lại 2 sản phẩm');
  });

  it('rejects quote when voucher is missing or exhausted', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 1, name: 'Trà đào', price: 45000, stock: 5, isAvailable: true },
    ]);
    prisma.promotion.findUnique.mockResolvedValue({
      id: 1,
      code: 'HETLUOT',
      discountPct: 10,
      maxDiscount: 50000,
      usageLimit: 0,
    });

    await expect(
      service.quote({
        items: [{ productId: 1, quantity: 1 }],
        voucherCode: 'HETLUOT',
      }),
    ).rejects.toThrow('Mã giảm giá không hợp lệ hoặc đã hết hạn!');
  });
});

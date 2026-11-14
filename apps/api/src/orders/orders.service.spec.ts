import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from './order-status';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  const prisma = {
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
});

import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from './order-status';
import { BadRequestException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  const prisma = {
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
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
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('updates an order through an allowed state transition', async () => {
    const updatedOrder = { id: 1, status: OrderStatus.PAID };
    prisma.order.findUnique.mockResolvedValue({
      id: 1,
      status: OrderStatus.PENDING,
    });
    prisma.order.update.mockResolvedValue(updatedOrder);

    await expect(
      service.update(1, { status: OrderStatus.PAID }),
    ).resolves.toBe(updatedOrder);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: OrderStatus.PAID },
    });
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
});

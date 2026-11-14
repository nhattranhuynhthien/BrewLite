import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService.cancel', () => {
  const order = {
    id: 7,
    userId: 42,
    status: 'PENDING',
    total: 50000,
    items: [{ productId: 3, quantity: 2 }],
    payment: [],
  };
  let service: OrdersService;
  let tx: {
    order: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    product: { update: jest.Mock };
    payment: { updateMany: jest.Mock };
    user: { updateMany: jest.Mock; update: jest.Mock };
    promotion: { update: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      order: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...order, items: [...order.items] }),
        findUnique: jest.fn().mockImplementation(({ where }) => ({
          ...order,
          id: where.id,
          status: 'CANCELLED',
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      product: { update: jest.fn().mockResolvedValue({}) },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({}) },
      promotion: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  it('cancels a pending order and restores product stock', async () => {
    await expect(service.cancel(7, 42)).resolves.toMatchObject({
      id: 7,
      status: 'CANCELLED',
    });

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 7, userId: 42, status: 'PENDING', paymentAttemptKey: null },
      data: { status: 'CANCELLED' },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { stock: { increment: 2 }, version: { increment: 1 } },
    });
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it('marks a paid order payment as refunded', async () => {
    tx.order.findFirst.mockResolvedValue({
      ...order,
      status: 'PAID',
      payment: [{ status: 'PAID' }],
    });

    await service.cancel(7, 42);

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { orderId: 7, status: 'PAID' },
      data: { status: 'REFUNDED', paidOrderId: null },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 42, rewardPoints: { gte: 5 } },
      data: { rewardPoints: { decrement: 5 } },
    });
  });

  it('rejects cancellation if earned points have already been spent', async () => {
    tx.order.findFirst.mockResolvedValue({ ...order, status: 'PAID' });
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.cancel(7, 42)).rejects.toThrow(ConflictException);
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it('restores reserved voucher and spent points when cancelling', async () => {
    tx.order.findFirst.mockResolvedValue({ ...order, promotionId: 5, pointsUsed: 12 });
    await service.cancel(7, 42);
    expect(tx.promotion.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { usageLimit: { increment: 1 } } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 42 }, data: { rewardPoints: { increment: 12 } } });
  });

  it('does not cancel an order belonging to another user', async () => {
    tx.order.findFirst.mockResolvedValue(null);

    await expect(service.cancel(7, 99)).rejects.toThrow(NotFoundException);
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('rejects orders that are no longer cancellable', async () => {
    tx.order.findFirst.mockResolvedValue({ ...order, status: 'PREPARING' });

    await expect(service.cancel(7, 42)).rejects.toThrow(BadRequestException);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('does not restore stock if another request changed the order status', async () => {
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.cancel(7, 42)).rejects.toThrow(ConflictException);
    expect(tx.product.update).not.toHaveBeenCalled();
  });
});

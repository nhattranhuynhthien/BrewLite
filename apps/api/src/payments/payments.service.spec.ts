import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentGateway, MockPaymentGateway } from './payment.gateway';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const gateway = new MockPaymentGateway();
  const paymentKeys = new Map<string, { key: string; response: string }>();
  let currentOrderStatus = 'PENDING';
  const prisma = {
    order: { findUnique: jest.fn(), updateMany: jest.fn() },
    payment: { findFirst: jest.fn(), create: jest.fn() },
    user: { update: jest.fn() },
    procPaymentKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    paymentKeys.clear();
    gateway.success = true;
    currentOrderStatus = 'PENDING';
    prisma.order.findUnique.mockImplementation(() =>
      Promise.resolve({
        id: 5,
        userId: 12,
        total: 25000,
        status: currentOrderStatus,
      }),
    );
    prisma.procPaymentKey.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(paymentKeys.get(where.key) ?? null),
    );
    prisma.procPaymentKey.create.mockImplementation(async ({ data }) => {
      const record = { key: data.key, response: data.response };
      paymentKeys.set(data.key, record);
      return record;
    });
    prisma.procPaymentKey.updateMany.mockImplementation(
      async ({ where, data }) => {
        const record = paymentKeys.get(where.key);
        if (!record || record.response !== where.response) return { count: 0 };
        record.response = data.response;
        return { count: 1 };
      },
    );
    prisma.procPaymentKey.update.mockImplementation(async ({ where, data }) => {
      const record = paymentKeys.get(where.key);
      if (!record) throw new Error('Payment key not found');
      record.response = data.response;
      return record;
    });
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockImplementation(async ({ data }) => data);
    prisma.order.updateMany.mockImplementation(async ({ where, data }) => {
      if (where.status !== currentOrderStatus) return { count: 0 };
      currentOrderStatus = data.status;
      return { count: 1 };
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('does not allow paying another account’s order', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 5,
      userId: 99,
      total: 25000,
    });

    await expect(
      service.create({ orderId: 5, method: 'WALLET' }, 'key', 12),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.procPaymentKey.findUnique).not.toHaveBeenCalled();
  });

  it('marks order PAID and adds reward points when gateway succeeds', async () => {
    const res = await service.create(
      { orderId: 5, method: 'WALLET' },
      'key',
      12,
    );

    expect(res.status).toBe('PAID');
    expect(res.orderStatus).toBe('PAID');
    expect(res.rewardPointsAdded).toBe(2);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('marks order PAYMENT_FAILED and adds no points when gateway fails', async () => {
    gateway.success = false;

    const res = await service.create(
      { orderId: 5, method: 'WALLET' },
      'key',
      12,
    );

    expect(res.status).toBe('FAILED');
    expect(res.orderStatus).toBe('PAYMENT_FAILED');
    expect(res.rewardPointsAdded).toBe(0);
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 5, status: 'PENDING' },
      data: { status: 'PAYMENT_FAILED' },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows retry with a new key after a failure', async () => {
    gateway.success = false;
    await service.create({ orderId: 5, method: 'WALLET' }, 'key-1', 12);

    gateway.success = true;
    const res = await service.create(
      { orderId: 5, method: 'WALLET' },
      'key-2',
      12,
    );

    expect(res.status).toBe('PAID');
    expect(prisma.order.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 5, status: 'PAYMENT_FAILED' },
      data: { status: 'PENDING' },
    });
    expect(prisma.order.updateMany).toHaveBeenNthCalledWith(3, {
      where: { id: 5, status: 'PENDING' },
      data: { status: 'PAID' },
    });
  });

  it.each([
    'CANCELLED',
    'COMPLETED',
    'PREPARING',
    'READY',
    'PAID',
    'UNKNOWN',
  ])(
    'rejects payment for an order in %s without changing payment or reward data',
    async (status) => {
      currentOrderStatus = status;
      const charge = jest.spyOn(gateway, 'charge');

      await expect(
        service.create({ orderId: 5, method: 'WALLET' }, `key-${status}`, 12),
      ).rejects.toThrow(BadRequestException);

      expect(charge).not.toHaveBeenCalled();
      expect(prisma.procPaymentKey.create).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(currentOrderStatus).toBe(status);
    },
  );

  it('does not write payment or points if the order changes during payment', async () => {
    const charge = jest.spyOn(gateway, 'charge').mockImplementation(async () => {
      currentOrderStatus = 'CANCELLED';
      return { success: true };
    });

    await expect(
      service.create({ orderId: 5, method: 'WALLET' }, 'concurrent-key', 12),
    ).rejects.toThrow(ConflictException);

    expect(charge).toHaveBeenCalledTimes(1);
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('replays an unresolved gateway request with the same key', async () => {
    const charge = jest
      .spyOn(gateway, 'charge')
      .mockRejectedValueOnce(new Error('Gateway response timed out'))
      .mockResolvedValueOnce({ success: true });

    await expect(
      service.create({ orderId: 5, method: 'WALLET' }, 'uncertain-key', 12),
    ).rejects.toThrow('Gateway response timed out');

    expect(paymentKeys.get('uncertain-key')?.response).toContain(
      '"status":"PROCESSING"',
    );

    const result = await service.create(
      { orderId: 5, method: 'WALLET' },
      'uncertain-key',
      12,
    );

    expect(result.status).toBe('PAID');
    expect(result.fromCache).toBe(true);
    expect(charge).toHaveBeenNthCalledWith(
      1,
      5,
      25000,
      'WALLET',
      'uncertain-key',
    );
    expect(charge).toHaveBeenNthCalledWith(
      2,
      5,
      25000,
      'WALLET',
      'uncertain-key',
    );
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
  });

  it('replays a confirmed failure for the same key and accepts a new key for a new attempt', async () => {
    gateway.success = false;
    const failedResult = await service.create(
      { orderId: 5, method: 'WALLET' },
      'failed-key',
      12,
    );
    const charge = jest.spyOn(gateway, 'charge');

    const replay = await service.create(
      { orderId: 5, method: 'WALLET' },
      'failed-key',
      12,
    );
    expect(replay).toMatchObject({ fromCache: true, status: 'FAILED' });
    expect(charge).not.toHaveBeenCalled();

    gateway.success = true;
    const retry = await service.create(
      { orderId: 5, method: 'WALLET' },
      'new-attempt-key',
      12,
    );
    expect(failedResult.status).toBe('FAILED');
    expect(retry.status).toBe('PAID');
    expect(prisma.payment.create).toHaveBeenCalledTimes(2);
  });

  it('rejects reusing a key for another order or payment method', async () => {
    await service.create({ orderId: 5, method: 'WALLET' }, 'bound-key', 12);

    await expect(
      service.create({ orderId: 5, method: 'CARD' }, 'bound-key', 12),
    ).rejects.toThrow(ConflictException);
  });

  it('does not create a processing key for an already paid order', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 1,
      orderId: 5,
      status: 'PAID',
    });

    await expect(
      service.create({ orderId: 5, method: 'WALLET' }, 'new-key', 12),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.procPaymentKey.create).not.toHaveBeenCalled();
  });
});

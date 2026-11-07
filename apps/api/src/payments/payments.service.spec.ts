import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { PaymentGateway, MockPaymentGateway } from './payment.gateway';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const gateway = new MockPaymentGateway();
  const prisma = {
    order: { findUnique: jest.fn(), update: jest.fn() },
    payment: { findFirst: jest.fn(), create: jest.fn() },
    user: { update: jest.fn() },
    procPaymentKey: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    gateway.success = true;
    prisma.order.findUnique.mockResolvedValue({ id: 5, userId: 12, total: 25000 });
    prisma.procPaymentKey.findUnique.mockResolvedValue(null);
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockImplementation(async ({ data }) => data);
    prisma.order.update.mockImplementation(async ({ data }) => ({ id: 5, ...data }));

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
    prisma.order.findUnique.mockResolvedValue({ id: 5, userId: 99, total: 25000 });

    await expect(
      service.create({ orderId: 5, method: 'WALLET' }, 'key', 12),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.procPaymentKey.findUnique).not.toHaveBeenCalled();
  });

  it('marks order PAID and adds reward points when gateway succeeds', async () => {
    const res = await service.create({ orderId: 5, method: 'WALLET' }, 'key', 12);

    expect(res.status).toBe('PAID');
    expect(res.orderStatus).toBe('PAID');
    expect(res.rewardPointsAdded).toBe(2);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('marks order PAYMENT_FAILED and adds no points when gateway fails', async () => {
    gateway.success = false;

    const res = await service.create({ orderId: 5, method: 'WALLET' }, 'key', 12);

    expect(res.status).toBe('FAILED');
    expect(res.orderStatus).toBe('PAYMENT_FAILED');
    expect(res.rewardPointsAdded).toBe(0);
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: 'PAYMENT_FAILED' },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows retry with a new key after a failure', async () => {
    gateway.success = false;
    await service.create({ orderId: 5, method: 'WALLET' }, 'key-1', 12);

    gateway.success = true;
    const res = await service.create({ orderId: 5, method: 'WALLET' }, 'key-2', 12);

    expect(res.status).toBe('PAID');
  });
});

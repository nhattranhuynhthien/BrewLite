import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const prisma = {
    order: { findUnique: jest.fn() },
    procPaymentKey: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentsService, { provide: PrismaService, useValue: prisma }],
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
});

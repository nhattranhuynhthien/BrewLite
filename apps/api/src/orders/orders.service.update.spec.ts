import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrdersService.update (quy tắc trạng thái + đồng thời)', () => {
  let service: OrdersService;
  let orders: Map<number, any>;
  let afterRead: (() => void) | undefined;

  beforeEach(async () => {
    orders = new Map([[1, { id: 1, userId: 3, total: 25000, status: 'PENDING' }]]);
    afterRead = undefined;

    const tx: any = {
      order: {
        findUnique: async ({ where }: any) => {
          const o = orders.get(where.id);
          const copy = o ? { ...o } : null;
          afterRead?.(); // giả lập luồng khác đổi trạng thái sau khi ta đã đọc
          return copy;
        },
        updateMany: async ({ where, data }: any) => {
          const o = orders.get(where.id);
          if (!o || (where.status !== undefined && o.status !== where.status)) return { count: 0 };
          Object.assign(o, data);
          return { count: 1 };
        },
      },
    };
    const prisma: any = { $transaction: async (cb: any) => cb(tx) };

    const moduleRef = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  it('chuyển hợp lệ PAID -> PREPARING', async () => {
    orders.get(1).status = 'PAID';
    const res = await service.update(1, { status: 'PREPARING' } as any);
    expect(res?.status).toBe('PREPARING');
  });

  it.each([
    ['PAID', 'COMPLETED'],
    ['PREPARING', 'PAID'],
    ['COMPLETED', 'PENDING'],
    ['CANCELLED', 'PAID'],
    ['PENDING', 'READY'],
  ])('chuyển sai %s -> %s bị chặn và không đổi dữ liệu', async (from, to) => {
    orders.get(1).status = from;
    await expect(service.update(1, { status: to } as any)).rejects.toThrow(BadRequestException);
    expect(orders.get(1).status).toBe(from);
  });

  it('trạng thái lạ bị chặn', async () => {
    await expect(service.update(1, { status: 'SHIPPED' } as any)).rejects.toThrow(BadRequestException);
    expect(orders.get(1).status).toBe('PENDING');
  });

  it('thiếu status => 400; không có đơn => 404', async () => {
    await expect(service.update(1, {} as any)).rejects.toThrow(BadRequestException);
    await expect(service.update(99, { status: 'PAID' } as any)).rejects.toThrow(NotFoundException);
  });

  it('trạng thái bị đổi giữa lúc đọc và ghi => 409, không ghi đè', async () => {
    afterRead = () => {
      orders.get(1).status = 'CANCELLED'; // luồng khác huỷ đơn ngay sau khi ta đọc PENDING
    };

    await expect(service.update(1, { status: 'PAID' } as any)).rejects.toThrow(ConflictException);
    expect(orders.get(1).status).toBe('CANCELLED');
  });
});

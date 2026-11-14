import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGateway, MockPaymentGateway } from './payment.gateway';
import { OrderStatus } from '../orders/order-status';

/**
 * Prisma giả có trạng thái trong bộ nhớ. $transaction chụp lại dữ liệu và
 * khôi phục nếu callback ném lỗi, nên test kiểm tra được "lỗi thì không đổi gì".
 */
function createFakePrisma() {
  const db = {
    orders: new Map<number, any>(),
    users: new Map<number, any>(),
    payments: [] as any[],
    keys: new Map<string, any>(),
    nextPaymentId: 1,
  };

  const client: any = {
    order: {
      findUnique: async ({ where }: any) => {
        const o = db.orders.get(where.id);
        return o ? { ...o } : null;
      },
      updateMany: async ({ where, data }: any) => {
        const o = db.orders.get(where.id);
        if (!o || (where.status !== undefined && o.status !== where.status) || (where.OR && o.paymentAttemptKey != null && o.paymentAttemptKey !== data.paymentAttemptKey)) {
          return { count: 0 };
        }
        Object.assign(o, data);
        return { count: 1 };
      },
    },
    payment: {
      findFirst: async ({ where }: any) =>
        db.payments.find(
          (p) => p.orderId === where.orderId && p.status === where.status,
        ) ?? null,
      create: async ({ data }: any) => {
        const row = { id: db.nextPaymentId++, ...data };
        db.payments.push(row);
        return { ...row };
      },
    },
    user: {
      update: async ({ where, data }: any) => {
        const u = db.users.get(where.id);
        u.rewardPoints += data.rewardPoints.increment;
        return { ...u };
      },
    },
    procPaymentKey: {
      findUnique: async ({ where }: any) => {
        const k = db.keys.get(where.key);
        return k ? { ...k } : null;
      },
      create: async ({ data }: any) => {
        if (db.keys.has(data.key)) {
          throw new Prisma.PrismaClientKnownRequestError('dup', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        db.keys.set(data.key, { ...data });
        return { ...data };
      },
      updateMany: async ({ where, data }: any) => {
        const k = db.keys.get(where.key);
        if (!k || k.response !== where.response) return { count: 0 };
        Object.assign(k, data);
        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        const k = db.keys.get(where.key);
        Object.assign(k, data);
        return { ...k };
      },
    },
    $transaction: async (cb: (tx: any) => Promise<unknown>) => {
      const snapshot = {
        orders: structuredClone(db.orders),
        users: structuredClone(db.users),
        payments: structuredClone(db.payments),
        keys: structuredClone(db.keys),
        nextPaymentId: db.nextPaymentId,
      };
      try {
        return await cb(client);
      } catch (e) {
        db.orders = snapshot.orders;
        db.users = snapshot.users;
        db.payments = snapshot.payments;
        db.keys = snapshot.keys;
        db.nextPaymentId = snapshot.nextPaymentId;
        throw e;
      }
    },
  };

  return { db, client };
}

describe('PaymentsService (trạng thái đơn + payment)', () => {
  let service: PaymentsService;
  let fake: ReturnType<typeof createFakePrisma>;
  let gateway: MockPaymentGateway;
  const USER = 12;
  const ORDER = 5;
  const TOTAL = 25000; // => 2 điểm

  const seedOrder = (status: string) =>
    fake.db.orders.set(ORDER, { id: ORDER, userId: USER, total: TOTAL, status });
  const pay = (key: string | undefined = 'k1', method = 'MOMO') =>
    service.create({ orderId: ORDER, method }, key, USER);
  const points = () => fake.db.users.get(USER).rewardPoints;
  const orderStatus = () => fake.db.orders.get(ORDER).status;

  beforeEach(async () => {
    fake = createFakePrisma();
    gateway = new MockPaymentGateway();
    fake.db.users.set(USER, { id: USER, rewardPoints: 100 });
    seedOrder(OrderStatus.PENDING);

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: fake.client },
        { provide: PaymentGateway, useValue: gateway },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
  });

  describe('luồng hợp lệ', () => {
    it('PENDING + gateway OK => PAID, cộng điểm, gửi idempotency key cho gateway', async () => {
      const res = await pay('k1');

      expect(res).toMatchObject({
        fromCache: false,
        status: 'PAID',
        orderStatus: 'PAID',
        rewardPointsAdded: 2,
      });
      expect(orderStatus()).toBe('PAID');
      expect(points()).toBe(102);
      expect(fake.db.payments).toHaveLength(1);
      expect(gateway.calls).toEqual([
        { orderId: ORDER, amount: TOTAL, method: 'MOMO', idempotencyKey: 'k1' },
      ]);
    });

    it('PENDING + gateway từ chối => PAYMENT_FAILED, không cộng điểm', async () => {
      gateway.success = false;
      const res = await pay('k1');

      expect(res).toMatchObject({ status: 'FAILED', orderStatus: 'PAYMENT_FAILED', rewardPointsAdded: 0 });
      expect(orderStatus()).toBe('PAYMENT_FAILED');
      expect(points()).toBe(100);
      expect(fake.db.payments.map((p) => p.status)).toEqual(['FAILED']);
    });

    it('retry từ PAYMENT_FAILED (key mới) đi PAYMENT_FAILED -> PENDING -> PAID', async () => {
      gateway.success = false;
      await pay('k1');
      gateway.success = true;
      const res = await pay('k2');

      expect(res).toMatchObject({ fromCache: false, status: 'PAID' });
      expect(orderStatus()).toBe('PAID');
      expect(points()).toBe(102);
      expect(fake.db.payments.map((p) => p.status)).toEqual(['FAILED', 'PAID']);
    });

    it('retry thất bại tiếp vẫn về PAYMENT_FAILED, không cộng điểm', async () => {
      gateway.success = false;
      await pay('k1');
      await pay('k2');

      expect(orderStatus()).toBe('PAYMENT_FAILED');
      expect(points()).toBe(100);
      expect(fake.db.payments.map((p) => p.status)).toEqual(['FAILED', 'FAILED']);
    });
  });

  describe('chặn trạng thái không cho phép', () => {
    it.each(['PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'])(
      'đơn %s bị từ chối: không đổi order/payment/điểm, không gọi gateway, không tạo key',
      async (status) => {
        seedOrder(status);

        await expect(pay('k1')).rejects.toThrow(BadRequestException);

        expect(orderStatus()).toBe(status);
        expect(fake.db.payments).toHaveLength(0);
        expect(points()).toBe(100);
        expect(gateway.calls).toHaveLength(0);
        expect(fake.db.keys.size).toBe(0);
      },
    );

    it('đơn PENDING nhưng đã có payment PAID (dữ liệu lệch) bị chặn', async () => {
      fake.db.payments.push({ id: 99, orderId: ORDER, status: 'PAID' });

      await expect(pay('k1')).rejects.toThrow(/đã được thanh toán/);
      expect(gateway.calls).toHaveLength(0);
      expect(points()).toBe(100);
    });

    it('đơn của người khác => 404, không gọi gateway', async () => {
      fake.db.orders.get(ORDER).userId = 999;

      await expect(pay('k1')).rejects.toThrow(NotFoundException);
      expect(gateway.calls).toHaveLength(0);
    });

    it('thiếu Idempotency-Key => 400', async () => {
      await expect(
        service.create({ orderId: ORDER, method: 'MOMO' }, undefined, USER),
      ).rejects.toThrow(BadRequestException);
      expect(gateway.calls).toHaveLength(0);
    });
  });

  describe('idempotency', () => {
    it('gửi lại cùng key => fromCache, gateway/payment/điểm không đổi', async () => {
      await pay('k1');
      const again = await pay('k1');

      expect(again).toMatchObject({ fromCache: true, status: 'PAID', rewardPointsAdded: 2 });
      expect(gateway.calls).toHaveLength(1);
      expect(fake.db.payments).toHaveLength(1);
      expect(points()).toBe(102);
    });

    it('replay cùng key vẫn trả kết quả cũ dù đơn đã sang PREPARING', async () => {
      await pay('k1');
      fake.db.orders.get(ORDER).status = 'PREPARING';

      const again = await pay('k1');

      expect(again).toMatchObject({ fromCache: true, status: 'PAID' });
      expect(orderStatus()).toBe('PREPARING');
    });

    it('replay kết quả thất bại cũng trả lại FAILED, không thử lại gateway', async () => {
      gateway.success = false;
      await pay('k1');
      gateway.success = true;

      const again = await pay('k1');

      expect(again).toMatchObject({ fromCache: true, status: 'FAILED' });
      expect(gateway.calls).toHaveLength(1);
    });

    it('cùng key nhưng đơn khác => 409', async () => {
      await pay('k1');
      fake.db.orders.set(6, { id: 6, userId: USER, total: TOTAL, status: 'PENDING' });

      await expect(
        service.create({ orderId: 6, method: 'MOMO' }, 'k1', USER),
      ).rejects.toThrow(ConflictException);
    });

    it('cùng key nhưng đổi method => 409', async () => {
      await pay('k1', 'MOMO');
      await expect(pay('k1', 'WALLET')).rejects.toThrow(ConflictException);
    });

    it('kết quả cũ (định dạng trước khi có PROCESSING) vẫn replay được', async () => {
      fake.db.keys.set('old', {
        key: 'old',
        response: JSON.stringify({
          status: 'PAID',
          payment: { orderId: ORDER, method: 'MOMO' },
          rewardPointsAdded: 2,
        }),
      });

      const res = await pay('old', 'MOMO');
      expect(res).toMatchObject({ fromCache: true, status: 'PAID' });
      expect(gateway.calls).toHaveLength(0);
    });
  });

  describe('lỗi giữa chừng', () => {
    it('gateway lỗi mạng => key còn PROCESSING; gọi lại cùng key hoàn tất đúng một lần', async () => {
      const original = gateway.charge.bind(gateway);
      let first = true;
      gateway.charge = async (...args: Parameters<typeof original>) => {
        if (first) {
          first = false;
          throw new Error('network');
        }
        return original(...args);
      };

      await expect(pay('k1')).rejects.toThrow('network');
      expect(JSON.parse(fake.db.keys.get('k1').response).status).toBe('PROCESSING');
      expect(orderStatus()).toBe('PENDING');
      expect(fake.db.payments).toHaveLength(0);

      const res = await pay('k1');

      expect(res).toMatchObject({ status: 'PAID' });
      expect(fake.db.payments).toHaveLength(1);
      expect(points()).toBe(102);
    });

    it('đơn bị huỷ trong lúc gọi gateway => 409, không đổi order/payment/điểm', async () => {
      gateway.onCharge = () => {
        fake.db.orders.get(ORDER).status = 'CANCELLED';
      };

      await expect(pay('k1')).rejects.toThrow(ConflictException);

      expect(orderStatus()).toBe('CANCELLED');
      expect(fake.db.payments).toHaveLength(0);
      expect(points()).toBe(100);
    });
  });
});

import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { assertTestDatabase, signTestToken } from './test-utils';

describe('Cancellation reservations and operator lifecycle (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let userId: number;
  let productId: number;
  let token: string;
  const prefix = `cancel-${randomUUID()}`;
  const code = `${prefix}-voucher`;
  const oldOperators = process.env.ORDER_OPERATOR_USER_IDS;

  beforeAll(async () => {
    assertTestDatabase();
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    db = app.get(PrismaService);
    const user = await db.user.create({ data: { email: `${prefix}@test.local`, password: 'test', rewardPoints: 100 } });
    userId = user.id;
    token = await signTestToken(app, user);
    productId = (await db.product.create({ data: { name: prefix, price: 50000, stock: 50 } })).id;
    await db.promotion.create({ data: { code, discountPct: 10, maxDiscount: 50000, usageLimit: 10 } });
    process.env.ORDER_OPERATOR_USER_IDS = String(userId);
  });

  afterAll(async () => {
    if (db && userId) {
      await db.payment.deleteMany({ where: { order: { userId } } });
      await db.orderItem.deleteMany({ where: { order: { userId } } });
      await db.order.deleteMany({ where: { userId } });
      await db.procPaymentKey.deleteMany({ where: { key: { startsWith: prefix } } });
      await db.promotion.deleteMany({ where: { code } });
      await db.product.deleteMany({ where: { id: productId } });
      await db.user.delete({ where: { id: userId } });
    }
    if (oldOperators === undefined) delete process.env.ORDER_OPERATOR_USER_IDS;
    else process.env.ORDER_OPERATOR_USER_IDS = oldOperators;
    await app?.close();
  });

  const key = () => `${prefix}-${randomUUID()}`;
  const create = () => request(app.getHttpServer()).post('/orders')
    .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key())
    .send({ items: [{ productId, quantity: 1 }], voucherCode: code, pointsToUse: 5 });
  const cancel = (id: number) => request(app.getHttpServer()).patch(`/orders/${id}/cancel`).set('Authorization', `Bearer ${token}`);
  const pay = (id: number, paymentKey: string) => request(app.getHttpServer()).post('/payments')
    .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', paymentKey)
    .send({ orderId: id, amount: 40000, method: 'WALLET' });
  const balances = async () => ({
    stock: (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock,
    points: (await db.user.findUniqueOrThrow({ where: { id: userId } })).rewardPoints,
    vouchers: (await db.promotion.findUniqueOrThrow({ where: { code } })).usageLimit,
  });

  it('concurrent cancellation restores stock, consumed points and voucher exactly once', async () => {
    const before = await balances();
    const created = await create().expect(201);
    expect(created.body.order.pointsUsed).toBe(5);
    expect(created.body.order.promotionId).toEqual(expect.any(Number));
    expect(await balances()).toEqual({ stock: before.stock - 1, points: before.points - 5, vouchers: before.vouchers - 1 });
    const responses = await Promise.all([cancel(created.body.orderId), cancel(created.body.orderId)]);
    expect(responses.filter(response => response.status === 200)).toHaveLength(1);
    expect(responses.every(response => [200, 400, 409].includes(response.status))).toBe(true);
    expect(await balances()).toEqual(before);
  });

  it('paid cancellation reverses rewards, refunds in the mock ledger and rejects stale payment replay', async () => {
    const before = await balances();
    const created = await create().expect(201);
    const paymentKey = key();
    await pay(created.body.orderId, paymentKey).expect(201);
    await cancel(created.body.orderId).expect(200);
    expect(await balances()).toEqual(before);
    const payment = await db.payment.findFirstOrThrow({ where: { orderId: created.body.orderId } });
    expect(payment.status).toBe('REFUNDED');
    expect(payment.paidOrderId).toBeNull();
    await pay(created.body.orderId, paymentKey).expect(400);
    await cancel(created.body.orderId).expect(400);
    expect(await balances()).toEqual(before);
  });

  it('an unknown gateway outcome keeps the reservation and blocks cancellation', async () => {
    const created = await create().expect(201);
    await db.order.update({ where: { id: created.body.orderId }, data: { paymentAttemptKey: key() } });
    const reserved = await balances();
    await cancel(created.body.orderId).expect(409);
    expect(await balances()).toEqual(reserved);
  });

  it('advances a paid order through the protected preparation API', async () => {
    const created = await create().expect(201);
    await pay(created.body.orderId, key()).expect(201);
    for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
      const response = await request(app.getHttpServer()).patch(`/orders/${created.body.orderId}/status`)
        .set('Authorization', `Bearer ${token}`).send({ status }).expect(200);
      expect(response.body.status).toBe(status);
    }
    await cancel(created.body.orderId).expect(400);
  });
});

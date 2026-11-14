import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentGateway, MockPaymentGateway } from '../src/payments/payment.gateway';
import { PaymentsService } from '../src/payments/payments.service';
import { assertTestDatabase, signTestToken } from './test-utils';

describe('Audit regressions: payment, validation and stock', () => {
  let app: INestApplication;
  let db: PrismaService;
  let gateway: MockPaymentGateway;
  let token: string;
  let userId: number;
  let productId: number;
  const prefix = `regression-${randomUUID()}`;
  const authEmails: string[] = [];
  const voucher = `${prefix}-3`;

  beforeAll(async () => {
    assertTestDatabase();
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    db = app.get(PrismaService);
    gateway = app.get(PaymentGateway) as MockPaymentGateway;
    const user = await db.user.create({ data: { email: `${prefix}@test.local`, password: 'unused', rewardPoints: 100 } });
    userId = user.id;
    token = await signTestToken(app, user);
    productId = (await db.product.create({ data: { name: prefix, price: 35001, stock: 20 } })).id;
    await db.promotion.create({ data: { code: voucher, discountPct: 3, maxDiscount: 50000, usageLimit: 10 } });
  });

  afterAll(async () => {
    await db.payment.deleteMany({ where: { order: { userId } } });
    await db.orderItem.deleteMany({ where: { order: { userId } } });
    await db.order.deleteMany({ where: { userId } });
    await db.product.delete({ where: { id: productId } });
    await db.promotion.delete({ where: { code: voucher } });
    await db.procPaymentKey.deleteMany({ where: { key: { startsWith: prefix } } });
    await db.user.deleteMany({ where: { OR: [{ id: userId }, { email: { in: authEmails } }] } });
    await app.close();
  });

  const postOrder = (extra = {}) => request(app.getHttpServer()).post('/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ items: [{ productId, quantity: 1 }], ...extra });
  const pay = (orderId: number, key: string, amount: number) => request(app.getHttpServer()).post('/payments')
    .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key)
    .send({ orderId, amount, method: 'WALLET' });

  it('rounds percentage discounts to integer VND and accepts the exact server total', async () => {
    const response = await postOrder({ voucherCode: voucher }).expect(201);
    expect(response.body.order.total).toBe(33951);
    await pay(response.body.orderId, `${prefix}-round`, response.body.order.total).expect(201);
    const payment = await db.payment.findFirstOrThrow({ where: { orderId: response.body.orderId } });
    expect(payment.amount).toBe(33951);
  });

  it('does not consume points beyond the usable whole thousands', async () => {
    await db.user.update({ where: { id: userId }, data: { rewardPoints: 100 } });
    const response = await postOrder({ pointsToUse: 100 }).expect(201);
    expect(response.body.order.total).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).rewardPoints).toBe(65);
  });

  it('claims the order before charging: a different key cannot call the gateway concurrently', async () => {
    const response = await postOrder().expect(201);
    const original = gateway.charge.bind(gateway);
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    let calls = 0;
    gateway.charge = async (...args: Parameters<typeof original>) => {
      calls += 1;
      entered();
      await blocked;
      return original(...args);
    };
    const first = pay(response.body.orderId, `${prefix}-first`, 35001).then(r => r);
    try {
      await started;
      await pay(response.body.orderId, `${prefix}-second`, 35001).expect(409);
      expect(calls).toBe(1);
    } finally {
      release();
      await first;
      gateway.charge = original;
    }
    expect((await first).status).toBe(201);
    expect(await db.payment.count({ where: { orderId: response.body.orderId, status: 'PAID' } })).toBe(1);
  });

  it('rejects cancellation during payment and preserves the successful payment', async () => {
    const response = await postOrder().expect(201);
    const orderId = response.body.orderId;
    const original = gateway.charge.bind(gateway);
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    gateway.charge = async (...args: Parameters<typeof original>) => {
      entered();
      await blocked;
      return original(...args);
    };
    const pending = pay(orderId, `${prefix}-cancel-race`, 35001).then(r => r);
    try {
      await started;
      await request(app.getHttpServer()).patch(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`).expect(409);
    } finally {
      release();
      await pending;
      gateway.charge = original;
    }
    expect((await pending).status).toBe(201);
    expect((await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PAID');
    expect(await db.payment.count({ where: { orderId, status: 'PAID' } })).toBe(1);
  });

  it('cancels a paid order and reverses its earned points', async () => {
    const before = (await db.user.findUniqueOrThrow({ where: { id: userId } })).rewardPoints;
    const response = await postOrder().expect(201);
    const orderId = response.body.orderId;
    await pay(orderId, `${prefix}-cancel-paid`, 35001).expect(201);
    await request(app.getHttpServer()).patch(`/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).rewardPoints).toBe(before);
    expect((await db.payment.findFirstOrThrow({ where: { orderId } })).status).toBe('REFUNDED');
  });

  it('rejects whitespace names, oversized IDs and oversized or blank payment keys', async () => {
    await request(app.getHttpServer()).patch('/users/me').set('Authorization', `Bearer ${token}`).send({ name: '   ' }).expect(400);
    await request(app.getHttpServer()).get('/products/2147483648').expect(400);
    await request(app.getHttpServer()).get('/orders/2147483648').set('Authorization', `Bearer ${token}`).expect(400);
    await postOrder({ items: [{ productId: 2147483648, quantity: 1 }] }).expect(400);
    await postOrder({ items: [{ productId, quantity: 1, toppingIds: [2147483648] }] }).expect(400);
    const response = await postOrder().expect(201);
    await pay(response.body.orderId, 'a'.repeat(201), 35001).expect(400);
    await pay(response.body.orderId, ' ', 35001).expect(400);
  });

  it('retains ownership after an unknown gateway result and reconciles with the same key from a new service', async () => {
    const response = await postOrder().expect(201);
    const original = gateway.charge.bind(gateway);
    const key = `${prefix}-network`;
    gateway.charge = async () => { throw new Error('gateway unavailable'); };
    try {
      await expect(app.get(PaymentsService).create({ orderId: response.body.orderId, method: 'WALLET', amount: 35001 }, key, userId)).rejects.toThrow('gateway unavailable');
      expect((await db.order.findUniqueOrThrow({ where: { id: response.body.orderId } })).paymentAttemptKey).toBe(key);
      await pay(response.body.orderId, `${prefix}-network-other`, 35001).expect(409);
    } finally {
      gateway.charge = original;
    }
    const recovered = await new PaymentsService(db, gateway).create({ orderId: response.body.orderId, method: 'WALLET', amount: 35001 }, key, userId);
    expect(recovered.status).toBe('PAID');
    expect(await db.payment.count({ where: { orderId: response.body.orderId } })).toBe(1);
  });

  it.each(['a'.repeat(72), 'é'.repeat(36)])('accepts exactly 72 UTF-8 bytes and rejects longer passwords', async password => {
    const email = `${randomUUID()}@test.local`;
    authEmails.push(email);
    const body = { email, name: 'Regression', password };
    await request(app.getHttpServer()).post('/auth/register').send(body).expect(201);
    await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(201);
    await request(app.getHttpServer()).post('/auth/login').send({ email, password: `${password}x` }).expect(400);
    await request(app.getHttpServer()).post('/auth/register').send({ ...body, email: `long-${email}`, password: `${password}x` }).expect(400);
    await request(app.getHttpServer()).post('/auth/register').send({ ...body, email: `blank-${email}`, name: '   ' }).expect(400);
  });

  it('rejects stale version writes and rolls back all item updates after an invalid topping', async () => {
    const before = await db.product.findUniqueOrThrow({ where: { id: productId } });
    const ordersBefore = await db.order.count({ where: { userId } });
    await postOrder({ items: [{ productId, quantity: 1, toppingIds: [2147483647] }] }).expect(400);
    expect(await db.product.findUniqueOrThrow({ where: { id: productId } })).toEqual(before);
    expect(await db.order.count({ where: { userId } })).toBe(ordersBefore);
    await postOrder().expect(201);
    const stale = await db.product.updateMany({ where: { id: productId, version: before.version }, data: { stock: { decrement: 1 }, version: { increment: 1 } } });
    expect(stale.count).toBe(0);
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).version).toBe(before.version + 1);
  });
});

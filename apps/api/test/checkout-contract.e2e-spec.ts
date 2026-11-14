import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaymentGateway, MockPaymentGateway } from '../src/payments/payment.gateway';
import { assertTestDatabase, signTestToken } from './test-utils';

describe('Checkout HTTP contract and retry', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let gateway: MockPaymentGateway;
  let token: string;
  let userId: number;
  let productId: number;
  const keys: string[] = [];
  const key = () => { const value = randomUUID(); keys.push(value); return value; };

  beforeAll(async () => {
    assertTestDatabase();
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);
    gateway = app.get(PaymentGateway);
    const user = await prisma.user.create({ data: { email: `checkout-${randomUUID()}@test.local`, password: 'test', rewardPoints: 100 } });
    userId = user.id;
    token = await signTestToken(app, user);
    productId = (await prisma.product.create({ data: { name: 'Checkout contract test', price: 35000, stock: 50 } })).id;
  });

  afterAll(async () => {
    if (prisma && userId) {
      const orders = await prisma.order.findMany({ where: { userId }, select: { id: true } });
      const orderId = { in: orders.map(order => order.id) };
      await prisma.payment.deleteMany({ where: { orderId } });
      await prisma.orderItem.deleteMany({ where: { orderId } });
      await prisma.order.deleteMany({ where: { userId } });
      await prisma.procPaymentKey.deleteMany({ where: { key: { in: keys } } });
      await prisma.user.delete({ where: { id: userId } });
      await prisma.product.delete({ where: { id: productId } });
    }
    await app?.close();
  });

  const create = (requestKey: string, quantity = 1) => request(app.getHttpServer())
    .post('/orders').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', requestKey)
    .send({ items: [{ productId, quantity }] });
  const pay = (body: object, requestKey = key()) => request(app.getHttpServer())
    .post('/payments').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', requestKey).send(body);

  it('concurrent duplicate orders reserve stock only once; changed body returns 409', async () => {
    const stock = (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock;
    const requestKey = key();
    const responses = await Promise.all([create(requestKey), create(requestKey)]);
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    expect(responses[0].body.orderId).toBe(responses[1].body.orderId);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(stock - 1);
    expect((await create(requestKey, 2)).status).toBe(409);
  });

  it.each(['WALLET', 'CREDIT_CARD'])('%s checkout is paid once, with one reward and history entry', async method => {
    const orderKey = key();
    const created = await create(orderKey);
    expect(created.status).toBe(201);
    const body = { orderId: created.body.orderId, amount: created.body.order.total, method };
    const pointsBefore = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).rewardPoints;
    const paymentKey = key();
    const first = await pay(body, paymentKey);
    const replay = await pay(body, paymentKey);
    expect(first.status).toBe(201);
    expect(first.body.orderStatus).toBe('PAID');
    expect(replay.body.fromCache).toBe(true);
    expect(first.body.payment.paidOrderId).toBe(body.orderId);
    expect(await prisma.payment.count({ where: { orderId: body.orderId } })).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).rewardPoints).toBe(pointsBefore + 3);
    expect((await create(orderKey)).body.orderId).toBe(body.orderId);
    const history = await request(app.getHttpServer()).get('/orders/me').set('Authorization', `Bearer ${token}`);
    expect(history.body.some((order: { id: number; status: string }) => order.id === body.orderId && order.status === 'PAID')).toBe(true);
  });

  it('missing amount, invalid card and underpayment fail without touching payment or order', async () => {
    const orderId = (await create(key())).body.orderId;
    for (const body of [
      { orderId, method: 'WALLET' },
      { orderId, method: 'CARD', amount: 35000 },
      { orderId, method: 'WALLET', amount: 1 },
    ]) expect((await pay(body)).status).toBe(400);
    expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PENDING');
  });

  it('failed payment can retry on the same order with a new key', async () => {
    const orderId = (await create(key())).body.orderId;
    const body = { orderId, amount: 35000, method: 'WALLET' };
    gateway.success = false;
    try {
      expect((await pay(body)).body.orderStatus).toBe('PAYMENT_FAILED');
    } finally { gateway.success = true; }
    expect((await pay(body)).body.orderStatus).toBe('PAID');
    expect(await prisma.payment.count({ where: { orderId, status: 'PAID' } })).toBe(1);
  });

  it('a zero-total order completes without calling the gateway', async () => {
    const created = await request(app.getHttpServer()).post('/orders')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key())
      .send({ items: [{ productId, quantity: 1 }], pointsToUse: 35 });
    expect(created.status).toBe(201);
    expect(created.body.order.total).toBe(0);
    const calls = gateway.calls.length;
    const result = await pay({ orderId: created.body.orderId, amount: 0, method: 'WALLET' });
    expect(result.status).toBe(201);
    expect(result.body.orderStatus).toBe('PAID');
    expect(gateway.calls).toHaveLength(calls);
  });
});

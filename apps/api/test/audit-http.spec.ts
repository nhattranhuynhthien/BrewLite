import { randomBytes } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Real controllers, guards, validation and state machine; no PostgreSQL claims.
describe('Audit HTTP routes and permissions', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let status: string;
  const originalSecret = process.env.JWT_SECRET;
  const originalOperators = process.env.ORDER_OPERATOR_USER_IDS;
  const db = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    order: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = randomBytes(48).toString('hex');
    process.env.ORDER_OPERATOR_USER_IDS = '7, 9';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(db).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    jwt = app.get(JwtService);
  });

  beforeEach(() => {
    status = 'PAID';
    db.$queryRaw.mockReset().mockResolvedValue([{ '?column?': 1 }]);
    db.$transaction.mockImplementation(callback => callback(db));
    db.order.findUnique.mockImplementation(({ where }) => where.id === 42 ? { id: 42, status, total: 50000 } : null);
    db.order.updateMany.mockReset().mockImplementation(({ where, data }) => {
      if (where.status !== status) return { count: 0 };
      status = data.status;
      return { count: 1 };
    });
  });

  afterAll(async () => {
    await app?.close();
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalOperators === undefined) delete process.env.ORDER_OPERATOR_USER_IDS;
    else process.env.ORDER_OPERATOR_USER_IDS = originalOperators;
  });

  const token = (id: number) => jwt.sign({ sub: id, email: `user-${id}@test.local` });
  const update = (id: number, body: object, orderId = 42) => request(app.getHttpServer())
    .patch(`/orders/${orderId}/status`).set('Authorization', `Bearer ${token(id)}`).send(body);

  it('registers public liveness and database readiness routes', async () => {
    expect((await request(app.getHttpServer()).get('/health').expect(200)).body.status).toBe('ok');
    expect((await request(app.getHttpServer()).get('/health/ready').expect(200)).body.database).toBe('up');
    db.$queryRaw.mockRejectedValue(new Error('private database detail'));
    const response = await request(app.getHttpServer()).get('/health/ready').expect(503);
    expect(response.body.database).toBe('down');
    expect(JSON.stringify(response.body)).not.toContain('private database detail');
  });

  it('requires authentication and rejects ordinary customers, including self-claimed roles', async () => {
    await request(app.getHttpServer()).patch('/orders/42/status').send({ status: 'PREPARING' }).expect(401);
    await update(8, { status: 'PREPARING', role: 'ADMIN' }).expect(403);
    expect(status).toBe('PAID');
    expect(db.order.updateMany).not.toHaveBeenCalled();
  });

  it('uses the same JWT configuration in payments and user profile modules', async () => {
    await request(app.getHttpServer()).post('/payments')
      .set('Authorization', `Bearer ${token(8)}`).send({}).expect(400);
    await request(app.getHttpServer()).patch('/users/me')
      .set('Authorization', `Bearer ${token(8)}`).send({ name: '   ' }).expect(400);
  });

  it('lets an authorized operator follow the state machine in order', async () => {
    for (const next of ['PREPARING', 'READY', 'COMPLETED']) {
      expect((await update(7, { status: next }).expect(200)).body.status).toBe(next);
    }
    await update(9, { status: 'PREPARING' }).expect(400);
    expect(status).toBe('COMPLETED');
  });

  it('rejects skipped transitions and prohibits bypassing payment or cancellation', async () => {
    for (const next of ['READY', 'COMPLETED', 'PAID', 'CANCELLED', 'UNKNOWN']) {
      await update(7, { status: next }).expect(400);
      expect(status).toBe('PAID');
    }
    await update(7, {}).expect(400);
    await update(7, { status: 'PREPARING' }, 999).expect(404);
  });

  it('returns conflict without overwriting a concurrent status change', async () => {
    db.order.updateMany.mockImplementationOnce(() => { status = 'CANCELLED'; return { count: 0 }; });
    await update(7, { status: 'PREPARING' }).expect(409);
    expect(status).toBe('CANCELLED');
  });

  it('fails closed if there are no configured operators', async () => {
    process.env.ORDER_OPERATOR_USER_IDS = '';
    try { await update(7, { status: 'PREPARING' }).expect(403); }
    finally { process.env.ORDER_OPERATOR_USER_IDS = '7,9'; }
  });
});

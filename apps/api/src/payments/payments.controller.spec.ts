import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../auth/auth.guard';
import { JwtService } from '@nestjs/jwt';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  const paymentsService = { create: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: paymentsService },
        { provide: AuthGuard, useValue: { canActivate: jest.fn(() => true) } },
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

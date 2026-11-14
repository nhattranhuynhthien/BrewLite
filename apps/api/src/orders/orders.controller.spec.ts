import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { JwtService } from '@nestjs/jwt';

describe('OrdersController', () => {
  let controller: OrdersController;
  const ordersService = {
    findByUser: jest.fn(),
    cancel: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: ordersService },
        { provide: JwtService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('uses the authenticated user id for the order history', () => {
    const orders = [{ id: 7, userId: 42 }];
    ordersService.findByUser.mockReturnValue(orders);
    const request = {
      user: { sub: 42, email: 'customer@example.com' },
    } as AuthenticatedRequest;

    expect(controller.findMine(request)).toBe(orders);
    expect(ordersService.findByUser).toHaveBeenCalledWith(42);
  });

  it('cancels the order for the authenticated user', () => {
    const order = { id: 7, status: 'CANCELLED' };
    const request = {
      user: { sub: 42, email: 'customer@example.com' },
    } as AuthenticatedRequest;
    ordersService.cancel.mockReturnValue(order);

    expect(controller.cancel(7, request)).toBe(order);
    expect(ordersService.cancel).toHaveBeenCalledWith(7, 42);
  });
});

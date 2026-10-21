import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuthenticatedRequest } from '../auth/authenticated-request';

describe('OrdersController', () => {
  let controller: OrdersController;
  const ordersService = {
    findByUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: ordersService }],
    }).compile();

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
});

import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AuthGuard } from '../auth/auth.guard';
import { OrderOperatorGuard } from './order-operator.guard';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, AuthGuard, OrderOperatorGuard],
})
export class OrdersModule {}

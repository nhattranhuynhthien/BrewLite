import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService, AuthGuard],
})
export class OrdersModule {}

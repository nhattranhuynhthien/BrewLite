import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

import { ProductsModule } from './products/products.module';

import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { AuthModule } from './auth/auth.module';


@Module({
  imports: [
    ProductsModule,
    UsersModule, 
    OrdersModule, 
    PaymentsModule, AuthModule, 
    
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ProcPaymentKeyEntity } from './procpayment-key.entity';
import { Product } from './product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProcPaymentKeyEntity, Product])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
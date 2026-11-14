import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AuthGuard } from '../auth/auth.guard';
import { PaymentGateway, MockPaymentGateway } from './payment.gateway';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    AuthGuard,
    { provide: PaymentGateway, useClass: MockPaymentGateway },
  ],
})
export class PaymentsModule {}

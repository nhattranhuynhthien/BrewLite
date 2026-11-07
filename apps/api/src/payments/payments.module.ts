import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from '../auth/auth.guard';
import { PaymentGateway, MockPaymentGateway } from './payment.gateway';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PrismaService,
    AuthGuard,
    { provide: PaymentGateway, useClass: MockPaymentGateway },
  ],
})
export class PaymentsModule {}

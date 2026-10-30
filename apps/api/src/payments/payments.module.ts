import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaService, AuthGuard],
})
export class PaymentsModule {}

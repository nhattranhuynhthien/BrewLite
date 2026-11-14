import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ToppingsController } from './toppings.controller';
import { ToppingsService } from './toppings.service';

@Module({
  imports: [PrismaModule],
  controllers: [ToppingsController],
  providers: [ToppingsService],
})
export class ToppingsModule {}

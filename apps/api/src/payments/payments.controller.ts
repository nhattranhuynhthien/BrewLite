import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(AuthGuard)
  @Post()
  async create(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() createPaymentDto: CreatePaymentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.paymentsService.create(createPaymentDto, idempotencyKey, request.user.sub);
  }
}
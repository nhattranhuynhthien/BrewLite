import { Controller, Post, Body, Headers } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcPaymentDto } from './dto/procpayment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Route 1: POST /payments/create (Luồng Create Payment cũ)
  @Post('create')
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.processMockPayment(createPaymentDto);
  }

  // Route 2: POST /payments/process (Luồng Process Payment mới: Idempotency + Lock)
  @Post('process')
  async processPayment(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() procPaymentDto: ProcPaymentDto,
  ) {
    return this.paymentsService.processPaymentWithStockDeduction(idempotencyKey, procPaymentDto);
  }
}
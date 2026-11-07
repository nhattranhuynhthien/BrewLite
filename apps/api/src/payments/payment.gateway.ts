import { Injectable } from '@nestjs/common';

export abstract class PaymentGateway {
  abstract charge(orderId: number, amount: number, method: string): Promise<{ success: boolean }>;
}

// Đặt `success = false` trong test để giả lập cổng thanh toán từ chối.
@Injectable()
export class MockPaymentGateway extends PaymentGateway {
  success = true;

  async charge() {
    return { success: this.success };
  }
}

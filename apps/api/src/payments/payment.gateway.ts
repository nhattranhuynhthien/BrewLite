import { Injectable } from '@nestjs/common';

export abstract class PaymentGateway {
  // idempotencyKey: gateway thật phải dùng key này để không trừ tiền hai lần khi gọi lại.
  abstract charge(
    orderId: number,
    amount: number,
    method: string,
    idempotencyKey?: string,
  ): Promise<{ success: boolean }>;
}

// Đặt `success = false` trong test để giả lập cổng thanh toán từ chối.
@Injectable()
export class MockPaymentGateway extends PaymentGateway {
  success = true;
  calls: { orderId: number; amount: number; method: string; idempotencyKey?: string }[] = [];
  // Hook cho test: chạy giữa lúc "gọi gateway", ví dụ để giả lập đơn bị huỷ đồng thời.
  onCharge?: () => void;

  async charge(orderId: number, amount: number, method: string, idempotencyKey?: string) {
    this.calls.push({ orderId, amount, method, idempotencyKey });
    this.onCharge?.();
    return { success: this.success };
  }
}

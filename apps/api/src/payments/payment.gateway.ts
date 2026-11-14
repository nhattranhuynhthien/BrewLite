import { ConflictException, Injectable } from '@nestjs/common';

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
  private readonly results = new Map<string, { fingerprint: string; success: boolean }>();
  success = true;
  calls: { orderId: number; amount: number; method: string; idempotencyKey?: string }[] = [];
  // Hook cho test: chạy giữa lúc "gọi gateway", ví dụ để giả lập đơn bị huỷ đồng thời.
  onCharge?: () => void;

  async charge(orderId: number, amount: number, method: string, idempotencyKey?: string) {
    const fingerprint = JSON.stringify([orderId, amount, method]);
    const cached = idempotencyKey ? this.results.get(idempotencyKey) : undefined;
    if (cached) {
      if (cached.fingerprint !== fingerprint) throw new ConflictException('Gateway key đã được dùng cho yêu cầu khác.');
      return { success: cached.success };
    }
    const success = this.success;
    if (idempotencyKey) this.results.set(idempotencyKey, { fingerprint, success });
    this.calls.push({ orderId, amount, method, idempotencyKey });
    this.onCharge?.();
    return { success };
  }
}

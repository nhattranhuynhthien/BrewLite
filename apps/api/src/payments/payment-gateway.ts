import { Injectable } from '@nestjs/common';

export abstract class PaymentGateway {
  abstract charge(amount: number, method: string): Promise<{ success: boolean }>;
}

// shortcut: mock luôn thành công, thay bằng gateway thật khi tích hợp; test thì override bằng jest.fn()
@Injectable()
export class MockPaymentGateway extends PaymentGateway {
  async charge() {
    return { success: true };
  }
}

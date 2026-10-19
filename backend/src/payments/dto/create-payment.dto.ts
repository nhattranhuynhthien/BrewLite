export class CreatePaymentDto {
  orderId: string;
  amount: number;
  paymentMethod: 'WALLET' | 'CARD'; // Chọn Ví hoặc Thẻ
}
import { IsNotEmpty, IsNumber, IsString, IsIn, IsPositive } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsNumber()
  orderId: number;

  @IsNotEmpty()
  @IsString()
  @IsIn(['WALLET', 'CARD']) // Giả sử hỗ trợ Ví hoặc Thẻ
  method: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;
}
export class ProcPaymentDto {
  @IsNumber()
  orderId: number;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  method: string;
}
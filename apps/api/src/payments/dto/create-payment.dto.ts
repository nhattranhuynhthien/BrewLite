import { IsEnum, IsInt, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Danh sách phương thức thanh toán được chấp nhận. Sửa cho khớp với UI.
export enum PaymentMethod {
  MOMO = 'MOMO',
  WALLET = 'WALLET',
  CREDIT_CARD = 'CREDIT_CARD',
}

export class CreatePaymentDto {
  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  orderId: number;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.MOMO })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
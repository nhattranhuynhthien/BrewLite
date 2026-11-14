import { Max, IsEnum, IsInt, IsNotEmpty, Min } from 'class-validator';
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
  @Max(2147483647)
  orderId: number;

  @ApiProperty({ example: 35000, minimum: 0, description: 'Tổng tiền của đơn hàng do server trả về, tính bằng VND.' })
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.MOMO })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}

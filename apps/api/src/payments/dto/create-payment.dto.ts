import { IsNumber, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 6 })
  @IsNumber()
  @IsNotEmpty()
  orderId: number;

  @ApiProperty({ example: 'MOMO' })
  @IsString()
  @IsNotEmpty()
  method: string;
}
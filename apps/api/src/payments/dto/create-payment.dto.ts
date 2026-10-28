import { IsNumber, IsString, IsNotEmpty, IsOptional } from 'class-validator';
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

  @ApiProperty({ example: 35000, required: false })
  @IsOptional()
  @IsNumber()
  amount?: number;
}
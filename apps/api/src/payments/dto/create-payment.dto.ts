import { IsInt, IsString, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  orderId: number;

  @ApiProperty({ example: 'MOMO' })
  @IsString()
  @IsNotEmpty()
  method: string;
}
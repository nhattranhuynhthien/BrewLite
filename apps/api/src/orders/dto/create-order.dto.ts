import { IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ description: 'ID của người dùng đặt hàng' })
  @IsNotEmpty({ message: 'User ID không được để trống' })
  @IsNumber({}, { message: 'User ID phải là số' })
  userId: number;

  @ApiProperty({ description: 'Tổng tiền của đơn hàng' })
  @IsNotEmpty()
  @IsNumber()
  total: number; // Sửa totalAmount thành total ở dòng này
}
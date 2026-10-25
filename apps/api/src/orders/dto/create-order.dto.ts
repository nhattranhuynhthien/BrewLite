import { IsNotEmpty, IsNumber, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class OrderItemDto {
  @ApiProperty({ description: 'ID của sản phẩm' })
  @IsNotEmpty({ message: 'Product ID không được để trống' })
  @IsNumber({}, { message: 'Product ID phải là số' })
  productId: number;

  @ApiProperty({ description: 'Số lượng mua' })
  @IsNotEmpty({ message: 'Số lượng không được để trống' })
  @IsNumber({}, { message: 'Số lượng phải là số' })
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'ID của người dùng đặt hàng' })
  @IsNotEmpty({ message: 'User ID không được để trống' })
  @IsNumber({}, { message: 'User ID phải là số' })
  userId: number;

  @ApiProperty({ description: 'Tổng tiền của đơn hàng (Tùy chọn, server tự tính)', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Total phải là số' })
  total?: number;

  @ApiProperty({ description: 'Danh sách sản phẩm trong đơn hàng', type: [OrderItemDto] })
  @IsArray({ message: 'Items phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
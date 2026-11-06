import { ArrayUnique, IsNotEmpty, IsArray, ValidateNested, Min, IsOptional, IsString, IsInt, IsIn, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({ description: 'ID của sản phẩm (món nước)', example: 1 })
  @IsNotEmpty({ message: 'Product ID không được để trống' })
  @IsInt({ message: 'Product ID phải là số nguyên' })
  @Min(1)
  productId: number;

  @ApiProperty({ description: 'Số lượng đặt mua', example: 2 })
  @IsNotEmpty({ message: 'Số lượng không được để trống' })
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng ít nhất phải là 1' })
  quantity: number;

  @ApiPropertyOptional({ description: 'Size của sản phẩm', enum: ['S', 'M', 'L'], example: 'L' })
  @IsOptional()
  @IsIn(['S', 'M', 'L'], { message: 'Size chỉ được là S, M hoặc L' })
  size?: string;

  @ApiPropertyOptional({ 
    description: 'Danh sách ID của các topping chọn thêm', 
    example: [3, 5], 
    type: [Number] 
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách topping phải là một mảng' })
  @ArrayUnique({ message: 'Danh sách topping không được chứa ID trùng lặp' })
  @IsInt({ each: true, message: 'ID topping phải là số nguyên' })
  @Min(1, { each: true, message: 'ID topping phải lớn hơn 0' })
  toppingIds?: number[];

  @ApiPropertyOptional({ description: 'Ghi chú riêng cho món', example: 'Ít đá, nhiều đường' })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là một chuỗi ký tự' })
  @MaxLength(255, { message: 'Ghi chú không được vượt quá 255 ký tự' })
  note?: string;
}

export class CreateOrderDto {
  @ApiProperty({ 
    description: 'Danh sách các món nước khách hàng muốn đặt',
    type: [OrderItemDto] 
  })
  @IsArray({ message: 'Danh sách đơn hàng phải là một mảng' })
  @ValidateNested({ each: true }) 
  @Type(() => OrderItemDto)      
  items: OrderItemDto[];

  @ApiProperty({ 
    description: 'Mã giảm giá áp dụng cho đơn hàng (không bắt buộc)', 
    example: 'GIAM10',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Mã giảm giá phải là một chuỗi ký tự' })
  voucherCode?: string; 

  @ApiProperty({ 
    description: 'Số điểm thưởng muốn sử dụng để giảm giá', 
    example: 5,
    required: false 
  })
  @IsOptional()
  @IsInt({ message: 'Số điểm sử dụng phải là số nguyên' })
  @Min(0)
  pointsToUse?: number;
}
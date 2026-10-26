import { IsNotEmpty, IsNumber, IsArray, ValidateNested, Min, IsOptional, IsString} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';


export class OrderItemDto {
  @ApiProperty({ description: 'ID của sản phẩm (món nước)', example: 1 })
  @IsNotEmpty({ message: 'Product ID không được để trống' })
  @IsNumber({}, { message: 'Product ID phải là số' })
  productId: number;

  @ApiProperty({ description: 'Số lượng đặt mua', example: 2 })
  @IsNotEmpty({ message: 'Số lượng không được để trống' })
  @IsNumber({}, { message: 'Số lượng phải là số' })
  @Min(1, { message: 'Số lượng ít nhất phải là 1' })
  quantity: number;
}


export class CreateOrderDto {
  @ApiProperty({ 
    description: 'Danh sách các món nước khách hàng muốn đặt',
    type: [OrderItemDto] 
  })
  @IsArray({ message: 'Danh sách đơn hàng phải là một mảng' })
  @ValidateNested({ each: true }) 
  @Type(() => OrderItemDto)      
  items: OrderItemDto[]; // Đã xóa @IsOptional và @IsString ở đây

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
  @IsNumber({}, { message: 'Số điểm sử dụng phải là số' })
  pointsToUse?: number;
}
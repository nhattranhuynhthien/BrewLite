import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { OrderStatus } from '../order-status';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: [OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED] })
  @IsIn([OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED])
  status: OrderStatus;
}

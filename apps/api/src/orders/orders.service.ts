import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto) {
    
    const newOrder = await this.prisma.order.create({
      data: {
        ...createOrderDto,
        status: 'PENDING', // Cứng ép trạng thái PENDING theo yêu cầu task
      },
    });

    
    return {
      message: 'Tạo đơn hàng thành công',
      orderId: newOrder.id, // Trả về mã đơn
      order: newOrder
    };
  }

  findAll() {
    return this.prisma.order.findMany();
  }

  findOne(id: number) {
    return this.prisma.order.findUnique({
      where: { id },
    });
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { assertTransition } from './order-status';

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

  findByUser(userId: number) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true } },
        payment: true,
      },
    });
  }

  async update(id: number, updateOrderDto: UpdateOrderDto) {
    if (!updateOrderDto.status) {
      throw new BadRequestException('Order status is required');
    }

    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    assertTransition(order.status, updateOrderDto.status);
    return this.prisma.order.update({
      where: { id },
      data: { status: updateOrderDto.status },
    });
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
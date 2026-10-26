import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { assertTransition } from './order-status';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, createOrderDto: CreateOrderDto) {
    let calculatedTotal = 0;
    const orderItemsData = [];

    
    for (const item of createOrderDto.items) {
      const product = await this.prisma.product.findUnique({
       where: { id: Number(item.productId) },
      });

      if (!product) {
        throw new NotFoundException(`Không tìm thấy sản phẩm có mã: ${item.productId}`);
      }

      
      calculatedTotal += product.price * item.quantity;

     
      orderItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      });
    }

   
    const newOrder = await this.prisma.order.create({
      data: {
        userId: userId,
        total: calculatedTotal,
        status: 'PENDING',
        items: { 
          create: orderItemsData,
        },
      },
      include: {
        items: true, 
      },
    });

    return {
      message: 'Tạo đơn hàng thành công',
      orderId: newOrder.id,
      order: newOrder,
    };
  }

  findAll() {
    return this.prisma.order.findMany({
      include: { items: true },
    });
  }

  findOne(id: number) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
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
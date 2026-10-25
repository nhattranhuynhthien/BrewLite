
// src/orders/orders.service.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { assertTransition } from './order-status';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto) {
    const { userId, items } = createOrderDto;

    if (!items || items.length === 0) {
      throw new BadRequestException('Đơn hàng phải chứa ít nhất một sản phẩm.');
    }

    // Sử dụng Prisma Transaction để đảm bảo tính toàn vẹn dữ liệu (Atomicity)
    return await this.prisma.$transaction(async (tx) => {
      let calculatedTotal = 0; // Đổi tên biến rõ ràng để TypeScript hiểu chắc chắn là number
      const orderItemsData = [];

      for (const item of items) {
        // 1. Kiểm tra sản phẩm có tồn tại không
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new NotFoundException(`Không tìm thấy sản phẩm với ID: ${item.productId}`);
        }

        // 2. Kiểm tra sơ bộ tồn kho
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Sản phẩm "${product.name}" không đủ hàng. Chỉ còn lại ${product.stock} sản phẩm.`
          );
        }

        // 3. Thực hiện Optimistic Locking / Atomic Update qua updateMany với điều kiện stock >= quantity
        const updateResult = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException(
            `Xung đột tồn kho cho sản phẩm "${product.name}" do có nhiều người cùng mua. Vui lòng thử lại!`
          );
        }

        // Cộng dồn tổng tiền chính xác
        calculatedTotal += product.price * item.quantity;
        orderItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        });
      }

      // 4. Tạo bản ghi Order và OrderItems liên quan
      const newOrder = await tx.order.create({
        data: {
          userId,
          total: calculatedTotal, // Truyền giá trị number chắc chắn vào đây
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
        message: 'Tạo đơn hàng thành công và cập nhật tồn kho',
        orderId: newOrder.id,
        order: newOrder,
      };
    });
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
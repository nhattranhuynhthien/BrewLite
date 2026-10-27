import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { assertTransition } from './order-status';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, createOrderDto: CreateOrderDto) {
    if (!createOrderDto.items || createOrderDto.items.length === 0) {
      throw new BadRequestException('Đơn hàng phải chứa ít nhất một sản phẩm.');
    }

    return await this.prisma.$transaction(async (tx) => {
      let calculatedTotal = 0;
      const orderItemsData = [];

      // 1. Kiểm tra tồn kho sơ bộ và trừ tồn kho nguyên tử (Optimistic Locking)
      for (const item of createOrderDto.items) {
        const product = await tx.product.findUnique({
          where: { id: Number(item.productId) },
        });

        if (!product) {
          throw new NotFoundException(`Không tìm thấy sản phẩm có mã: ${item.productId}`);
        }

        // Kiểm tra tồn kho sơ bộ
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Sản phẩm "${product.name}" không đủ hàng. Chỉ còn lại ${product.stock} sản phẩm.`,
          );
        }

        // Thực hiện Optimistic Locking / Atomic Update qua updateMany với điều kiện stock >= quantity
        const updateResult = await tx.product.updateMany({
          where: {
            id: Number(item.productId),
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
            `Xung đột tồn kho cho sản phẩm "${product.name}" do có nhiều người cùng mua. Vui lòng thử lại!`,
          );
        }

        calculatedTotal += product.price * item.quantity;

        orderItemsData.push({
          productId: Number(item.productId),
          quantity: item.quantity,
          price: product.price,
        });
      }

      // 2. Kiểm tra Voucher giảm giá
      let promoToUpdate: number | null = null;
      if (createOrderDto.voucherCode) {
        const promo = await tx.promotion.findUnique({
          where: { code: createOrderDto.voucherCode },
        });

        if (promo && promo.usageLimit > 0) {
          const discountAmount = Math.min((calculatedTotal * promo.discountPct) / 100, promo.maxDiscount);
          calculatedTotal -= discountAmount;
          promoToUpdate = promo.id;
        } else {
          throw new BadRequestException('Mã giảm giá không hợp lệ hoặc đã hết hạn!');
        }
      }

      // 3. Kiểm tra logic dùng điểm thưởng
      if (createOrderDto.pointsToUse) {
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (!user || user.rewardPoints < createOrderDto.pointsToUse) {
          throw new BadRequestException('Tài khoản không đủ điểm thưởng để áp dụng');
        }

        const pointDiscount = createOrderDto.pointsToUse * 1000; // 1 điểm = 1.000 VNĐ
        calculatedTotal -= pointDiscount;
      }

      // Đảm bảo tổng tiền không bị âm
      if (calculatedTotal < 0) calculatedTotal = 0;

      // 4. Trừ lượt dùng của voucher (nếu có)
      if (promoToUpdate) {
        await tx.promotion.update({
          where: { id: promoToUpdate },
          data: { usageLimit: { decrement: 1 } },
        });
      }

      // 5. Trừ điểm của người dùng (nếu có)
      if (createOrderDto.pointsToUse) {
        await tx.user.update({
          where: { id: userId },
          data: { rewardPoints: { decrement: createOrderDto.pointsToUse } },
        });
      }

      // 6. Tạo đơn hàng mới
      const newOrder = await tx.order.create({
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
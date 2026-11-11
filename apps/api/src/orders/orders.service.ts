import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { assertTransition } from './order-status';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, createOrderDto: CreateOrderDto) {
    if (!createOrderDto.items || createOrderDto.items.length === 0) {
      throw new BadRequestException('Đơn hàng phải chứa ít nhất một sản phẩm.');
    }

    return await this.prisma.$transaction(async (tx) => {
      let calculatedTotal = 0;
      const orderItemsData: Prisma.OrderItemCreateWithoutOrderInput[] = [];

      // 1. Kiểm tra tồn kho sơ bộ và trừ tồn kho nguyên tử (Optimistic Locking)
      // Luôn khóa/trừ kho theo thứ tự productId tăng dần để hai đơn có cùng sản phẩm
      // nhưng thứ tự khác nhau không khóa chéo nhau (deadlock). Thứ tự món trong đơn giữ nguyên.
      const itemsByProductId = createOrderDto.items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => Number(a.item.productId) - Number(b.item.productId));

      for (const { item, index } of itemsByProductId) {
        const product = await tx.product.findUnique({
          where: { id: Number(item.productId) },
        });

        if (!product) {
          throw new NotFoundException(`Không tìm thấy sản phẩm có mã: ${item.productId}`);
        }
        if (!product.isAvailable) {
          throw new BadRequestException(`Sản phẩm "${product.name}" hiện không khả dụng.`);
        }
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Sản phẩm "${product.name}" không đủ hàng. Chỉ còn lại ${product.stock} sản phẩm.`,
          );
        }

        const updateResult = await tx.product.updateMany({
          where: {
            id: Number(item.productId),
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException(
            `Xung đột tồn kho cho sản phẩm "${product.name}" do có nhiều người cùng mua. Vui lòng thử lại!`,
          );
        }

        let itemUnitPrice = product.price;

        if (item.size === 'M') {
          itemUnitPrice += 5000;
        } else if (item.size === 'L') {
          itemUnitPrice += 10000;
        }

        const orderItemPayload: Prisma.OrderItemCreateWithoutOrderInput = {
          quantity: item.quantity,
          size: item.size || null,
          sweetness: item.sweetness || null,
          ice: item.ice || null,
          note: item.note || null,
          unitPrice: itemUnitPrice,
          product: {
            connect: { id: Number(item.productId) },
          },
        };

        if (item.toppingIds?.length) {
          const toppings = await tx.topping.findMany({
            where: { id: { in: item.toppingIds } },
          });

          if (toppings.length !== item.toppingIds.length) {
            throw new BadRequestException(`Một hoặc nhiều Topping cho món "${product.name}" không hợp lệ.`);
          }

          const toppingsTotal = toppings.reduce((sum, topping) => sum + topping.price, 0);
          itemUnitPrice += toppingsTotal;
          orderItemPayload.unitPrice = itemUnitPrice;
          orderItemPayload.toppings = toppings.map(({ id, name, price }) => ({ id, name, price }));
        }

        calculatedTotal += itemUnitPrice * item.quantity;

        orderItemsData[index] = orderItemPayload;
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

        const pointDiscount = createOrderDto.pointsToUse * 1000;
        calculatedTotal -= pointDiscount;
      }

      if (calculatedTotal < 0) calculatedTotal = 0;

      // 4. Trừ lượt dùng voucher
      if (promoToUpdate) {
        const promoUpdate = await tx.promotion.updateMany({
          where: { id: promoToUpdate, usageLimit: { gt: 0 } },
          data: { usageLimit: { decrement: 1 } },
        });
        if (promoUpdate.count !== 1) {
          throw new ConflictException('Mã giảm giá vừa hết lượt sử dụng. Vui lòng thử lại!');
        }
      }

      // 5. Trừ điểm của người dùng
      if (createOrderDto.pointsToUse) {
        const pointsUpdate = await tx.user.updateMany({
          where: { id: userId, rewardPoints: { gte: createOrderDto.pointsToUse } },
          data: { rewardPoints: { decrement: createOrderDto.pointsToUse } },
        });
        if (pointsUpdate.count !== 1) {
          throw new ConflictException('Số dư điểm thưởng vừa thay đổi. Vui lòng thử lại!');
        }
      }

      // 6. Tạo đơn hàng với các Option đã chốt giá
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

  async findForUser(id: number, userId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: { include: { product: true } },
        payment: true,
      },
    });
    if (!order) throw new NotFoundException(`Không tìm thấy đơn hàng ${id}`);
    return order;
  }

  async update(id: number, updateOrderDto: UpdateOrderDto) {
    if (!updateOrderDto.status) {
      throw new BadRequestException('Order status is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) {
        throw new NotFoundException(`Order ${id} not found`);
      }

      assertTransition(order.status, updateOrderDto.status);
      const result = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: updateOrderDto.status },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'Order status changed while this update was being processed. Please retry.',
        );
      }

      return tx.order.findUnique({ where: { id } });
    });
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
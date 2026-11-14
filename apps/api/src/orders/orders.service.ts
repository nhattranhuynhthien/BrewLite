import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from '../prisma/prisma.service';
import { assertTransition, OrderStatus } from './order-status';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

class StockConflict extends ConflictException {}

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, createOrderDto: CreateOrderDto, idempotencyKey?: string, stockRetries = 10): Promise<{ message: string; orderId: number; order: Prisma.OrderGetPayload<{ include: { items: true } }> }> {
    if (idempotencyKey !== undefined && (!idempotencyKey.trim() || idempotencyKey.length > 200)) {
      throw new BadRequestException('Idempotency-Key phải có từ 1 đến 200 ký tự.');
    }
    const requestKey = idempotencyKey
      ? createHash('sha256').update(`${userId}:${idempotencyKey}`).digest('hex')
      : null;
    const requestHash = createHash('sha256').update(JSON.stringify({
      items: createOrderDto.items?.map(item => ({
        productId: item.productId, quantity: item.quantity, size: item.size ?? null,
        sweetness: item.sweetness ?? null, ice: item.ice ?? null, note: item.note ?? null,
        toppingIds: [...(item.toppingIds ?? [])].sort((a, b) => a - b),
      })),
      voucherCode: createOrderDto.voucherCode ?? '', pointsToUse: createOrderDto.pointsToUse ?? 0,
    })).digest('hex');
    if (!createOrderDto.items || createOrderDto.items.length === 0) {
      throw new BadRequestException('Đơn hàng phải chứa ít nhất một sản phẩm.');
    }

    return await this.prisma.$transaction(async (tx) => {
      if (requestKey) {
        // Serialize requests with the same key across API processes; rollback releases the lock.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${requestKey}, 0))`;
        const existing = await tx.order.findUnique({ where: { requestKey }, include: { items: true } });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException('Idempotency-Key đã được dùng cho giỏ hàng khác.');
          }
          return { message: 'Đơn hàng đã được tạo', orderId: existing.id, order: existing };
        }
      }
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
            version: product.version,
          },
          data: {
            stock: { decrement: item.quantity },
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new StockConflict(
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
          const discountAmount = Math.round(Math.min((calculatedTotal * promo.discountPct) / 100, promo.maxDiscount));
          calculatedTotal -= discountAmount;
          promoToUpdate = promo.id;
        } else {
          throw new BadRequestException('Mã giảm giá không hợp lệ hoặc đã hết hạn!');
        }
      }

      // 3. Kiểm tra logic dùng điểm thưởng
      const pointsToUse = Math.min(createOrderDto.pointsToUse ?? 0, Math.floor(calculatedTotal / 1000));
      if (pointsToUse) {
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (!user || user.rewardPoints < pointsToUse) {
          throw new BadRequestException('Tài khoản không đủ điểm thưởng để áp dụng');
        }

        const pointDiscount = pointsToUse * 1000;
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
      if (pointsToUse) {
        const pointsUpdate = await tx.user.updateMany({
          where: { id: userId, rewardPoints: { gte: pointsToUse } },
          data: { rewardPoints: { decrement: pointsToUse } },
        });
        if (pointsUpdate.count !== 1) {
          throw new ConflictException('Số dư điểm thưởng vừa thay đổi. Vui lòng thử lại!');
        }
      }

      // 6. Tạo đơn hàng với các Option đã chốt giá
      const newOrder = await tx.order.create({
        data: {
          requestKey,
          requestHash: requestKey ? requestHash : null,
          pointsUsed: pointsToUse,
          promotionId: promoToUpdate,
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
    }).catch((error: unknown) => {
      if (error instanceof StockConflict && stockRetries > 0) {
        return this.create(userId, createOrderDto, idempotencyKey, stockRetries - 1);
      }
      throw error;
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

  async cancel(orderId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: { items: true, payment: true },
      });
      if (!order) throw new NotFoundException('Không tìm thấy đơn');

      const cancellableStatuses: string[] = [
        OrderStatus.PENDING,
        OrderStatus.PAYMENT_FAILED,
        OrderStatus.PAID,
      ];
      if (!cancellableStatuses.includes(order.status)) {
        throw new BadRequestException('Đơn đã được pha chế, không thể hủy');
      }

      const cancellation = await tx.order.updateMany({
        where: { id: orderId, userId, status: order.status, ...(order.status === OrderStatus.PAID ? {} : { paymentAttemptKey: null }) },
        data: { status: OrderStatus.CANCELLED },
      });
      if (cancellation.count !== 1) {
        throw new ConflictException(
          'Trạng thái đơn hàng đã thay đổi. Vui lòng thử lại.',
        );
      }

      for (const item of [...order.items].sort((a, b) => a.productId - b.productId)) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity }, version: { increment: 1 } },
        });
      }

      if (order.promotionId) {
        await tx.promotion.update({
          where: { id: order.promotionId },
          data: { usageLimit: { increment: 1 } },
        });
      }
      if (order.pointsUsed > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { rewardPoints: { increment: order.pointsUsed } },
        });
      }

      if (order.status === OrderStatus.PAID) {
        const points = Math.floor(order.total / 10000);
        if (points > 0) {
          const reversal = await tx.user.updateMany({
            where: { id: userId, rewardPoints: { gte: points } },
            data: { rewardPoints: { decrement: points } },
          });
          if (reversal.count !== 1) throw new ConflictException('Không đủ điểm để hoàn tác điểm thưởng của đơn.');
        }
        await tx.payment.updateMany({
          where: { orderId, status: 'PAID' },
          data: { status: 'REFUNDED', paidOrderId: null },
        });
      }

      const cancelledOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, payment: true },
      });
      if (!cancelledOrder) {
        throw new NotFoundException('Không tìm thấy đơn');
      }
      return cancelledOrder;
    });
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

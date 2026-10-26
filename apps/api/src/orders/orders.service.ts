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

    // 1. Tính tổng tiền từ danh sách sản phẩm
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

    // 2. Kiểm tra Voucher giảm giá (Chưa cập nhật CSDL vội)
    let promoToUpdate = null;
    if (createOrderDto.voucherCode) {
      const promo = await this.prisma.promotion.findUnique({
        where: { code: createOrderDto.voucherCode }
      });

      if (promo && promo.usageLimit > 0) {
        const discountAmount = Math.min((calculatedTotal * promo.discountPct) / 100, promo.maxDiscount);
        calculatedTotal -= discountAmount;
        promoToUpdate = promo.id; // Lưu lại ID để trừ lượt ở bước Transaction
      } else {
        throw new BadRequestException('Mã giảm giá không hợp lệ hoặc đã hết hạn!'); 
      }
    }

    // 3. Kiểm tra logic dùng điểm thưởng
    if (createOrderDto.pointsToUse) {
      const user = await this.prisma.user.findUnique({
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

    // 4. Chạy Transaction: Lưu đơn hàng, trừ lượt voucher và trừ điểm CÙNG LÚC
    const [newOrder] = await this.prisma.$transaction([
      // Lệnh 1: Tạo đơn hàng
      this.prisma.order.create({
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
      }),

      // Lệnh 2: Trừ lượt dùng của voucher (nếu có dùng)
      ...(promoToUpdate ? [
        this.prisma.promotion.update({
          where: { id: promoToUpdate },
          data: { usageLimit: { decrement: 1 } }
        })
      ] : []),

      // Lệnh 3: Trừ điểm của người dùng (nếu có dùng)
      ...(createOrderDto.pointsToUse ? [
        this.prisma.user.update({
          where: { id: userId },
          data: { rewardPoints: { decrement: createOrderDto.pointsToUse } },
        })
      ] : []),
    ]);

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
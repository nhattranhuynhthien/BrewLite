import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(createPaymentDto: CreatePaymentDto, idempotencyKey: string | undefined, userId: number) {
    if (!idempotencyKey) {
      throw new BadRequestException('Thiếu Idempotency-Key trong Header');
    }

    const { orderId, method } = createPaymentDto;
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException(`Không tìm thấy đơn hàng mã số: ${orderId}`);
    }

    const existingKey = await this.prisma.procPaymentKey.findUnique({
      where: { key: idempotencyKey },
    });
    if (existingKey) {
      const parsedResponse = JSON.parse(existingKey.response);
      if (parsedResponse.payment?.orderId !== orderId) {
        throw new ConflictException('Idempotency-Key đã được dùng cho một yêu cầu khác.');
      }
      return {
        fromCache: true,
        idempotencyKey,
        ...parsedResponse,
      };
    }

    // 2. Kiểm tra xem đơn hàng này đã từng thanh toán thành công chưa
    const successfulPayment = await this.prisma.payment.findFirst({
      where: { orderId, status: 'PAID' },
    });

    if (successfulPayment) {
      throw new BadRequestException('Đơn hàng này đã được thanh toán thành công trước đó.');
    }

    // Tính toán số điểm thưởng (1 điểm cho mỗi 10.000 VNĐ)
    const pointsToAdd = Math.floor(order.total / 10000);
    const paymentAmount = order.total;

    // 3. Chạy Transaction: Tạo Payment, cập nhật Order thành PAID, cộng điểm User
    const [payment, updatedOrder] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          orderId,
          method,
          amount: paymentAmount,
          status: 'PAID',
        },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
      }),
      this.prisma.user.update({
        where: { id: order.userId },
        data: { rewardPoints: { increment: pointsToAdd } },
      }),
    ]);

    const result = {
      status: 'PAID',
      message: 'Thanh toán thành công',
      orderId: order.id,
      orderStatus: updatedOrder.status,
      payment,
      order: updatedOrder,
      rewardPointsAdded: pointsToAdd,
    };

    // 4. Lưu Idempotency-Key và kết quả JSON vào bảng ProcPaymentKey để chặn lặp request sau
    await this.prisma.procPaymentKey.create({
      data: {
        key: idempotencyKey,
        response: JSON.stringify(result),
      },
    });

    return {
      fromCache: false,
      idempotencyKey,
      ...result,
    };
  }

}
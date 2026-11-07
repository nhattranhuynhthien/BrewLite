import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGateway } from './payment.gateway';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private gateway: PaymentGateway,
  ) {}

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

    // Gọi cổng thanh toán (ngoài transaction để không giữ transaction DB khi chờ mạng)
    const { success } = await this.gateway.charge(orderId, order.total, method);

    // Tính toán số điểm thưởng (1 điểm cho mỗi 10.000 VNĐ), chỉ khi thanh toán thành công
    const pointsToAdd = success ? Math.floor(order.total / 10000) : 0;
    const paymentStatus = success ? 'PAID' : 'FAILED';
    const orderStatus = success ? 'PAID' : 'PAYMENT_FAILED';

    // 3. Transaction: ghi Payment, cập nhật trạng thái Order, cộng điểm User (nếu thành công)
    const operations = [
      this.prisma.payment.create({
        data: { orderId, method, amount: order.total, status: paymentStatus },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: orderStatus },
      }),
    ];
    if (success) {
      operations.push(
        this.prisma.user.update({
          where: { id: order.userId },
          data: { rewardPoints: { increment: pointsToAdd } },
        }) as any,
      );
    }
    const [payment, updatedOrder] = await this.prisma.$transaction(operations);

    const result = {
      status: paymentStatus,
      message: success ? 'Thanh toán thành công' : 'Thanh toán thất bại',
      orderId: order.id,
      orderStatus,
      payment,
      order: updatedOrder,
      rewardPointsAdded: pointsToAdd,
    };

    // 4. Lưu Idempotency-Key và kết quả (cả thành công lẫn thất bại) để chặn lặp request.
    // Muốn thử lại sau khi thất bại thì client gửi Idempotency-Key mới.
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

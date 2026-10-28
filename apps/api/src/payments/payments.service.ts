import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(createPaymentDto: CreatePaymentDto, idempotencyKey?: string) {
    if (!idempotencyKey) {
      throw new BadRequestException('Thiếu Idempotency-Key trong Header');
    }

    // 0. Kiểm tra xem Idempotency-Key này đã được xử lý trước đó chưa
    const existingKey = await this.prisma.procPaymentKey.findUnique({
      where: { key: idempotencyKey },
    });

    // Nếu key đã tồn tại -> Trả về luôn kết quả từ cache (không chạy lại logic thanh toán)
    if (existingKey) {
      const parsedResponse = JSON.parse(existingKey.response);
      return {
        fromCache: true,
        idempotencyKey,
        ...parsedResponse,
      };
    }

    const { orderId, method, amount } = createPaymentDto;

    // 1. Kiểm tra đơn hàng có tồn tại không
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng mã số: ${orderId}`);
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
    const paymentAmount = amount !== undefined ? amount : order.total;

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

  findAll() {
    return this.prisma.payment.findMany();
  }

  findOne(id: number) {
    return this.prisma.payment.findUnique({
      where: { id },
    });
  }

  update(id: number, updatePaymentDto: UpdatePaymentDto) {
    return `This action updates a #${id} payment`;
  }

  remove(id: number) {
    return `This action removes a #${id} payment`;
  }
}
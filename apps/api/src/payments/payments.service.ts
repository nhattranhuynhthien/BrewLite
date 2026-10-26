// src/payments/payments.service.ts[cite: 4]
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
      throw new NotFoundException(`Không tìm thấy đơn hàng với ID: ${orderId}`);
    }

    // 2. Kiểm tra xem đơn hàng này đã từng thanh toán thành công chưa
    const successfulPayment = await this.prisma.payment.findFirst({
      where: { orderId, status: 'PAID' },
    });

    if (successfulPayment) {
      throw new BadRequestException('Đơn hàng này đã được thanh toán thành công trước đó.');
    }

    // 3. Mock logic thanh toán (80% thành công, 20% lỗi)
    const isSuccess = Math.random() > 0.2;
    const paymentStatus = isSuccess ? 'PAID' : 'PAYMENT_FAILED';

    // 4. Lưu lịch sử giao dịch thanh toán vào database
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        method,
        amount,
        status: paymentStatus,
      },
    });

    // 5. Cập nhật trạng thái của đơn hàng tương ứng
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: paymentStatus,
      },
    });

    const result = {
      message: isSuccess ? 'Thanh toán thành công' : 'Thanh toán thất bại',
      payment,
    };

    // 6. Lưu Idempotency-Key và kết quả JSON vào bảng ProcPaymentKey để chặn lặp request sau
    await this.prisma.procPaymentKey.create({
      data: {
        key: idempotencyKey,
        response: JSON.stringify(result),
      },
    });

    // Trả về kết quả kèm theo thông tin idempotencyKey cho client dễ kiểm tra
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
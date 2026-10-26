import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(createPaymentDto: CreatePaymentDto) {
    const { orderId, method } = createPaymentDto;

    // 1. Kiểm tra xem đơn hàng có tồn tại không
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng mã số: ${orderId}`);
    }

    // Tính toán số điểm thưởng (1 điểm cho mỗi 10.000 VNĐ)
    const pointsToAdd = Math.floor(order.total / 10000);

    // 2. Chạy Transaction bao gồm 3 thao tác
    const [payment, updatedOrder, updatedUser] = await this.prisma.$transaction([
      // Thao tác 1: Tạo bản ghi thanh toán mới
      this.prisma.payment.create({
        data: {
          orderId,
          method,
          amount: order.total,
        },
      }),
      
      // Thao tác 2: Cập nhật trạng thái đơn hàng thành "PAID"
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAID' }, 
      }),

      // Thao tác 3: Cộng điểm vào tài khoản khách hàng
      this.prisma.user.update({
        where: { id: order.userId },
        data: { rewardPoints: { increment: pointsToAdd } },
      }),
    ]);

    return {
      message: 'Thanh toán thành công',
      payment,
      order: updatedOrder,
      rewardPointsAdded: pointsToAdd,
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
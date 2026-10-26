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

    // 2. Chạy Transaction: Nếu 1 trong 2 thao tác lỗi, toàn bộ sẽ bị hủy để bảo toàn dữ liệu
    const [payment, updatedOrder] = await this.prisma.$transaction([
      // Thao tác 1: Tạo bản ghi thanh toán mới
      this.prisma.payment.create({
  data: {
    orderId,
    method,
    amount: order.total, // Xóa bỏ hai dấu gạch chéo // ở đầu dòng này
  },
}),
      
      // Thao tác 2: Cập nhật trạng thái đơn hàng thành "PAID"
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAID' }, 
      }),
    ]);

    return {
      message: 'Thanh toán thành công',
      payment,
      order: updatedOrder,
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
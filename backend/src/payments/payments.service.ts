import { Injectable, ConflictException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcPaymentDto } from './dto/procpayment.dto';
import { ProcPaymentKeyEntity } from './procpayment-key.entity';
import { Product } from './product.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(ProcPaymentKeyEntity)
    private readonly procPaymentKeyRepo: Repository<ProcPaymentKeyEntity>, // Đảm bảo khai báo đúng kiểu Repository
    private readonly dataSource: DataSource, // DataSource được inject trực tiếp từ NestJS
  ) {}

  // ==========================================
  // 1. LUỒNG CREATE PAYMENT (Code cũ của bạn)
  // ==========================================
  async processMockPayment(dto: CreatePaymentDto) {
    const isSuccess = Math.random() > 0.2;
    const paymentStatus = isSuccess ? 'PAID' : 'PAYMENT_FAILED';

    return {
      success: isSuccess,
      message: isSuccess ? 'Thanh toán thành công' : 'Thanh toán thất bại',
      data: {
        orderId: (dto as any).orderId,
        paymentMethod: (dto as any).paymentMethod,
        amount: dto.amount,
        status: paymentStatus,
        transactionTime: new Date().toISOString(),
      },
    };
  }

  // ==========================================
  // 2. LUỒNG PROCESS PAYMENT (Nâng cao: Idempotency + Optimistic Lock)
  // ==========================================
  async processPaymentWithStockDeduction(idempotencyKey: string, dto: ProcPaymentDto) {
    if (!idempotencyKey) {
      throw new HttpException('Thiếu header Idempotency-Key', HttpStatus.BAD_REQUEST);
    }

    // 1. Kiểm tra Idempotency Key trong DB
    const existing = await this.procPaymentKeyRepo.findOne({ where: { key: idempotencyKey } });
    if (existing) {
      if (existing.status === 'PROCESSING') {
        throw new ConflictException('Giao dịch đang được xử lý, vui lòng không bấm lại.');
      }
      return existing.result; // Trả về kết quả cũ nếu đã hoàn tất
    }

    // 2. Tạo khóa trạng thái PROCESSING
    const record = this.procPaymentKeyRepo.create({
      key: idempotencyKey,
      status: 'PROCESSING',
    });

    try {
      await this.procPaymentKeyRepo.save(record);
    } catch (e) {
      throw new ConflictException('Giao dịch trùng lặp đang được xử lý.');
    }

    // 3. Trừ kho bằng Optimistic Locking (với Transaction & Retry)
    const maxRetries = 3;
    let attempt = 0;
    let paymentResult: any;

    while (attempt < maxRetries) {
      attempt++;
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const product = await queryRunner.manager.findOne(Product, {
          where: { id: dto.productId },
        });

        if (!product) {
          throw new BadRequestException('Sản phẩm không tồn tại');
        }

        if (product.stock < dto.quantity) {
          throw new BadRequestException('Sản phẩm đã hết hàng hoặc không đủ số lượng');
        }

        // Trừ kho
        product.stock -= dto.quantity;
        await queryRunner.manager.save(product); // Optimistic lock được kiểm tra tự động qua version

        paymentResult = {
          success: true,
          transactionId: 'TXN_' + Date.now(),
          productId: product.id,
          remainingStock: product.stock,
          amount: dto.amount,
          message: 'Thanh toán và đặt hàng thành công',
        };

        await queryRunner.commitTransaction();
        break; // Thành công thì thoát vòng lặp
      } catch (err: any) {
        await queryRunner.rollbackTransaction();

        // Thử lại nếu xung đột version
        if (err.name === 'OptimisticLockVersionMismatchError' && attempt < maxRetries) {
          continue; 
        }

        record.status = 'FAILED';
        record.result = { error: err.message };
        await this.procPaymentKeyRepo.save(record);
        throw err;
      } finally {
        await queryRunner.release();
      }
    }

    // 4. Cập nhật trạng thái SUCCESS
    record.status = 'SUCCESS';
    record.result = paymentResult;
    await this.procPaymentKeyRepo.save(record);

    return paymentResult;
  }
}
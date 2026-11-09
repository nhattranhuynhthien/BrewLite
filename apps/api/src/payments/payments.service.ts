import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGateway } from './payment.gateway';
import {
  assertPaymentAllowed,
  assertTransition,
  OrderStatus,
} from '../orders/order-status';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private gateway: PaymentGateway,
  ) {}

  async create(
    createPaymentDto: CreatePaymentDto,
    idempotencyKey: string | undefined,
    userId: number,
  ) {
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

    let existingKey = await this.prisma.procPaymentKey.findUnique({
      where: { key: idempotencyKey },
    });
    let fromCache = Boolean(existingKey);
    if (existingKey) {
      const parsedResponse = JSON.parse(existingKey.response);
      this.assertSameRequest(parsedResponse, orderId, method);
      if (parsedResponse.status !== 'PROCESSING') {
        return {
          fromCache: true,
          idempotencyKey,
          ...parsedResponse,
        };
      }
    }

    assertPaymentAllowed(order.status);

    if (!existingKey) {
      const successfulPayment = await this.prisma.payment.findFirst({
        where: { orderId, status: 'PAID' },
      });

      if (successfulPayment) {
        throw new BadRequestException(
          'Đơn hàng này đã được thanh toán thành công trước đó.',
        );
      }
    }

    // A processing record lets retries reconcile the original gateway request with the same key.
    const processingResponse = { status: 'PROCESSING', orderId, method };
    const processingResponseJson = JSON.stringify(processingResponse);
    if (!existingKey) {
      try {
        existingKey = await this.prisma.procPaymentKey.create({
          data: { key: idempotencyKey, response: processingResponseJson },
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }

        existingKey = await this.prisma.procPaymentKey.findUnique({
          where: { key: idempotencyKey },
        });
        if (!existingKey) throw error;

        fromCache = true;
        const parsedResponse = JSON.parse(existingKey.response);
        this.assertSameRequest(parsedResponse, orderId, method);
        if (parsedResponse.status !== 'PROCESSING') {
          return {
            fromCache: true,
            idempotencyKey,
            ...parsedResponse,
          };
        }
      }
    }

    // The gateway must deduplicate repeated calls using this same key.
    const { success } = await this.gateway.charge(
      orderId,
      order.total,
      method,
      idempotencyKey,
    );

    // Tính toán số điểm thưởng (1 điểm cho mỗi 10.000 VNĐ), chỉ khi thanh toán thành công
    const pointsToAdd = success ? Math.floor(order.total / 10000) : 0;
    const paymentStatus = success ? 'PAID' : 'FAILED';
    const orderStatus = success
      ? OrderStatus.PAID
      : OrderStatus.PAYMENT_FAILED;

    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.procPaymentKey.updateMany({
        where: { key: idempotencyKey, response: processingResponseJson },
        data: {
          response: JSON.stringify({
            ...processingResponse,
            status: 'FINALIZING',
          }),
        },
      });

      if (claim.count !== 1) {
        const currentKey = await tx.procPaymentKey.findUnique({
          where: { key: idempotencyKey },
        });
        if (!currentKey)
          throw new ConflictException(
            'Không thể xác nhận trạng thái yêu cầu thanh toán.',
          );
        const currentResponse = JSON.parse(currentKey.response);
        if (
          currentResponse.status !== 'FINALIZING' &&
          currentResponse.status !== 'PROCESSING'
        ) {
          return currentResponse;
        }
        throw new ConflictException(
          'Yêu cầu thanh toán đang được xử lý. Vui lòng thử lại.',
        );
      }

      let expectedStatus = order.status;
      if (expectedStatus === OrderStatus.PAYMENT_FAILED) {
        assertTransition(expectedStatus, OrderStatus.PENDING);
        const retryTransition = await tx.order.updateMany({
          where: { id: orderId, status: expectedStatus },
          data: { status: OrderStatus.PENDING },
        });
        if (retryTransition.count !== 1) {
          throw new ConflictException(
            'Order status changed while payment was being processed. Please retry.',
          );
        }
        expectedStatus = OrderStatus.PENDING;
      }

      assertTransition(expectedStatus, orderStatus);
      const orderTransition = await tx.order.updateMany({
        where: { id: orderId, status: expectedStatus },
        data: { status: orderStatus },
      });
      if (orderTransition.count !== 1) {
        throw new ConflictException(
          'Order status changed while payment was being processed. Please retry.',
        );
      }

      const updatedOrder = await tx.order.findUnique({
        where: { id: orderId },
      });
      if (!updatedOrder) {
        throw new NotFoundException(`Không tìm thấy đơn hàng mã số: ${orderId}`);
      }
      const payment = await tx.payment.create({
        data: { orderId, method, amount: order.total, status: paymentStatus },
      });
      if (success) {
        await tx.user.update({
          where: { id: order.userId },
          data: { rewardPoints: { increment: pointsToAdd } },
        });
      }

      const paymentResult = {
        status: paymentStatus,
        message: success ? 'Thanh toán thành công' : 'Thanh toán thất bại',
        orderId: order.id,
        orderStatus,
        payment,
        order: updatedOrder,
        rewardPointsAdded: pointsToAdd,
      };
      await tx.procPaymentKey.update({
        where: { key: idempotencyKey },
        data: { response: JSON.stringify(paymentResult) },
      });
      return paymentResult;
    });

    return {
      fromCache,
      idempotencyKey,
      ...result,
    };
  }

  private assertSameRequest(
    response: {
      orderId?: number;
      method?: string;
      payment?: { orderId?: number; method?: string };
    },
    orderId: number,
    method: string,
  ): void {
    const storedOrderId = response.orderId ?? response.payment?.orderId;
    const storedMethod = response.method ?? response.payment?.method;
    if (
      storedOrderId !== orderId ||
      (storedMethod !== undefined && storedMethod !== method)
    ) {
      throw new ConflictException(
        'Idempotency-Key đã được dùng cho một yêu cầu khác.',
      );
    }
  }
}

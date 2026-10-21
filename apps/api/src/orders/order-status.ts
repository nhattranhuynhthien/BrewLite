import { BadRequestException } from '@nestjs/common';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_FAILED]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

function isOrderStatus(status: string): status is OrderStatus {
  return Object.values(OrderStatus).includes(status as OrderStatus);
}

export function assertTransition(currentStatus: string, nextStatus: string): void {
  if (
    !isOrderStatus(currentStatus) ||
    !isOrderStatus(nextStatus) ||
    !allowedTransitions[currentStatus].includes(nextStatus)
  ) {
    throw new BadRequestException(
      `Order status transition ${currentStatus} -> ${nextStatus} is not allowed`,
    );
  }
}

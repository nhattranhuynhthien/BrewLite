import { BadRequestException } from '@nestjs/common';
import { assertTransition, OrderStatus } from './order-status';

describe('assertTransition', () => {
  it('allows the successful order lifecycle', () => {
    expect(() => {
      assertTransition(OrderStatus.PENDING, OrderStatus.PAID);
      assertTransition(OrderStatus.PAID, OrderStatus.PREPARING);
      assertTransition(OrderStatus.PREPARING, OrderStatus.READY);
      assertTransition(OrderStatus.READY, OrderStatus.COMPLETED);
    }).not.toThrow();
  });

  it('allows retrying a failed payment or cancelling the order', () => {
    expect(() =>
      assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.PENDING),
    ).not.toThrow();
    expect(() =>
      assertTransition(OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED),
    ).not.toThrow();
  });

  it.each([
    [OrderStatus.PENDING, OrderStatus.PREPARING],
    [OrderStatus.PAID, OrderStatus.READY],
    [OrderStatus.COMPLETED, OrderStatus.PAID],
    [OrderStatus.CANCELLED, OrderStatus.PENDING],
    ['UNKNOWN', OrderStatus.PAID],
  ])('blocks the invalid transition %s -> %s', (current, next) => {
    expect(() => assertTransition(current, next)).toThrow(BadRequestException);
  });
});

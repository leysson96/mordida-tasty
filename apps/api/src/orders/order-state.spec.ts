import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { activeKitchenStatuses, assertOrderTransition } from './order-state';

describe('order state machine', () => {
  it('allows the kitchen flow from paid to delivered', () => {
    expect(() => assertOrderTransition(OrderStatus.PAID, OrderStatus.CONFIRMED)).not.toThrow();
    expect(() =>
      assertOrderTransition(OrderStatus.CONFIRMED, OrderStatus.PREPARING)
    ).not.toThrow();
    expect(() => assertOrderTransition(OrderStatus.PREPARING, OrderStatus.READY)).not.toThrow();
    expect(() => assertOrderTransition(OrderStatus.READY, OrderStatus.DELIVERED)).not.toThrow();
  });

  it('blocks cancelling paid orders without an explicit refund flow', () => {
    expect(() => assertOrderTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toThrow(
      BadRequestException
    );
  });

  it('keeps unpaid orders out of the kitchen board', () => {
    expect(activeKitchenStatuses).toEqual([
      OrderStatus.PAID,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY
    ]);
  });
});

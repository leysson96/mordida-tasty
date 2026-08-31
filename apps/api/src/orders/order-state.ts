import { BadRequestException } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";

const transitions: Record<OrderStatus, OrderStatus[]> = {
  CREATED: [
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.CANCELLED,
    OrderStatus.EXPIRED,
  ],
  PENDING_PAYMENT: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.EXPIRED,
    OrderStatus.CANCELLED,
  ],
  PAID: [OrderStatus.CONFIRMED],
  CONFIRMED: [OrderStatus.PREPARING],
  PREPARING: [OrderStatus.READY],
  READY: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
  PAYMENT_FAILED: [
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
    OrderStatus.EXPIRED,
  ],
  EXPIRED: [
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
  ],
};

export const paidOrBeyondStatuses: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.DELIVERED,
];

export const revenueOrderStatuses = paidOrBeyondStatuses;
export const removableOrderItemStatuses = paidOrBeyondStatuses;

export function assertOrderTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) {
    return;
  }

  if (!transitions[from].includes(to)) {
    throw new BadRequestException(`Invalid order transition: ${from} -> ${to}`);
  }
}

export const activeKitchenStatuses = [
  OrderStatus.PAID,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

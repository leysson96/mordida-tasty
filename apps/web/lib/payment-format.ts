import { formatMoney } from "./api";
import type { OrderSummary } from "./types";

export function paymentMethodLabel(order: Pick<OrderSummary, "paymentMethod">) {
  return order.paymentMethod === "CASH" ? "Efectivo" : "Tarjeta";
}

export function paymentSummaryText(
  order: Pick<
    OrderSummary,
    "paymentMethod" | "deliveryMethod" | "cashTenderedCents" | "cashChangeCents"
  >,
) {
  if (order.paymentMethod !== "CASH") {
    return "Tarjeta";
  }

  if (
    order.cashTenderedCents !== null &&
    order.cashTenderedCents !== undefined
  ) {
    const changeCents = Math.max(0, order.cashChangeCents ?? 0);
    return `Efectivo - paga con ${formatMoney(order.cashTenderedCents)} - cambio ${formatMoney(changeCents)}`;
  }

  return order.deliveryMethod === "DELIVERY"
    ? "Efectivo en entrega"
    : "Efectivo en local";
}

export function isCardPayment(order: Pick<OrderSummary, "paymentMethod">) {
  return !order.paymentMethod || order.paymentMethod === "CARD";
}

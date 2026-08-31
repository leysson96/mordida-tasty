import type { OrderStatus } from "./types";

export const orderStatusLabels: Record<OrderStatus, string> = {
  CREATED: "Creado",
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  PAYMENT_FAILED: "Pago fallido",
  EXPIRED: "Expirado",
};

export const adminNextStatuses: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ["PENDING_PAYMENT", "CANCELLED", "EXPIRED"],
  PENDING_PAYMENT: ["PAID", "PAYMENT_FAILED", "EXPIRED", "CANCELLED"],
  PAID: ["CONFIRMED"],
  CONFIRMED: ["PREPARING"],
  PREPARING: ["READY"],
  READY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  PAYMENT_FAILED: ["PENDING_PAYMENT", "PAID", "CANCELLED", "EXPIRED"],
  EXPIRED: ["PENDING_PAYMENT", "PAID", "CANCELLED"],
};

export const removableOrderItemStatuses = new Set<OrderStatus>([
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
]);

export const activeAdminOrderStatuses: OrderStatus[] = [
  "CREATED",
  "PENDING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
];

export const trackingProgressStatuses: OrderStatus[] = [
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
];

export const kitchenColumns: Array<{
  status: OrderStatus;
  title: string;
  next?: OrderStatus;
  action?: string;
}> = [
  { status: "PAID", title: "Nuevos", next: "CONFIRMED", action: "Confirmar" },
  {
    status: "CONFIRMED",
    title: "Confirmados",
    next: "PREPARING",
    action: "Preparar",
  },
  { status: "PREPARING", title: "Preparando", next: "READY", action: "Listo" },
  { status: "READY", title: "Listos", next: "DELIVERED", action: "Entregado" },
];

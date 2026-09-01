"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  CookingPot,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { api, formatMoney } from "../lib/api";
import {
  orderStatusLabels,
  trackingProgressStatuses,
} from "../lib/order-state";
import { formatOrderItemOptions } from "../lib/order-format";
import type { OrderStatus, OrderSummary } from "../lib/types";
import { useCart } from "./cart-provider";

const pendingCheckoutStorageKey = "mordida_pending_checkout_order";
const trackingStatusIcons: Partial<Record<OrderStatus, LucideIcon>> = {
  PAID: ReceiptText,
  CONFIRMED: CheckCircle2,
  PREPARING: CookingPot,
  READY: PackageCheck,
  DELIVERED: Truck,
};

const trackingStepDescriptions: Partial<Record<OrderStatus, string>> = {
  PAID: "Pago recibido",
  CONFIRMED: "Pedido aceptado",
  PREPARING: "Cocina en marcha",
  READY: "Listo para salir",
  DELIVERED: "Pedido completado",
};

export function TrackingClient({
  orderNumber,
  trackingToken,
}: {
  orderNumber: string;
  trackingToken?: string;
}) {
  const [order, setOrder] = useState<OrderSummary>();
  const [error, setError] = useState<string>();
  const { clear } = useCart();

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        if (!trackingToken) {
          throw new Error("El enlace de seguimiento no es valido.");
        }

        const query = new URLSearchParams({ t: trackingToken });
        const data = await api<OrderSummary>(
          `/orders/track/${encodeURIComponent(orderNumber)}?${query.toString()}`,
        );
        if (active) {
          setOrder(data);
          setError(undefined);
        }
        if (
          window.sessionStorage.getItem(pendingCheckoutStorageKey) ===
          data.orderNumber
        ) {
          clear();
          window.sessionStorage.removeItem(pendingCheckoutStorageKey);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar.",
          );
        }
      }
    }

    load();
    const id = window.setInterval(load, 10_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [clear, orderNumber, trackingToken]);

  if (error) {
    return <main className="page-shell empty-state error">{error}</main>;
  }

  if (!order) {
    return (
      <main className="page-shell empty-state">
        <RefreshCw className="spin" aria-hidden="true" />
        Cargando pedido
      </main>
    );
  }

  const currentIndex = trackingProgressStatuses.indexOf(order.status);
  const hasProgress = currentIndex >= 0;
  const latestStatus =
    order.statusHistory && order.statusHistory.length > 0
      ? order.statusHistory[order.statusHistory.length - 1]
      : undefined;
  const deliveryLabel =
    order.deliveryMethod === "DELIVERY"
      ? "Entrega a domicilio"
      : "Recogida en local";
  const MethodIcon = order.deliveryMethod === "DELIVERY" ? Truck : Store;

  return (
    <main className="page-shell tracking-page">
      <section className="tracking-hero">
        <div>
          <p className="eyebrow">Pedido {order.orderNumber}</p>
          <h1>{orderStatusLabels[order.status]}</h1>
          <p>{deliveryLabel}</p>
        </div>
        <div className="tracking-hero-meta" aria-label="Detalles del pedido">
          <span>
            <MethodIcon aria-hidden="true" size={17} />
            {deliveryLabel}
          </span>
          <span>
            <RefreshCw aria-hidden="true" size={17} />
            Actualiza cada 10s
          </span>
        </div>
      </section>

      <section className="tracking-panel" aria-label="Estado del pedido">
        <div className="tracking-panel-head">
          <h2>Seguimiento</h2>
          <span>
            {latestStatus
              ? formatTrackingDate(latestStatus.createdAt)
              : formatTrackingDate(order.createdAt)}
          </span>
        </div>
        <div className="tracking-steps">
          {trackingProgressStatuses.map((status, index) => {
            const done = hasProgress && index <= currentIndex;
            const current = hasProgress && index === currentIndex;
            const StepIcon = trackingStatusIcons[status] ?? Clock3;

            return (
              <div
                key={status}
                className={`tracking-step ${done ? "done" : ""} ${
                  current ? "current" : ""
                }`}
              >
                <span className="tracking-step-marker">
                  {done ? (
                    <CheckCircle2 aria-hidden="true" size={20} />
                  ) : (
                    <StepIcon aria-hidden="true" size={19} />
                  )}
                </span>
                <span className="tracking-step-copy">
                  <strong>{orderStatusLabels[status]}</strong>
                  <small>{trackingStepDescriptions[status]}</small>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="tracking-info-grid">
        <article>
          <span>Total</span>
          <strong>{formatMoney(order.totalCents)}</strong>
        </article>
        <article>
          <span>Creado</span>
          <strong>{formatTrackingDate(order.createdAt)}</strong>
        </article>
        <article className="wide">
          <span>{deliveryLabel}</span>
          <strong>
            {order.deliveryMethod === "DELIVERY"
              ? [
                  order.deliveryStreet,
                  order.deliveryCity,
                  order.deliveryPostalCode,
                ]
                  .filter(Boolean)
                  .join(", ") || "Direccion pendiente"
              : "Te avisaremos cuando este listo"}
          </strong>
          {order.deliveryMethod === "DELIVERY" && order.deliveryNotes && (
            <small>{order.deliveryNotes}</small>
          )}
        </article>
      </section>

      <section className="summary-panel tracking-summary">
        <h2>Productos</h2>
        {order.items.map((item, itemIndex) => (
          <div key={item.id ?? `${item.productName}-${itemIndex}`}>
            <span className="summary-item-copy">
              <strong>
                {item.quantity} x {item.productName}
              </strong>
              {item.options && item.options.length > 0 && (
                <small>{formatOrderItemOptions(item)}</small>
              )}
            </span>
            <strong>{formatMoney(item.lineTotalCents)}</strong>
          </div>
        ))}
        <div className="total-row">
          <span>Total</span>
          <strong>{formatMoney(order.totalCents)}</strong>
        </div>
      </section>
    </main>
  );
}

function formatTrackingDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

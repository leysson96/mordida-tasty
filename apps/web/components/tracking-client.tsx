"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, formatMoney } from "../lib/api";
import {
  orderStatusLabels,
  trackingProgressStatuses,
} from "../lib/order-state";
import { formatOrderItemOptions } from "../lib/order-format";
import { OrderSummary } from "../lib/types";
import { useCart } from "./cart-provider";

const pendingCheckoutStorageKey = "mordida_pending_checkout_order";

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

  return (
    <main className="page-shell narrow-page">
      <section className="tracking-hero">
        <p className="eyebrow">Pedido {order.orderNumber}</p>
        <h1>{orderStatusLabels[order.status]}</h1>
        <p>
          {order.deliveryMethod === "DELIVERY"
            ? "Entrega a domicilio"
            : "Recogida en local"}
        </p>
      </section>

      <section className="status-rail" aria-label="Estado del pedido">
        {trackingProgressStatuses.map((status, index) => (
          <div key={status} className={index <= currentIndex ? "done" : ""}>
            <span>{index + 1}</span>
            <p>{orderStatusLabels[status]}</p>
          </div>
        ))}
      </section>

      <section className="summary-panel">
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

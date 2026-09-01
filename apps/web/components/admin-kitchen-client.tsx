"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Check,
  ChefHat,
  CreditCard,
  LogOut,
  PackageCheck,
  Printer,
  RefreshCw,
} from "lucide-react";
import { api, formatMoney } from "../lib/api";
import {
  readableErrorMessage,
  redirectOnAdminAuthError,
} from "../lib/admin-errors";
import { brandConfig } from "../lib/brand";
import { kitchenColumns } from "../lib/order-state";
import { formatOrderItemOptions } from "../lib/order-format";
import {
  OrderStatus,
  OrderSummary,
  PublicSettings,
  SiteContent,
  User,
} from "../lib/types";
import { paymentSummaryText } from "../lib/payment-format";
import { logoutAdmin } from "./admin-auth";
import { KitchenAlarm } from "./kitchen-alarm";

export function AdminKitchenClient() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [user, setUser] = useState<User>();
  const [error, setError] = useState<string>();
  const [printingOrderId, setPrintingOrderId] = useState<string>();
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [siteContent, setSiteContent] = useState<SiteContent>(brandConfig);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [me, data, settings] = await Promise.all([
          api<User>("/admin/auth/me"),
          api<OrderSummary[]>("/admin/orders/kitchen"),
          api<PublicSettings>("/settings/public"),
        ]);
        if (active) {
          setUser(me);
          setOrders(data);
          setSiteContent({ ...brandConfig, ...settings.siteContent });
          setError(undefined);
        }
      } catch (requestError) {
        if (active) {
          handleAdminError(
            requestError,
            "No se pudieron cargar los pedidos de cocina.",
          );
        }
      }
    }

    load();
    const id = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const ordersByStatus = useMemo(
    () =>
      kitchenColumns.reduce(
        (acc, column) => ({
          ...acc,
          [column.status]: orders.filter(
            (order) => order.status === column.status,
          ),
        }),
        {} as Record<OrderStatus, OrderSummary[]>,
      ),
    [orders],
  );

  const printingOrder = orders.find((order) => order.id === printingOrderId);

  async function changeStatus(orderId: string, status: OrderStatus) {
    try {
      const updated = await api<OrderSummary>(
        `/admin/orders/${orderId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );

      if (status === "DELIVERED") {
        setOrders((current) => current.filter((order) => order.id !== orderId));
      } else {
        setOrders((current) =>
          current.map((order) => (order.id === orderId ? updated : order)),
        );
      }
      setAcknowledged((current) => new Set(current).add(orderId));
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo actualizar el pedido.");
    }
  }

  function printOrder(orderId: string) {
    setPrintingOrderId(orderId);
    window.setTimeout(() => window.print(), 80);
  }

  async function logout() {
    try {
      await logoutAdmin();
    } finally {
      window.location.href = "/admin/login";
    }
  }

  function handleAdminError(requestError: unknown, fallback: string) {
    if (redirectOnAdminAuthError(requestError)) {
      return;
    }

    setError(readableErrorMessage(requestError, fallback));
  }

  return (
    <main className="page-shell kitchen-page">
      <section className="admin-toolbar no-print">
        <div>
          <p className="eyebrow">Cocina</p>
          <h1>Pedidos en marcha</h1>
        </div>
        <div className="toolbar-actions">
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="button secondary">
              <ArrowLeft aria-hidden="true" size={18} />
              Panel
            </Link>
          )}
          <button
            type="button"
            className="icon-button"
            onClick={logout}
            title="Salir"
          >
            <LogOut aria-hidden="true" size={20} />
          </button>
        </div>
      </section>

      {error && <div className="empty-state error no-print">{error}</div>}

      <KitchenAlarm
        orders={orders}
        acknowledged={acknowledged}
        onSilence={() =>
          setAcknowledged(new Set(orders.map((order) => order.id)))
        }
      />

      <section className="kitchen-board no-print">
        {kitchenColumns.map((column) => (
          <div className="kitchen-column" key={column.status}>
            <div className="kitchen-column-head">
              <h2>{column.title}</h2>
              <span>{ordersByStatus[column.status]?.length ?? 0}</span>
            </div>

            {(ordersByStatus[column.status]?.length ?? 0) === 0 ? (
              <div className="empty-state compact">
                <RefreshCw aria-hidden="true" size={22} />
                Sin pedidos
              </div>
            ) : (
              ordersByStatus[column.status].map((order) => (
                <article className="kitchen-card" key={order.id}>
                  <div className="kitchen-card-head">
                    <div>
                      <strong>{order.orderNumber}</strong>
                      <span>
                        {new Date(order.createdAt).toLocaleTimeString("es-ES")}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => printOrder(order.id)}
                      title="Imprimir comanda"
                    >
                      <Printer aria-hidden="true" size={19} />
                    </button>
                  </div>

                  <div className="kitchen-service">
                    {order.deliveryMethod === "DELIVERY" ? (
                      <>
                        <ChefHat aria-hidden="true" size={18} />
                        <span>Envio</span>
                      </>
                    ) : (
                      <>
                        <PackageCheck aria-hidden="true" size={18} />
                        <span>Recogida</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`payment-chip ${
                      order.paymentMethod === "CASH" ? "cash" : ""
                    }`}
                  >
                    {order.paymentMethod === "CASH" ? (
                      <Banknote aria-hidden="true" size={16} />
                    ) : (
                      <CreditCard aria-hidden="true" size={16} />
                    )}
                    <span>{paymentSummaryText(order)}</span>
                  </div>

                  <ul>
                    {order.items
                      .filter((item) => !item.removedAt)
                      .map((item, itemIndex) => (
                        <li
                          key={
                            item.id ??
                            `${order.id}-${item.productName}-${itemIndex}`
                          }
                        >
                          <span>{item.quantity}x</span>
                          <div className="kitchen-line-copy">
                            <strong>{item.productName}</strong>
                            {item.options && item.options.length > 0 && (
                              <small>{formatOrderItemOptions(item)}</small>
                            )}
                          </div>
                        </li>
                      ))}
                  </ul>

                  {order.deliveryNotes && (
                    <p className="kitchen-note">{order.deliveryNotes}</p>
                  )}

                  <div className="kitchen-card-foot">
                    <span>{formatMoney(order.totalCents)}</span>
                    {column.next && (
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => changeStatus(order.id, column.next!)}
                      >
                        <Check aria-hidden="true" size={18} />
                        {column.action}
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        ))}
      </section>

      <section className="print-ticket">
        {printingOrder && (
          <>
            <h1>{siteContent.name}</h1>
            <p>{printingOrder.orderNumber}</p>
            <p>{new Date(printingOrder.createdAt).toLocaleString("es-ES")}</p>
            <p>{paymentSummaryText(printingOrder)}</p>
            <hr />
            {printingOrder.items
              .filter((item) => !item.removedAt)
              .map((item, itemIndex) => (
                <div
                  key={`kitchen-print-${item.id ?? `${item.productName}-${itemIndex}`}`}
                >
                  <span>
                    {item.quantity} x {item.productName}
                    {item.options && item.options.length > 0 && (
                      <small>{formatOrderItemOptions(item)}</small>
                    )}
                  </span>
                  <strong>{formatMoney(item.lineTotalCents)}</strong>
                </div>
              ))}
            <hr />
            <div>
              <span>Total</span>
              <strong>{formatMoney(printingOrder.totalCents)}</strong>
            </div>
            <p>
              {printingOrder.deliveryMethod === "DELIVERY"
                ? "ENVIO"
                : "RECOGIDA"}
            </p>
            {printingOrder.deliveryNotes && (
              <p>{printingOrder.deliveryNotes}</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

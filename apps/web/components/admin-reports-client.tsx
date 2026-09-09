"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Filter,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Truck,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { api, formatMoney } from "../lib/api";
import {
  readableErrorMessage,
  redirectOnAdminAuthError,
} from "../lib/admin-errors";
import { orderStatusLabels } from "../lib/order-state";
import { formatOrderItemOptions } from "../lib/order-format";
import { paymentMethodLabel, paymentSummaryText } from "../lib/payment-format";
import type {
  AdminOrderHistoryResponse,
  DeliveryMethod,
  OrderPaymentMethod,
  OrderStatus,
  OrderSummary,
} from "../lib/types";

interface SalesReportResponse {
  from: string;
  to: string;
  totalRevenueCents: number;
  orderCount: number;
  averageTicketCents: number;
  salesByDay: Array<{
    date: string;
    revenueCents: number;
    orderCount: number;
  }>;
  topProducts: Array<{
    productName: string;
    quantity: number;
    revenueCents: number;
  }>;
}

type RangePreset = "today" | "7d" | "30d" | "month";
type HistoryStatusFilter = OrderStatus | "ALL";
type HistoryPaymentMethodFilter = OrderPaymentMethod | "ALL";
type HistoryDeliveryMethodFilter = DeliveryMethod | "ALL";

interface OrderHistoryFilters {
  q: string;
  status: HistoryStatusFilter;
  paymentMethod: HistoryPaymentMethodFilter;
  deliveryMethod: HistoryDeliveryMethodFilter;
  from: string;
  to: string;
}

type OrderHistoryMeta = Omit<AdminOrderHistoryResponse, "orders">;

const historyPageSize = 100;
const historyStatusOptions = Object.keys(orderStatusLabels) as OrderStatus[];

function inputDate(date: Date) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 10);
}

function presetRange(preset: RangePreset) {
  const today = new Date();
  const from = new Date(today);

  if (preset === "today") {
    return { from: inputDate(today), to: inputDate(today) };
  }

  if (preset === "month") {
    from.setDate(1);
    return { from: inputDate(from), to: inputDate(today) };
  }

  from.setDate(today.getDate() - (preset === "7d" ? 6 : 29));
  return { from: inputDate(from), to: inputDate(today) };
}

function historyFiltersForRange(range: { from: string; to: string }) {
  return {
    q: "",
    status: "ALL",
    paymentMethod: "ALL",
    deliveryMethod: "ALL",
    from: range.from,
    to: range.to,
  } satisfies OrderHistoryFilters;
}

const emptyHistoryFilters: OrderHistoryFilters = {
  q: "",
  status: "ALL",
  paymentMethod: "ALL",
  deliveryMethod: "ALL",
  from: "",
  to: "",
};

const emptyHistoryMeta: OrderHistoryMeta = {
  total: 0,
  page: 1,
  pageSize: historyPageSize,
  totalPages: 1,
};

export function AdminReportsClient() {
  const initialRange = useMemo(() => presetRange("30d"), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [report, setReport] = useState<SalesReportResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [historyFilters, setHistoryFilters] = useState<OrderHistoryFilters>(
    () => historyFiltersForRange(initialRange),
  );
  const [appliedHistoryFilters, setAppliedHistoryFilters] =
    useState<OrderHistoryFilters>(() => historyFiltersForRange(initialRange));
  const [historyOrders, setHistoryOrders] = useState<OrderSummary[]>([]);
  const [historyMeta, setHistoryMeta] =
    useState<OrderHistoryMeta>(emptyHistoryMeta);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string>();
  const [selectedHistoryOrderId, setSelectedHistoryOrderId] =
    useState<string>();

  useEffect(() => {
    loadReport(initialRange.from, initialRange.to);
    loadOrderHistory(historyFiltersForRange(initialRange), 1);
  }, [initialRange.from, initialRange.to]);

  async function loadReport(nextFrom = from, nextTo = to) {
    setLoading(true);
    setError(undefined);

    try {
      const params = new URLSearchParams({ from: nextFrom, to: nextTo });
      const data = await api<SalesReportResponse>(
        `/admin/reports/sales?${params.toString()}`,
      );
      setReport(data);
    } catch (requestError) {
      if (redirectOnAdminAuthError(requestError)) {
        return;
      }
      setError(readableErrorMessage(requestError, "No se pudo cargar."));
    } finally {
      setLoading(false);
    }
  }

  async function loadOrderHistory(nextFilters = historyFilters, nextPage = 1) {
    setHistoryLoading(true);
    setHistoryError(undefined);

    try {
      const data = await api<AdminOrderHistoryResponse>(
        adminOrderHistoryPath(nextFilters, nextPage),
      );
      setAppliedHistoryFilters(nextFilters);
      setHistoryOrders(data.orders);
      setHistoryMeta({
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: data.totalPages,
      });
      setSelectedHistoryOrderId(undefined);
    } catch (requestError) {
      if (redirectOnAdminAuthError(requestError)) {
        return;
      }
      setHistoryError(
        readableErrorMessage(requestError, "No se pudo cargar el historial."),
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadReport();
  }

  function submitHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadOrderHistory(historyFilters, 1);
  }

  function clearHistoryFilters() {
    setHistoryFilters(emptyHistoryFilters);
    loadOrderHistory(emptyHistoryFilters, 1);
  }

  function loadHistoryPage(page: number) {
    loadOrderHistory(appliedHistoryFilters, page);
  }

  function applyPreset(preset: RangePreset) {
    const range = presetRange(preset);
    setFrom(range.from);
    setTo(range.to);
    loadReport(range.from, range.to);
  }

  function updateHistoryFilter<K extends keyof OrderHistoryFilters>(
    key: K,
    value: OrderHistoryFilters[K],
  ) {
    setHistoryFilters((current) => ({ ...current, [key]: value }));
  }

  const activeSalesDays =
    report?.salesByDay.filter(
      (day) => day.revenueCents > 0 || day.orderCount > 0,
    ) ?? [];
  const chartDays =
    activeSalesDays.length > 0
      ? activeSalesDays
      : (report?.salesByDay.slice(-7) ?? []);
  const maxRevenue = Math.max(
    ...(chartDays.map((day) => day.revenueCents) ?? [0]),
    0,
  );
  const maxProductRevenue = Math.max(
    ...(report?.topProducts.map((product) => product.revenueCents) ?? [0]),
    0,
  );
  const bestDay = activeSalesDays.reduce<
    SalesReportResponse["salesByDay"][number] | undefined
  >(
    (best, day) => (!best || day.revenueCents > best.revenueCents ? day : best),
    undefined,
  );
  const topProduct = report?.topProducts[0];
  const selectedHistoryOrder = selectedHistoryOrderId
    ? historyOrders.find((order) => order.id === selectedHistoryOrderId)
    : undefined;
  const canPageBack = historyMeta.page > 1;
  const canPageForward = historyMeta.page < historyMeta.totalPages;

  return (
    <main className="page-shell admin-page admin-report-page">
      <section className="admin-toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Reportes</h1>
        </div>
      </section>

      <form className="report-controls" onSubmit={submit}>
        <div className="report-presets">
          <button
            type="button"
            className="button secondary"
            onClick={() => applyPreset("today")}
          >
            Hoy
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => applyPreset("7d")}
          >
            7 dias
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => applyPreset("30d")}
          >
            30 dias
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => applyPreset("month")}
          >
            Mes
          </button>
        </div>
        <label>
          Desde
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <button className="button primary" type="submit" disabled={loading}>
          <CalendarDays aria-hidden="true" size={18} />
          Filtrar
        </button>
      </form>

      {error && <div className="empty-state error">{error}</div>}

      <section className="admin-metrics">
        <article>
          <span>Ingresos</span>
          <strong>{formatMoney(report?.totalRevenueCents ?? 0)}</strong>
          <small>Ventas cobradas</small>
        </article>
        <article>
          <span>Pedidos</span>
          <strong>{report?.orderCount ?? 0}</strong>
          <small>{activeSalesDays.length} dias con venta</small>
        </article>
        <article>
          <span>Ticket medio</span>
          <strong>{formatMoney(report?.averageTicketCents ?? 0)}</strong>
          <small>Promedio por pedido</small>
        </article>
      </section>

      {report && (
        <section className="report-insights">
          <article>
            <CalendarDays aria-hidden="true" size={20} />
            <div>
              <span>Rango</span>
              <strong>
                {formatReportDate(report.from)} - {formatReportDate(report.to)}
              </strong>
            </div>
          </article>
          <article>
            <Trophy aria-hidden="true" size={20} />
            <div>
              <span>Mejor dia</span>
              <strong>
                {bestDay ? formatReportDate(bestDay.date) : "Sin ventas"}
              </strong>
              {bestDay && <small>{formatMoney(bestDay.revenueCents)}</small>}
            </div>
          </article>
          <article>
            <PackageCheck aria-hidden="true" size={20} />
            <div>
              <span>Producto lider</span>
              <strong>{topProduct?.productName ?? "Sin ventas"}</strong>
              {topProduct && <small>{topProduct.quantity} uds.</small>}
            </div>
          </article>
        </section>
      )}

      <section className="report-grid">
        <section className="form-panel">
          <h2>
            <BarChart3 aria-hidden="true" size={20} />
            Actividad diaria
          </h2>
          {!report || loading ? (
            <div className="empty-state">
              <RefreshCw className="spin" aria-hidden="true" />
              Cargando reportes
            </div>
          ) : (
            <div className="trend-chart">
              {chartDays.map((day) => {
                const height =
                  maxRevenue > 0
                    ? Math.max(8, (day.revenueCents / maxRevenue) * 100)
                    : 8;
                return (
                  <article className="trend-day" key={day.date}>
                    <div className="trend-day-label">
                      <strong>{formatReportDate(day.date)}</strong>
                      <span>{day.orderCount} ped.</span>
                    </div>
                    <div className="trend-bar-track">
                      <span
                        className="trend-bar"
                        style={{ height: `${height}%` }}
                        title={formatMoney(day.revenueCents)}
                      />
                    </div>
                    <strong>{formatMoney(day.revenueCents)}</strong>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="form-panel">
          <h2>
            <ReceiptText aria-hidden="true" size={20} />
            Productos mas vendidos
          </h2>
          <div className="report-product-list">
            {report?.topProducts.length ? (
              report.topProducts.map((product, index) => {
                const width =
                  maxProductRevenue > 0
                    ? Math.max(
                        8,
                        (product.revenueCents / maxProductRevenue) * 100,
                      )
                    : 8;

                return (
                  <article
                    className="report-product-row"
                    key={product.productName}
                  >
                    <span className="report-product-rank">{index + 1}</span>
                    <div>
                      <strong>{product.productName}</strong>
                      <small>{product.quantity} uds.</small>
                      <span className="report-product-meter">
                        <span style={{ width: `${width}%` }} />
                      </span>
                    </div>
                    <strong>{formatMoney(product.revenueCents)}</strong>
                  </article>
                );
              })
            ) : (
              <p className="muted">Sin ventas en este rango.</p>
            )}
          </div>
        </section>
      </section>

      <section className="form-panel order-history-panel">
        <div className="section-heading">
          <h2>
            <ReceiptText aria-hidden="true" size={20} />
            Historial de pedidos
          </h2>
          <span className="admin-soft-pill">
            {historyOrderCountLabel(historyMeta.total)}
          </span>
        </div>

        <form className="history-filter-bar" onSubmit={submitHistory}>
          <label className="search-field">
            Buscar
            <div>
              <Search aria-hidden="true" size={18} />
              <input
                value={historyFilters.q}
                onChange={(event) =>
                  updateHistoryFilter("q", event.target.value)
                }
                placeholder="Pedido, cliente, email, telefono"
              />
            </div>
          </label>
          <label>
            Estado
            <select
              value={historyFilters.status}
              onChange={(event) =>
                updateHistoryFilter(
                  "status",
                  event.target.value as HistoryStatusFilter,
                )
              }
            >
              <option value="ALL">Todos</option>
              {historyStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pago
            <select
              value={historyFilters.paymentMethod}
              onChange={(event) =>
                updateHistoryFilter(
                  "paymentMethod",
                  event.target.value as HistoryPaymentMethodFilter,
                )
              }
            >
              <option value="ALL">Todos</option>
              <option value="CARD">Tarjeta</option>
              <option value="CASH">Efectivo</option>
            </select>
          </label>
          <label>
            Entrega
            <select
              value={historyFilters.deliveryMethod}
              onChange={(event) =>
                updateHistoryFilter(
                  "deliveryMethod",
                  event.target.value as HistoryDeliveryMethodFilter,
                )
              }
            >
              <option value="ALL">Todas</option>
              <option value="PICKUP">Recogida</option>
              <option value="DELIVERY">Envio</option>
            </select>
          </label>
          <label>
            Desde
            <input
              type="date"
              value={historyFilters.from}
              onChange={(event) =>
                updateHistoryFilter("from", event.target.value)
              }
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={historyFilters.to}
              onChange={(event) => updateHistoryFilter("to", event.target.value)}
            />
          </label>
          <div className="order-filter-actions">
            <button
              className="button primary"
              type="submit"
              disabled={historyLoading}
            >
              <Filter aria-hidden="true" size={18} />
              Filtrar
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={clearHistoryFilters}
              disabled={historyLoading}
            >
              <X aria-hidden="true" size={18} />
              Limpiar
            </button>
          </div>
        </form>

        {historyMeta.total > 0 && (
          <div className="order-pagination history-pagination no-print">
            <button
              type="button"
              className="button secondary"
              onClick={() => loadHistoryPage(historyMeta.page - 1)}
              disabled={historyLoading || !canPageBack}
            >
              <ChevronLeft aria-hidden="true" size={18} />
              Anterior
            </button>
            <span>
              Pagina {historyMeta.page} de {historyMeta.totalPages} -{" "}
              {historyRangeLabel(historyMeta)}
            </span>
            <button
              type="button"
              className="button secondary"
              onClick={() => loadHistoryPage(historyMeta.page + 1)}
              disabled={historyLoading || !canPageForward}
            >
              Siguiente
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>
        )}

        {historyError && <div className="empty-state error">{historyError}</div>}

        {historyLoading ? (
          <div className="empty-state">
            <RefreshCw className="spin" aria-hidden="true" />
            Cargando historial
          </div>
        ) : historyOrders.length ? (
          <div className="order-history-layout">
            <div className="order-history-list">
              {historyOrders.map((order) => {
                const DeliveryIcon =
                  order.deliveryMethod === "DELIVERY" ? Truck : Store;
                const PaymentIcon =
                  order.paymentMethod === "CASH" ? Banknote : CreditCard;
                const selected = order.id === selectedHistoryOrderId;

                return (
                  <button
                    type="button"
                    className={`order-history-row status-${order.status.toLowerCase()} ${
                      selected ? "selected" : ""
                    }`}
                    key={order.id}
                    onClick={() => setSelectedHistoryOrderId(order.id)}
                  >
                    <div className="history-order-main">
                      <div>
                        <strong className="order-number">
                          {order.orderNumber}
                        </strong>
                        <time dateTime={order.createdAt}>
                          {formatHistoryDate(order.createdAt)}
                        </time>
                      </div>
                      <span
                        className={`history-status status-${order.status.toLowerCase()}`}
                      >
                        {orderStatusLabels[order.status]}
                      </span>
                    </div>
                    <div className="history-order-meta">
                      <span className="history-customer">
                        {customerDisplayName(order)}
                      </span>
                      <span className="history-chip">
                        <DeliveryIcon aria-hidden="true" size={16} />
                        {deliveryMethodLabel(order.deliveryMethod)}
                      </span>
                      <span
                        className={`history-chip ${
                          order.paymentMethod === "CASH" ? "cash" : ""
                        }`}
                      >
                        <PaymentIcon aria-hidden="true" size={16} />
                        {paymentMethodLabel(order)}
                      </span>
                      <span className="history-chip">
                        {orderItemCountLabel(order)}
                      </span>
                      <strong className="history-order-total">
                        {formatMoney(order.totalCents)}
                      </strong>
                    </div>
                  </button>
                );
              })}
            </div>

            <OrderHistoryDetail
              order={selectedHistoryOrder}
              onClose={() => setSelectedHistoryOrderId(undefined)}
            />
          </div>
        ) : (
          <div className="empty-state">Sin pedidos para estos filtros.</div>
        )}
      </section>
    </main>
  );
}

function OrderHistoryDetail({
  order,
  onClose,
}: {
  order?: OrderSummary;
  onClose: () => void;
}) {
  if (!order) {
    return (
      <aside className="order-history-detail empty">
        <ReceiptText aria-hidden="true" size={28} />
        <strong>Selecciona un pedido</strong>
        <span>Abre cualquier pedido del historial para revisar sus datos.</span>
      </aside>
    );
  }

  const isDelivery = order.deliveryMethod === "DELIVERY";
  const phone = customerPhone(order);

  return (
    <aside className="order-history-detail">
      <div className="history-detail-head">
        <div>
          <p className="eyebrow">Pedido</p>
          <h3>{order.orderNumber}</h3>
          <span>{orderStatusLabels[order.status]}</span>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          title="Cerrar detalle"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="history-detail-section">
        <h4>
          <UserRound aria-hidden="true" size={17} />
          Cliente
        </h4>
        <dl className="history-detail-list">
          <div>
            <dt>Nombre</dt>
            <dd>{customerDisplayName(order)}</dd>
          </div>
          {order.customerEmail && (
            <div>
              <dt>
                <Mail aria-hidden="true" size={15} />
                Email
              </dt>
              <dd>{order.customerEmail}</dd>
            </div>
          )}
          {phone && (
            <div>
              <dt>
                <Phone aria-hidden="true" size={15} />
                Telefono
              </dt>
              <dd>{phone}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="history-detail-section">
        <h4>
          {isDelivery ? (
            <Truck aria-hidden="true" size={17} />
          ) : (
            <Store aria-hidden="true" size={17} />
          )}
          Entrega
        </h4>
        <dl className="history-detail-list">
          <div>
            <dt>Metodo</dt>
            <dd>{deliveryMethodLabel(order.deliveryMethod)}</dd>
          </div>
          {isDelivery && (
            <>
              {order.deliveryName && (
                <div>
                  <dt>Nombre entrega</dt>
                  <dd>{order.deliveryName}</dd>
                </div>
              )}
              <div>
                <dt>
                  <MapPin aria-hidden="true" size={15} />
                  Direccion
                </dt>
                <dd>{deliveryAddress(order)}</dd>
              </div>
              {order.deliveryNotes && (
                <div>
                  <dt>Notas</dt>
                  <dd>{order.deliveryNotes}</dd>
                </div>
              )}
            </>
          )}
        </dl>
      </div>

      <div className="history-detail-section">
        <h4>
          <ShoppingBag aria-hidden="true" size={17} />
          Productos
        </h4>
        <ul className="history-detail-items">
          {order.items.map((item, index) => (
            <li
              key={item.id ?? `${order.id}-${item.productName}-${index}`}
              className={item.removedAt ? "removed" : undefined}
            >
              <span>{item.quantity}x</span>
              <div>
                <strong>{item.productName}</strong>
                {item.options && item.options.length > 0 && (
                  <small>{formatOrderItemOptions(item)}</small>
                )}
                {item.removedAt && (
                  <small>{item.removedReason ?? "Producto quitado"}</small>
                )}
              </div>
              <strong>{formatMoney(item.lineTotalCents)}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="history-detail-section">
        <h4>
          <CreditCard aria-hidden="true" size={17} />
          Pago y totales
        </h4>
        <dl className="history-total-list">
          <div>
            <dt>Metodo</dt>
            <dd>{paymentSummaryText(order)}</dd>
          </div>
          {order.subtotalCents !== undefined && (
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(order.subtotalCents)}</dd>
            </div>
          )}
          {(order.discountCents ?? 0) > 0 && (
            <div>
              <dt>Descuento</dt>
              <dd>-{formatMoney(order.discountCents ?? 0)}</dd>
            </div>
          )}
          {(order.deliveryFeeCents ?? 0) > 0 && (
            <div>
              <dt>Envio</dt>
              <dd>{formatMoney(order.deliveryFeeCents ?? 0)}</dd>
            </div>
          )}
          {(order.taxCents ?? 0) > 0 && (
            <div>
              <dt>Impuestos</dt>
              <dd>{formatMoney(order.taxCents ?? 0)}</dd>
            </div>
          )}
          <div className="history-total-strong">
            <dt>Total</dt>
            <dd>{formatMoney(order.totalCents)}</dd>
          </div>
        </dl>
      </div>

      <div className="history-detail-section">
        <h4>
          <Clock3 aria-hidden="true" size={17} />
          Historial de estados
        </h4>
        {order.statusHistory?.length ? (
          <ol className="history-status-list">
            {order.statusHistory.map((item, index) => (
              <li key={`${item.toStatus}-${item.createdAt}-${index}`}>
                <span>{orderStatusLabels[item.toStatus]}</span>
                <time dateTime={item.createdAt}>
                  {formatHistoryDate(item.createdAt)}
                </time>
                {item.note && <small>{item.note}</small>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Sin movimientos registrados.</p>
        )}
      </div>
    </aside>
  );
}
function formatReportDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  });
}

function adminOrderHistoryPath(filters: OrderHistoryFilters, page: number) {
  const params = new URLSearchParams();

  if (filters.q.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.status !== "ALL") {
    params.set("status", filters.status);
  }

  if (filters.paymentMethod !== "ALL") {
    params.set("paymentMethod", filters.paymentMethod);
  }

  if (filters.deliveryMethod !== "ALL") {
    params.set("deliveryMethod", filters.deliveryMethod);
  }

  if (filters.from) {
    params.set("from", filters.from);
  }

  if (filters.to) {
    params.set("to", filters.to);
  }

  params.set("page", String(Math.max(1, page)));
  params.set("pageSize", String(historyPageSize));

  return `/admin/orders/history?${params.toString()}`;
}

function historyOrderCountLabel(total: number) {
  return total === 1 ? "1 pedido" : `${total} pedidos`;
}

function historyRangeLabel(meta: OrderHistoryMeta) {
  if (meta.total === 0) {
    return "Sin resultados";
  }

  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.total, meta.page * meta.pageSize);

  return `${from}-${to} de ${meta.total}`;
}

function formatHistoryDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deliveryMethodLabel(method: DeliveryMethod) {
  return method === "DELIVERY" ? "Envio" : "Recogida";
}

function customerDisplayName(order: OrderSummary) {
  return order.customerName ?? order.deliveryName ?? "Cliente sin nombre";
}

function customerPhone(order: OrderSummary) {
  return order.deliveryPhone ?? order.customerPhone;
}

function deliveryAddress(order: OrderSummary) {
  const address = [
    order.deliveryStreet,
    order.deliveryPostalCode,
    order.deliveryCity,
  ]
    .filter(Boolean)
    .join(", ");

  return address || "Direccion no registrada";
}

function orderItemCountLabel(order: OrderSummary) {
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return quantity === 1 ? "1 producto" : `${quantity} productos`;
}

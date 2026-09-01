"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  BarChart3,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Euro,
  Filter,
  Gift,
  X,
  LogOut,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Truck,
  Utensils,
  UsersRound,
} from "lucide-react";
import { api, formatMoney } from "../lib/api";
import {
  readableErrorMessage,
  redirectOnAdminAuthError,
} from "../lib/admin-errors";
import { brandConfig } from "../lib/brand";
import {
  DayKey,
  OpeningHours,
  TimeRange,
  normalizeOpeningHours,
  weekdays,
} from "../lib/opening-hours";
import {
  activeAdminOrderStatuses,
  adminNextStatuses,
  orderStatusLabels,
  removableOrderItemStatuses,
} from "../lib/order-state";
import { formatOrderItemOptions } from "../lib/order-format";
import {
  DeliveryMethod,
  LoyaltyProgram,
  LoyaltyRewardType,
  OrderItem,
  OrderStatus,
  OrderSummary,
  OrdersPause,
  ServiceStatus,
  SiteContent,
  SpecialClosure,
} from "../lib/types";
import { isCardPayment, paymentSummaryText } from "../lib/payment-format";
import { logoutAdmin } from "./admin-auth";
import { KitchenAlarm } from "./kitchen-alarm";

interface DashboardResponse {
  date: string;
  paidRevenueCents: number;
  ordersByStatus: Record<string, number>;
}

interface SettingsResponse {
  taxRate: number;
  deliveryFeeCents: number;
  openingHours: OpeningHours;
  openNow: boolean;
  serviceStatus: ServiceStatus;
  ordersPause: OrdersPause;
  specialClosures: SpecialClosure[];
  siteContent: SiteContent;
  loyaltyProgram: LoyaltyProgram;
}

interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
}

type StatusFilter = OrderStatus | "ACTIVE" | "ALL";
type DeliveryMethodFilter = DeliveryMethod | "ALL";
type SettingsSection = "service" | "business" | "loyalty" | "hours" | "security";

interface OrderFilters {
  q: string;
  status: StatusFilter;
  deliveryMethod: DeliveryMethodFilter;
  from: string;
  to: string;
}

const defaultOrderFilters: OrderFilters = {
  q: "",
  status: "ACTIVE",
  deliveryMethod: "ALL",
  from: "",
  to: "",
};

const orderPageSize = 50;
const fullRefundStatuses = new Set<OrderStatus>([
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
]);
const defaultLoyaltyProgram: LoyaltyProgram = {
  enabled: true,
  goalOrders: 5,
  rewardType: "DISCOUNT_PERCENT",
  discountPercent: 10,
  freeProductName: "Mordida Smash",
  title: "Mordida Club",
  description:
    "Completa pedidos entregados y desbloquea una recompensa para tu proxima visita.",
};

export function AdminOrdersClient() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [dashboard, setDashboard] = useState<DashboardResponse>();
  const [orderFilters, setOrderFilters] =
    useState<OrderFilters>(defaultOrderFilters);
  const [draftOrderFilters, setDraftOrderFilters] =
    useState<OrderFilters>(defaultOrderFilters);
  const [orderPage, setOrderPage] = useState(1);
  const [taxRatePercent, setTaxRatePercent] = useState("10");
  const [deliveryFeeEuros, setDeliveryFeeEuros] = useState("2.50");
  const [openingHours, setOpeningHours] = useState<OpeningHours>(() =>
    normalizeOpeningHours(),
  );
  const [openNow, setOpenNow] = useState(false);
  const [ordersPause, setOrdersPause] = useState<OrdersPause>({
    paused: false,
    reason: "",
  });
  const [specialClosures, setSpecialClosures] = useState<SpecialClosure[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent>(brandConfig);
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram>(
    defaultLoyaltyProgram,
  );
  const [error, setError] = useState<string>();
  const [settingsMessage, setSettingsMessage] = useState<string>();
  const [printingOrderId, setPrintingOrderId] = useState<string>();
  const [removalTarget, setRemovalTarget] = useState<{
    order: OrderSummary;
    item: OrderItem;
  }>();
  const [removalBusy, setRemovalBusy] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OrderSummary>();
  const [cancelBusy, setCancelBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [twoFactor, setTwoFactor] = useState<TwoFactorSetupResponse>();
  const [twoFactorMessage, setTwoFactorMessage] = useState<string>();
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("service");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [ordersData, dashboardData, settingsData] = await Promise.all([
          api<OrderSummary[]>(adminOrdersPath(orderFilters, orderPage)),
          api<DashboardResponse>("/admin/dashboard"),
          api<SettingsResponse>("/admin/settings"),
        ]);

        if (active) {
          setOrders(ordersData);
          setDashboard(dashboardData);
          setTaxRatePercent(String(settingsData.taxRate * 100));
          setDeliveryFeeEuros((settingsData.deliveryFeeCents / 100).toFixed(2));
          setOpeningHours(normalizeOpeningHours(settingsData.openingHours));
          setOpenNow(settingsData.openNow);
          setOrdersPause(
            settingsData.ordersPause ?? settingsData.serviceStatus.pause,
          );
          setSpecialClosures(settingsData.specialClosures ?? []);
          setSiteContent({ ...brandConfig, ...settingsData.siteContent });
          setLoyaltyProgram({
            ...defaultLoyaltyProgram,
            ...settingsData.loyaltyProgram,
          });
          setError(undefined);
        }
      } catch (requestError) {
        if (active) {
          handleAdminError(requestError, "No se pudo cargar.");
        }
      }
    }

    load();
    const id = window.setInterval(load, 8000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [orderFilters, orderPage]);

  const activeOrders = useMemo(
    () =>
      orders.filter((order) => activeAdminOrderStatuses.includes(order.status)),
    [orders],
  );
  const displayedOrders = useMemo(
    () => (orderFilters.status === "ACTIVE" ? activeOrders : orders),
    [activeOrders, orderFilters.status, orders],
  );
  const hasNextOrderPage = orders.length === orderPageSize;

  function activeOrderItems(order: OrderSummary) {
    return order.items.filter((item) => !item.removedAt);
  }

  function canRemoveOrderItem(order: OrderSummary, item: OrderItem) {
    return (
      Boolean(item.id) &&
      !item.removedAt &&
      isCardPayment(order) &&
      removableOrderItemStatuses.has(order.status) &&
      activeOrderItems(order).length > 1
    );
  }

  function canCancelOrderWithRefund(order: OrderSummary) {
    return isCardPayment(order) && fullRefundStatuses.has(order.status);
  }

  function applyOrderFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOrderPage(1);
    setOrderFilters({
      ...draftOrderFilters,
      q: draftOrderFilters.q.trim(),
    });
  }

  function clearOrderFilters() {
    setDraftOrderFilters(defaultOrderFilters);
    setOrderFilters(defaultOrderFilters);
    setOrderPage(1);
  }

  function updateDraftFilter<Key extends keyof OrderFilters>(
    key: Key,
    value: OrderFilters[Key],
  ) {
    setDraftOrderFilters((current) => ({ ...current, [key]: value }));
  }

  async function changeStatus(orderId: string, status: OrderStatus) {
    try {
      const updated = await api<OrderSummary>(
        `/admin/orders/${orderId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? updated : order)),
      );
      setAcknowledged((current) => new Set(current).add(orderId));
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo actualizar.");
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

  async function saveBusinessSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const taxRate = Number(form.get("taxRate")) / 100;
    const deliveryFeeCents = Math.round(
      Number(form.get("deliveryFeeEuros")) * 100,
    );
    try {
      await Promise.all([
        api("/admin/settings/tax-rate", {
          method: "PATCH",
          body: JSON.stringify({ taxRate }),
        }),
        api("/admin/settings/delivery-fee", {
          method: "PATCH",
          body: JSON.stringify({ deliveryFeeCents }),
        }),
      ]);
      setTaxRatePercent(String(taxRate * 100));
      setDeliveryFeeEuros((deliveryFeeCents / 100).toFixed(2));
      setSettingsMessage("Ajustes guardados.");
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo guardar.");
    }
  }

  async function saveLoyaltySettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rewardType = String(
      form.get("rewardType") ?? "DISCOUNT_PERCENT",
    ) as LoyaltyRewardType;

    try {
      const response = await api<LoyaltyProgram>("/admin/settings/loyalty", {
        method: "PATCH",
        body: JSON.stringify({
          enabled: form.get("enabled") === "on",
          goalOrders: Number(form.get("goalOrders")),
          rewardType,
          discountPercent: Number(form.get("discountPercent")),
          freeProductName: String(form.get("freeProductName") ?? ""),
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? ""),
        }),
      });
      setLoyaltyProgram(response);
      setSettingsMessage("Fidelidad guardada.");
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo guardar fidelidad.");
    }
  }

  async function saveOrdersPause(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      const response = await api<{
        ordersPause: OrdersPause;
        serviceStatus: ServiceStatus;
        openNow: boolean;
      }>("/admin/settings/orders-pause", {
        method: "PATCH",
        body: JSON.stringify({
          paused: form.get("paused") === "on",
          reason: String(form.get("reason") ?? ""),
        }),
      });
      setOrdersPause(response.ordersPause);
      setOpenNow(response.openNow);
      setSettingsMessage(
        response.ordersPause.paused
          ? "Pedidos pausados."
          : "Pedidos reanudados.",
      );
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo cambiar el servicio.");
    }
  }

  async function createSpecialClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const closure = await api<SpecialClosure>("/admin/special-closures", {
        method: "POST",
        body: JSON.stringify({
          startsAt: localDateTimeToIso(String(form.get("startsAt"))),
          endsAt: localDateTimeToIso(String(form.get("endsAt"))),
          reason: String(form.get("reason")),
        }),
      });
      setSpecialClosures((current) => sortClosures([closure, ...current]));
      await refreshServiceStatus();
      formElement.reset();
      setSettingsMessage("Cierre especial creado.");
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo crear el cierre.");
    }
  }

  async function updateSpecialClosure(
    closure: SpecialClosure,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      const updated = await api<SpecialClosure>(
        `/admin/special-closures/${closure.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            startsAt: localDateTimeToIso(String(form.get("startsAt"))),
            endsAt: localDateTimeToIso(String(form.get("endsAt"))),
            reason: String(form.get("reason")),
            active: form.get("active") === "on",
          }),
        },
      );
      setSpecialClosures((current) =>
        sortClosures(
          current.map((item) => (item.id === updated.id ? updated : item)),
        ),
      );
      await refreshServiceStatus();
      setSettingsMessage("Cierre actualizado.");
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo actualizar el cierre.");
    }
  }

  async function deactivateSpecialClosure(closure: SpecialClosure) {
    const confirmed = window.confirm(`Desactivar cierre "${closure.reason}"?`);
    if (!confirmed) {
      return;
    }

    try {
      const updated = await api<SpecialClosure>(
        `/admin/special-closures/${closure.id}`,
        { method: "DELETE" },
      );
      setSpecialClosures((current) =>
        sortClosures(
          current.map((item) => (item.id === updated.id ? updated : item)),
        ),
      );
      await refreshServiceStatus();
      setSettingsMessage("Cierre desactivado.");
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo desactivar el cierre.");
    }
  }

  async function refreshServiceStatus() {
    const publicSettings = await api<{ openNow: boolean }>("/settings/public");
    setOpenNow(publicSettings.openNow);
  }

  async function saveOpeningHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api("/admin/settings/opening-hours", {
        method: "PATCH",
        body: JSON.stringify({ openingHours }),
      });
      const publicSettings = await api<{ openNow: boolean }>(
        "/settings/public",
      );
      setOpenNow(publicSettings.openNow);
      setSettingsMessage("Horarios guardados.");
    } catch (requestError) {
      handleAdminError(requestError, "No se pudieron guardar los horarios.");
    }
  }

  async function removeOrderItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!removalTarget?.item.id) {
      return;
    }

    const form = new FormData(event.currentTarget);
    setRemovalBusy(true);

    try {
      const updated = await api<OrderSummary>(
        `/admin/orders/${removalTarget.order.id}/items/${removalTarget.item.id}/remove`,
        {
          method: "PATCH",
          body: JSON.stringify({ reason: String(form.get("reason")) }),
        },
      );
      setOrders((current) =>
        current.map((order) => (order.id === updated.id ? updated : order)),
      );
      setRemovalTarget(undefined);
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo quitar el producto.");
    } finally {
      setRemovalBusy(false);
    }
  }

  async function cancelOrderWithRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cancelTarget) {
      return;
    }

    const form = new FormData(event.currentTarget);
    setCancelBusy(true);

    try {
      const updated = await api<OrderSummary>(
        `/admin/orders/${cancelTarget.id}/cancel-refund`,
        {
          method: "PATCH",
          body: JSON.stringify({ reason: String(form.get("reason")) }),
        },
      );
      setOrders((current) =>
        current.map((order) => (order.id === updated.id ? updated : order)),
      );
      setAcknowledged((current) => new Set(current).add(updated.id));
      setCancelTarget(undefined);
      setError(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo cancelar el pedido.");
    } finally {
      setCancelBusy(false);
    }
  }

  function updateTimezone(timezone: string) {
    setOpeningHours((current) => ({ ...current, timezone }));
  }

  function updateTimeRange(
    day: DayKey,
    index: number,
    field: keyof TimeRange,
    value: string,
  ) {
    setOpeningHours((current) => ({
      ...current,
      weekly: {
        ...current.weekly,
        [day]: current.weekly[day].map((range, rangeIndex) =>
          rangeIndex === index ? { ...range, [field]: value } : range,
        ),
      },
    }));
  }

  function addTimeRange(day: DayKey) {
    setOpeningHours((current) => ({
      ...current,
      weekly: {
        ...current.weekly,
        [day]: [...current.weekly[day], { open: "12:00", close: "23:00" }],
      },
    }));
  }

  function removeTimeRange(day: DayKey, index: number) {
    setOpeningHours((current) => ({
      ...current,
      weekly: {
        ...current.weekly,
        [day]: current.weekly[day].filter(
          (_, rangeIndex) => rangeIndex !== index,
        ),
      },
    }));
  }

  async function setupTwoFactor() {
    try {
      const response = await api<TwoFactorSetupResponse>(
        "/admin/auth/2fa/setup",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      setTwoFactor(response);
      setTwoFactorMessage(undefined);
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo crear 2FA.");
    }
  }

  async function confirmTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await api("/admin/auth/2fa/confirm", {
        method: "POST",
        body: JSON.stringify({ code: String(form.get("code")) }),
      });
      setTwoFactorMessage("2FA activado.");
      event.currentTarget.reset();
    } catch (requestError) {
      handleAdminError(requestError, "No se pudo confirmar 2FA.");
    }
  }

  const printingOrder = orders.find((order) => order.id === printingOrderId);

  function handleAdminError(requestError: unknown, fallback: string) {
    if (redirectOnAdminAuthError(requestError)) {
      return;
    }

    setError(readableErrorMessage(requestError, fallback));
  }

  return (
    <main className="page-shell admin-page">
      <section className="admin-toolbar no-print">
        <div>
          <p className="eyebrow">Panel</p>
          <h1>Pedidos de hoy</h1>
        </div>
        <div className="toolbar-actions">
          <Link href="/admin/menu" className="button secondary">
            <Utensils aria-hidden="true" size={18} />
            Menu
          </Link>
          <Link href="/admin/reportes" className="button secondary">
            <BarChart3 aria-hidden="true" size={18} />
            Reportes
          </Link>
          <Link href="/admin/reparto" className="button secondary">
            <Truck aria-hidden="true" size={18} />
            Reparto
          </Link>
          <Link href="/admin/staff" className="button secondary">
            <UsersRound aria-hidden="true" size={18} />
            Staff
          </Link>
          <Link href="/admin/cocina" className="button secondary">
            <Utensils aria-hidden="true" size={18} />
            Cocina
          </Link>
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

      <section className="admin-metrics no-print">
        <article>
          <span>Pedidos</span>
          <strong>{displayedOrders.length}</strong>
        </article>
        <article>
          <span>Facturado</span>
          <strong>{formatMoney(dashboard?.paidRevenueCents ?? 0)}</strong>
        </article>
        <article>
          <span>Pendientes</span>
          <strong>{activeOrders.length}</strong>
        </article>
      </section>

      <form className="order-filter-bar no-print" onSubmit={applyOrderFilters}>
        <label className="search-field">
          Buscar
          <div>
            <Search aria-hidden="true" size={18} />
            <input
              value={draftOrderFilters.q}
              onChange={(event) => updateDraftFilter("q", event.target.value)}
              placeholder="Pedido, cliente, email, telefono"
            />
          </div>
        </label>
        <label>
          Estado
          <select
            value={draftOrderFilters.status}
            onChange={(event) =>
              updateDraftFilter("status", event.target.value as StatusFilter)
            }
          >
            <option value="ACTIVE">Activos</option>
            <option value="ALL">Todos</option>
            {(Object.keys(adminNextStatuses) as OrderStatus[]).map((status) => (
              <option key={status} value={status}>
                {orderStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Metodo
          <select
            value={draftOrderFilters.deliveryMethod}
            onChange={(event) =>
              updateDraftFilter(
                "deliveryMethod",
                event.target.value as DeliveryMethodFilter,
              )
            }
          >
            <option value="ALL">Todos</option>
            <option value="PICKUP">Recogida</option>
            <option value="DELIVERY">Envio</option>
          </select>
        </label>
        <label>
          Desde
          <input
            type="date"
            value={draftOrderFilters.from}
            onChange={(event) => updateDraftFilter("from", event.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={draftOrderFilters.to}
            onChange={(event) => updateDraftFilter("to", event.target.value)}
          />
        </label>
        <div className="order-filter-actions">
          <button className="button primary" type="submit">
            <Filter aria-hidden="true" size={18} />
            Filtrar
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={clearOrderFilters}
          >
            <X aria-hidden="true" size={18} />
            Limpiar
          </button>
        </div>
      </form>

      <div className="order-pagination no-print">
        <button
          type="button"
          className="button secondary"
          onClick={() => setOrderPage((current) => Math.max(1, current - 1))}
          disabled={orderPage === 1}
        >
          <ChevronLeft aria-hidden="true" size={18} />
          Anterior
        </button>
        <span>Pagina {orderPage}</span>
        <button
          type="button"
          className="button secondary"
          onClick={() => setOrderPage((current) => current + 1)}
          disabled={!hasNextOrderPage}
        >
          Siguiente
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </div>

      <KitchenAlarm
        orders={displayedOrders}
        acknowledged={acknowledged}
        onSilence={() =>
          setAcknowledged(new Set(displayedOrders.map((order) => order.id)))
        }
      />

      <section className="admin-content no-print">
        <div className="orders-board">
          {displayedOrders.length === 0 ? (
            <div className="empty-state">
              <RefreshCw className="spin" aria-hidden="true" />
              Sin pedidos para mostrar
            </div>
          ) : (
            displayedOrders.map((order) => (
              <article
                key={order.id}
                className={`order-card status-${order.status.toLowerCase()}`}
              >
                <div className="order-card-head">
                  <div>
                    <strong className="order-number">
                      {order.orderNumber}
                    </strong>
                    <span>
                      {new Date(order.createdAt).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
                  {order.items.map((item, itemIndex) => (
                    <li
                      key={
                        item.id ??
                        `${order.id}-${item.productName}-${itemIndex}`
                      }
                      className={`order-line ${item.removedAt ? "removed" : ""}`}
                    >
                      <span>{item.quantity}x</span>
                      <div className="order-line-copy">
                        <strong>{item.productName}</strong>
                        {item.options && item.options.length > 0 && (
                          <small>{formatOrderItemOptions(item)}</small>
                        )}
                        {item.removedAt && (
                          <small>
                            {item.removedReason ?? "Producto quitado"}
                          </small>
                        )}
                      </div>
                      <div className="order-line-actions">
                        {item.removedAt ? (
                          <span className="refund-chip">
                            -
                            {formatMoney(
                              item.refundedCents ?? item.lineTotalCents,
                            )}
                          </span>
                        ) : (
                          <strong>{formatMoney(item.lineTotalCents)}</strong>
                        )}
                        {canRemoveOrderItem(order, item) && (
                          <button
                            type="button"
                            className="icon-button danger small"
                            onClick={() => setRemovalTarget({ order, item })}
                            title="Quitar y reembolsar"
                          >
                            <Trash2 aria-hidden="true" size={16} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="order-card-foot">
                  <span>{orderStatusLabels[order.status]}</span>
                  <strong>{formatMoney(order.totalCents)}</strong>
                </div>
                <div className="status-actions">
                  {adminNextStatuses[order.status].map((status) => (
                    <button
                      type="button"
                      className="button secondary"
                      key={status}
                      onClick={() => changeStatus(order.id, status)}
                    >
                      {orderStatusLabels[status]}
                    </button>
                  ))}
                  {canCancelOrderWithRefund(order) && (
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => setCancelTarget(order)}
                    >
                      <X aria-hidden="true" size={17} />
                      Cancelar y reembolsar
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>

        <aside className="settings-panel admin-settings-panel">
          <div className="settings-panel-head">
            <h2>
              <Settings aria-hidden="true" size={20} />
              Ajustes
            </h2>
            <span className={`status-pill ${openNow ? "" : "danger"}`}>
              {openNow ? "Abierto" : "Cerrado"}
            </span>
          </div>

          {settingsMessage && <p className="form-success">{settingsMessage}</p>}

          <div className="settings-tabs" aria-label="Secciones de ajustes">
            <button
              type="button"
              className={settingsSection === "service" ? "active" : ""}
              onClick={() => setSettingsSection("service")}
            >
              <CalendarOff aria-hidden="true" size={18} />
              Servicio
            </button>
            <button
              type="button"
              className={settingsSection === "business" ? "active" : ""}
              onClick={() => setSettingsSection("business")}
            >
              <Euro aria-hidden="true" size={18} />
              Negocio
            </button>
            <button
              type="button"
              className={settingsSection === "loyalty" ? "active" : ""}
              onClick={() => setSettingsSection("loyalty")}
            >
              <Gift aria-hidden="true" size={18} />
              Fidelidad
            </button>
            <button
              type="button"
              className={settingsSection === "hours" ? "active" : ""}
              onClick={() => setSettingsSection("hours")}
            >
              <Clock aria-hidden="true" size={18} />
              Horarios
            </button>
            <button
              type="button"
              className={settingsSection === "security" ? "active" : ""}
              onClick={() => setSettingsSection("security")}
            >
              <ShieldCheck aria-hidden="true" size={18} />
              2FA
            </button>
          </div>

          {settingsSection === "service" && (
            <section className="settings-section">
              <div className={`settings-status ${openNow ? "open" : "closed"}`}>
                <Clock aria-hidden="true" size={18} />
                {openNow ? "Abierto ahora" : "Cerrado ahora"}
              </div>

              <form
                key={`${ordersPause.paused}-${ordersPause.reason}`}
                className="service-control-form"
                onSubmit={saveOrdersPause}
              >
                <div className="settings-section-head">
                  <h3>
                    <CalendarOff aria-hidden="true" size={18} />
                    Pedidos
                  </h3>
                  <span>{ordersPause.paused ? "Pausado" : "Activo"}</span>
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="paused"
                    defaultChecked={ordersPause.paused}
                  />
                  Pausar pedidos
                </label>
                <label>
                  Motivo
                  <textarea
                    name="reason"
                    rows={2}
                    maxLength={180}
                    defaultValue={ordersPause.reason}
                    placeholder="Cerrado por mantenimiento, vacaciones..."
                  />
                </label>
                <button className="button primary full" type="submit">
                  <Save aria-hidden="true" size={18} />
                  Guardar servicio
                </button>
              </form>

              <details className="settings-accordion">
                <summary>
                  <span>
                    <CalendarOff aria-hidden="true" size={18} />
                    Crear cierre especial
                  </span>
                  <Plus aria-hidden="true" size={18} />
                </summary>
                <form
                  className="service-control-form"
                  onSubmit={createSpecialClosure}
                >
                  <label>
                    Desde
                    <input name="startsAt" type="datetime-local" required />
                  </label>
                  <label>
                    Hasta
                    <input name="endsAt" type="datetime-local" required />
                  </label>
                  <label>
                    Motivo
                    <input
                      name="reason"
                      maxLength={180}
                      required
                      placeholder="Festivo, vacaciones, evento privado..."
                    />
                  </label>
                  <button className="button secondary full" type="submit">
                    <Plus aria-hidden="true" size={18} />
                    Crear cierre
                  </button>
                </form>
              </details>

              <details className="settings-accordion">
                <summary>
                  <span>
                    <CalendarOff aria-hidden="true" size={18} />
                    Cierres guardados
                  </span>
                  <strong>{specialClosures.length}</strong>
                </summary>
                <div className="closure-list">
                  {specialClosures.length === 0 ? (
                    <p className="muted">Sin cierres especiales.</p>
                  ) : (
                    specialClosures.map((closure) => (
                      <form
                        key={closure.id}
                        className={`closure-row ${
                          closure.active ? "" : "inactive"
                        }`}
                        onSubmit={(event) =>
                          updateSpecialClosure(closure, event)
                        }
                      >
                        <label>
                          Desde
                          <input
                            name="startsAt"
                            type="datetime-local"
                            defaultValue={toDateTimeLocal(closure.startsAt)}
                            required
                          />
                        </label>
                        <label>
                          Hasta
                          <input
                            name="endsAt"
                            type="datetime-local"
                            defaultValue={toDateTimeLocal(closure.endsAt)}
                            required
                          />
                        </label>
                        <label>
                          Motivo
                          <input
                            name="reason"
                            maxLength={180}
                            defaultValue={closure.reason}
                            required
                          />
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            name="active"
                            defaultChecked={closure.active}
                          />
                          Activo
                        </label>
                        <div className="row-actions inline-actions">
                          <button
                            className="icon-button primary"
                            type="submit"
                            title="Guardar cierre"
                          >
                            <Save aria-hidden="true" size={17} />
                          </button>
                          <button
                            className="icon-button danger"
                            type="button"
                            onClick={() => deactivateSpecialClosure(closure)}
                            title="Desactivar cierre"
                            disabled={!closure.active}
                          >
                            <Trash2 aria-hidden="true" size={17} />
                          </button>
                        </div>
                      </form>
                    ))
                  )}
                </div>
              </details>
            </section>
          )}

          {settingsSection === "business" && (
            <section className="settings-section">
              <div className="settings-section-head">
                <h3>
                  <Euro aria-hidden="true" size={18} />
                  Facturacion
                </h3>
                <span>IVA y envio</span>
              </div>
              <form
                onSubmit={saveBusinessSettings}
                className="inline-form business-settings-form"
              >
                <label>
                  IVA %
                  <input
                    type="number"
                    name="taxRate"
                    step="0.01"
                    min="0"
                    max="100"
                    value={taxRatePercent}
                    onChange={(event) => setTaxRatePercent(event.target.value)}
                  />
                </label>
                <label>
                  Envio EUR
                  <input
                    type="number"
                    name="deliveryFeeEuros"
                    step="0.01"
                    min="0"
                    value={deliveryFeeEuros}
                    onChange={(event) =>
                      setDeliveryFeeEuros(event.target.value)
                    }
                  />
                </label>
                <button className="button primary full" type="submit">
                  <Euro aria-hidden="true" size={18} />
                  Guardar importes
                </button>
              </form>
            </section>
          )}

          {settingsSection === "loyalty" && (
            <section className="settings-section">
              <div className="settings-section-head">
                <h3>
                  <Gift aria-hidden="true" size={18} />
                  Fidelidad
                </h3>
                <span>{loyaltyProgram.enabled ? "Activo" : "Pausado"}</span>
              </div>
              <form
                onSubmit={saveLoyaltySettings}
                className="inline-form loyalty-settings-form"
              >
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={loyaltyProgram.enabled}
                    onChange={(event) =>
                      setLoyaltyProgram((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                  />
                  Activar programa
                </label>
                <label>
                  Nombre del club
                  <input
                    name="title"
                    maxLength={60}
                    value={loyaltyProgram.title}
                    onChange={(event) =>
                      setLoyaltyProgram((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Mensaje
                  <textarea
                    name="description"
                    rows={3}
                    maxLength={180}
                    value={loyaltyProgram.description}
                    onChange={(event) =>
                      setLoyaltyProgram((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Pedidos para premio
                  <input
                    type="number"
                    name="goalOrders"
                    min="2"
                    max="20"
                    step="1"
                    value={loyaltyProgram.goalOrders}
                    onChange={(event) =>
                      setLoyaltyProgram((current) => ({
                        ...current,
                        goalOrders: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Tipo de premio
                  <select
                    name="rewardType"
                    value={loyaltyProgram.rewardType}
                    onChange={(event) =>
                      setLoyaltyProgram((current) => ({
                        ...current,
                        rewardType: event.target.value as LoyaltyRewardType,
                      }))
                    }
                  >
                    <option value="DISCOUNT_PERCENT">Descuento</option>
                    <option value="FREE_PRODUCT">Producto gratis</option>
                  </select>
                </label>
                <label>
                  Descuento %
                  <input
                    type="number"
                    name="discountPercent"
                    min="1"
                    max="100"
                    step="1"
                    value={loyaltyProgram.discountPercent}
                    onChange={(event) =>
                      setLoyaltyProgram((current) => ({
                        ...current,
                        discountPercent: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Producto gratis
                  <input
                    name="freeProductName"
                    maxLength={80}
                    value={loyaltyProgram.freeProductName}
                    onChange={(event) =>
                      setLoyaltyProgram((current) => ({
                        ...current,
                        freeProductName: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="loyalty-preview">
                  <span>Vista cliente</span>
                  <strong>
                    {loyaltyProgram.rewardType === "DISCOUNT_PERCENT"
                      ? `${loyaltyProgram.discountPercent}% de descuento`
                      : loyaltyProgram.freeProductName}
                  </strong>
                  <small>
                    Meta: {loyaltyProgram.goalOrders} pedidos entregados
                  </small>
                </div>
                <button className="button primary full" type="submit">
                  <Gift aria-hidden="true" size={18} />
                  Guardar fidelidad
                </button>
              </form>
            </section>
          )}

          {settingsSection === "hours" && (
            <section className="settings-section">
              <form className="hours-form" onSubmit={saveOpeningHours}>
                <div className="settings-section-head">
                  <h3>
                    <Clock aria-hidden="true" size={18} />
                    Horarios
                  </h3>
                  <span>Semanal</span>
                </div>
                <label>
                  Zona horaria
                  <input
                    name="timezone"
                    value={openingHours.timezone}
                    onChange={(event) => updateTimezone(event.target.value)}
                  />
                </label>
                <div className="weekday-list">
                  {weekdays.map((day) => (
                    <section className="weekday-editor" key={day.key}>
                      <div className="weekday-head">
                        <strong>{day.label}</strong>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => addTimeRange(day.key)}
                          title={`Anadir franja ${day.label}`}
                        >
                          <Plus aria-hidden="true" size={18} />
                        </button>
                      </div>
                      {openingHours.weekly[day.key].length === 0 ? (
                        <p className="muted">Cerrado</p>
                      ) : (
                        openingHours.weekly[day.key].map((range, index) => (
                          <div
                            className="time-range-row"
                            key={`${day.key}-${index}`}
                          >
                            <label>
                              Abre
                              <input
                                type="time"
                                value={range.open}
                                onChange={(event) =>
                                  updateTimeRange(
                                    day.key,
                                    index,
                                    "open",
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <label>
                              Cierra
                              <input
                                type="time"
                                value={range.close}
                                onChange={(event) =>
                                  updateTimeRange(
                                    day.key,
                                    index,
                                    "close",
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() => removeTimeRange(day.key, index)}
                              title={`Quitar franja ${day.label}`}
                            >
                              <Trash2 aria-hidden="true" size={17} />
                            </button>
                          </div>
                        ))
                      )}
                    </section>
                  ))}
                </div>
                <button className="button primary full" type="submit">
                  <Clock aria-hidden="true" size={18} />
                  Guardar horarios
                </button>
              </form>
            </section>
          )}

          {settingsSection === "security" && (
            <section className="settings-section">
              <div className="settings-section-head">
                <h3>
                  <ShieldCheck aria-hidden="true" size={18} />
                  Seguridad
                </h3>
                <span>Admin</span>
              </div>
              <div className="two-factor-box">
                <button
                  type="button"
                  className="button secondary full"
                  onClick={setupTwoFactor}
                >
                  Preparar 2FA
                </button>
                {twoFactor && (
                  <form onSubmit={confirmTwoFactor}>
                    <code>{twoFactor.secret}</code>
                    <a href={twoFactor.otpauthUrl}>Abrir app</a>
                    <label>
                      Codigo
                      <input
                        name="code"
                        inputMode="numeric"
                        maxLength={6}
                        required
                      />
                    </label>
                    <button className="button primary" type="submit">
                      Activar
                    </button>
                  </form>
                )}
                {twoFactorMessage && (
                  <p className="form-success">{twoFactorMessage}</p>
                )}
              </div>
            </section>
          )}
        </aside>
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
                  key={`print-${item.id ?? `${item.productName}-${itemIndex}`}`}
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
          </>
        )}
      </section>

      {removalTarget && (
        <div className="modal-backdrop no-print">
          <form className="modal-panel" onSubmit={removeOrderItem}>
            <div className="modal-head">
              <h2>Quitar producto</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setRemovalTarget(undefined)}
                title="Cerrar"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <p>
              {removalTarget.item.quantity}x {removalTarget.item.productName} -{" "}
              {formatMoney(removalTarget.item.lineTotalCents)}
            </p>
            <label>
              Motivo
              <textarea
                name="reason"
                rows={4}
                minLength={3}
                maxLength={240}
                required
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setRemovalTarget(undefined)}
                disabled={removalBusy}
              >
                Cancelar
              </button>
              <button
                className="button primary"
                type="submit"
                disabled={removalBusy}
              >
                <Trash2 aria-hidden="true" size={17} />
                Reembolsar
              </button>
            </div>
          </form>
        </div>
      )}

      {cancelTarget && (
        <div className="modal-backdrop no-print">
          <form className="modal-panel" onSubmit={cancelOrderWithRefund}>
            <div className="modal-head">
              <h2>Cancelar pedido</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setCancelTarget(undefined)}
                title="Cerrar"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <p>
              {cancelTarget.orderNumber} - devolver{" "}
              {formatMoney(cancelTarget.totalCents)}
            </p>
            <label>
              Motivo
              <textarea
                name="reason"
                rows={4}
                minLength={3}
                maxLength={240}
                required
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setCancelTarget(undefined)}
                disabled={cancelBusy}
              >
                Cancelar
              </button>
              <button
                className="button danger"
                type="submit"
                disabled={cancelBusy}
              >
                <X aria-hidden="true" size={17} />
                Reembolsar
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function localDateTimeToIso(value: string) {
  return new Date(value).toISOString();
}

function adminOrdersPath(filters: OrderFilters, page: number) {
  const params = new URLSearchParams();
  const hasDateRange = Boolean(filters.from || filters.to);

  if (!hasDateRange) {
    params.set("today", "true");
  }

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.status !== "ACTIVE" && filters.status !== "ALL") {
    params.set("status", filters.status);
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

  params.set("page", String(page));
  params.set("pageSize", String(orderPageSize));

  return `/admin/orders?${params.toString()}`;
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function sortClosures(closures: SpecialClosure[]) {
  return [...closures].sort((a, b) => {
    if (a.active !== b.active) {
      return Number(b.active) - Number(a.active);
    }

    return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
  });
}

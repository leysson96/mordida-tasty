"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Banknote,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Gift,
  History,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import {
  readableErrorMessage,
  redirectOnAdminAuthError,
} from "../../lib/admin-errors";
import { getAdminCustomerDetail } from "../../lib/admin-customers";
import { formatMoney } from "../../lib/api";
import { orderStatusLabels } from "../../lib/order-state";
import type {
  AdminCustomerConsent,
  AdminCustomerDetailResponse,
  CommercialConsentChannel,
} from "../../lib/types";

const historyPageSize = 5;
const consentChannels: CommercialConsentChannel[] = [
  "EMAIL",
  "SMS",
  "WHATSAPP",
];

interface CustomerDetailProps {
  customerId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetail({
  customerId,
  open,
  onOpenChange,
}: CustomerDetailProps) {
  const [detail, setDetail] = useState<AdminCustomerDetailResponse>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const [contactVisible, setContactVisible] = useState(false);

  useEffect(() => {
    setPage(1);
    setDetail(undefined);
    setError(undefined);
    setContactVisible(false);
  }, [customerId]);

  useEffect(() => {
    if (!open || !customerId) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(undefined);

    getAdminCustomerDetail(customerId, page, historyPageSize, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setDetail(response);
        }
      })
      .catch((requestError) => {
        if (
          controller.signal.aborted ||
          redirectOnAdminAuthError(requestError)
        ) {
          return;
        }
        setError(
          readableErrorMessage(
            requestError,
            "No se pudo cargar la ficha del cliente.",
          ),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [customerId, open, page, reloadKey]);

  const anonymized = useMemo(
    () => (detail ? isAnonymized(detail) : false),
    [detail],
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="crm-detail-overlay" />
        <Dialog.Content className="crm-detail-drawer">
          <header className="crm-detail-header">
            <div>
              <p className="eyebrow">Ficha de cliente</p>
              <Dialog.Title>
                {detail?.customer.name ?? "Cargando cliente..."}
              </Dialog.Title>
              <Dialog.Description>
                Actividad, fidelidad y permisos comerciales registrados.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="icon-button crm-detail-close"
                aria-label="Cerrar ficha del cliente"
                title="Cerrar"
              >
                <X aria-hidden="true" size={21} />
              </button>
            </Dialog.Close>
          </header>

          <div className="crm-detail-body">
            {loading && !detail ? (
              <div className="crm-detail-loading" role="status">
                <RefreshCw aria-hidden="true" className="spinning" size={22} />
                Cargando ficha...
              </div>
            ) : error && !detail ? (
              <div className="empty-state error crm-detail-error" role="alert">
                <span>{error}</span>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setReloadKey((current) => current + 1)}
                >
                  Reintentar
                </button>
              </div>
            ) : detail ? (
              <>
                <section
                  className="crm-detail-status"
                  aria-label="Estado del cliente"
                >
                  <span
                    className={`crm-status ${detail.customer.active ? "active" : "disabled"}`}
                  >
                    {detail.customer.active
                      ? "Cuenta activa"
                      : "Cuenta desactivada"}
                  </span>
                  <span
                    className={`crm-segment crm-segment-${detail.segment.key.toLowerCase()}`}
                  >
                    {detail.segment.label}
                  </span>
                  {anonymized && (
                    <span className="crm-anonymized">Datos anonimizados</span>
                  )}
                </section>

                <section
                  className="crm-detail-section"
                  aria-labelledby="crm-summary-title"
                >
                  <div className="crm-detail-section-heading">
                    <ShoppingBag aria-hidden="true" size={19} />
                    <h2 id="crm-summary-title">Resumen</h2>
                  </div>
                  <dl className="crm-metric-grid">
                    <Metric
                      label="Pedidos entregados"
                      value={String(detail.metrics.deliveredOrders)}
                    />
                    <Metric
                      label="Cancelados"
                      value={String(detail.metrics.cancelledOrders)}
                    />
                    <Metric
                      label="Gasto total"
                      value={formatMoney(detail.metrics.totalSpentCents)}
                    />
                    <Metric
                      label="Ticket medio"
                      value={formatMoney(detail.metrics.averageTicketCents)}
                    />
                  </dl>
                  <div className="crm-segment-reason">
                    <strong>Motivo del segmento</strong>
                    <span>{detail.segment.reason}</span>
                  </div>
                </section>

                <section
                  className="crm-detail-section"
                  aria-labelledby="crm-activity-title"
                >
                  <div className="crm-detail-section-heading">
                    <CalendarClock aria-hidden="true" size={19} />
                    <h2 id="crm-activity-title">Ultima actividad</h2>
                  </div>
                  <dl className="crm-detail-list crm-detail-list-two-columns">
                    <DetailTerm
                      label="Ultima compra"
                      value={formatDate(detail.metrics.lastPurchaseAt)}
                    />
                    <DetailTerm
                      label="Ultimo acceso"
                      value={formatDate(detail.customer.lastLoginAt)}
                    />
                    <DetailTerm
                      label="Cuenta creada"
                      value={formatDate(detail.customer.createdAt)}
                    />
                    {!detail.customer.active && (
                      <DetailTerm
                        label="Desactivada"
                        value={formatDate(detail.customer.disabledAt)}
                      />
                    )}
                  </dl>
                </section>

                <section
                  className="crm-detail-section"
                  aria-labelledby="crm-contact-title"
                >
                  <div className="crm-detail-section-heading crm-contact-heading">
                    <UserRound aria-hidden="true" size={19} />
                    <h2 id="crm-contact-title">Datos personales</h2>
                    {!anonymized && (
                      <button
                        type="button"
                        className="button secondary crm-contact-toggle"
                        onClick={() => setContactVisible((current) => !current)}
                        aria-expanded={contactVisible}
                        aria-controls="crm-contact-content"
                      >
                        {contactVisible ? (
                          <EyeOff aria-hidden="true" size={16} />
                        ) : (
                          <Eye aria-hidden="true" size={16} />
                        )}
                        {contactVisible ? "Ocultar" : "Mostrar"}
                      </button>
                    )}
                  </div>
                  <div id="crm-contact-content" className="crm-contact-content">
                    {anonymized ? (
                      <p>
                        La identidad fue eliminada. No se reconstruyen datos
                        desde pedidos.
                      </p>
                    ) : contactVisible ? (
                      <dl className="crm-detail-list">
                        <DetailTerm
                          icon={<Mail aria-hidden="true" size={17} />}
                          label="Email"
                          value={detail.customer.email}
                        />
                        <DetailTerm
                          icon={<Phone aria-hidden="true" size={17} />}
                          label="Telefono"
                          value={detail.customer.phone || "No indicado"}
                        />
                      </dl>
                    ) : (
                      <p>
                        Ocultos por privacidad. Muestralos solo cuando sean
                        necesarios.
                      </p>
                    )}
                  </div>
                </section>

                <div className="crm-detail-two-columns">
                  <section
                    className="crm-detail-section"
                    aria-labelledby="crm-loyalty-title"
                  >
                    <div className="crm-detail-section-heading">
                      <Gift aria-hidden="true" size={19} />
                      <h2 id="crm-loyalty-title">Fidelidad</h2>
                    </div>
                    {detail.loyalty.program.enabled ? (
                      <dl className="crm-detail-list">
                        <DetailTerm
                          label="Progreso"
                          value={`${detail.loyalty.progressOrders}/${detail.loyalty.program.goalOrders} pedidos`}
                        />
                        <DetailTerm
                          label="Premios disponibles"
                          value={String(detail.loyalty.availableRewards)}
                        />
                        <DetailTerm
                          label="Recompensa"
                          value={detail.loyalty.rewardLabel}
                        />
                      </dl>
                    ) : (
                      <p className="crm-detail-muted">Programa desactivado.</p>
                    )}
                  </section>

                  <section
                    className="crm-detail-section"
                    aria-labelledby="crm-cash-title"
                  >
                    <div className="crm-detail-section-heading">
                      <Banknote aria-hidden="true" size={19} />
                      <h2 id="crm-cash-title">Pago en efectivo</h2>
                    </div>
                    <dl className="crm-detail-list">
                      <DetailTerm
                        label="Estado"
                        value={cashTrustLabel(detail.cashTrust.status)}
                      />
                      <DetailTerm
                        label="Compras validas"
                        value={`${detail.cashTrust.successfulOrdersCount}/${detail.cashTrust.requiredSuccessfulOrders}`}
                      />
                      {detail.cashTrust.ordersRemaining > 0 && (
                        <DetailTerm
                          label="Faltan"
                          value={`${detail.cashTrust.ordersRemaining} pedido(s)`}
                        />
                      )}
                      {detail.cashTrust.lastIncidentReason && (
                        <DetailTerm
                          label="Ultima incidencia"
                          value={incidentLabel(
                            detail.cashTrust.lastIncidentReason,
                          )}
                        />
                      )}
                    </dl>
                  </section>
                </div>

                <section
                  className="crm-detail-section"
                  aria-labelledby="crm-consent-title"
                >
                  <div className="crm-detail-section-heading">
                    <ShieldCheck aria-hidden="true" size={19} />
                    <h2 id="crm-consent-title">Consentimiento comercial</h2>
                  </div>
                  <div className="crm-consent-list">
                    {consentChannels.map((channel) => (
                      <ConsentStatus
                        key={channel}
                        channel={channel}
                        consent={detail.commercialConsents.find(
                          (item) => item.channel === channel,
                        )}
                      />
                    ))}
                  </div>
                  <p className="crm-detail-note">
                    Esta ficha es informativa. No permite iniciar campanas ni
                    contactar al cliente.
                  </p>
                </section>

                <section
                  className="crm-detail-section crm-history-section"
                  aria-labelledby="crm-history-title"
                >
                  <div className="crm-detail-section-heading">
                    <History aria-hidden="true" size={19} />
                    <h2 id="crm-history-title">Historial de pedidos</h2>
                    <span>{detail.pagination.total} pedidos</span>
                  </div>
                  {error && (
                    <div
                      className="empty-state error crm-detail-error"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}
                  {detail.orders.length === 0 ? (
                    <p className="crm-history-empty">
                      Sin pedidos registrados.
                    </p>
                  ) : (
                    <div className="crm-history-list" aria-busy={loading}>
                      {detail.orders.map((order) => (
                        <article key={order.id} className="crm-history-order">
                          <div>
                            <strong>{order.orderNumber}</strong>
                            <span>{formatDate(order.createdAt)}</span>
                          </div>
                          <div>
                            <span>{orderStatusLabels[order.status]}</span>
                            <span>
                              {order.deliveryMethod === "DELIVERY"
                                ? "Envio"
                                : "Recogida"}
                            </span>
                            <span>
                              {order.paymentMethod === "CASH"
                                ? "Efectivo"
                                : "Tarjeta"}
                            </span>
                          </div>
                          <strong>{formatMoney(order.totalCents)}</strong>
                        </article>
                      ))}
                    </div>
                  )}
                  <nav
                    className="crm-history-pagination"
                    aria-label="Paginacion del historial"
                  >
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
                      disabled={loading || page <= 1}
                      aria-label="Pagina anterior del historial"
                      title="Pagina anterior"
                    >
                      <ChevronLeft aria-hidden="true" size={19} />
                    </button>
                    <span>
                      Pagina {detail.pagination.page} de{" "}
                      {detail.pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() =>
                        setPage((current) =>
                          Math.min(detail.pagination.totalPages, current + 1),
                        )
                      }
                      disabled={loading || page >= detail.pagination.totalPages}
                      aria-label="Pagina siguiente del historial"
                      title="Pagina siguiente"
                    >
                      <ChevronRight aria-hidden="true" size={19} />
                    </button>
                  </nav>
                </section>
              </>
            ) : null}
          </div>

          <style jsx global>{`
            .crm-detail-overlay {
              position: fixed;
              inset: 0;
              z-index: 80;
              background: rgba(32, 19, 15, 0.58);
              animation: crm-detail-fade 150ms ease-out;
            }

            .crm-detail-drawer {
              position: fixed;
              top: 0;
              right: 0;
              bottom: 0;
              z-index: 81;
              display: grid;
              grid-template-rows: auto minmax(0, 1fr);
              width: min(660px, 100vw);
              max-height: 100dvh;
              color: var(--color-ink);
              background: var(--color-surface);
              border-left: 1px solid var(--color-line);
              box-shadow: -18px 0 48px rgba(41, 23, 17, 0.2);
              animation: crm-detail-enter 180ms ease-out;
            }

            .crm-detail-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 16px;
              padding: 20px 22px 16px;
              border-bottom: 1px solid var(--color-line);
            }

            .crm-detail-header h2 {
              margin: 2px 0 4px;
              font-size: 1.6rem;
              line-height: 1.15;
            }

            .crm-detail-header p:not(.eyebrow) {
              margin: 0;
              color: var(--color-muted);
              font-size: 0.86rem;
            }

            .crm-detail-close {
              flex: 0 0 auto;
            }

            .crm-detail-body {
              overflow-y: auto;
              overscroll-behavior: contain;
              padding: 0 22px 28px;
            }

            .crm-detail-loading {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
              min-height: 260px;
              color: var(--color-muted);
              font-weight: 850;
            }

            .crm-detail-error {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              margin: 18px 0;
              text-align: left;
            }

            .crm-detail-status {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              padding: 16px 0 4px;
            }

            .crm-segment,
            .crm-anonymized {
              display: inline-flex;
              align-items: center;
              min-height: 28px;
              padding: 0 9px;
              border-radius: var(--radius-small);
              font-size: 0.75rem;
              font-weight: 950;
            }

            .crm-segment {
              color: var(--color-brand-dark);
              background: var(--color-accent-soft);
              border: 1px solid var(--color-line);
            }

            .crm-anonymized {
              color: #fff;
              background: #56504d;
            }

            .crm-detail-section {
              padding: 18px 0;
              border-bottom: 1px solid var(--color-line);
            }

            .crm-detail-section:last-child {
              border-bottom: 0;
            }

            .crm-detail-section-heading {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 13px;
            }

            .crm-detail-section-heading h2 {
              margin: 0;
              font-size: 1rem;
            }

            .crm-detail-section-heading > span {
              margin-left: auto;
              color: var(--color-muted);
              font-size: 0.78rem;
              font-weight: 850;
            }

            .crm-metric-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              margin: 0;
              border: 1px solid var(--color-line);
              border-radius: var(--radius-small);
            }

            .crm-metric-grid > div {
              display: grid;
              gap: 4px;
              min-width: 0;
              padding: 11px;
              border-right: 1px solid var(--color-line);
            }

            .crm-metric-grid > div:last-child {
              border-right: 0;
            }

            .crm-metric-grid dt,
            .crm-detail-list dt {
              color: var(--color-muted);
              font-size: 0.73rem;
              font-weight: 850;
            }

            .crm-metric-grid dd,
            .crm-detail-list dd {
              margin: 0;
              overflow-wrap: anywhere;
              font-weight: 900;
            }

            .crm-segment-reason {
              display: grid;
              gap: 3px;
              margin-top: 10px;
              padding-left: 11px;
              border-left: 3px solid var(--color-brand);
              font-size: 0.82rem;
            }

            .crm-segment-reason span,
            .crm-detail-muted,
            .crm-contact-content p,
            .crm-detail-note {
              color: var(--color-muted);
            }

            .crm-detail-list {
              display: grid;
              gap: 10px;
              margin: 0;
            }

            .crm-detail-list-two-columns {
              grid-template-columns: 1fr 1fr;
            }

            .crm-detail-list > div {
              display: grid;
              grid-template-columns: minmax(115px, 0.42fr) minmax(0, 1fr);
              align-items: start;
              gap: 10px;
            }

            .crm-detail-term-label {
              display: inline-flex;
              align-items: center;
              gap: 6px;
            }

            .crm-contact-heading {
              margin-bottom: 8px;
            }

            .crm-contact-toggle {
              min-height: 34px;
              margin-left: auto;
              padding: 0 10px;
              font-size: 0.78rem;
            }

            .crm-contact-content p,
            .crm-detail-muted,
            .crm-detail-note {
              margin: 0;
              font-size: 0.82rem;
            }

            .crm-detail-two-columns {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 22px;
              border-bottom: 1px solid var(--color-line);
            }

            .crm-detail-two-columns .crm-detail-section {
              border-bottom: 0;
            }

            .crm-consent-list {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 8px;
            }

            .crm-consent-item {
              display: grid;
              gap: 5px;
              min-width: 0;
              padding: 10px;
              border: 1px solid var(--color-line);
              border-radius: var(--radius-small);
            }

            .crm-consent-item > div {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 0.82rem;
              font-weight: 900;
            }

            .crm-consent-state {
              color: var(--color-muted);
              font-size: 0.74rem;
            }

            .crm-consent-state.granted {
              color: var(--color-green);
              font-weight: 900;
            }

            .crm-consent-state.withdrawn {
              color: var(--color-danger);
              font-weight: 900;
            }

            .crm-detail-note {
              margin-top: 10px;
            }

            .crm-history-list {
              display: grid;
              gap: 7px;
            }

            .crm-history-order {
              display: grid;
              grid-template-columns: minmax(150px, 1fr) minmax(0, 1.15fr) auto;
              align-items: center;
              gap: 12px;
              padding: 10px 0;
              border-bottom: 1px solid var(--color-line);
            }

            .crm-history-order > div {
              display: flex;
              flex-wrap: wrap;
              gap: 4px 9px;
              min-width: 0;
            }

            .crm-history-order > div:first-child {
              display: grid;
            }

            .crm-history-order span {
              color: var(--color-muted);
              font-size: 0.75rem;
            }

            .crm-history-empty {
              min-height: 92px;
              margin: 0;
              padding-top: 30px;
              color: var(--color-muted);
              text-align: center;
              font-weight: 850;
            }

            .crm-history-pagination {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              padding-top: 12px;
            }

            .crm-history-pagination span {
              min-width: 120px;
              color: var(--color-muted);
              text-align: center;
              font-size: 0.8rem;
            }

            @keyframes crm-detail-fade {
              from {
                opacity: 0;
              }
            }

            @keyframes crm-detail-enter {
              from {
                transform: translateX(18px);
                opacity: 0.7;
              }
            }

            @media (max-width: 620px) {
              .crm-detail-header {
                padding: 16px;
              }

              .crm-detail-body {
                padding: 0 16px 24px;
              }

              .crm-metric-grid {
                grid-template-columns: 1fr 1fr;
              }

              .crm-metric-grid > div:nth-child(2) {
                border-right: 0;
              }

              .crm-metric-grid > div:nth-child(-n + 2) {
                border-bottom: 1px solid var(--color-line);
              }

              .crm-detail-list-two-columns,
              .crm-detail-two-columns {
                grid-template-columns: 1fr;
              }

              .crm-detail-two-columns {
                gap: 0;
              }

              .crm-detail-two-columns .crm-detail-section:first-child {
                border-bottom: 1px solid var(--color-line);
              }

              .crm-consent-list {
                grid-template-columns: 1fr;
              }

              .crm-history-order {
                grid-template-columns: 1fr auto;
              }

              .crm-history-order > div:nth-child(2) {
                grid-column: 1 / -1;
                grid-row: 2;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .crm-detail-overlay,
              .crm-detail-drawer {
                animation: none;
              }
            }
          `}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DetailTerm({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="crm-detail-term-label">
        {icon}
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function ConsentStatus({
  channel,
  consent,
}: {
  channel: CommercialConsentChannel;
  consent?: AdminCustomerConsent;
}) {
  const withdrawn = Boolean(consent?.withdrawnAt);
  const granted = Boolean(consent?.grantedAt) && !withdrawn;
  const state = granted
    ? "Autorizado"
    : withdrawn
      ? "Retirado"
      : "No registrado";

  return (
    <div className="crm-consent-item">
      <div>
        {granted && <Check aria-hidden="true" size={15} />}
        {consentChannelLabel(channel)}
      </div>
      <span
        className={`crm-consent-state ${granted ? "granted" : withdrawn ? "withdrawn" : ""}`}
      >
        {state}
      </span>
      {consent && (
        <span className="crm-consent-state">
          Actualizado {formatDate(consent.updatedAt)}
        </span>
      )}
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Sin actividad";
  }
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isAnonymized(detail: AdminCustomerDetailResponse) {
  return (
    detail.customer.email.endsWith("@anonymized.invalid") ||
    detail.customer.name.trim().toLowerCase() === "cliente eliminado"
  );
}

function cashTrustLabel(
  status: AdminCustomerDetailResponse["cashTrust"]["status"],
) {
  if (status === "ENABLED") return "Habilitado";
  if (status === "BLOCKED_INCIDENT") return "Bloqueado por incidencia";
  return "Pendiente de activacion";
}

function incidentLabel(
  reason: NonNullable<
    AdminCustomerDetailResponse["cashTrust"]["lastIncidentReason"]
  >,
) {
  return reason === "NO_PICKUP"
    ? "No recogio el pedido"
    : "Ausente en la entrega";
}

function consentChannelLabel(channel: CommercialConsentChannel) {
  if (channel === "EMAIL") return "Email";
  if (channel === "SMS") return "SMS";
  return "WhatsApp";
}

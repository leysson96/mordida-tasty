"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import * as Switch from "@radix-ui/react-switch";
import {
  Banknote,
  Gift,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  MessageCircle,
  MessageSquareText,
  ShieldCheck,
  Trash2,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { ApiError, api, formatMoney } from "../../lib/api";
import {
  Address,
  CustomerCashTrustState,
  CustomerCommercialConsentPreference,
  CustomerLoyaltyProgress,
  CommercialConsentChannel,
  OrderSummary,
  User,
} from "../../lib/types";

export default function AccountPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<User>();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loyalty, setLoyalty] = useState<CustomerLoyaltyProgress>();
  const [cashTrust, setCashTrust] = useState<CustomerCashTrustState>();
  const [commercialConsents, setCommercialConsents] = useState<
    CustomerCommercialConsentPreference[]
  >([]);
  const [commercialBusy, setCommercialBusy] = useState(false);
  const [commercialMessage, setCommercialMessage] = useState<string>();
  const [commercialError, setCommercialError] = useState<string>();
  const [error, setError] = useState<string>();
  const [addressMessage, setAddressMessage] = useState<string>();
  const [addressBusy, setAddressBusy] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address>();

  useEffect(() => {
    let active = true;

    Promise.all([
      api<User>("/auth/me"),
      api<Address[]>("/customers/addresses"),
      api<OrderSummary[]>("/orders/mine"),
      api<CustomerLoyaltyProgress>("/customers/loyalty").catch(() => undefined),
      api<CustomerCashTrustState>("/customers/cash-trust").catch(
        () => undefined,
      ),
      api<CustomerCommercialConsentPreference[]>(
        "/customers/commercial-consents",
      ),
    ])
      .then(
        ([
          me,
          savedAddresses,
          savedOrders,
          loyaltyProgress,
          cashTrustState,
          consentPreferences,
        ]) => {
          if (!active) {
            return;
          }
          setUser(me);
          setAddresses(savedAddresses);
          setOrders(savedOrders);
          setLoyalty(loyaltyProgress);
          setCashTrust(cashTrustState);
          setCommercialConsents(consentPreferences);
          setAuthenticated(true);
        },
      )
      .catch((requestError: Error) => {
        if (!active) {
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 401) {
          setAuthenticated(false);
          return;
        }
        setAuthenticated(true);
        setError(requestError.message);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authenticated !== true) {
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      label: String(form.get("label")),
      recipientName: String(form.get("recipientName")),
      phone: String(form.get("phone")),
      street: String(form.get("street")),
      city: String(form.get("city")),
      postalCode: String(form.get("postalCode")),
      notes: String(form.get("notes") ?? ""),
      isDefault: form.get("isDefault") === "on",
    };

    try {
      setAddressBusy(true);
      setError(undefined);
      setAddressMessage(undefined);

      const address = await api<Address>(
        editingAddress
          ? `/customers/addresses/${editingAddress.id}`
          : "/customers/addresses",
        {
          method: editingAddress ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );

      setAddresses((current) => {
        const updated = current
          .map((item) =>
            item.id === address.id
              ? address
              : address.isDefault
                ? { ...item, isDefault: false }
                : item,
          )
          .filter((item) => item.id !== address.id);
        return sortAddresses([address, ...updated]);
      });
      setEditingAddress(undefined);
      setAddressMessage(
        editingAddress ? "Direccion actualizada." : "Direccion guardada.",
      );
      formElement.reset();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar.",
      );
    } finally {
      setAddressBusy(false);
    }
  }

  async function deleteAddress(address: Address) {
    const confirmed = window.confirm(`Eliminar direccion "${address.label}"?`);
    if (!confirmed) {
      return;
    }

    try {
      setAddressBusy(true);
      setError(undefined);
      setAddressMessage(undefined);
      await api(`/customers/addresses/${address.id}`, { method: "DELETE" });
      setAddresses((current) =>
        current.filter((item) => item.id !== address.id),
      );
      if (editingAddress?.id === address.id) {
        setEditingAddress(undefined);
      }
      setAddressMessage("Direccion eliminada.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo eliminar.",
      );
    } finally {
      setAddressBusy(false);
    }
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  async function updateCommercialConsent(
    channel: CommercialConsentChannel,
    granted: boolean,
  ) {
    if (commercialBusy) {
      return;
    }

    const selectedChannels = new Set(
      commercialConsents
        .filter((preference) => preference.granted)
        .map((preference) => preference.channel),
    );
    if (granted) {
      selectedChannels.add(channel);
    } else {
      selectedChannels.delete(channel);
    }

    try {
      setCommercialBusy(true);
      setCommercialMessage(undefined);
      setCommercialError(undefined);
      const updated = await api<CustomerCommercialConsentPreference[]>(
        "/customers/commercial-consents",
        {
          method: "PUT",
          body: JSON.stringify({ channels: [...selectedChannels] }),
        },
      );
      setCommercialConsents(updated);
      setCommercialMessage(
        granted
          ? "Preferencia activada."
          : "Preferencia retirada inmediatamente.",
      );
    } catch (requestError) {
      setCommercialError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo actualizar la preferencia.",
      );
    } finally {
      setCommercialBusy(false);
    }
  }

  if (authenticated === null) {
    return (
      <main className="page-shell auth-page">
        <section className="auth-panel">
          <UserRound aria-hidden="true" size={30} />
          <h1>Tu cuenta</h1>
          <p className="muted">Cargando cuenta.</p>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="page-shell auth-page">
        <section className="auth-panel">
          <UserRound aria-hidden="true" size={30} />
          <h1>Tu cuenta</h1>
          <Link href="/auth/login" className="button primary full">
            Entrar
          </Link>
          <Link href="/auth/registro" className="button secondary full">
            Crear cuenta
          </Link>
        </section>
      </main>
    );
  }

  const cashTrustInfo = cashTrust ? cashTrustDisplay(cashTrust) : undefined;

  return (
    <main className="page-shell account-page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Cuenta</p>
          <h1>{user?.name ?? "Cliente"}</h1>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={logout}
          title="Salir"
        >
          <LogOut aria-hidden="true" size={20} />
        </button>
      </section>

      {error && <div className="empty-state error">{error}</div>}

      {loyalty?.program.enabled && (
        <section className="loyalty-panel">
          <div className="loyalty-copy">
            <span className="loyalty-badge">
              <Trophy aria-hidden="true" size={17} />
              {loyalty.rewardReady ? "Premio desbloqueado" : "En progreso"}
            </span>
            <h2>{loyalty.program.title}</h2>
            <p>{loyalty.program.description}</p>
          </div>
          <div className="loyalty-progress-card">
            <div className="loyalty-progress-head">
              <span>
                {loyalty.progressOrders}/{loyalty.program.goalOrders} pedidos
              </span>
              <strong>{loyalty.rewardLabel}</strong>
            </div>
            <div className="loyalty-meter" aria-hidden="true">
              <span style={{ width: `${loyalty.progressPercent}%` }} />
            </div>
            <div className="loyalty-progress-foot">
              <span>{loyalty.completedOrders} entregados</span>
              <span>
                {loyalty.rewardReady
                  ? `${loyalty.availableRewards} premio${
                      loyalty.availableRewards === 1 ? "" : "s"
                    } disponible${loyalty.availableRewards === 1 ? "" : "s"}`
                  : `Faltan ${loyalty.ordersRemaining}`}
              </span>
            </div>
            {loyalty.usedRewards > 0 && (
              <small className="loyalty-used-note">
                {loyalty.usedRewards} premio
                {loyalty.usedRewards === 1 ? "" : "s"} canjeado
                {loyalty.usedRewards === 1 ? "" : "s"}.
              </small>
            )}
          </div>
          <Gift className="loyalty-watermark" aria-hidden="true" size={96} />
        </section>
      )}

      {cashTrust && cashTrustInfo && (
        <section
          className={`loyalty-panel cash-trust-panel ${
            cashTrust.cashEnabled ? "enabled" : "locked"
          }`}
        >
          <div className="loyalty-copy">
            <span className="loyalty-badge">
              <Banknote aria-hidden="true" size={17} />
              {cashTrustInfo.badge}
            </span>
            <h2>{cashTrustInfo.title}</h2>
            <p>{cashTrustInfo.description}</p>
          </div>
          <div className="loyalty-progress-card">
            <div className="loyalty-progress-head">
              <span>
                {cashTrust.successfulOrdersCount}/
                {cashTrust.requiredSuccessfulOrders} pedidos correctos
              </span>
              <strong>{cashTrustInfo.status}</strong>
            </div>
            <div className="loyalty-meter" aria-hidden="true">
              <span style={{ width: `${cashTrustProgress(cashTrust)}%` }} />
            </div>
            <div className="loyalty-progress-foot">
              <span>{cashTrustInfo.progress}</span>
              <span>{cashTrustInfo.action}</span>
            </div>
          </div>
        </section>
      )}

      <section
        className="commercial-preferences-panel"
        aria-labelledby="commercial-preferences-title"
      >
        <div className="commercial-preferences-heading">
          <ShieldCheck aria-hidden="true" size={22} />
          <div>
            <h2 id="commercial-preferences-title">
              Comunicaciones comerciales
            </h2>
            <p>
              Elige por separado como quieres recibir ofertas y novedades. Cada
              cambio se guarda al momento y puedes retirar el permiso cuando
              quieras.
            </p>
          </div>
        </div>
        <div className="commercial-preference-list">
          <CommercialPreference
            channel="EMAIL"
            title="Email"
            description="Ofertas y novedades en tu correo."
            icon={<Mail aria-hidden="true" size={19} />}
            checked={isCommercialChannelGranted(commercialConsents, "EMAIL")}
            disabled={commercialBusy}
            onCheckedChange={(checked) =>
              updateCommercialConsent("EMAIL", checked)
            }
          />
          <CommercialPreference
            channel="SMS"
            title="SMS"
            description="Promociones breves en tu telefono."
            icon={<MessageSquareText aria-hidden="true" size={19} />}
            checked={isCommercialChannelGranted(commercialConsents, "SMS")}
            disabled={commercialBusy}
            onCheckedChange={(checked) =>
              updateCommercialConsent("SMS", checked)
            }
          />
          <CommercialPreference
            channel="WHATSAPP"
            title="WhatsApp"
            description="Novedades comerciales por WhatsApp."
            icon={<MessageCircle aria-hidden="true" size={19} />}
            checked={isCommercialChannelGranted(commercialConsents, "WHATSAPP")}
            disabled={commercialBusy}
            onCheckedChange={(checked) =>
              updateCommercialConsent("WHATSAPP", checked)
            }
          />
        </div>
        <div className="commercial-preferences-feedback" aria-live="polite">
          {commercialBusy && <span>Guardando preferencia...</span>}
          {commercialMessage && (
            <span className="form-success">{commercialMessage}</span>
          )}
          {commercialError && (
            <span className="form-error">{commercialError}</span>
          )}
        </div>
      </section>

      <section className="account-grid">
        <form
          key={editingAddress?.id ?? "new-address"}
          className="form-panel"
          onSubmit={saveAddress}
        >
          <h2>
            <MapPin aria-hidden="true" size={20} />
            {editingAddress ? "Editar direccion" : "Direccion"}
          </h2>
          <div className="form-grid">
            <label>
              Etiqueta
              <input
                name="label"
                required
                placeholder="Casa"
                defaultValue={editingAddress?.label ?? ""}
              />
            </label>
            <label>
              Nombre
              <input
                name="recipientName"
                required
                defaultValue={editingAddress?.recipientName ?? ""}
              />
            </label>
            <label>
              Telefono
              <input
                name="phone"
                required
                placeholder="+34..."
                defaultValue={editingAddress?.phone ?? ""}
              />
            </label>
            <label>
              Ciudad
              <input
                name="city"
                required
                defaultValue={editingAddress?.city ?? ""}
              />
            </label>
            <label className="full-field">
              Direccion
              <input
                name="street"
                required
                defaultValue={editingAddress?.street ?? ""}
              />
            </label>
            <label>
              Codigo postal
              <input
                name="postalCode"
                required
                defaultValue={editingAddress?.postalCode ?? ""}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isDefault"
                defaultChecked={editingAddress?.isDefault ?? false}
              />
              Predeterminada
            </label>
            <label className="full-field">
              Notas
              <textarea
                name="notes"
                rows={3}
                defaultValue={editingAddress?.notes ?? ""}
              />
            </label>
          </div>
          {addressMessage && <p className="form-success">{addressMessage}</p>}
          <div className="form-actions">
            {editingAddress && (
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditingAddress(undefined)}
                disabled={addressBusy}
              >
                <X aria-hidden="true" size={18} />
                Cancelar
              </button>
            )}
            <button
              className="button primary"
              type="submit"
              disabled={addressBusy}
            >
              {editingAddress ? (
                <Save aria-hidden="true" size={18} />
              ) : (
                <Plus aria-hidden="true" size={18} />
              )}
              {addressBusy
                ? "Guardando"
                : editingAddress
                  ? "Actualizar"
                  : "Guardar"}
            </button>
          </div>
        </form>

        <section className="stacked-list">
          <h2>Direcciones guardadas</h2>
          {addresses.length === 0 ? (
            <p className="muted">Sin direcciones guardadas.</p>
          ) : (
            addresses.map((address) => (
              <article key={address.id} className="list-card">
                <div className="address-card-head">
                  <strong>{address.label}</strong>
                  {address.isDefault && (
                    <span className="status-pill">Predeterminada</span>
                  )}
                </div>
                <p>
                  {address.street}, {address.city} {address.postalCode}
                </p>
                <p>
                  {address.recipientName} - {address.phone}
                </p>
                {address.notes && <p>{address.notes}</p>}
                <div className="address-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setEditingAddress(address)}
                    disabled={addressBusy}
                  >
                    <Pencil aria-hidden="true" size={17} />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="button secondary danger-text"
                    onClick={() => deleteAddress(address)}
                    disabled={addressBusy}
                  >
                    <Trash2 aria-hidden="true" size={17} />
                    Eliminar
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </section>

      <section className="stacked-list">
        <h2>
          <ReceiptText aria-hidden="true" size={20} />
          Historial
        </h2>
        {orders.length === 0 ? (
          <p className="muted">Sin pedidos todavia.</p>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={
                order.trackingToken
                  ? `/seguimiento/${order.orderNumber}?t=${encodeURIComponent(order.trackingToken)}`
                  : `/seguimiento/${order.orderNumber}`
              }
              className="list-card order-link"
            >
              <span>{order.orderNumber}</span>
              <strong>{formatMoney(order.totalCents)}</strong>
              <span>{order.status}</span>
            </Link>
          ))
        )}
      </section>
      <style jsx global>{`
        .commercial-preferences-panel {
          display: grid;
          gap: 15px;
          margin-bottom: 20px;
          padding: 18px 20px;
          border: 1px solid var(--color-line);
          border-radius: var(--radius);
          background: rgba(255, 250, 243, 0.98);
          box-shadow: var(--shadow-tight);
        }

        .commercial-preferences-heading {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .commercial-preferences-heading h2,
        .commercial-preferences-heading p {
          margin: 0;
        }

        .commercial-preferences-heading h2 {
          font-size: 1.05rem;
        }

        .commercial-preferences-heading p {
          margin-top: 4px;
          color: var(--color-muted);
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .commercial-preference-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          border: 1px solid var(--color-line);
          border-radius: var(--radius-small);
        }

        .commercial-preference-row {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding: 13px;
          border-right: 1px solid var(--color-line);
        }

        .commercial-preference-row:last-child {
          border-right: 0;
        }

        .commercial-preference-copy {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .commercial-preference-copy strong {
          font-size: 0.88rem;
        }

        .commercial-preference-copy span {
          color: var(--color-muted);
          font-size: 0.75rem;
          line-height: 1.35;
        }

        .commercial-preference-switch {
          position: relative;
          flex: 0 0 auto;
          width: 44px;
          height: 24px;
          margin-left: auto;
          padding: 0;
          border: 1px solid var(--color-line-strong);
          border-radius: 999px;
          background: #c9c0ba;
          cursor: pointer;
        }

        .commercial-preference-switch[data-state="checked"] {
          background: var(--color-green);
        }

        .commercial-preference-switch:focus-visible {
          outline: 3px solid rgba(122, 0, 8, 0.25);
          outline-offset: 2px;
        }

        .commercial-preference-switch:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .commercial-preference-thumb {
          display: block;
          width: 18px;
          height: 18px;
          transform: translateX(2px);
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 3px rgba(33, 21, 18, 0.28);
          transition: transform 130ms ease;
        }

        .commercial-preference-thumb[data-state="checked"] {
          transform: translateX(22px);
        }

        .commercial-preferences-feedback {
          min-height: 22px;
          color: var(--color-muted);
          font-size: 0.82rem;
          font-weight: 850;
        }

        .commercial-preferences-feedback .form-success,
        .commercial-preferences-feedback .form-error {
          display: inline-block;
          margin: 0;
        }

        @media (max-width: 760px) {
          .commercial-preference-list {
            grid-template-columns: 1fr;
          }

          .commercial-preference-row {
            border-right: 0;
            border-bottom: 1px solid var(--color-line);
          }

          .commercial-preference-row:last-child {
            border-bottom: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .commercial-preference-thumb {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}

function CommercialPreference({
  channel,
  title,
  description,
  icon,
  checked,
  disabled,
  onCheckedChange,
}: {
  channel: CommercialConsentChannel;
  title: string;
  description: string;
  icon: ReactNode;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="commercial-preference-row">
      {icon}
      <div className="commercial-preference-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <Switch.Root
        className="commercial-preference-switch"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={`${title}: ${checked ? "activado" : "desactivado"}`}
        data-channel={channel}
      >
        <Switch.Thumb className="commercial-preference-thumb" />
      </Switch.Root>
    </div>
  );
}

function isCommercialChannelGranted(
  preferences: CustomerCommercialConsentPreference[],
  channel: CommercialConsentChannel,
) {
  return preferences.some(
    (preference) => preference.channel === channel && preference.granted,
  );
}

function sortAddresses(addresses: Address[]) {
  return [...addresses].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault),
  );
}

function cashTrustDisplay(cashTrust: CustomerCashTrustState) {
  if (cashTrust.cashEnabled) {
    return {
      badge: "Efectivo activo",
      title: "Pago en efectivo disponible",
      description:
        "Ya puedes elegir efectivo en pedidos para recoger o entregar.",
      status: "Activo",
      progress: "Confianza completada",
      action: "Disponible en checkout",
    };
  }

  const remaining = Math.max(cashTrust.ordersRemaining, 0);
  const orderWord = remaining === 1 ? "pedido" : "pedidos";

  if (cashTrust.status === "BLOCKED_INCIDENT") {
    return {
      badge: "Efectivo bloqueado",
      title: "Efectivo pausado por incidencia",
      description:
        "Para recuperar efectivo, completa pedidos con tarjeta sin incidencias.",
      status: `Faltan ${remaining}`,
      progress: `${remaining} ${orderWord} con tarjeta`,
      action: "Solo tarjeta por ahora",
    };
  }

  return {
    badge: "Efectivo pendiente",
    title: "Activa efectivo con pedidos correctos",
    description:
      "Los clientes nuevos completan primero pedidos con tarjeta sin incidencias.",
    status: `Faltan ${remaining}`,
    progress: `${remaining} ${orderWord} con tarjeta`,
    action: "Solo tarjeta por ahora",
  };
}

function cashTrustProgress(cashTrust: CustomerCashTrustState) {
  if (cashTrust.cashEnabled) {
    return 100;
  }

  if (cashTrust.requiredSuccessfulOrders <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round(
      (cashTrust.successfulOrdersCount / cashTrust.requiredSuccessfulOrders) *
        100,
    ),
  );
}

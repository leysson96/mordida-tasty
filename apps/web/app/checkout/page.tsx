"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, MapPin, Store } from "lucide-react";
import { ApiError, api, formatMoney } from "../../lib/api";
import {
  Address,
  DeliveryMethod,
  DeliveryQuote,
  OrderPaymentMethod,
  OrderSummary,
  PublicSettings,
  User,
} from "../../lib/types";
import { useCart } from "../../components/cart-provider";

interface CheckoutSessionResponse {
  checkoutUrl: string;
  orderNumber: string;
}

export default function CheckoutPage() {
  const { items, subtotalCents, clear } = useCart();
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("PICKUP");
  const [paymentMethod, setPaymentMethod] =
    useState<OrderPaymentMethod>("CARD");
  const [publicSettings, setPublicSettings] = useState<PublicSettings>();
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [addressName, setAddressName] = useState("");
  const [addressPhone, setAddressPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [cashTenderedEuros, setCashTenderedEuros] = useState("");
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote>();
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    api<PublicSettings>("/settings/public")
      .then((settings) => {
        if (active) {
          setPublicSettings(settings);
        }
      })
      .catch((requestError: Error) => setError(requestError.message));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([api<User>("/auth/me"), api<Address[]>("/customers/addresses")])
      .then(([user, addresses]) => {
        if (!active) {
          return;
        }

        setCustomerName((current) => current || user.name || "");
        setCustomerEmail((current) => current || user.email || "");
        setCustomerPhone((current) => current || user.phone || "");
        setSavedAddresses(addresses);

        const defaultAddress =
          addresses.find((address) => address.isDefault) ?? addresses[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
          applySavedAddress(defaultAddress);
        }
      })
      .catch((requestError: Error) => {
        if (!active) {
          return;
        }

        if (requestError instanceof ApiError && requestError.status === 401) {
          return;
        }

        setError(requestError.message);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (deliveryMethod !== "DELIVERY") {
      setDeliveryQuote(undefined);
      setQuoteError(undefined);
      setQuoteLoading(false);
      return;
    }

    const cleanPostalCode = postalCode.trim();
    if (cleanPostalCode.length < 4) {
      setDeliveryQuote(undefined);
      setQuoteError(undefined);
      setQuoteLoading(false);
      return;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      setQuoteLoading(true);
      setQuoteError(undefined);
      api<DeliveryQuote>(
        `/settings/delivery-quote?postalCode=${encodeURIComponent(
          cleanPostalCode,
        )}&subtotalCents=${subtotalCents}`,
      )
        .then((quote) => {
          if (!active) {
            return;
          }

          setDeliveryQuote(quote);
          setQuoteError(
            quote.available
              ? undefined
              : (quote.reason ?? "No repartimos en ese codigo postal."),
          );
        })
        .catch((requestError: Error) => {
          if (active) {
            setDeliveryQuote(undefined);
            setQuoteError(requestError.message);
          }
        })
        .finally(() => {
          if (active) {
            setQuoteLoading(false);
          }
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [deliveryMethod, postalCode, subtotalCents]);

  const hasDeliveryZones = (publicSettings?.deliveryZones.length ?? 0) > 0;
  const deliveryFeeCents =
    deliveryMethod === "DELIVERY"
      ? (deliveryQuote?.deliveryFeeCents ??
        (hasDeliveryZones ? 0 : (publicSettings?.deliveryFeeCents ?? 0)))
      : 0;
  const ordersClosed = publicSettings?.openNow === false;
  const ordersClosedReason =
    publicSettings?.serviceStatus?.reason ??
    "Los pedidos estan cerrados ahora mismo.";
  const deliveryNeedsQuote =
    deliveryMethod === "DELIVERY" &&
    hasDeliveryZones &&
    postalCode.trim().length >= 4 &&
    !deliveryQuote &&
    !quoteError;
  const deliveryBlocked =
    deliveryMethod === "DELIVERY" &&
    (deliveryQuote?.available === false || Boolean(quoteError));
  const totalCents = useMemo(
    () => subtotalCents + deliveryFeeCents,
    [deliveryFeeCents, subtotalCents],
  );
  const cashTenderedCents = useMemo(
    () => parseMoneyInputCents(cashTenderedEuros),
    [cashTenderedEuros],
  );
  const cashChangeCents =
    paymentMethod === "CASH" && cashTenderedCents !== undefined
      ? cashTenderedCents - totalCents
      : undefined;
  const cashNeedsTender =
    paymentMethod === "CASH" && deliveryMethod === "DELIVERY";
  const cashBlocked =
    cashNeedsTender &&
    (cashTenderedCents === undefined || cashTenderedCents < totalCents);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (items.length === 0) {
      setError("El carrito esta vacio.");
      return;
    }

    if (deliveryMethod === "DELIVERY" && !publicSettings) {
      setError("No se pudo confirmar el coste de envio.");
      return;
    }

    if (deliveryMethod === "DELIVERY" && hasDeliveryZones) {
      if (postalCode.trim().length < 4) {
        setError("Introduce un codigo postal para calcular el envio.");
        return;
      }

      if (quoteLoading || deliveryNeedsQuote) {
        setError("Espera a que confirmemos la zona de reparto.");
        return;
      }

      if (!deliveryQuote?.available) {
        setError(
          quoteError ??
            deliveryQuote?.reason ??
            "No se pudo confirmar la zona de reparto.",
        );
        return;
      }
    }

    if (ordersClosed) {
      setError(ordersClosedReason);
      return;
    }

    if (paymentMethod === "CASH" && deliveryMethod === "DELIVERY") {
      if (cashTenderedCents === undefined) {
        setError(
          "Indica con cuanto pagara el cliente para preparar el cambio.",
        );
        return;
      }

      if (cashTenderedCents !== undefined && cashTenderedCents < totalCents) {
        setError("El importe en efectivo debe cubrir el total del pedido.");
        return;
      }
    }

    const form = new FormData(event.currentTarget);
    const idempotencyKey = crypto.randomUUID();
    setLoading(true);

    try {
      const order = await api<OrderSummary>("/orders", {
        method: "POST",
        idempotencyKey,
        body: JSON.stringify({
          customerName: String(form.get("customerName")),
          customerEmail: String(form.get("customerEmail")),
          customerPhone: String(form.get("customerPhone")),
          deliveryMethod,
          paymentMethod,
          cashTenderedCents:
            paymentMethod === "CASH" && deliveryMethod === "DELIVERY"
              ? cashTenderedCents
              : undefined,
          address:
            deliveryMethod === "DELIVERY"
              ? {
                  name: String(form.get("addressName")),
                  phone: String(form.get("addressPhone")),
                  street: String(form.get("street")),
                  city: String(form.get("city")),
                  postalCode: String(form.get("postalCode")),
                  notes: String(form.get("notes") ?? ""),
                }
              : undefined,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            options: cartItemOptionsPayload(item.options),
          })),
          acceptLegal: form.get("acceptLegal") === "on",
        }),
      });

      if (paymentMethod === "CASH") {
        if (!order.trackingToken) {
          throw new Error("No se pudo abrir el seguimiento del pedido.");
        }

        clear();
        window.location.href = `/seguimiento/${encodeURIComponent(
          order.orderNumber,
        )}?t=${encodeURIComponent(order.trackingToken)}`;
        return;
      }

      const checkout = await api<CheckoutSessionResponse>(
        "/payments/checkout",
        {
          method: "POST",
          body: JSON.stringify({ orderId: order.id }),
        },
      );

      window.sessionStorage.setItem(
        "mordida_pending_checkout_order",
        checkout.orderNumber,
      );
      window.location.href = checkout.checkoutUrl;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear el pedido.",
      );
      setLoading(false);
    }
  }

  function applySavedAddress(address: Address) {
    setAddressName(address.recipientName);
    setAddressPhone(address.phone);
    setStreet(address.street);
    setCity(address.city);
    setPostalCode(address.postalCode);
    setNotes(address.notes ?? "");
  }

  function selectSavedAddress(addressId: string) {
    setSelectedAddressId(addressId);
    const address = savedAddresses.find((item) => item.id === addressId);
    if (address) {
      applySavedAddress(address);
    }
  }

  return (
    <main className="page-shell checkout-page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1>Datos del pedido</h1>
        </div>
        <CreditCard aria-hidden="true" size={28} />
      </section>

      <form className="checkout-layout" onSubmit={submit}>
        <section className="form-panel">
          <div className="segmented-control">
            <button
              type="button"
              className={deliveryMethod === "PICKUP" ? "active" : ""}
              onClick={() => setDeliveryMethod("PICKUP")}
            >
              <Store aria-hidden="true" size={17} />
              Recogida
            </button>
            <button
              type="button"
              className={deliveryMethod === "DELIVERY" ? "active" : ""}
              onClick={() => setDeliveryMethod("DELIVERY")}
            >
              <MapPin aria-hidden="true" size={17} />
              Envio
            </button>
          </div>

          <div className="form-grid">
            <label>
              Nombre
              <input
                name="customerName"
                required
                minLength={2}
                autoComplete="name"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </label>
            <label>
              Email
              <input
                name="customerEmail"
                required
                type="email"
                autoComplete="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
              />
            </label>
            <label>
              Telefono
              <input
                name="customerPhone"
                required
                autoComplete="tel"
                placeholder="+34..."
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
              />
            </label>
          </div>

          {deliveryMethod === "DELIVERY" && (
            <div className="form-grid address-grid">
              {savedAddresses.length > 0 && (
                <label className="full-field checkout-address-picker">
                  Direccion guardada
                  <select
                    value={selectedAddressId}
                    onChange={(event) => selectSavedAddress(event.target.value)}
                  >
                    {savedAddresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.label}
                        {address.isDefault ? " - predeterminada" : ""} -{" "}
                        {address.street}, {address.postalCode}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Nombre entrega
                <input
                  name="addressName"
                  required
                  minLength={2}
                  autoComplete="name"
                  value={addressName}
                  onChange={(event) => setAddressName(event.target.value)}
                />
              </label>
              <label>
                Telefono entrega
                <input
                  name="addressPhone"
                  required
                  autoComplete="tel"
                  placeholder="+34..."
                  value={addressPhone}
                  onChange={(event) => setAddressPhone(event.target.value)}
                />
              </label>
              <label className="full-field">
                Direccion
                <input
                  name="street"
                  required
                  minLength={4}
                  autoComplete="street-address"
                  value={street}
                  onChange={(event) => setStreet(event.target.value)}
                />
              </label>
              <label>
                Ciudad
                <input
                  name="city"
                  required
                  minLength={2}
                  autoComplete="address-level2"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </label>
              <label>
                Codigo postal
                <input
                  name="postalCode"
                  required
                  minLength={4}
                  autoComplete="postal-code"
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                />
              </label>
              {hasDeliveryZones && (
                <div
                  className={`delivery-quote full-field ${
                    quoteError || deliveryQuote?.available === false
                      ? "blocked"
                      : ""
                  }`}
                >
                  {quoteLoading || deliveryNeedsQuote ? (
                    <span>Calculando zona de reparto...</span>
                  ) : quoteError ? (
                    <span>{quoteError}</span>
                  ) : deliveryQuote?.available ? (
                    <span>
                      {deliveryQuote.zone?.name ?? "Zona general"} - Envio{" "}
                      {formatMoney(deliveryQuote.deliveryFeeCents)}
                      {deliveryQuote.minimumOrderCents > 0
                        ? ` - Pedido minimo ${formatMoney(
                            deliveryQuote.minimumOrderCents,
                          )}`
                        : ""}
                    </span>
                  ) : (
                    <span>Introduce tu codigo postal para calcular envio.</span>
                  )}
                </div>
              )}
              <label className="full-field">
                Notas
                <textarea
                  name="notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
            </div>
          )}

          <section className="payment-method-panel">
            <div className="payment-method-head">
              <h2>Pago</h2>
              <strong>{formatMoney(totalCents)}</strong>
            </div>
            <div className="payment-choice-grid">
              <button
                type="button"
                className={paymentMethod === "CARD" ? "active" : ""}
                onClick={() => setPaymentMethod("CARD")}
              >
                <CreditCard aria-hidden="true" size={17} />
                Tarjeta
              </button>
              <button
                type="button"
                className={paymentMethod === "CASH" ? "active" : ""}
                onClick={() => setPaymentMethod("CASH")}
              >
                <Banknote aria-hidden="true" size={18} />
                Efectivo
              </button>
            </div>

            {paymentMethod === "CASH" && (
              <div className="cash-payment-panel">
                {deliveryMethod === "DELIVERY" ? (
                  <>
                    <label>
                      Paga con
                      <input
                        name="cashTenderedEuros"
                        inputMode="decimal"
                        placeholder={formatMoney(totalCents)}
                        value={cashTenderedEuros}
                        onChange={(event) =>
                          setCashTenderedEuros(event.target.value)
                        }
                      />
                    </label>
                    <p
                      className={
                        cashChangeCents !== undefined && cashChangeCents < 0
                          ? "form-error"
                          : "cash-change-preview"
                      }
                    >
                      {cashTenderedCents === undefined
                        ? "Indica el importe para preparar cambio."
                        : cashChangeCents !== undefined && cashChangeCents < 0
                          ? `Faltan ${formatMoney(Math.abs(cashChangeCents))}.`
                          : `Cambio a preparar: ${formatMoney(
                              cashChangeCents ?? 0,
                            )}`}
                    </p>
                  </>
                ) : (
                  <p className="cash-change-preview">
                    Pagas en caja al recoger tu pedido.
                  </p>
                )}
              </div>
            )}
          </section>

          <label className="checkbox-label legal-consent">
            <input type="checkbox" name="acceptLegal" required />
            <span>
              Acepto la <Link href="/privacidad">politica de privacidad</Link> y
              las <Link href="/condiciones">condiciones</Link>.
            </span>
          </label>
        </section>

        <aside className="summary-panel checkout-summary">
          <h2>Resumen</h2>
          {items.map((item) => (
            <div key={item.id}>
              <span className="summary-item-copy">
                <strong>
                  {item.quantity} x {item.name}
                </strong>
                {item.options.length > 0 && (
                  <small>
                    {item.options
                      .map(
                        (option) => `${option.groupName}: ${option.choiceName}`,
                      )
                      .join(", ")}
                  </small>
                )}
              </span>
              <strong>{formatMoney(item.priceCents * item.quantity)}</strong>
            </div>
          ))}
          <div>
            <span>Envio</span>
            <strong>{formatMoney(deliveryFeeCents)}</strong>
          </div>
          <div className="total-row">
            <span>Total</span>
            <strong>{formatMoney(totalCents)}</strong>
          </div>
          {deliveryMethod === "DELIVERY" && hasDeliveryZones && (
            <p
              className={
                deliveryBlocked ? "form-error" : "delivery-summary-note"
              }
            >
              {quoteLoading || deliveryNeedsQuote
                ? "Calculando reparto..."
                : deliveryQuote?.available
                  ? `Zona: ${deliveryQuote.zone?.name ?? "general"}`
                  : (quoteError ?? "Introduce codigo postal para calcular.")}
            </p>
          )}
          {ordersClosed && <p className="form-error">{ordersClosedReason}</p>}
          {error && <p className="form-error">{error}</p>}
          <button
            className="button primary full"
            type="submit"
            disabled={
              loading ||
              items.length === 0 ||
              ordersClosed ||
              (deliveryMethod === "DELIVERY" && !publicSettings) ||
              deliveryBlocked ||
              quoteLoading ||
              deliveryNeedsQuote ||
              cashBlocked
            }
          >
            {paymentMethod === "CASH" ? (
              <Banknote aria-hidden="true" size={18} />
            ) : (
              <CreditCard aria-hidden="true" size={18} />
            )}
            {loading
              ? paymentMethod === "CASH"
                ? "Confirmando"
                : "Abriendo pago"
              : paymentMethod === "CASH"
                ? "Confirmar pedido"
                : "Pagar"}
          </button>
        </aside>
      </form>
    </main>
  );
}

function cartItemOptionsPayload(
  options: Array<{ groupId: string; choiceId: string }>,
) {
  const byGroup = new Map<string, string[]>();

  for (const option of options) {
    byGroup.set(option.groupId, [
      ...(byGroup.get(option.groupId) ?? []),
      option.choiceId,
    ]);
  }

  return [...byGroup.entries()].map(([groupId, choiceIds]) => ({
    groupId,
    choiceIds,
  }));
}

function parseMoneyInputCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return undefined;
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    return undefined;
  }

  return Math.round(amount * 100);
}

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CreditCard, MapPin, Store } from "lucide-react";
import { api, formatMoney } from "../../lib/api";
import {
  DeliveryMethod,
  DeliveryQuote,
  OrderSummary,
  PublicSettings,
} from "../../lib/types";
import { useCart } from "../../components/cart-provider";

interface CheckoutSessionResponse {
  checkoutUrl: string;
  orderNumber: string;
}

export default function CheckoutPage() {
  const { items, subtotalCents } = useCart();
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("PICKUP");
  const [publicSettings, setPublicSettings] = useState<PublicSettings>();
  const [postalCode, setPostalCode] = useState("");
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
          : "No se pudo crear el pago.",
      );
      setLoading(false);
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
              />
            </label>
            <label>
              Email
              <input
                name="customerEmail"
                required
                type="email"
                autoComplete="email"
              />
            </label>
            <label>
              Telefono
              <input
                name="customerPhone"
                required
                autoComplete="tel"
                placeholder="+34..."
              />
            </label>
          </div>

          {deliveryMethod === "DELIVERY" && (
            <div className="form-grid address-grid">
              <label>
                Nombre entrega
                <input
                  name="addressName"
                  required
                  minLength={2}
                  autoComplete="name"
                />
              </label>
              <label>
                Telefono entrega
                <input
                  name="addressPhone"
                  required
                  autoComplete="tel"
                  placeholder="+34..."
                />
              </label>
              <label className="full-field">
                Direccion
                <input
                  name="street"
                  required
                  minLength={4}
                  autoComplete="street-address"
                />
              </label>
              <label>
                Ciudad
                <input
                  name="city"
                  required
                  minLength={2}
                  autoComplete="address-level2"
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
                <textarea name="notes" rows={3} />
              </label>
            </div>
          )}

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
              deliveryNeedsQuote
            }
          >
            <CreditCard aria-hidden="true" size={18} />
            {loading ? "Abriendo pago" : "Pagar"}
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

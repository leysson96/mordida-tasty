"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { formatMoney } from "../../lib/api";
import { quoteCartItems } from "../../lib/order-quote";
import { cartLinePriceDisplay } from "../../lib/product-pricing";
import type { LinePriceDisplay } from "../../lib/product-pricing";
import type { OrderQuote } from "../../lib/types";
import { useCart } from "../../components/cart-provider";

export default function CartPage() {
  const { items, subtotalCents, updateQuantity, removeItem } = useCart();
  const [quote, setQuote] = useState<OrderQuote>();
  const [quoteError, setQuoteError] = useState<string>();

  useEffect(() => {
    if (items.length === 0) {
      setQuote(undefined);
      setQuoteError(undefined);
      return;
    }

    let active = true;
    quoteCartItems(items)
      .then((nextQuote) => {
        if (active) {
          setQuote(nextQuote);
          setQuoteError(undefined);
        }
      })
      .catch((requestError: Error) => {
        if (active) {
          setQuote(undefined);
          setQuoteError(requestError.message);
        }
      });

    return () => {
      active = false;
    };
  }, [items]);

  const quotedSubtotalCents = quote?.subtotalCents ?? subtotalCents;
  const grossSubtotalCents = quote?.grossSubtotalCents ?? subtotalCents;
  const promotionDiscountCents = quote?.promotionDiscountCents ?? 0;

  return (
    <main className="page-shell narrow-page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Carrito</p>
          <h1>Tu pedido</h1>
        </div>
        <ShoppingBag aria-hidden="true" size={28} />
      </section>

      {items.length === 0 ? (
        <div className="empty-state">
          El carrito esta vacio.
          <Link href="/" className="button primary">
            Ver menu
          </Link>
        </div>
      ) : (
        <>
          <div className="cart-list">
            {items.map((item, index) => {
              const lineQuote = quote?.items.find(
                (line) => line.itemIndex === index,
              );
              const linePrice = cartLinePriceDisplay(item, lineQuote);

              return (
                <article key={item.id} className="cart-row">
                  <div>
                    <h2>{item.name}</h2>
                    <p>{formatMoney(item.priceCents)}</p>
                    {item.options.length > 0 && (
                      <ul className="item-options">
                        {item.options.map((option) => (
                          <li key={`${option.groupId}-${option.choiceId}`}>
                            {option.groupName}: {option.choiceName}
                            {option.priceCents > 0
                              ? ` +${formatMoney(option.priceCents)}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div
                    className="quantity-control"
                    aria-label={`Cantidad de ${item.name}`}
                  >
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      title="Reducir"
                    >
                      <Minus aria-hidden="true" size={18} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      title="Aumentar"
                    >
                      <Plus aria-hidden="true" size={18} />
                    </button>
                  </div>
                  <CartLinePrice price={linePrice} />
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => removeItem(item.id)}
                    title="Eliminar"
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                </article>
              );
            })}
          </div>

          <section className="summary-panel">
            {promotionDiscountCents > 0 && (
              <>
                <div>
                  <span>Subtotal antes</span>
                  <strong>{formatMoney(grossSubtotalCents)}</strong>
                </div>
                <div className="summary-discount-row">
                  <span>Promos aplicadas</span>
                  <strong>-{formatMoney(promotionDiscountCents)}</strong>
                </div>
              </>
            )}
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(quotedSubtotalCents)}</strong>
            </div>
            {quoteError && <p className="form-error">{quoteError}</p>}
            <Link href="/checkout" className="button primary full">
              Continuar
            </Link>
          </section>
        </>
      )}
    </main>
  );
}

function CartLinePrice({ price }: { price: LinePriceDisplay }) {
  if (!price.hasPromotion) {
    return <strong>{formatMoney(price.finalLineTotalCents)}</strong>;
  }

  return (
    <span className="price-stack cart-line-price">
      <span className="price-before">
        {formatMoney(price.originalLineTotalCents)}
      </span>
      <strong className="price-final">
        {formatMoney(price.finalLineTotalCents)}
      </strong>
      {price.promotionName && (
        <small className="price-promo-label">{price.promotionName}</small>
      )}
    </span>
  );
}

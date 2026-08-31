"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { formatMoney } from "../../lib/api";
import { useCart } from "../../components/cart-provider";

export default function CartPage() {
  const { items, subtotalCents, updateQuantity, removeItem } = useCart();

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
            {items.map((item) => (
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
                <strong>{formatMoney(item.priceCents * item.quantity)}</strong>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => removeItem(item.id)}
                  title="Eliminar"
                >
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              </article>
            ))}
          </div>

          <section className="summary-panel">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(subtotalCents)}</strong>
            </div>
            <Link href="/checkout" className="button primary full">
              Continuar
            </Link>
          </section>
        </>
      )}
    </main>
  );
}

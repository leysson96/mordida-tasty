"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Clock,
  Instagram,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  Store,
} from "lucide-react";
import Link from "next/link";
import { api, formatMoney } from "../lib/api";
import { brandConfig } from "../lib/brand";
import { Category, Product, PublicSettings } from "../lib/types";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";

export function MenuClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [publicSettings, setPublicSettings] = useState<PublicSettings>();
  const [selectedSlug, setSelectedSlug] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const { addItem } = useCart();
  const siteContent = { ...brandConfig, ...publicSettings?.siteContent };
  const serviceReason = publicSettings?.serviceStatus?.reason;
  const whatsappUrl = buildWhatsAppUrl(
    siteContent.whatsappPhone,
    siteContent.name,
  );

  useEffect(() => {
    Promise.all([
      api<Category[]>("/menu"),
      api<PublicSettings>("/settings/public"),
    ])
      .then(([menuData, settingsData]) => {
        setCategories(menuData);
        setPublicSettings(settingsData);
        const featuredSlug =
          settingsData.siteContent?.featuredProductSlug ??
          brandConfig.featuredProductSlug;
        setSelectedSlug(
          menuData.find((category) =>
            category.products?.some((product) => product.slug === featuredSlug),
          )?.slug ?? menuData[0]?.slug,
        );
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedCategory = useMemo(
    () =>
      categories.find((category) => category.slug === selectedSlug) ??
      categories[0],
    [categories, selectedSlug],
  );

  return (
    <main className="menu-page">
      <section className="sales-hero">
        <Image
          src={siteContent.heroImage}
          alt={siteContent.featuredProductName}
          fill
          priority
          sizes="100vw"
          className="sales-hero-image"
        />
        <div className="sales-hero-overlay" />
        <div className="sales-hero-content">
          <p className="eyebrow hero-eyebrow">{siteContent.tagline}</p>
          <h1>{siteContent.heroTitle}</h1>
          <p>{siteContent.heroText}</p>
          <div className="hero-actions">
            <a href="#menu" className="button primary">
              <ShoppingBag aria-hidden="true" size={18} />
              Pedir ahora
            </a>
            <Link
              href={`/producto/${siteContent.featuredProductSlug}`}
              className="button ghost"
            >
              Ver {siteContent.featuredProductName}
            </Link>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                className="button ghost"
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle aria-hidden="true" size={18} />
                WhatsApp
              </a>
            )}
            {siteContent.instagramUrl && (
              <a
                href={siteContent.instagramUrl}
                className="button ghost"
                target="_blank"
                rel="noreferrer"
              >
                <Instagram aria-hidden="true" size={18} />
                Instagram
              </a>
            )}
          </div>
          <dl className="hero-service">
            <div>
              <dt>
                <Clock aria-hidden="true" size={16} />
                Servicio
              </dt>
              <dd>
                {publicSettings?.openNow === false
                  ? "Cerrado ahora"
                  : "Abierto ahora"}
                {publicSettings?.openNow === false && serviceReason && (
                  <small>{serviceReason}</small>
                )}
              </dd>
            </div>
            <div>
              <dt>
                <Store aria-hidden="true" size={16} />
                Recogida
              </dt>
              <dd>Sin coste extra</dd>
            </div>
            <div>
              <dt>
                <MapPin aria-hidden="true" size={16} />
                Envio
              </dt>
              <dd>{formatMoney(publicSettings?.deliveryFeeCents ?? 0)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="page-shell menu-section" id="menu">
        <div className="menu-intro">
          <div>
            <p className="eyebrow">Carta online</p>
            <h2>Elige tu mordida</h2>
          </div>
          <p>{siteContent.menuIntroText}</p>
        </div>

        {loading ? (
          <div className="empty-state">
            <RefreshCw className="spin" aria-hidden="true" />
            Cargando menu
          </div>
        ) : error ? (
          <div className="empty-state error">{error}</div>
        ) : (
          <>
            <div
              className="category-tabs"
              role="tablist"
              aria-label="Categorias"
            >
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={
                    category.slug === selectedCategory?.slug ? "active" : ""
                  }
                  onClick={() => setSelectedSlug(category.slug)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <section
              className="product-grid"
              aria-label={selectedCategory?.name}
            >
              {selectedCategory?.products?.map((product) => (
                <article
                  key={product.id}
                  className={`product-card ${
                    product.slug === siteContent.featuredProductSlug
                      ? "featured"
                      : ""
                  }`}
                >
                  <Link
                    href={`/producto/${product.slug}`}
                    className="product-photo"
                  >
                    <ProductImage product={product} />
                    {!product.available && (
                      <span className="sold-out">Agotado</span>
                    )}
                  </Link>
                  <div className="product-copy">
                    <div>
                      <h3>
                        <Link href={`/producto/${product.slug}`}>
                          {product.name}
                        </Link>
                      </h3>
                      <p>{product.description}</p>
                    </div>
                    <div className="product-actions">
                      <strong>{formatMoney(product.priceCents)}</strong>
                      {productHasOptions(product) ? (
                        <Link
                          href={`/producto/${product.slug}`}
                          className={`icon-button primary ${
                            product.available ? "" : "disabled-link"
                          }`}
                          aria-disabled={!product.available}
                          tabIndex={product.available ? undefined : -1}
                          title="Configurar opciones"
                        >
                          <SlidersHorizontal aria-hidden="true" size={20} />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="icon-button primary"
                          disabled={!product.available}
                          onClick={() => addItem(product)}
                          title="Anadir al carrito"
                        >
                          <Plus aria-hidden="true" size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function productHasOptions(product: Product) {
  return (product.optionGroups ?? []).some(
    (group) => group.active && group.choices.some((choice) => choice.active),
  );
}

function buildWhatsAppUrl(phone: string | undefined, businessName: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) {
    return undefined;
  }

  const text = encodeURIComponent(
    `Hola ${businessName}, quiero hacer un pedido.`,
  );
  return `https://wa.me/${digits}?text=${text}`;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Clock,
  Flame,
  Heart,
  Instagram,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  Store,
} from "lucide-react";
import Link from "next/link";
import { api, formatMoney } from "../lib/api";
import { brandConfig } from "../lib/brand";
import {
  Category,
  Product,
  PromotionCampaign,
  PublicSettings,
  SiteContent,
} from "../lib/types";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";

// Promotion dates are business-calendar dates, not UTC timestamps.
const PROMOTION_TIMEZONE = "Europe/Madrid";

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
  const businessAddress = fullBusinessAddress(siteContent);
  const directionsUrl = buildDirectionsUrl(siteContent, businessAddress);
  const showLocation = Boolean(
    siteContent.businessAddress.trim() ||
      siteContent.businessCity.trim() ||
      siteContent.businessPostalCode.trim() ||
      siteContent.googleMapsUrl.trim(),
  );
  const showAbout = Boolean(siteContent.aboutText.trim());
  const showStoryLocation = showLocation || showAbout;

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
  const visiblePromotion = useMemo(
    () =>
      getVisiblePromotion(
        publicSettings?.promotionCampaign,
        categories,
        new Date(),
      ),
    [categories, publicSettings?.promotionCampaign],
  );

  return (
    <main className="menu-page">
      <section className="sales-hero">
        <Image
          src={siteContent.heroImage}
          alt={siteContent.featuredProductName}
          fill
          priority
          loading="eager"
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
            {(whatsappUrl || siteContent.instagramUrl) && (
              <div className="hero-social-actions">
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

        {visiblePromotion && (
          <FeaturedPromotion promotion={visiblePromotion} />
        )}

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

      {showStoryLocation && (
        <section className="story-location-band" aria-label="Mordida Tasty">
          <div className="page-shell story-location-grid">
            {showLocation && (
              <article className="visit-panel">
                <div>
                  <p className="eyebrow">Ubicacion</p>
                  <h2>{siteContent.locationTitle}</h2>
                  <p>{siteContent.locationText}</p>
                </div>
                {businessAddress && (
                  <address>
                    <MapPin aria-hidden="true" size={22} />
                    <span>{businessAddress}</span>
                  </address>
                )}
                <div className="visit-actions">
                  {directionsUrl && (
                    <a
                      className="button primary"
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation aria-hidden="true" size={18} />
                      Como llegar
                    </a>
                  )}
                  <a className="button secondary" href="#menu">
                    <ShoppingBag aria-hidden="true" size={18} />
                    Pedir para recoger
                  </a>
                </div>
              </article>
            )}

            {showAbout && (
              <article className="about-panel">
                <p className="eyebrow">Nosotros</p>
                <h2>{siteContent.aboutTitle}</h2>
                <p>{siteContent.aboutText}</p>
                <div className="about-signature">
                  <Heart aria-hidden="true" size={18} />
                  Hecho para pedir otra mordida
                </div>
              </article>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function productHasOptions(product: Product) {
  return (product.optionGroups ?? []).some(
    (group) => group.active && group.choices.some((choice) => choice.active),
  );
}

type VisiblePromotion = PromotionCampaign & { product: Product };

function FeaturedPromotion({ promotion }: { promotion: VisiblePromotion }) {
  const title = splitPromotionTitle(promotion.title);
  const productImage = {
    ...promotion.product,
    imageUrl: promotion.imageUrl || promotion.product.imageUrl,
  };

  return (
    <section className="featured-promotion" aria-label="Promocion">
      <Link
        href={`/producto/${promotion.product.slug}`}
        className="featured-promotion-media"
      >
        <span className="featured-promotion-image-shadow" aria-hidden="true" />
        <span className="featured-promotion-image-frame">
          <ProductImage product={productImage} />
        </span>
        <span className="featured-promotion-insignia">
          <small>{promotion.badge}</small>
          <strong>{promotion.product.name}</strong>
        </span>
      </Link>
      <div className="featured-promotion-copy">
        <span className="promo-badge">
          <Flame aria-hidden="true" size={16} />
          {promotion.badge}
        </span>
        <h2>
          {title.lead && `${title.lead} `}
          <span>{title.accent}</span>
        </h2>
        <p>{promotion.description}</p>
        <div className="featured-promotion-actions">
          <strong>{formatMoney(promotion.product.priceCents)}</strong>
          <Link
            href={`/producto/${promotion.product.slug}`}
            className="button primary promo-button"
          >
            {promotion.ctaLabel}
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function splitPromotionTitle(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { lead: "", accent: words[0] ?? title };
  }

  const accentSize = words.length >= 4 ? 2 : 1;
  return {
    lead: words.slice(0, -accentSize).join(" "),
    accent: words.slice(-accentSize).join(" "),
  };
}

function getVisiblePromotion(
  promotion: PromotionCampaign | undefined,
  categories: Category[],
  now: Date,
) {
  if (!promotion?.enabled || !isPromotionInDateWindow(promotion, now)) {
    return undefined;
  }

  const product = categories
    .flatMap((category) => category.products ?? [])
    .find((item) => item.slug === promotion.productSlug);

  if (!product?.active || !product.available) {
    return undefined;
  }

  const ready =
    promotion.badge.trim() &&
    promotion.title.trim() &&
    promotion.description.trim() &&
    promotion.productSlug.trim() &&
    promotion.ctaLabel.trim();

  if (!ready) {
    return undefined;
  }

  return { ...promotion, product };
}

function isPromotionInDateWindow(promotion: PromotionCampaign, now: Date) {
  if (!promotion.startsOn || !promotion.endsOn) {
    return false;
  }

  const today = dateInTimezone(now, PROMOTION_TIMEZONE);
  return promotion.startsOn <= today && today <= promotion.endsOn;
}

function dateInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: timezone,
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";

  return `${year}-${month}-${day}`;
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

function fullBusinessAddress(siteContent: SiteContent) {
  return [
    siteContent.businessAddress,
    siteContent.businessPostalCode,
    siteContent.businessCity,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function buildDirectionsUrl(siteContent: SiteContent, businessAddress: string) {
  const exactMapsUrl = siteContent.googleMapsUrl.trim();
  if (exactMapsUrl) {
    return exactMapsUrl;
  }

  // Free-form addresses can resolve to the wrong business in Google Maps.
  if (businessAddress) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      businessAddress,
    )}`;
  }

  return undefined;
}

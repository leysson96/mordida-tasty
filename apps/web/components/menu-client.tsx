"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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
import { productUnitPriceDisplay } from "../lib/product-pricing";
import {
  Category,
  DiscountWeekday,
  Product,
  PromotionCampaign,
  PublicDiscountCampaign,
  PublicSettings,
  SiteContent,
} from "../lib/types";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";

// Promotion dates are business-calendar dates, not UTC timestamps.
const PROMOTION_TIMEZONE = "Europe/Madrid";
const PROMOTION_ROTATION_MS = 5600;

export function MenuClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [publicSettings, setPublicSettings] = useState<PublicSettings>();
  const [selectedSlug, setSelectedSlug] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [promotionIndex, setPromotionIndex] = useState(0);
  const [promotionPaused, setPromotionPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
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
  const visiblePromotions = useMemo(
    () =>
      getVisiblePromotionSlides(
        publicSettings?.promotionCampaign,
        publicSettings?.discountCampaigns ?? [],
        categories,
        new Date(),
      ),
    [
      categories,
      publicSettings?.discountCampaigns,
      publicSettings?.promotionCampaign,
    ],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => {
      mediaQuery.removeEventListener("change", updatePreference);
    };
  }, []);

  useEffect(() => {
    if (promotionIndex >= visiblePromotions.length) {
      setPromotionIndex(0);
    }
  }, [promotionIndex, visiblePromotions.length]);

  useEffect(() => {
    if (
      visiblePromotions.length <= 1 ||
      promotionPaused ||
      prefersReducedMotion
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setPromotionIndex((current) => (current + 1) % visiblePromotions.length);
    }, PROMOTION_ROTATION_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [prefersReducedMotion, promotionPaused, visiblePromotions.length]);

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

        {visiblePromotions.length > 0 && (
          <FeaturedPromotionCarousel
            activeIndex={promotionIndex}
            promotions={visiblePromotions}
            onPauseChange={setPromotionPaused}
            onSelect={setPromotionIndex}
          />
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
                      <ProductUnitPrice product={product} />
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

type VisiblePromotion = {
  id: string;
  badge: string;
  title: string;
  description: string;
  imageUrl: string;
  ctaLabel: string;
  validityLabel: string;
  product: Product;
  discountId?: string;
};

function FeaturedPromotionCarousel({
  activeIndex,
  promotions,
  onPauseChange,
  onSelect,
}: {
  activeIndex: number;
  promotions: VisiblePromotion[];
  onPauseChange: (paused: boolean) => void;
  onSelect: (index: number) => void;
}) {
  const activePromotion =
    promotions[Math.min(activeIndex, promotions.length - 1)] ?? promotions[0];
  const showControls = promotions.length > 1;

  function selectPrevious() {
    onSelect((activeIndex - 1 + promotions.length) % promotions.length);
  }

  function selectNext() {
    onSelect((activeIndex + 1) % promotions.length);
  }

  function pause() {
    onPauseChange(true);
  }

  function resume() {
    onPauseChange(false);
  }

  function handleMouseOut(event: MouseEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    resume();
  }

  return (
    <section
      className="featured-promotion-carousel"
      aria-label="Promociones activas"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onMouseOver={pause}
      onMouseOut={handleMouseOut}
      onTouchStart={pause}
    >
      <FeaturedPromotion key={activePromotion.id} promotion={activePromotion} />
      {showControls && (
        <div className="featured-promotion-controls">
          <button
            className="icon-button carousel-arrow"
            type="button"
            aria-label="Promocion anterior"
            onClick={selectPrevious}
            title="Promocion anterior"
          >
            <ChevronLeft aria-hidden="true" size={22} />
          </button>
          <div className="featured-promotion-dots" aria-label="Elegir promo">
            {promotions.map((promotion, index) => (
              <button
                key={promotion.id}
                type="button"
                className={index === activeIndex ? "active" : ""}
                aria-label={`Ver promocion ${index + 1}: ${promotion.title}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => onSelect(index)}
                title={promotion.title}
              />
            ))}
          </div>
          <button
            className="icon-button carousel-arrow"
            type="button"
            aria-label="Promocion siguiente"
            onClick={selectNext}
            title="Promocion siguiente"
          >
            <ChevronRight aria-hidden="true" size={22} />
          </button>
        </div>
      )}
    </section>
  );
}

function FeaturedPromotion({ promotion }: { promotion: VisiblePromotion }) {
  const title = splitPromotionTitle(promotion.title);
  const productImage = {
    ...promotion.product,
    imageUrl: promotion.imageUrl || promotion.product.imageUrl,
  };

  return (
    <article className="featured-promotion" aria-label={promotion.title}>
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
        <span className="promo-validity">
          <CalendarDays aria-hidden="true" size={17} />
          {promotion.validityLabel}
        </span>
        <p>{promotion.description}</p>
        <div className="featured-promotion-actions">
          <ProductUnitPrice product={promotion.product} featured />
          <Link
            href={`/producto/${promotion.product.slug}`}
            className="button primary promo-button"
          >
            {promotion.ctaLabel}
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function ProductUnitPrice({
  product,
  featured = false,
}: {
  product: Product;
  featured?: boolean;
}) {
  const price = productUnitPriceDisplay(product);

  if (!price.hasPromotion) {
    return <strong>{formatMoney(price.finalUnitPriceCents)}</strong>;
  }

  return (
    <span className={featured ? "price-stack hero-price" : "price-stack"}>
      <span className="price-before">
        {formatMoney(price.originalUnitPriceCents)}
      </span>
      <strong className="price-final">
        {formatMoney(price.finalUnitPriceCents)}
      </strong>
      {price.promotionName && (
        <small className="price-promo-label">{price.promotionName}</small>
      )}
    </span>
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

function getVisiblePromotionSlides(
  visualPromotion: PromotionCampaign | undefined,
  discountCampaigns: PublicDiscountCampaign[],
  categories: Category[],
  now: Date,
) {
  const visualSlide = getVisualPromotionSlide(visualPromotion, categories, now);
  const slides: VisiblePromotion[] = [];

  for (const discount of discountCampaigns) {
    if (!discount.active || !isDiscountInDateWindow(discount, now)) {
      continue;
    }

    const linkedVisual =
      visualSlide &&
      visualPromotion?.discountId === discount.id &&
      discountTargetsProduct(discount, visualSlide.product);
    const product = linkedVisual
      ? visualSlide.product
      : productForDiscount(discount, categories);

    if (!product) {
      continue;
    }

    slides.push({
      id: `discount:${discount.id}`,
      discountId: discount.id,
      badge: linkedVisual ? visualSlide.badge : formatPublicDiscount(discount),
      title: linkedVisual ? visualSlide.title : discount.name,
      description: linkedVisual
        ? visualSlide.description
        : discount.description?.trim() ||
          `Promocion activa. ${discountWeekdayLabel(discount.weekdays)}.`,
      imageUrl: linkedVisual ? visualSlide.imageUrl : product.imageUrl ?? "",
      ctaLabel: linkedVisual ? visualSlide.ctaLabel : "Pedir ahora",
      validityLabel: discountWeekdayLabel(discount.weekdays),
      product,
    });
  }

  if (
    visualSlide &&
    (!visualPromotion?.discountId ||
      !slides.some((slide) => slide.discountId === visualPromotion.discountId))
  ) {
    slides.unshift(visualSlide);
  }

  return slides;
}

function getVisualPromotionSlide(
  promotion: PromotionCampaign | undefined,
  categories: Category[],
  now: Date,
): VisiblePromotion | undefined {
  if (!promotion?.enabled || !isPromotionInDateWindow(promotion, now)) {
    return undefined;
  }

  const product = categories
    .flatMap((category) => category.products ?? [])
    .find((item) => item.slug === promotion.productSlug);

  if (!isPublicPromotionProduct(product)) {
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

  return {
    id: promotion.discountId
      ? `visual:${promotion.discountId}`
      : `visual:${promotion.productSlug}`,
    discountId: promotion.discountId || undefined,
    badge: promotion.badge,
    title: promotion.title,
    description: promotion.description,
    imageUrl: promotion.imageUrl,
    ctaLabel: promotion.ctaLabel,
    validityLabel: "Valido todos los dias",
    product,
  };
}

function isPromotionInDateWindow(promotion: PromotionCampaign, now: Date) {
  if (!promotion.startsOn || !promotion.endsOn) {
    return false;
  }

  const today = dateInTimezone(now, PROMOTION_TIMEZONE);
  return promotion.startsOn <= today && today <= promotion.endsOn;
}

function isDiscountInDateWindow(
  discount: Pick<PublicDiscountCampaign, "startsOn" | "endsOn">,
  now: Date,
) {
  if (!discount.startsOn || !discount.endsOn) {
    return false;
  }

  const today = dateInTimezone(now, PROMOTION_TIMEZONE);
  return discount.startsOn <= today && today <= discount.endsOn;
}

function productForDiscount(
  discount: PublicDiscountCampaign,
  categories: Category[],
) {
  const products = categories.flatMap((category) => category.products ?? []);

  if (discount.scope === "PRODUCTS") {
    return discount.productIds
      .map((productId) => products.find((product) => product.id === productId))
      .find(isPublicPromotionProduct);
  }

  if (discount.scope === "CATEGORY" && discount.categoryId) {
    return categories
      .find((category) => category.id === discount.categoryId)
      ?.products?.find(isPublicPromotionProduct);
  }

  return undefined;
}

function discountTargetsProduct(
  discount: PublicDiscountCampaign,
  product: Product,
) {
  if (discount.scope === "PRODUCTS") {
    return discount.productIds.includes(product.id);
  }

  if (discount.scope === "CATEGORY") {
    return discount.categoryId === product.categoryId;
  }

  return false;
}

function isPublicPromotionProduct(product: Product | undefined): product is Product {
  return Boolean(product?.active && product.available);
}

const discountWeekdayCopy: Record<DiscountWeekday, string> = {
  MON: "lunes",
  TUE: "martes",
  WED: "miercoles",
  THU: "jueves",
  FRI: "viernes",
  SAT: "sabado",
  SUN: "domingo",
};

function discountWeekdayLabel(weekdays: DiscountWeekday[]) {
  if (weekdays.length === 0) {
    return "Valido todos los dias";
  }

  return `Valido ${humanList(weekdays.map((weekday) => discountWeekdayCopy[weekday]))}`;
}

function humanList(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  return `${values.slice(0, -1).join(", ")} y ${
    values[values.length - 1]
  }`;
}

function formatPublicDiscount(discount: PublicDiscountCampaign) {
  if (discount.type === "PERCENTAGE") {
    return `-${trimDisplayNumber(discount.value / 100)}%`;
  }

  return `-${formatMoney(discount.value)}`;
}

function trimDisplayNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

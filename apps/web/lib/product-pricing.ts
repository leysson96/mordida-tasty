import type { CartItem, OrderQuoteLine, Product } from "./types";

export interface UnitPriceDisplay {
  hasPromotion: boolean;
  originalUnitPriceCents: number;
  finalUnitPriceCents: number;
  promotionName?: string | null;
}

export interface LinePriceDisplay {
  hasPromotion: boolean;
  originalLineTotalCents: number;
  finalLineTotalCents: number;
  promotionDiscountCents: number;
  promotionName?: string | null;
}

export interface CartItemPricingInput {
  unitPriceCents: number;
  originalUnitPriceCents?: number | null;
  promotionDiscountName?: string | null;
  promotionDiscountUnitCents?: number | null;
}

export function productUnitPriceDisplay(product: Product): UnitPriceDisplay {
  const pricing = product.promotionPricing;
  const hasPromotion = Boolean(
    pricing &&
      pricing.unitDiscountCents > 0 &&
      pricing.discountedUnitPriceCents < pricing.originalUnitPriceCents,
  );

  return {
    hasPromotion,
    originalUnitPriceCents: pricing?.originalUnitPriceCents ?? product.priceCents,
    finalUnitPriceCents: hasPromotion
      ? pricing?.discountedUnitPriceCents ?? product.priceCents
      : product.priceCents,
    promotionName: hasPromotion ? pricing?.discountName : null,
  };
}

export function cartLinePriceDisplay(
  item: CartItem,
  quoteLine?: OrderQuoteLine,
): LinePriceDisplay {
  const fallbackOriginalUnit =
    item.originalUnitPriceCents && item.originalUnitPriceCents > item.priceCents
      ? item.originalUnitPriceCents
      : item.priceCents;
  const fallbackDiscountUnit =
    item.promotionDiscountUnitCents && item.promotionDiscountUnitCents > 0
      ? item.promotionDiscountUnitCents
      : 0;
  const originalLineTotalCents =
    quoteLine?.originalLineTotalCents ?? fallbackOriginalUnit * item.quantity;
  const finalLineTotalCents =
    quoteLine?.lineTotalCents ?? item.priceCents * item.quantity;
  const promotionDiscountCents =
    quoteLine?.promotionDiscountCents ?? fallbackDiscountUnit * item.quantity;
  const hasPromotion =
    promotionDiscountCents > 0 && originalLineTotalCents > finalLineTotalCents;

  return {
    hasPromotion,
    originalLineTotalCents,
    finalLineTotalCents,
    promotionDiscountCents,
    promotionName:
      quoteLine?.promotionDiscountName ?? item.promotionDiscountName ?? null,
  };
}

import type { OrderItem } from "./types";
import { formatMoney } from "./api";

export function formatOrderItemOptions(item: OrderItem) {
  return (item.options ?? [])
    .map((option) => `${option.groupName}: ${option.choiceName}`)
    .join(", ");
}

export function hasPromotionDiscount(item: OrderItem) {
  return (item.promotionDiscountCents ?? 0) > 0;
}

export function formatOrderItemPromotion(item: OrderItem) {
  if (!hasPromotionDiscount(item)) {
    return "";
  }

  const label = item.promotionDiscountName?.trim() || "Promo aplicada";
  const previous =
    (item.originalLineTotalCents ?? 0) > item.lineTotalCents
      ? ` - antes ${formatMoney(item.originalLineTotalCents ?? 0)}`
      : "";

  return `${label}: -${formatMoney(item.promotionDiscountCents ?? 0)}${previous}`;
}

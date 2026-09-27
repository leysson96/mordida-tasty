import { formatMoney } from "../../lib/api";
import type { AdminDiscount, DiscountWeekday } from "../../lib/types";
import {
  AdminDiscountPayload,
  EditableDiscountScope,
  weekdayOptions,
} from "./types";

export function discountPayloadFromForm(
  form: FormData,
  scope: EditableDiscountScope,
  type: AdminDiscountPayload["type"],
): AdminDiscountPayload {
  const rawValue = Number(form.get("value") || 0);
  const productIds = form
    .getAll("productIds")
    .map((value) => String(value))
    .filter(Boolean);
  const categoryId = String(form.get("categoryId") || "");

  return {
    name: String(form.get("name") || ""),
    description: String(form.get("description") || ""),
    active: form.get("active") === "on",
    type,
    value: Math.round(rawValue * 100),
    scope,
    startsOn: String(form.get("startsOn") || ""),
    endsOn: String(form.get("endsOn") || ""),
    weekdays: form
      .getAll("weekdays")
      .map((value) => String(value) as DiscountWeekday),
    priority: Number(form.get("priority") || 0),
    ...(scope === "PRODUCTS" ? { productIds } : { categoryId }),
  };
}

export function discountValueForForm(discount: AdminDiscount): string {
  return trimMoneyNumber(discount.value / 100);
}

export function formatDiscountValue(discount: AdminDiscount): string {
  if (discount.type === "PERCENTAGE") {
    return `${trimMoneyNumber(discount.value / 100)}%`;
  }

  return formatMoney(discount.value);
}

export function discountScopeLabel(discount: AdminDiscount): string {
  if (discount.scope === "CATEGORY") {
    return discount.category?.name ?? "Categoria";
  }

  if (discount.products.length === 0) {
    return "Sin productos";
  }

  if (discount.products.length === 1) {
    return discount.products[0]?.name ?? "Producto";
  }

  return `${discount.products.length} productos`;
}

export function validityLabel(weekdays: DiscountWeekday[]): string {
  if (weekdays.length === 0) {
    return "Todos los dias";
  }

  const labels = new Map(
    weekdayOptions.map((weekday) => [weekday.value, weekday.label]),
  );
  return weekdays.map((weekday) => labels.get(weekday) ?? weekday).join(", ");
}

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function trimMoneyNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

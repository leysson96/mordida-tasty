import { api } from "./api";
import type { CartItem, CartItemOption, OrderQuote } from "./types";

export interface OrderItemPayload {
  productId: string;
  quantity: number;
  options: Array<{
    groupId: string;
    choiceIds: string[];
  }>;
}

export function cartItemOptionsPayload(
  options: Pick<CartItemOption, "groupId" | "choiceId">[],
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

export function cartItemsPayload(items: CartItem[]): OrderItemPayload[] {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    options: cartItemOptionsPayload(item.options),
  }));
}

export function quoteCartItems(items: CartItem[]) {
  return api<OrderQuote>("/orders/quote", {
    method: "POST",
    body: JSON.stringify({ items: cartItemsPayload(items) }),
  });
}

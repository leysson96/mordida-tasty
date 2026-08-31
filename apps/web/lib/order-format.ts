import type { OrderItem } from "./types";

export function formatOrderItemOptions(item: OrderItem) {
  return (item.options ?? [])
    .map((option) => `${option.groupName}: ${option.choiceName}`)
    .join(", ");
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { CartItem, CartItemOption, Product } from "../lib/types";
import type { CartItemPricingInput } from "../lib/product-pricing";

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotalCents: number;
  addItem: (
    product: Product,
    options?: CartItemOption[],
    pricing?: CartItemPricingInput,
  ) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const storageKey = "mordida_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      setItems((JSON.parse(stored) as CartItem[]).map(normalizeCartItem));
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageReady]);

  const addItem = useCallback(
    (
      product: Product,
      options: CartItemOption[] = [],
      pricing?: CartItemPricingInput,
    ) => {
      setItems((current) => {
        const normalizedOptions = sortCartOptions(options);
        const id = buildCartLineId(product.id, normalizedOptions);
        const baseUnitPriceCents =
          product.priceCents +
          normalizedOptions.reduce((sum, option) => sum + option.priceCents, 0);
        const productPromotionPricing =
          normalizedOptions.length === 0 &&
          product.promotionPricing &&
          product.promotionPricing.unitDiscountCents > 0
            ? {
                unitPriceCents:
                  product.promotionPricing.discountedUnitPriceCents,
                originalUnitPriceCents:
                  product.promotionPricing.originalUnitPriceCents,
                promotionDiscountName: product.promotionPricing.discountName,
                promotionDiscountUnitCents:
                  product.promotionPricing.unitDiscountCents,
              }
            : undefined;
        const selectedPricing = pricing ?? productPromotionPricing;
        const unitPriceCents =
          selectedPricing?.unitPriceCents ?? baseUnitPriceCents;
        const found = current.find((item) => item.id === id);
        if (found) {
          return current.map((item) =>
            item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
          );
        }

        return [
          ...current,
          {
            id,
            productId: product.id,
            name: product.name,
            slug: product.slug,
            priceCents: unitPriceCents,
            imageUrl: product.imageUrl,
            options: normalizedOptions,
            quantity: 1,
            originalUnitPriceCents:
              selectedPricing?.originalUnitPriceCents ?? unitPriceCents,
            promotionDiscountName:
              selectedPricing?.promotionDiscountName ?? null,
            promotionDiscountUnitCents:
              selectedPricing?.promotionDiscountUnitCents ?? 0,
          },
        ];
      });
    },
    [],
  );

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    setItems((current) =>
      current
        .map((item) => (item.id === itemId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.priceCents * item.quantity,
      0,
    );
    return {
      items,
      totalItems,
      subtotalCents,
      addItem,
      updateQuantity,
      removeItem,
      clear,
    };
  }, [addItem, clear, items, removeItem, updateQuantity]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function normalizeCartItem(item: CartItem) {
  const options = sortCartOptions(item.options ?? []);
  const originalUnitPriceCents =
    item.originalUnitPriceCents && item.originalUnitPriceCents > 0
      ? item.originalUnitPriceCents
      : item.priceCents;
  return {
    ...item,
    id: item.id ?? buildCartLineId(item.productId, options),
    options,
    originalUnitPriceCents,
    promotionDiscountName: item.promotionDiscountName ?? null,
    promotionDiscountUnitCents: item.promotionDiscountUnitCents ?? 0,
  };
}

function buildCartLineId(productId: string, options: CartItemOption[]) {
  if (options.length === 0) {
    return productId;
  }

  const optionKey = options
    .map((option) => `${option.groupId}:${option.choiceId}`)
    .join("|");
  return `${productId}:${optionKey}`;
}

function sortCartOptions(options: CartItemOption[]) {
  return [...options].sort(
    (a, b) =>
      a.groupId.localeCompare(b.groupId) ||
      a.choiceId.localeCompare(b.choiceId),
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}

"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CartItem, CartItemOption, Product } from "../lib/types";

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotalCents: number;
  addItem: (product: Product, options?: CartItemOption[]) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const storageKey = "mordida_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      setItems((JSON.parse(stored) as CartItem[]).map(normalizeCartItem));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback(
    (product: Product, options: CartItemOption[] = []) => {
      setItems((current) => {
        const normalizedOptions = sortCartOptions(options);
        const id = buildCartLineId(product.id, normalizedOptions);
        const unitPriceCents =
          product.priceCents +
          normalizedOptions.reduce((sum, option) => sum + option.priceCents, 0);
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
  return {
    ...item,
    id: item.id ?? buildCartLineId(item.productId, options),
    options,
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

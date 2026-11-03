import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Product } from '@/types/product';

export type CartSize = 'S' | 'M' | 'L';
export type CartOptions = {
  size: CartSize;
  sweetness: string;
  ice: string;
  note: string;
};
export type CartItem = { product: Product; quantity: number; options?: CartOptions };

const DEFAULT_OPTIONS: CartOptions = {
  size: 'M',
  sweetness: 'Bình thường',
  ice: 'Bình thường',
  note: '',
};

export function getCartOptions(item: CartItem): CartOptions {
  return { ...DEFAULT_OPTIONS, ...item.options };
}

export function getCartItemKey(item: CartItem): string {
  return JSON.stringify([item.product.id, getCartOptions(item)]);
}

type CartState = {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, options?: CartOptions) => void;
  setQuantity: (itemKey: string, quantity: number) => void;
  removeItem: (itemKey: string) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (product, quantity = 1, options = DEFAULT_OPTIONS) =>
        set((state) => {
          const newItem = { product, quantity, options };
          const itemKey = getCartItemKey(newItem);
          const existing = state.items.find((item) => getCartItemKey(item) === itemKey);
          return existing
            ? {
                items: state.items.map((item) =>
                  getCartItemKey(item) === itemKey
                    ? { ...item, quantity: item.quantity + quantity }
                    : item,
                ),
              }
            : { items: [...state.items, newItem] };
        }),
      setQuantity: (itemKey, quantity) =>
        set((state) => ({
          items:
            quantity < 1
              ? state.items.filter((item) => getCartItemKey(item) !== itemKey)
              : state.items.map((item) =>
                  getCartItemKey(item) === itemKey ? { ...item, quantity } : item,
                ),
        })),
      removeItem: (itemKey) =>
        set((state) => ({ items: state.items.filter((item) => getCartItemKey(item) !== itemKey) })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'brewlite-cart',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

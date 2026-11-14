import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  defaultProductOptions,
  getCartItemKey,
  type SelectedProductOptions,
} from '@/lib/product-options';
import type { Product } from '@/types/product';

export type CartItem = {
  product: Product;
  quantity: number;
  options?: SelectedProductOptions;
};

type CartState = {
  items: CartItem[];
  addItem: (product: Product, quantity: number, options?: SelectedProductOptions) => void;
  setQuantity: (itemKey: string, quantity: number) => void;
  removeItem: (itemKey: string) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (product, quantity, options = defaultProductOptions()) =>
        set((state) => {
          const itemKey = getCartItemKey(product.id, options);
          const existing = state.items.find(
            (item) => getCartItemKey(item.product.id, item.options) === itemKey,
          );
          return existing
            ? {
                items: state.items.map((item) =>
                  getCartItemKey(item.product.id, item.options) === itemKey
                    ? { ...item, quantity: item.quantity + quantity }
                    : item,
                ),
              }
            : { items: [...state.items, { product, quantity, options }] };
        }),
      setQuantity: (itemKey, quantity) =>
        set((state) => ({
          items:
            quantity < 1
              ? state.items.filter(
                  (item) => getCartItemKey(item.product.id, item.options) !== itemKey,
                )
              : state.items.map((item) =>
                  getCartItemKey(item.product.id, item.options) === itemKey
                    ? { ...item, quantity }
                    : item,
                ),
        })),
      removeItem: (itemKey) =>
        set((state) => ({
          items: state.items.filter(
            (item) => getCartItemKey(item.product.id, item.options) !== itemKey,
          ),
        })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'brewlite-cart',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Product } from '@/types/product';

export type CartItem = { product: Product; quantity: number };

type CartState = {
  items: CartItem[];
  addItem: (product: Product) => void;
  setQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (product) =>
        set((state) => {
          const existing = state.items.find((item) => item.product.id === product.id);
          return existing
            ? {
                items: state.items.map((item) =>
                  item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
                ),
              }
            : { items: [...state.items, { product, quantity: 1 }] };
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity < 1
              ? state.items.filter((item) => item.product.id !== productId)
              : state.items.map((item) =>
                  item.product.id === productId ? { ...item, quantity } : item,
                ),
        })),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.product.id !== productId) })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'brewlite-cart',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

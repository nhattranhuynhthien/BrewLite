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
  consumeItems: (snapshot: CartItem[]) => void;
  syncCatalog: (products: Product[]) => void;
};

export function getProductQuantityInCart(items: CartItem[], productId: number): number {
  return items.reduce(
    (sum, item) => (item.product.id === productId ? sum + item.quantity : sum),
    0,
  );
}

export function getRemainingProductStock(
  items: CartItem[],
  product: Pick<Product, 'id' | 'stock'>,
): number {
  return Math.max(0, Math.floor(product.stock) - getProductQuantityInCart(items, product.id));
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (product, quantity, options = defaultProductOptions()) =>
        set((state) => {
          const itemKey = getCartItemKey(product.id, options);
          const remaining = getRemainingProductStock(state.items, product);
          const allowed = Math.min(Math.max(0, Math.floor(quantity)), remaining);
          if (allowed <= 0) return state;

          const existing = state.items.find(
            (item) => getCartItemKey(item.product.id, item.options) === itemKey,
          );
          return existing
            ? {
                items: state.items.map((item) =>
                  getCartItemKey(item.product.id, item.options) === itemKey
                    ? { ...item, quantity: item.quantity + allowed }
                    : item,
                ),
              }
            : { items: [...state.items, { product, quantity: allowed, options }] };
        }),
      setQuantity: (itemKey, quantity) =>
        set((state) => {
          const target = state.items.find(
            (item) => getCartItemKey(item.product.id, item.options) === itemKey,
          );
          if (!target) return state;
          const otherVariantsQty = state.items.reduce(
            (sum, item) =>
              item.product.id === target.product.id &&
              getCartItemKey(item.product.id, item.options) !== itemKey
                ? sum + item.quantity
                : sum,
            0,
          );
          const maxForLine = Math.max(0, Math.floor(target.product.stock) - otherVariantsQty);
          const nextQty = Math.min(Math.floor(quantity), maxForLine);
          return {
            items:
              nextQty < 1
                ? state.items.filter(
                    (item) => getCartItemKey(item.product.id, item.options) !== itemKey,
                  )
                : state.items.map((item) =>
                    getCartItemKey(item.product.id, item.options) === itemKey
                      ? { ...item, quantity: nextQty }
                      : item,
                  ),
          };
        }),
      removeItem: (itemKey) =>
        set((state) => ({
          items: state.items.filter(
            (item) => getCartItemKey(item.product.id, item.options) !== itemKey,
          ),
        })),
      clearCart: () => set({ items: [] }),
      // Remove only quantities confirmed by this payment; retain additions made meanwhile.
      consumeItems: (snapshot) => set((state) => {
        const quantities = new Map<string, number>();
        for (const item of snapshot) {
          const key = getCartItemKey(item.product.id, item.options);
          quantities.set(key, (quantities.get(key) ?? 0) + item.quantity);
        }
        return {
          items: state.items.flatMap((item) => {
            const key = getCartItemKey(item.product.id, item.options);
            const quantity = item.quantity - (quantities.get(key) ?? 0);
            return quantity > 0 ? [{ ...item, quantity }] : [];
          }),
        };
      }),
      syncCatalog: (products) => set((state) => {
        if (state.items.length === 0 || products.length === 0) return state;
        const catalog = new Map(products.map((product) => [product.id, product]));
        let changed = false;
        const items = state.items.map((item) => {
          const latest = catalog.get(item.product.id);
          if (!latest) return item;
          if (
            latest.stock === item.product.stock &&
            latest.isAvailable === item.product.isAvailable &&
            latest.price === item.product.price &&
            latest.name === item.product.name &&
            latest.imageUrl === item.product.imageUrl
          ) {
            return item;
          }
          changed = true;
          return { ...item, product: { ...item.product, ...latest } };
        });
        return changed ? { items } : state;
      }),
    }),
    {
      name: 'brewlite-cart',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

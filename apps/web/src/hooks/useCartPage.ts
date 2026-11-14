'use client';

import { useMemo } from 'react';
import { useCartStore } from '@/store/cart-store';
import { getConfiguredUnitPrice } from '@/lib/product-options';

export function useCartPage() {
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + getConfiguredUnitPrice(item.product, item.options) * item.quantity,
        0,
      ),
    [items],
  );
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );
  return {
    clearCart,
    items,
    removeItem,
    setQuantity,
    subtotal,
    total: subtotal,
    totalQuantity,
  };
}

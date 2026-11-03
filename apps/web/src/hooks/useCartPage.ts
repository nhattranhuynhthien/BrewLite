'use client';

import { useMemo } from 'react';
import { useCartStore } from '@/store/cart-store';

export function useCartPage() {
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
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

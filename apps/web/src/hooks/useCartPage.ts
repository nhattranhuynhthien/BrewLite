'use client';

import { useMemo } from 'react';
import { useCartStore } from '@/store/cart-store';

export const FREE_DELIVERY_THRESHOLD = 150_000;
export const DELIVERY_FEE = 25_000;

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
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD || items.length === 0 ? 0 : DELIVERY_FEE;

  return {
    clearCart,
    deliveryFee,
    freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
    items,
    removeItem,
    setQuantity,
    subtotal,
    total: subtotal + deliveryFee,
    totalQuantity,
  };
}

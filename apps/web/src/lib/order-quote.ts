import { apiFetch } from '@/lib/api';
import { normalizeProductOptions } from '@/lib/product-options';
import type { CartItem } from '@/store/cart-store';

export interface OrderQuoteItemPayload {
  productId: number;
  quantity: number;
  size: 'S' | 'M' | 'L';
  toppingIds: number[];
  sweetness: string;
  ice: string;
  note: string;
}

export interface OrderQuote {
  subtotal: number;
  voucherCode: string | null;
  voucherDiscount: number;
  voucher: {
    code: string;
    discountPct: number;
    maxDiscount: number;
  } | null;
  totalAfterVoucher: number;
  pointsToUse: number;
  pointsDiscount: number;
  total: number;
  earnedPoints: number;
}

export function buildOrderItemsPayload(items: CartItem[]): OrderQuoteItemPayload[] {
  return items.map(({ product, quantity, options }) => {
    const normalized = normalizeProductOptions(options);
    return {
      productId: product.id,
      quantity,
      size: normalized.size,
      toppingIds: normalized.toppings.map(({ id }) => id),
      sweetness: normalized.sweetness,
      ice: normalized.ice,
      note: normalized.note,
    };
  });
}

export function fetchOrderQuote({
  items,
  voucherCode,
  pointsToUse,
}: {
  items: CartItem[];
  voucherCode?: string | null;
  pointsToUse?: number;
}): Promise<OrderQuote> {
  const payload: {
    items: OrderQuoteItemPayload[];
    voucherCode?: string;
    pointsToUse?: number;
  } = {
    items: buildOrderItemsPayload(items),
  };
  const trimmedVoucher = voucherCode?.trim();
  if (trimmedVoucher) {
    payload.voucherCode = trimmedVoucher;
  }
  if (pointsToUse && pointsToUse > 0) {
    payload.pointsToUse = pointsToUse;
  }
  return apiFetch<OrderQuote>('/orders/quote', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

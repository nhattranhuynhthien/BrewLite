import type { Product } from '@/types/product';

export type CupSize = 'S' | 'M' | 'L';
export type Sweetness = 'Ít đường' | 'Bình thường' | 'Nhiều đường';
export type Ice = 'Ít đá' | 'Bình thường' | 'Không đá';

export type ToppingOption = {
  id: number;
  code: string;
  name: string;
  extraPrice: number;
};

export type SelectedProductOptions = {
  size: CupSize;
  toppings: ToppingOption[];
  sweetness: Sweetness;
  ice: Ice;
  note: string;
};

export const SIZE_EXTRA_PRICES: Record<CupSize, number> = {
  S: 0,
  M: 5000,
  L: 10000,
};

export const SWEETNESS_OPTIONS: Sweetness[] = ['Ít đường', 'Bình thường', 'Nhiều đường'];
export const ICE_OPTIONS: Ice[] = ['Ít đá', 'Bình thường', 'Không đá'];

export function defaultProductOptions(): SelectedProductOptions {
  return {
    size: 'M',
    toppings: [],
    sweetness: 'Bình thường',
    ice: 'Bình thường',
    note: '',
  };
}

export function normalizeProductOptions(
  options?: SelectedProductOptions,
): SelectedProductOptions {
  return options ?? defaultProductOptions();
}

export function getCartItemKey(
  productId: number,
  options?: SelectedProductOptions,
): string {
  const normalized = normalizeProductOptions(options);
  const toppingIds = normalized.toppings.map(({ id }) => id).sort((a, b) => a - b);
  return JSON.stringify([
    productId,
    normalized.size,
    toppingIds,
    normalized.sweetness,
    normalized.ice,
    normalized.note.trim(),
  ]);
}

export function getConfiguredUnitPrice(
  product: Product,
  options?: SelectedProductOptions,
): number {
  const normalized = normalizeProductOptions(options);
  return (
    product.price +
    SIZE_EXTRA_PRICES[normalized.size] +
    normalized.toppings.reduce((sum, topping) => sum + topping.extraPrice, 0)
  );
}

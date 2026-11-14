'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { Product } from '@/types/product';

function validateProducts(data: unknown): Product[] {
  if (!Array.isArray(data) || !data.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false;
    const product = item as Record<string, unknown>;
    return Number.isInteger(product.id) && typeof product.name === 'string'
      && typeof product.price === 'number' && Number.isFinite(product.price) && product.price >= 0
      && (product.imageUrl === null || typeof product.imageUrl === 'string');
  })) throw new Error('Dữ liệu menu không hợp lệ. Vui lòng thử lại.');
  return data as Product[];
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      const data = await apiFetch<Product[]>('/products');
      setProducts(validateProducts(data));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được menu');
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    return fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    let active = true;
    apiFetch<Product[]>('/products')
      .then((data) => {
        if (active) {
          setProducts(validateProducts(data));
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Không tải được menu');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return { products, loading, error, reload };
}

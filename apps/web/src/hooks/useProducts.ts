'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { Product } from '@/types/product';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      const data = await apiFetch<Product[]>('/products');
      setProducts(data);
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
          setProducts(data);
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
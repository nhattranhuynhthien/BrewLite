'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { ToppingOption } from '@/lib/product-options';

type ApiTopping = {
  id: number;
  name: string;
  price: number;
};

export function useToppings() {
  const [toppings, setToppings] = useState<ToppingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchToppings = useCallback(async () => {
    try {
      const data = await apiFetch<ApiTopping[]>('/toppings');
      setToppings(data.map(({ id, name, price }) => ({
        id,
        code: String(id),
        name,
        extraPrice: price,
      })));
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách topping.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    return fetchToppings();
  }, [fetchToppings]);

  useEffect(() => {
    let active = true;
    apiFetch<ApiTopping[]>('/toppings')
      .then((data) => {
        if (active) {
          setToppings(data.map(({ id, name, price }) => ({
            id,
            code: String(id),
            name,
            extraPrice: price,
          })));
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách topping.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return { toppings, loading, error, reload };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCartStore } from '@/store/cart-store';

export function useSiteHeader(onSearchChange: (query: string) => void, onSearchOpen?: () => void) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const cartCount = useCartStore((state) =>
    state.items.reduce((count, item) => count + item.quantity, 0),
  );

  useEffect(() => {
    useCartStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const toggleSearch = useCallback(() => {
    if (searchOpen) {
      onSearchChange('');
      setSearchOpen(false);
      return;
    }
    onSearchOpen?.();
    setSearchOpen(true);
  }, [onSearchChange, onSearchOpen, searchOpen]);

  const closeSearch = useCallback(() => {
    onSearchChange('');
    setSearchOpen(false);
  }, [onSearchChange]);

  return {
    cartCount,
    closeSearch,
    onSearchChange,
    searchInputRef,
    searchOpen,
    toggleSearch,
  };
}

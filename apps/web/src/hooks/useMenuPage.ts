'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
};

export function useAuthUser() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // Đọc localStorage trong useEffect để tránh lệch HTML giữa server và client
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      setUser(raw ? (JSON.parse(raw) as AuthUser) : null);
    } catch {
      setUser(null);
    }
    setReady(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  }, [router]);

  return { user, ready, logout };
}
'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getAccessToken, setAccessToken, subscribeToAccessToken } from '@/lib/api';

export type AuthUser = { id: number; email: string; name: string | null };

export function useAuthUser() {
  const router = useRouter();
  const token = useSyncExternalStore(subscribeToAccessToken, getAccessToken, () => null);
  const [profile, setProfile] = useState<{ token: string; user: AuthUser | null } | null>(null);
  useEffect(() => {
    if (!token) return;
    let active = true;
    apiFetch<AuthUser>('/users/me')
      .then(user => { if (active) setProfile({ token, user }); })
      .catch(() => { if (active) setProfile({ token, user: null }); });
    return () => { active = false; };
  }, [token]);
  const logout = useCallback(() => {
    setAccessToken(null);
    router.push('/');
  }, [router]);
  return {
    user: token && profile?.token === token ? profile.user : null,
    ready: !token || profile?.token === token,
    logout,
  };
}

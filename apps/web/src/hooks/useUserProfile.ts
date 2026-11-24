'use client';

import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import { apiFetch, getAccessToken, subscribeToAccessToken } from '@/lib/api';

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  rewardPoints: number;
  pendingRewardPoints: number;
}

const PROFILE_UPDATE_EVENT = 'brewlite:profile-update';

export function notifyProfileUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PROFILE_UPDATE_EVENT));
  }
}

export function useUserProfile() {
  const token = useSyncExternalStore(subscribeToAccessToken, getAccessToken, () => null);
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  const [result, setResult] = useState<{ token: string; revision: number; profile: UserProfile | null } | null>(null);
  const fetchProfile = useCallback(() => refresh(), []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const controller = new AbortController();
    apiFetch<UserProfile>('/auth/me', { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
      .then(profile => { if (active) setResult({ token, revision, profile }); })
      .catch(() => { if (active) setResult({ token, revision, profile: null }); });
    return () => { active = false; controller.abort(); };
  }, [token, revision]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleUpdate = () => {
      fetchProfile();
    };
    window.addEventListener(PROFILE_UPDATE_EVENT, handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener(PROFILE_UPDATE_EVENT, handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [fetchProfile]);

  const profile = token && result?.token === token ? result.profile : null;
  return {
    profile,
    rewardPoints: profile?.rewardPoints ?? 0,
    pendingRewardPoints: profile?.pendingRewardPoints ?? 0,
    availableRewardPoints: Math.max(0, (profile?.rewardPoints ?? 0) - (profile?.pendingRewardPoints ?? 0)),
    loading: Boolean(token && (result?.token !== token || result?.revision !== revision)),
    refetch: fetchProfile,
  };
}

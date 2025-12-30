"use client";

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export default function AuthInitializer() {
  useEffect(() => {
    // Initialize persisted auth state (refresh user if token present)
    (async () => {
      try {
        const state = useAuthStore.getState();
        const token = state.accessToken;
        const masked = token ? `${token.slice(0,6)}...${token.slice(-6)}` : 'no-token';
        console.log('Initial auth token:', masked);
        await state.initializeAuth();
      } catch (err) {
        console.error('Auth initialization failed:', err);
      }
    })();
  }, []);

  return null;
}

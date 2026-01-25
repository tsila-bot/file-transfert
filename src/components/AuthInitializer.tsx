"use client";

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSocketErrorHandler } from '@/shared/hooks/useSocketErrorHandler';
import { useP2PNotifications } from '@/shared/hooks/useP2PNotifications';
import ToastContainer from '@/components/ui/ToastContainer';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { useToast } from '@/components/ui/use-toast';

export default function AuthInitializer() {
  return (
    <ToastProvider>
      <AuthInitializerContent />
    </ToastProvider>
  );
}

function AuthInitializerContent() {
  const { toast } = useToast();

  // ✅ Initialize socket error handler globally
  useSocketErrorHandler();

  // ✅ Initialize P2P notifications globally
  useP2PNotifications();

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
  }, [toast]);

  return <ToastContainer />;
}

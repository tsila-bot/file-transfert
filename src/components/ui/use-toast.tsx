'use client';

import { useState, useCallback } from 'react';

type ToastVariant = 'default' | 'destructive';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: React.ReactNode;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((toastId?: string) => {
    setToasts((prev) => (toastId ? prev.filter((t) => t.id !== toastId) : []));
  }, []);

  const toast = useCallback(
    (message: string | Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);

      const newToast: Toast =
        typeof message === 'string'
          ? { id, title: message, variant: 'default' }
          : { id, variant: 'default', ...message };

      setToasts((prev) => [...prev, newToast]);

      // Auto-dismiss après 5 secondes
      setTimeout(() => {
        dismiss(id);
      }, 5000);

      return id;
    },
    [dismiss]
  );

  return {
    toasts,
    toast,
    dismiss,
  };
}

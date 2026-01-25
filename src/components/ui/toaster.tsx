'use client';

import { useToast } from '@/components/ui/use-toast';
import { Toast } from '@/components/ui/toast';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed right-4 bottom-4 z-50 max-w-md space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          variant={toast.variant}
          title={toast.title}
          description={toast.description}
          // action={toast.action} // Not supported in new Toast type
          onClose={() => dismiss(toast.id)}
        />
      ))}
    </div>
  );
}


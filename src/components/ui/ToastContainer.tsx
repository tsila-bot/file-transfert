'use client';

import { useToast } from '@/components/ui/use-toast';
import { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log('📊 ToastContainer toasts:', toasts); // DEBUG
  }, [toasts]);

  if (!mounted) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-md pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-sm pointer-events-auto transition-all ${
              toast.variant === 'destructive'
                ? 'bg-red-50/95 border-red-200 text-red-900 hover:shadow-lg'
                : 'bg-blue-50/95 border-blue-200 text-blue-900 hover:shadow-lg'
            }`}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {toast.variant === 'destructive' ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <Info className="w-5 h-5 text-blue-600" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1">
              {toast.title && (
                <p className="font-semibold text-sm">{toast.title}</p>
              )}
              {toast.description && (
                <p className="text-sm mt-1 opacity-90">{toast.description}</p>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={() => dismiss(toast.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors hover:bg-white/50 rounded p-1"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Debug: Show toast count in console */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 text-xs text-gray-500 pointer-events-none">
          {toasts.length} toast(s)
        </div>
      )}
    </>
  );
}

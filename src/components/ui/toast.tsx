import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const toastVariants = cva(
  'group pointer-events-auto flex items-center w-full p-4 pr-4 relative slide-in-right rounded-md border shadow-lg mt-4',
  {
    variants: {
      variant: {
        default: 'bg-white border-black text-black',
        destructive:
          'destructive group border-destructive bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface ToastProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: 'default' | 'destructive';
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  onClose?: () => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, title, description, action, onClose, ...props }, ref) => (
    <div ref={ref} className={cn(toastVariants({ variant }), className)} {...props}>
      <div className="grid flex-1 gap-1">
        {title && <div className="text-sm font-semibold">{title}</div>}
        {description && <div className="text-sm">{description}</div>}
      </div>
      {action}
      <button
        className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
        onClick={onClose}
        type="button"
      >
        <span className="sr-only">Close</span>✕
      </button>
    </div>
  )
);

Toast.displayName = 'Toast';

export { Toast, toastVariants };
export type { ToastProps };

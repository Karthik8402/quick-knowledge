import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export type ToastMessage = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
};

let toastIdCounter = 0;
const listeners: Array<(toast: ToastMessage) => void> = [];

/** Fire a toast from anywhere — no context/provider needed. */
export function showToast(type: ToastType, title: string, message?: string, duration = 4000) {
  const toast: ToastMessage = {
    id: `toast-${++toastIdCounter}`,
    type,
    title,
    message,
    duration,
  };
  listeners.forEach((fn) => fn(toast));
}

const iconMap: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
};

const colorMap: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-green-50/90 dark:bg-[#0d2818]/90',
    border: 'border-green-200 dark:border-[#2dd36f]/30',
    icon: 'text-green-600 dark:text-[#2dd36f]',
  },
  error: {
    bg: 'bg-red-50/90 dark:bg-[#2d0a0a]/90',
    border: 'border-red-200 dark:border-[#ff4961]/30',
    icon: 'text-red-600 dark:text-[#ff4961]',
  },
  info: {
    bg: 'bg-surface-container-high/90 dark:bg-surface-container-high/90',
    border: 'border-primary/30',
    icon: 'text-primary',
  },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<(ToastMessage & { exiting?: boolean })[]>([]);

  useEffect(() => {
    const handler = (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === toast.id ? { ...t, exiting: true } : t))
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 300);
      }, toast.duration ?? 4000);
    };

    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
      {toasts.map((toast) => {
        const colors = colorMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`${toast.exiting ? 'animate-toast-out' : 'animate-toast-in'} 
              ${colors.bg} ${colors.border} border backdrop-blur-xl rounded-2xl p-4 shadow-2xl 
              flex items-start gap-3 cursor-pointer hover-lift`}
            onClick={() => {
              setToasts((prev) =>
                prev.map((t) => (t.id === toast.id ? { ...t, exiting: true } : t))
              );
              setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 300);
            }}
          >
            <span className={`material-symbols-outlined ${colors.icon} text-xl mt-0.5`}>
              {iconMap[toast.type]}
            </span>
            <div className="flex-grow min-w-0">
              <p className="text-on-surface font-semibold text-sm">{toast.title}</p>
              {toast.message && (
                <p className="text-on-surface-variant text-xs mt-0.5 leading-relaxed">{toast.message}</p>
              )}
              {/* Progress bar */}
              <div className="mt-2 h-[2px] w-full bg-outline-variant/20 rounded-full overflow-hidden">
                <div
                  className={`h-full ${toast.type === 'success' ? 'bg-green-500 dark:bg-[#2dd36f]' : toast.type === 'error' ? 'bg-red-500 dark:bg-[#ff4961]' : 'bg-primary'} rounded-full`}
                  style={{ animation: `progressBar ${(toast.duration ?? 4000) / 1000}s linear forwards` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

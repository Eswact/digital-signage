'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { IconCheck, IconWarning, IconSpinner } from '@/components/ui/icons';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<((message: string, type?: ToastType) => void) | null>(null);

const STYLES: Record<ToastType, string> = {
  success: 'border-success/30 text-ink',
  error: 'border-danger/40 text-ink',
  info: 'border-line-strong text-ink',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), type === 'error' ? 6000 : 3200);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-5 lg:right-5 lg:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border bg-surface px-3.5 py-3 text-sm shadow-lg animate-sheet-up',
              STYLES[t.type],
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center',
                t.type === 'success' && 'text-success',
                t.type === 'error' && 'text-danger',
                t.type === 'info' && 'text-accent',
              )}
            >
              {t.type === 'success' ? <IconCheck /> : t.type === 'error' ? <IconWarning /> : <IconSpinner className="animate-spin" />}
            </span>
            <span className="flex-1 break-words">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** `toast('Screen deleted', 'success')` */
export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx ?? (() => undefined);
}

/** Error → readable message for toasts. */
export const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { IconX } from '@/components/ui/icons';
import { useT } from '@/lib/i18n';

/**
 * Modal dialog: centered on desktop, a bottom sheet on phones. Closes on Esc and
 * backdrop click; focus moves into the dialog and returns afterwards.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const t = useT();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portal: a fixed backdrop must not inherit margins from `space-y-*` parents.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 animate-fade-in sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-line bg-surface shadow-2xl outline-none animate-sheet-up sm:rounded-lg',
          size === 'sm' && 'sm:max-w-sm',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
          size === 'xl' && 'sm:max-w-4xl',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="-mr-1.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-ink-3 hover:bg-sunken hover:text-ink"
          >
            <IconX className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 pb-safe">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

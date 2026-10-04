'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { IconMore } from '@/components/ui/icons';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
  disabled?: boolean;
}

/** "⋯" dropdown for secondary row actions. */
export function Menu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visible = items.filter((i) => !i.hidden);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (visible.length === 0) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded text-ink-2 hover:bg-sunken hover:text-ink"
      >
        <IconMore className="h-5 w-5" />
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-48 rounded border border-line-strong bg-surface py-1 shadow-lg animate-fade-in"
        >
          {visible.map((item) => (
            <li key={item.label} role="none">
              <button
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  'block w-full px-3 py-2 text-left text-sm hover:bg-sunken disabled:opacity-50',
                  item.danger ? 'text-danger' : 'text-ink',
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

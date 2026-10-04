'use client';

import { cn } from '@/lib/cn';
import { IconChevronDown, IconSpinner } from '@/components/ui/icons';

/** Native select (best on mobile) with a custom chevron. `loading` shows a spinner. */
export function Select({
  className,
  loading,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { loading?: boolean }) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-10 w-full appearance-none rounded border border-line-strong bg-surface pl-3 pr-9 text-sm text-ink transition-colors',
          'hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {loading ? (
        <IconSpinner className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-accent" />
      ) : (
        <IconChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
      )}
    </div>
  );
}

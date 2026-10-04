'use client';

import { cn } from '@/lib/cn';

export interface TabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Underlined tab bar (scrolls horizontally on narrow screens). */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: TabOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex gap-5 overflow-x-auto border-b border-line', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            '-mb-px flex h-10 items-center gap-2 whitespace-nowrap border-b-2 text-sm font-medium transition-colors',
            value === o.value
              ? 'border-ink text-ink'
              : 'border-transparent text-ink-3 hover:text-ink',
          )}
        >
          {o.label}
          {o.count != null && (
            <span className="rounded-sm bg-sunken px-1.5 text-xs text-ink-2">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

'use client';

import { cn } from '@/lib/cn';

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-start gap-3', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
      {(label || description) && (
        <span className="min-w-0 select-none">
          {label && <span className="block text-sm text-ink">{label}</span>}
          {description && <span className="block text-xs text-ink-3">{description}</span>}
        </span>
      )}
    </label>
  );
}

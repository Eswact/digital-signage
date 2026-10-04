'use client';

import { cn } from '@/lib/cn';

const FIELD =
  'w-full rounded border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition-colors ' +
  'hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, 'h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, 'py-2 leading-relaxed', className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('block text-[13px] font-medium text-ink', className)} {...props} />;
}

/** Label + control + optional hint/error, stacked. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

/** Number input that clamps on commit and ignores partial typing. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  ...props
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'step'>) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={Number.isFinite(value) ? value : ''}
      min={min}
      max={max}
      step={step}
      className={cn('tabular-nums', className)}
      onChange={(e) => {
        if (e.target.value === '') return;
        const n = Number(e.target.value);
        if (Number.isNaN(n)) return;
        onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
      }}
      {...props}
    />
  );
}

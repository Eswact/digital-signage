import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-sunken', className)} />;
}

export function Progress({ value, tone = 'accent', className }: { value: number; tone?: 'accent' | 'warn' | 'danger'; className?: string }) {
  const color = tone === 'danger' ? 'bg-danger' : tone === 'warn' ? 'bg-warn' : 'bg-accent';
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-sunken', className)}
    >
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/** Usage bar tone: warn above 80 %, danger at 100 %. */
export const usageTone = (pct: number) => (pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'accent');

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-md border border-dashed border-line-strong px-6 py-12 text-center', className)}>
      {icon && <div className="text-ink-3 [&>svg]:h-8 [&>svg]:w-8">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Page title block: micro-label, large title, description, actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{eyebrow}</p>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tightest sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Big number with a micro-label (dashboard strip). */
export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

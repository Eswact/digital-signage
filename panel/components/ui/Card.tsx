import { cn } from '@/lib/cn';

/** Flat panel: hairline border on a surface, no shadow. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md border border-line bg-surface', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

/** Card with a small uppercase title row (Swiss micro-label) and optional right-side action. */
export function Section({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-md border border-line bg-surface', className)}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

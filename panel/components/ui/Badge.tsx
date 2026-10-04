import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'success' | 'accent' | 'warn' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2',
  success: 'bg-success-soft text-success',
  accent: 'bg-accent-soft text-accent',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({
  tone = 'neutral',
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

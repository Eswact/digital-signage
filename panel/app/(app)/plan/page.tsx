'use client';

import { useOrganization } from '@/lib/queries';
import { useRole } from '@/lib/session';
import { formatBytes, formatDuration, percent } from '@/lib/format';
import { useT } from '@/lib/i18n';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { PageHeader, Progress, Skeleton, usageTone } from '@/components/ui/Misc';
import { Badge } from '@/components/ui/Badge';

function Meter({ label, used, max, format = String, note }: { label: string; used: number; max: number; format?: (n: number) => string; note?: string }) {
  const t = useT();
  const pct = percent(used, max);
  const tone = usageTone(pct);
  return (
    <div className="space-y-2 px-4 py-5 sm:px-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{label}</h3>
        <p className="text-sm tabular-nums text-ink-2">
          <span className="text-lg font-semibold text-ink">{format(used)}</span> / {format(max)}
        </p>
      </div>
      <Progress value={pct} tone={tone} />
      <p className="text-xs text-ink-3">
        {tone === 'danger' ? t('Limit reached — remove something or ask your administrator to raise it.') : note ?? t('{n}% used', { n: pct })}
      </p>
    </div>
  );
}

export default function PlanPage() {
  const t = useT();
  const { isSuperadmin } = useRole();
  const org = useOrganization();
  if (!org.data) return <Skeleton className="h-96 w-full" />;
  const { limits, usage, plan } = org.data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('Organization')}
        title={t('Plan & usage')}
        description={t('What {name} may use, and how much of it is used right now.', { name: org.data.name })}
        actions={<Badge tone="accent">{plan}</Badge>}
      />

      <Card>
        <div className="divide-y divide-line">
          <Meter label={t('Screens')} used={usage.screens} max={limits.maxScreens} />
          <Meter label={t('Devices')} used={usage.devices} max={limits.maxDevices} />
          <Meter label={t('Team members')} used={usage.members} max={limits.maxMembers} note={t('Includes pending invitations.')} />
          <Meter label={t('Media files')} used={usage.mediaFiles} max={limits.maxMediaFiles} />
          <Meter label={t('Storage')} used={usage.storageBytes} max={limits.storageQuotaMb * 1024 * 1024} format={formatBytes} />
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">{t('Per-upload limits')}</h2>
        <dl className="grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-2">{t('Largest single file')}</dt>
            <dd className="text-lg font-semibold tabular-nums">{limits.maxUploadMb} MB</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-2">{t('Longest video')}</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatDuration(limits.maxVideoSeconds)}</dd>
          </div>
        </dl>
      </section>

      <p className="text-sm text-ink-2">
        {isSuperadmin ? (
          <>
            {t('As platform administrator you can change these limits for every organization in')}{' '}
            <Link href="/admin/organizations" className="text-accent hover:underline">
              {t('Organizations')}
            </Link>
            .
          </>
        ) : (
          t('Need more? Contact your administrator to raise these limits.')
        )}
      </p>
    </div>
  );
}

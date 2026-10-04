'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, OrgLimits } from '@/lib/api';
import { useRole } from '@/lib/session';
import { useAdminOrganizations } from '@/lib/queries';
import { useAction } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Input';
import { PageHeader, Skeleton } from '@/components/ui/Misc';
import { LIMIT_FIELDS } from '@/lib/labels';

interface SystemInfo {
  media: { storage: 'local' | 's3'; ffprobe: boolean; allowUnverifiedVideo: boolean };
}

export default function AdminSettingsPage() {
  const t = useT();
  const router = useRouter();
  const { session, isSuperadmin } = useRole();
  const orgs = useAdminOrganizations();
  const system = useQuery({ queryKey: ['admin', 'system'], queryFn: () => api<SystemInfo>('/admin/system'), enabled: isSuperadmin });
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (session && !isSuperadmin) router.replace('/devices');
  }, [session, isSuperadmin, router]);

  useEffect(() => {
    if (orgs.data) setValues(Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, String(orgs.data!.defaults[f.key])])));
  }, [orgs.data]);

  const save = useAction(
    () => {
      const limits: Partial<OrgLimits> = {};
      for (const f of LIMIT_FIELDS) limits[f.key] = Math.max(0, Math.round(Number(values[f.key])));
      return api('/admin/limits', { method: 'PUT', body: JSON.stringify(limits) });
    },
    { invalidate: [['admin', 'organizations'], ['organization']], success: 'Platform defaults saved' },
  );

  if (!isSuperadmin) return null;
  if (!orgs.data) return <Skeleton className="h-96 w-full" />;

  const sys = system.data?.media;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('Platform')} title={t('Settings')} description={t('Defaults and facts that apply to the whole installation. Only platform administrators see this page.')} />

      <Section title={t('Default limits per organization')} description={t('Used for every organization that has no limits of its own. Change a single organization under Organizations.')}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIMIT_FIELDS.map((f) => (
              <Field key={f.key} label={`${t(f.label)}${f.unit ? ` (${f.unit})` : ''}`}>
                <Input type="number" min={0} inputMode="numeric" required value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="tabular-nums" />
              </Field>
            ))}
          </div>
          <Button type="submit" loading={save.isPending}>
            {t('Save defaults')}
          </Button>
        </form>
      </Section>

      <Section title={t('Media storage')} description={t('Configured on the server through environment variables.')}>
        {!sys ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <dl className="grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t('Storage')}</dt>
              <dd className="mt-1 text-sm font-medium">{sys.storage === 's3' ? t('S3-compatible bucket') : t('Local disk')}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t('Video verification')}</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                {sys.ffprobe ? <Badge tone="success" dot>ffprobe</Badge> : <Badge tone="danger" dot>{t('ffprobe missing')}</Badge>}
              </dd>
            </div>
            <div className="sm:col-span-3">
              {!sys.ffprobe && (
                <p className="rounded border border-warn/40 bg-warn-soft p-3 text-sm text-warn">
                  {sys.allowUnverifiedVideo
                    ? t('ffprobe is not installed, so uploaded videos are accepted without checking their length (MEDIA_ALLOW_UNVERIFIED_VIDEO). Install ffmpeg on the server to enforce the video length limit.')
                    : t('ffprobe is not installed, so video uploads are rejected. Install ffmpeg on the server (or set FFPROBE_PATH).')}
                </p>
              )}
            </div>
          </dl>
        )}
      </Section>
    </div>
  );
}

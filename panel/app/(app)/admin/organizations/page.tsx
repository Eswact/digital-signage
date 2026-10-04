'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminOrganization, api, OrgLimits } from '@/lib/api';
import { LIMIT_FIELDS } from '@/lib/labels';
import { useRole } from '@/lib/session';
import { useAdminOrganizations } from '@/lib/queries';
import { useAction } from '@/lib/hooks';
import { formatBytes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Input';
import { PageHeader, Skeleton } from '@/components/ui/Misc';

function EditDialog({ org, defaults, onClose }: { org: AdminOrganization | null; defaults: OrgLimits | undefined; onClose: () => void }) {
  const t = useT();
  const [plan, setPlan] = useState('');
  // Empty string = no override (platform default applies).
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!org) return;
    setPlan(org.plan);
    setValues(Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, org.limits[f.key] != null ? String(org.limits[f.key]) : ''])));
  }, [org]);

  const save = useAction(
    () => {
      const limits: Record<string, number> = {};
      for (const f of LIMIT_FIELDS) {
        const raw = values[f.key]?.trim();
        if (raw) limits[f.key] = Math.max(0, Math.round(Number(raw)));
      }
      return api(`/admin/organizations/${org!.id}`, { method: 'PATCH', body: JSON.stringify({ plan: plan.trim() || undefined, limits: Object.keys(limits).length ? limits : null }) });
    },
    { invalidate: [['admin', 'organizations'], ['organization']], success: 'Organization updated', onSuccess: onClose },
  );

  return (
    <Dialog
      open={!!org}
      onClose={onClose}
      size="lg"
      title={org?.name ?? ''}
      description={t('Leave a field empty to use the platform default shown next to it.')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {t('Save')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label={t('Plan label')} hint={t('Free text, shown to the organization (e.g. standard, pro).')}>
          <Input value={plan} onChange={(e) => setPlan(e.target.value)} className="max-w-xs" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {LIMIT_FIELDS.map((f) => (
            <Field key={f.key} label={`${t(f.label)}${f.unit ? ` (${f.unit})` : ''}`}>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={values[f.key] ?? ''}
                placeholder={defaults ? String(defaults[f.key]) : ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="tabular-nums"
              />
            </Field>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

export default function AdminOrganizationsPage() {
  const t = useT();
  const router = useRouter();
  const { session, isSuperadmin } = useRole();
  const orgs = useAdminOrganizations();
  const [editing, setEditing] = useState<AdminOrganization | null>(null);

  useEffect(() => {
    if (session && !isSuperadmin) router.replace('/devices');
  }, [session, isSuperadmin, router]);

  if (!isSuperadmin) return null;
  const list = orgs.data?.organizations ?? [];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('Platform')} title={t('Organizations')} description={t('Every organization on this installation, its usage and its limits.')} />

      {orgs.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {list.map((o) => (
              <li key={o.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{o.name}</p>
                    <Badge>{o.plan}</Badge>
                    {Object.keys(o.limits).length > 0 && <Badge tone="accent">{t('custom limits')}</Badge>}
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-ink-3">
                    {t('{n} screens', { n: `${o.usage.screens}/${o.effective.maxScreens}` })} · {t('{n} devices', { n: `${o.usage.devices}/${o.effective.maxDevices}` })} · {t('{n} members', { n: `${o.usage.members}/${o.effective.maxMembers}` })} ·{' '}
                    {t('{n} files', { n: `${o.usage.mediaFiles}/${o.effective.maxMediaFiles}` })} · {formatBytes(o.usage.storageBytes)} / {o.effective.storageQuotaMb} MB
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditing(o)}>
                  {t('Edit limits')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <EditDialog org={editing} defaults={orgs.data?.defaults} onClose={() => setEditing(null)} />
    </div>
  );
}

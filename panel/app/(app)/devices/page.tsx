'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, Device, deviceSupports } from '@/lib/api';
import { useRole } from '@/lib/session';
import { useAdminOrganizations, useDevices, useGroups, useScreens, useTemplates } from '@/lib/queries';
import { useAction } from '@/lib/hooks';
import { timeAgo } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Input';
import { Menu } from '@/components/ui/Menu';
import { EmptyState, PageHeader, Skeleton, Stat } from '@/components/ui/Misc';
import { Select } from '@/components/ui/Select';
import { useConfirm, usePrompt } from '@/components/ui/Confirm';
import { IconDevicesEmpty, IconPlus } from '@/components/ui/icons';

function PairDialog({ open, initialCode, onClose }: { open: boolean; initialCode: string; onClose: () => void }) {
  const t = useT();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setCode(initialCode), [initialCode]);

  const pair = useAction(
    () => api<Device>('/devices/pair', { method: 'POST', body: JSON.stringify({ deviceId: code.trim().toUpperCase(), name: name.trim() || undefined }) }),
    {
      invalidate: [['devices'], ['organization']],
      success: 'Device added',
      onSuccess: () => {
        setCode('');
        setName('');
        setError(null);
        onClose();
      },
    },
  );
  // Show the server's reason inline (e.g. "device linked to another organization", plan limit).
  const submit = () => pair.mutateAsync().catch((e: Error) => setError(e.message));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Add a device')}
      description={t('Open the Signage app on the device. The code on its screen links it to your organization.')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button loading={pair.isPending} disabled={code.trim().length < 4} onClick={submit}>
            {t('Add device')}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim().length >= 4) submit();
        }}
        className="space-y-4"
      >
        <Field label={t('Device ID')} hint={t('The 8-character code shown on the device screen (or scan its QR code).')} error={error}>
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            autoFocus
            placeholder="ABCD1234"
            className="font-mono uppercase tracking-widest"
          />
        </Field>
        <Field label={t('Name (optional)')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Lobby TV')} />
        </Field>
      </form>
    </Dialog>
  );
}

function DevicesContent() {
  const t = useT();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const { canEdit, isSuperadmin } = useRole();
  const devices = useDevices();
  const screens = useScreens();
  const templates = useTemplates();
  const groups = useGroups();
  const orgs = useAdminOrganizations();

  const params = useSearchParams();
  const [pairOpen, setPairOpen] = useState(false);
  const [pairCode, setPairCode] = useState('');
  const [moving, setMoving] = useState<Device | null>(null);
  const [targetOrg, setTargetOrg] = useState('');

  // QR pairing: the device shows a QR that opens /devices?pair=CODE.
  useEffect(() => {
    const code = params.get('pair');
    if (code) {
      setPairCode(code.toUpperCase());
      setPairOpen(true);
    }
  }, [params]);

  const refresh = [['devices']];
  const rename = useAction(({ id, name }: { id: string; name: string }) => api(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }), {
    invalidate: refresh,
    success: 'Device renamed',
  });
  const assign = useAction(({ id, screenId }: { id: string; screenId: string }) => api(`/devices/${id}/assign-screen`, { method: 'POST', body: JSON.stringify({ screenId }) }), {
    invalidate: refresh,
    success: 'Screen assigned',
  });
  const clearScreen = useAction((id: string) => api(`/devices/${id}/screen`, { method: 'DELETE' }), { invalidate: refresh, success: 'Screen removed' });
  const setGroup = useAction(({ id, groupId }: { id: string; groupId: string | null }) => api(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify({ groupId }) }), {
    invalidate: refresh,
    success: (_r, v, tr) => tr(v.groupId ? 'Device added to the group' : 'Device removed from the group'),
  });
  const unpair = useAction((id: string) => api(`/devices/${id}/unpair`, { method: 'POST' }), {
    invalidate: [['devices'], ['organization']],
    success: 'Device released',
  });
  const transfer = useAction(({ id, organizationId }: { id: string; organizationId: string }) => api(`/devices/${id}/transfer`, { method: 'POST', body: JSON.stringify({ organizationId }) }), {
    invalidate: refresh,
    success: 'Device moved',
    onSuccess: () => setMoving(null),
  });

  const list = devices.data ?? [];
  const waiting = list.filter((d) => !d.currentScreenId && !d.activeScreenId);
  const running = list.filter((d) => d.currentScreenId || d.activeScreenId);
  const online = list.filter((d) => d.status === 'online').length;

  const screenName = (id?: string | null) => screens.data?.find((s) => s.id === id)?.name;
  const orgName = (id?: string | null) => orgs.data?.organizations.find((o) => o.id === id)?.name;

  /** Can the device render this screen's template? null = unknown (old APK reports nothing). */
  const supports = (d: Device, screenId?: string | null) => {
    const screen = screens.data?.find((s) => s.id === screenId);
    return screen ? deviceSupports(d, templates.data?.find((x) => x.type === screen.template)) : null;
  };

  function row(d: Device) {
    const busy = (m: { isPending: boolean; variables?: unknown }, key: (v: never) => string) =>
      m.isPending && key(m.variables as never) === d.id;
    const scheduled = !!d.activeScreenId && d.activeScreenId !== d.currentScreenId;
    const needsUpdate = supports(d, d.activeScreenId ?? d.currentScreenId) === false;

    return (
      <li key={d.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] md:items-center md:gap-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn('mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full', d.status === 'online' ? 'bg-success' : 'bg-line-strong')}
            title={d.status === 'online' ? t('Online') : t('Offline')}
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{d.name || d.deviceId}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
              <span className="font-mono">{d.deviceId}</span>
              <span>·</span>
              <span>{d.status === 'online' ? t('online now') : t('last seen {when}', { when: timeAgo(t, d.lastSeenAt) })}</span>
              {d.appVersionName && (
                <>
                  <span>·</span>
                  <span>APK {d.appVersionName}</span>
                </>
              )}
              {isSuperadmin && orgName(d.organizationId) && (
                <>
                  <span>·</span>
                  <span>{orgName(d.organizationId)}</span>
                </>
              )}
            </p>
            {(scheduled || needsUpdate) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {scheduled && <Badge tone="accent">{t('Scheduled: {screen}', { screen: screenName(d.activeScreenId) ?? '…' })}</Badge>}
                {needsUpdate && <Badge tone="warn">{t('App update needed')}</Badge>}
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3 md:hidden">{t('Screen')}</p>
          {canEdit ? (
            <Select
              aria-label={t('Screen')}
              value={d.currentScreenId ?? ''}
              loading={busy(assign, (v: { id: string }) => v.id) || busy(clearScreen, (v: string) => v)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__clear__') clearScreen.mutate(d.id);
                else if (v) assign.mutate({ id: d.id, screenId: v });
              }}
            >
              <option value="" disabled>
                {t('Choose a screen…')}
              </option>
              {d.currentScreenId && <option value="__clear__">{t('— Remove screen —')}</option>}
              {screens.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {supports(d, s.id) === false ? ` (${t('needs app update')})` : ''}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm">{screenName(d.currentScreenId) ?? '—'}</p>
          )}
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3 md:hidden">{t('Group')}</p>
          {canEdit ? (
            <Select
              aria-label={t('Group')}
              value={d.groupId ?? ''}
              loading={busy(setGroup, (v: { id: string }) => v.id)}
              onChange={(e) => setGroup.mutate({ id: d.id, groupId: e.target.value || null })}
            >
              <option value="">{t('No group')}</option>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm">{d.group?.name ?? '—'}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Menu
            label={t('Device actions')}
            items={[
              {
                label: t('Rename'),
                hidden: !canEdit,
                onSelect: async () => {
                  const name = await prompt({ title: t('Rename device'), initial: d.name ?? '', label: t('Name'), confirmLabel: t('Rename') });
                  if (name !== null) rename.mutate({ id: d.id, name: name.trim() });
                },
              },
              {
                label: t('Move to another organization…'),
                hidden: !isSuperadmin,
                onSelect: () => {
                  setTargetOrg('');
                  setMoving(d);
                },
              },
              {
                label: t('Unpair'),
                danger: true,
                hidden: !canEdit,
                onSelect: async () => {
                  const ok = await confirm({
                    title: t('Unpair device'),
                    message: t('Unpair "{name}"? It returns to its pairing screen and can be paired again.', { name: d.name || d.deviceId }),
                    confirmLabel: t('Unpair'),
                    danger: true,
                  });
                  if (ok) unpair.mutate(d.id);
                },
              },
            ]}
          />
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('Manage')}
        title={t('Devices')}
        description={t('Pair screens, give them content and keep an eye on their status.')}
        actions={
          canEdit && (
            <Button onClick={() => setPairOpen(true)}>
              <IconPlus className="h-4 w-4" /> {t('Add device')}
            </Button>
          )
        }
      />

      {devices.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<IconDevicesEmpty />}
          title={t('No devices yet')}
          description={t('Install the Android app on a screen or TV box, then add its Device ID here.')}
          action={canEdit && <Button onClick={() => setPairOpen(true)}>{t('Add device')}</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-6 border-b border-line pb-6 sm:max-w-md">
            <Stat label={t('Online')} value={online} />
            <Stat label={t('Total')} value={list.length} />
            <Stat label={t('Waiting')} value={waiting.length} />
          </div>

          {waiting.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
                {t('Waiting for a screen')} <Badge tone="warn">{waiting.length}</Badge>
              </h2>
              <Card>
                <ul className="divide-y divide-line">{waiting.map(row)}</ul>
              </Card>
            </section>
          )}

          {running.length > 0 && (
            <section className="space-y-3">
              {waiting.length > 0 && (
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">{t('Showing content')}</h2>
              )}
              <Card>
                <ul className="divide-y divide-line">{running.map(row)}</ul>
              </Card>
            </section>
          )}
        </>
      )}

      <PairDialog open={pairOpen} initialCode={pairCode} onClose={() => setPairOpen(false)} />

      <Dialog
        open={!!moving}
        onClose={() => setMoving(null)}
        title={t('Move device')}
        description={t('The screen and group assignment is cleared and the device returns to its pairing screen.')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoving(null)}>
              {t('Cancel')}
            </Button>
            <Button disabled={!targetOrg} loading={transfer.isPending} onClick={() => moving && transfer.mutate({ id: moving.id, organizationId: targetOrg })}>
              {t('Move')}
            </Button>
          </>
        }
      >
        <Field label={t('Organization')}>
          <Select value={targetOrg} onChange={(e) => setTargetOrg(e.target.value)}>
            <option value="">{t('Choose…')}</option>
            {orgs.data?.organizations
              .filter((o) => o.id !== moving?.organizationId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </Select>
        </Field>
      </Dialog>
    </div>
  );
}

export default function DevicesPage() {
  return (
    <Suspense>
      <DevicesContent />
    </Suspense>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Schedule } from '@/lib/api';
import { useRole } from '@/lib/session';
import { useDevices, useGroups, useOrganization, useSchedules, useScreens } from '@/lib/queries';
import { useAction } from '@/lib/hooks';
import { WEEKDAYS } from '@/lib/labels';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/Confirm';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, NumberInput } from '@/components/ui/Input';
import { Menu } from '@/components/ui/Menu';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/Misc';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { IconPlus, IconSchedule } from '@/components/ui/icons';

interface FormState {
  name: string;
  targetType: 'device' | 'group';
  targetId: string;
  screenId: string;
  days: number[];
  allDay: boolean;
  startTime: string;
  endTime: string;
  priority: number;
  enabled: boolean;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const blank = (): FormState => ({
  name: '',
  targetType: 'device',
  targetId: '',
  screenId: '',
  days: ALL_DAYS,
  allDay: false,
  startTime: '09:00',
  endTime: '17:00',
  priority: 0,
  enabled: true,
});

const fromSchedule = (s: Schedule): FormState => ({
  name: s.name,
  targetType: s.targetType,
  targetId: s.targetId,
  screenId: s.screenId,
  days: s.days,
  allDay: !s.startTime || !s.endTime || s.startTime === s.endTime,
  startTime: s.startTime ?? '09:00',
  endTime: s.endTime ?? '17:00',
  priority: s.priority,
  enabled: s.enabled,
});

function ScheduleDialog({ editing, onClose }: { editing: Schedule | 'new' | null; onClose: () => void }) {
  const t = useT();
  const devices = useDevices();
  const groups = useGroups();
  const screens = useScreens();
  const [form, setForm] = useState<FormState>(blank());
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (editing === 'new') setForm(blank());
    else if (editing) setForm(fromSchedule(editing));
    setError(null);
  }, [editing]);

  const body = () =>
    JSON.stringify({
      name: form.name.trim(),
      targetType: form.targetType,
      targetId: form.targetId,
      screenId: form.screenId,
      days: form.days,
      startTime: form.allDay ? null : form.startTime,
      endTime: form.allDay ? null : form.endTime,
      priority: form.priority,
      enabled: form.enabled,
    });

  const save = useAction(
    () => (editing === 'new' ? api('/schedules', { method: 'POST', body: body() }) : api(`/schedules/${(editing as Schedule).id}`, { method: 'PATCH', body: body() })),
    { invalidate: [['schedules'], ['devices']], success: 'Schedule saved', onSuccess: onClose },
  );

  const targets = form.targetType === 'device' ? (devices.data ?? []).map((d) => ({ id: d.id, name: d.name || d.deviceId })) : (groups.data ?? []).map((g) => ({ id: g.id, name: g.name }));
  const valid = form.name.trim() && form.targetId && form.screenId && form.days.length > 0 && (form.allDay || form.startTime !== form.endTime);
  const overnight = !form.allDay && form.endTime < form.startTime;

  return (
    <Dialog
      open={!!editing}
      onClose={onClose}
      size="lg"
      title={editing === 'new' ? t('New schedule') : t('Edit schedule')}
      description={t('While a schedule is active, its screen replaces the one assigned to the device or group.')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button loading={save.isPending} disabled={!valid} onClick={() => save.mutateAsync().catch((e: Error) => setError(e.message))}>
            {t('Save schedule')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label={t('Name')}>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('e.g. Lunch menu')} autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Applies to')}>
            <SegmentedControl
              fullWidth
              value={form.targetType}
              onChange={(targetType) => set({ targetType, targetId: '' })}
              options={[
                { value: 'device', label: t('A device') },
                { value: 'group', label: t('A group') },
              ]}
            />
          </Field>
          <Field label={form.targetType === 'device' ? t('Device') : t('Group')}>
            <Select value={form.targetId} onChange={(e) => set({ targetId: e.target.value })}>
              <option value="">{t('Choose…')}</option>
              {targets.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label={t('Show this screen')}>
          <Select value={form.screenId} onChange={(e) => set({ screenId: e.target.value })}>
            <option value="">{t('Choose…')}</option>
            {screens.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('On these days')}>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = form.days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ days: on ? form.days.filter((x) => x !== d.value) : [...form.days, d.value] })}
                  className={cn('h-9 w-12 rounded border text-[13px] font-medium', on ? 'border-ink bg-ink text-paper' : 'border-line-strong text-ink-2 hover:text-ink')}
                >
                  {t(d.short)}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="space-y-3">
          <Toggle checked={form.allDay} onChange={(allDay) => set({ allDay })} label={t('All day')} />
          {!form.allDay && (
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t('From')}>
                <Input type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} className="w-36" />
              </Field>
              <Field label={t('Until')}>
                <Input type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} className="w-36" />
              </Field>
              {overnight && <p className="pb-2.5 text-xs text-ink-2">{t('Runs past midnight into the next day.')}</p>}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Priority')} hint={t('When schedules overlap, the higher number wins.')}>
            <div className="w-28">
              <NumberInput value={form.priority} min={-100} max={100} onChange={(priority) => set({ priority: Math.round(priority) })} />
            </div>
          </Field>
          <div className="pt-6">
            <Toggle checked={form.enabled} onChange={(enabled) => set({ enabled })} label={t('Enabled')} />
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}

export default function SchedulesPage() {
  const t = useT();
  const confirm = useConfirm();
  const { canEdit } = useRole();
  const schedules = useSchedules();
  const devices = useDevices();
  const groups = useGroups();
  const screens = useScreens();
  const org = useOrganization();
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null);

  const toggle = useAction(({ id, enabled }: { id: string; enabled: boolean }) => api(`/schedules/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }), { invalidate: [['schedules'], ['devices']] });
  const remove = useAction((id: string) => api(`/schedules/${id}`, { method: 'DELETE' }), { invalidate: [['schedules'], ['devices']], success: 'Schedule deleted' });

  const list = schedules.data ?? [];
  const targetName = (s: Schedule) =>
    s.targetType === 'device'
      ? (devices.data?.find((d) => d.id === s.targetId)?.name || devices.data?.find((d) => d.id === s.targetId)?.deviceId)
      : groups.data?.find((g) => g.id === s.targetId)?.name;
  const screenName = (id: string) => screens.data?.find((x) => x.id === id)?.name;

  const dayLabel = (s: Schedule) => {
    if (s.days.length === 7) return t('Every day');
    if (s.days.length === 5 && [1, 2, 3, 4, 5].every((d) => s.days.includes(d))) return t('Weekdays');
    if (s.days.length === 2 && s.days.includes(0) && s.days.includes(6)) return t('Weekends');
    return WEEKDAYS.filter((d) => s.days.includes(d.value)).map((d) => t(d.short)).join(', ');
  };
  const timeLabel = (s: Schedule) => (!s.startTime || !s.endTime || s.startTime === s.endTime ? t('All day') : `${s.startTime} – ${s.endTime}`);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('Manage')}
        title={t('Schedules')}
        description={t('Switch what a device shows by time of day and weekday — breakfast menu, lunch menu, closing notice.')}
        actions={
          canEdit && (
            <Button onClick={() => setEditing('new')}>
              <IconPlus className="h-4 w-4" /> {t('New schedule')}
            </Button>
          )
        }
      />

      {org.data && (
        <p className="text-sm text-ink-2">
          {t('Times use the organization time zone:')} <strong className="font-medium text-ink">{org.data.timezone}</strong>.{' '}
          <Link href="/team" className="text-accent hover:underline">
            {t('Change it in Team')}
          </Link>
        </p>
      )}

      {schedules.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<IconSchedule />}
          title={t('No schedules yet')}
          description={t('Without a schedule, devices always show the screen assigned to them.')}
          action={canEdit && <Button onClick={() => setEditing('new')}>{t('New schedule')}</Button>}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {list.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn('truncate font-medium', !s.enabled && 'text-ink-3')}>{s.name}</p>
                    {s.activeNow && <Badge tone="success" dot>{t('Active now')}</Badge>}
                    {!s.enabled && <Badge>{t('Off')}</Badge>}
                    {s.priority !== 0 && <Badge>{t('Priority {n}', { n: s.priority })}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-2">
                    <span className="font-medium text-ink">{screenName(s.screenId) ?? '…'}</span> {t('on')}{' '}
                    {s.targetType === 'group' ? `${t('group')} ` : ''}
                    <span className="font-medium text-ink">{targetName(s) ?? '…'}</span>
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-ink-3">
                    {dayLabel(s)} · {timeLabel(s)}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-3">
                    <Toggle checked={s.enabled} onChange={(enabled) => toggle.mutate({ id: s.id, enabled })} label={t('Enabled')} />
                    <Menu
                      label={t('Schedule actions')}
                      items={[
                        { label: t('Edit'), onSelect: () => setEditing(s) },
                        {
                          label: t('Delete'),
                          danger: true,
                          onSelect: async () => {
                            const ok = await confirm({ title: t('Delete schedule'), message: t('Delete "{name}"?', { name: s.name }), confirmLabel: t('Delete'), danger: true });
                            if (ok) remove.mutate(s.id);
                          },
                        },
                      ]}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ScheduleDialog editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

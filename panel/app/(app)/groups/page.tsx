'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useRole } from '@/lib/session';
import { useDevices, useGroups, useScreens } from '@/lib/queries';
import { useAction } from '@/lib/hooks';
import { msg, useT } from '@/lib/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/Confirm';
import { Input } from '@/components/ui/Input';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/Misc';
import { Select } from '@/components/ui/Select';
import { IconGroup } from '@/components/ui/icons';

export default function GroupsPage() {
  const t = useT();
  const confirm = useConfirm();
  const { canEdit } = useRole();
  const groups = useGroups();
  const screens = useScreens();
  const devices = useDevices();
  const [name, setName] = useState('');

  const create = useAction((n: string) => api('/groups', { method: 'POST', body: JSON.stringify({ name: n }) }), {
    invalidate: [['groups']],
    success: 'Group created',
    onSuccess: () => setName(''),
  });
  const remove = useAction((id: string) => api(`/groups/${id}`, { method: 'DELETE' }), { invalidate: [['groups'], ['devices'], ['schedules']], success: 'Group deleted' });
  const assign = useAction(({ id, screenId }: { id: string; screenId: string }) => api<{ assigned: number }>(`/groups/${id}/assign-screen`, { method: 'POST', body: JSON.stringify({ screenId }) }), {
    invalidate: [['devices'], ['groups']],
    success: (res, _v, tr) => tr(res.assigned === 1 ? msg('Screen assigned to {n} device') : msg('Screen assigned to {n} devices'), { n: res.assigned }),
  });
  const unassign = useAction((id: string) => api(`/groups/${id}/screen`, { method: 'DELETE' }), { invalidate: [['devices'], ['groups']], success: "Group's screen removed" });

  const list = groups.data ?? [];
  const countIn = (gid: string) => (devices.data ?? []).filter((d) => d.groupId === gid).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('Manage')}
        title={t('Groups')}
        description={t('Group devices — e.g. per shop or floor — and give them a screen in one go. Add devices to a group on the Devices page.')}
      />

      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name.trim());
          }}
          className="flex max-w-xl gap-2"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('New group name (e.g. Branch 1)')} />
          <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
            {t('Add group')}
          </Button>
        </form>
      )}

      {groups.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : list.length === 0 ? (
        <EmptyState icon={<IconGroup />} title={t('No groups yet')} description={t('Create a group, then add devices to it from the Devices page.')} />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {list.map((g) => {
              const pending = (assign.isPending && assign.variables?.id === g.id) || (unassign.isPending && unassign.variables === g.id);
              return (
                <li key={g.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g.name}</p>
                    <Badge className="mt-1">{t(countIn(g.id) === 1 ? msg('{n} device') : msg('{n} devices'), { n: countIn(g.id) })}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <div className="w-full sm:w-64">
                        <Select
                          aria-label={t('Screen for the whole group')}
                          value={g.currentScreenId ?? ''}
                          loading={pending}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '__clear__') unassign.mutate(g.id);
                            else if (v) assign.mutate({ id: g.id, screenId: v });
                          }}
                        >
                          <option value="" disabled>
                            {t('Give the group a screen…')}
                          </option>
                          {g.currentScreenId && <option value="__clear__">{t('— Remove screen —')}</option>}
                          {screens.data?.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : (
                      <span className="text-sm">{screens.data?.find((s) => s.id === g.currentScreenId)?.name ?? '—'}</span>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={remove.isPending && remove.variables === g.id}
                        onClick={async () => {
                          const ok = await confirm({
                            title: t('Delete group'),
                            message: t('Delete "{name}"? Devices are kept; they just leave the group. Schedules targeting the group stop applying.', { name: g.name }),
                            confirmLabel: t('Delete'),
                            danger: true,
                          });
                          if (ok) remove.mutate(g.id);
                        }}
                      >
                        {t('Delete')}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, User } from '@/lib/api';
import { useRole } from '@/lib/session';
import { useUsers } from '@/lib/queries';
import { useAction } from '@/lib/hooks';
import { useI18n, useT } from '@/lib/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useConfirm, usePrompt } from '@/components/ui/Confirm';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Input';
import { Menu } from '@/components/ui/Menu';
import { PageHeader, Skeleton } from '@/components/ui/Misc';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { IconPlus } from '@/components/ui/icons';
import { useEffect } from 'react';

type Role = User['role'];

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [error, setError] = useState<string | null>(null);

  const create = useAction(() => api('/users', { method: 'POST', body: JSON.stringify({ email: email.trim(), password, name: name.trim() || undefined, role }) }), {
    invalidate: [['users'], ['admin', 'organizations']],
    success: 'User created',
    onSuccess: () => {
      setEmail('');
      setName('');
      setPassword('');
      setRole('user');
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('New user')}
      description={t('The user gets their own organization. To add someone to an existing organization, invite them from its Team page instead.')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button loading={create.isPending} disabled={!email.includes('@') || password.length < 6} onClick={() => create.mutateAsync().catch((e: Error) => setError(e.message))}>
            {t('Create user')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('Email')} error={error}>
          <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} autoFocus />
        </Field>
        <Field label={t('Name (optional)')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('Password')} hint={t('At least 6 characters')}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label={t('Platform role')}>
          <SegmentedControl<Role>
            value={role}
            onChange={setRole}
            options={[
              { value: 'user', label: t('User') },
              { value: 'superadmin', label: t('Administrator') },
            ]}
          />
        </Field>
      </div>
    </Dialog>
  );
}

export default function AdminUsersPage() {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const { session, isSuperadmin } = useRole();
  const users = useUsers();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (session && !isSuperadmin) router.replace('/devices');
  }, [session, isSuperadmin, router]);

  const changeRole = useAction(({ id, role }: { id: string; role: Role }) => api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }), { invalidate: [['users']], success: 'Role updated' });
  const resetPassword = useAction(({ id, password }: { id: string; password: string }) => api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ password }) }), { success: 'Password updated — their sessions were ended' });
  const remove = useAction((id: string) => api(`/users/${id}`, { method: 'DELETE' }), { invalidate: [['users'], ['admin', 'organizations']], success: 'User deleted' });

  if (!isSuperadmin) return null;
  const list = users.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('Platform')}
        title={t('Users')}
        description={t('Everyone with an account on this installation.')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <IconPlus className="h-4 w-4" /> {t('New user')}
          </Button>
        }
      />

      {users.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {list.map((u) => {
              const self = u.id === session?.user.id;
              return (
                <li key={u.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-semibold uppercase text-ink-2">{(u.name || u.email).slice(0, 2)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {u.name || u.email} {self && <span className="font-normal text-ink-3">({t('you')})</span>}
                      </p>
                      <p className="truncate text-xs text-ink-3">
                        {u.email} · {t('since {date}', { date: new Date(u.createdAt).toLocaleDateString(locale) })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={u.role === 'superadmin' ? 'accent' : 'neutral'}>{u.role === 'superadmin' ? t('Administrator') : t('User')}</Badge>
                    <Menu
                      label={t('User actions')}
                      items={[
                        {
                          label: u.role === 'superadmin' ? t('Make regular user') : t('Make administrator'),
                          onSelect: () => changeRole.mutate({ id: u.id, role: u.role === 'superadmin' ? 'user' : 'superadmin' }),
                        },
                        {
                          label: t('Set new password…'),
                          onSelect: async () => {
                            const password = await prompt({
                              title: t('New password for {email}', { email: u.email }),
                              label: t('Password'),
                              type: 'password',
                              confirmLabel: t('Set password'),
                              validate: (v) => (v.length >= 6 ? null : t('At least 6 characters')),
                            });
                            if (password) resetPassword.mutate({ id: u.id, password });
                          },
                        },
                        {
                          label: t('Delete user'),
                          danger: true,
                          hidden: self,
                          onSelect: async () => {
                            const ok = await confirm({ title: t('Delete user'), message: t('Delete {email} permanently? Organizations only they belong to are deleted too.', { email: u.email }), confirmLabel: t('Delete'), danger: true });
                            if (ok) remove.mutate(u.id);
                          },
                        },
                      ]}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <CreateDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

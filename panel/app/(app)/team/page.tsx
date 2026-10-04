'use client';

import { useEffect, useState } from 'react';
import { api, OrganizationDetail, refreshProfile } from '@/lib/api';
import { useRole } from '@/lib/session';
import { useOrganization } from '@/lib/queries';
import { useAction } from '@/lib/hooks';
import { ROLE_HELP, ROLE_LABEL } from '@/lib/labels';
import { useI18n, useT } from '@/lib/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Section } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/Confirm';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Input';
import { PageHeader, Skeleton } from '@/components/ui/Misc';
import { Select } from '@/components/ui/Select';
import { IconCopy, IconPlus } from '@/components/ui/icons';

type Role = OrganizationDetail['members'][number]['role'];
const ROLES: Role[] = ['owner', 'editor', 'viewer'];

/** All IANA zones the browser knows, with the common ones first for convenience. */
function timeZones(): string[] {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return all.includes('UTC') ? all : ['UTC', ...all];
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invite = useAction(() => api<{ token: string }>('/organization/invitations', { method: 'POST', body: JSON.stringify({ email: email.trim(), role }) }), {
    invalidate: [['organization']],
    onSuccess: (res) => setLink(`${window.location.origin}/invite?token=${res.token}`),
  });

  function close() {
    setEmail('');
    setLink(null);
    setError(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={link ? t('Invitation created') : t('Invite a colleague')}
      description={link ? undefined : t('They get an email with a link to join. The invitation is valid for 7 days.')}
      size="md"
      footer={
        link ? (
          <Button onClick={close}>{t('Done')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              {t('Cancel')}
            </Button>
            <Button loading={invite.isPending} disabled={!email.includes('@')} onClick={() => invite.mutateAsync().catch((e: Error) => setError(e.message))}>
              {t('Send invitation')}
            </Button>
          </>
        )
      }
    >
      {link ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">
            {t('We emailed the link to {email} if email is configured on this server. You can also share it yourself — it is only shown now.', { email })}
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded border border-line bg-sunken px-2 py-2 font-mono text-xs">{link}</code>
            <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(link)}>
              <IconCopy className="h-4 w-4" /> {t('Copy')}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.includes('@')) invite.mutateAsync().catch((err: Error) => setError(err.message));
          }}
        >
          <Field label={t('Email')} error={error}>
            <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} autoFocus placeholder="colleague@company.com" />
          </Field>
          <Field label={t('Role')} hint={t(ROLE_HELP[role])}>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(ROLE_LABEL[r])}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      )}
    </Dialog>
  );
}

export default function TeamPage() {
  const t = useT();
  const { locale } = useI18n();
  const confirm = useConfirm();
  const { session, isOwner } = useRole();
  const org = useOrganization();
  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    if (org.data) {
      setName(org.data.name);
      setTimezone(org.data.timezone);
    }
  }, [org.data]);

  const saveSettings = useAction(() => api('/organization', { method: 'PATCH', body: JSON.stringify({ name: name.trim(), timezone }) }), {
    invalidate: [['organization'], ['schedules']],
    success: 'Organization updated',
    onSuccess: () => void refreshProfile(),
  });
  const setRole = useAction(({ userId, role }: { userId: string; role: Role }) => api(`/organization/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }), {
    invalidate: [['organization']],
    success: 'Role updated',
  });
  const removeMember = useAction((userId: string) => api(`/organization/members/${userId}`, { method: 'DELETE' }), { invalidate: [['organization']], success: 'Member removed' });
  const revoke = useAction((id: string) => api(`/organization/invitations/${id}`, { method: 'DELETE' }), { invalidate: [['organization']], success: 'Invitation revoked' });

  if (!org.data) return <Skeleton className="h-96 w-full" />;
  const data = org.data;
  const changed = name.trim() !== data.name || timezone !== data.timezone;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('Organization')}
        title={t('Team')}
        description={t('Everyone who can work with {name}. Devices, screens and media belong to the organization, not to a person.', { name: data.name })}
        actions={
          isOwner && (
            <Button onClick={() => setInviting(true)}>
              <IconPlus className="h-4 w-4" /> {t('Invite')}
            </Button>
          )
        }
      />

      <Section title={t('Organization')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Name')}>
            <Input value={name} disabled={!isOwner} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t('Time zone')} hint={t('Schedules run on this clock.')}>
            <Select value={timezone} disabled={!isOwner} onChange={(e) => setTimezone(e.target.value)}>
              {timeZones().map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {isOwner && (
          <div className="mt-4">
            <Button loading={saveSettings.isPending} disabled={!changed || !name.trim()} onClick={() => saveSettings.mutate()}>
              {t('Save')}
            </Button>
          </div>
        )}
      </Section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
          {t('Members')} <span className="ml-1 text-ink-3">{data.members.length}</span>
        </h2>
        <Card>
          <ul className="divide-y divide-line">
            {data.members.map((m) => {
              const self = m.userId === session?.user.id;
              return (
                <li key={m.userId} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-semibold uppercase text-ink-2">
                      {(m.name || m.email).slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {m.name || m.email} {self && <span className="font-normal text-ink-3">({t('you')})</span>}
                      </p>
                      <p className="truncate text-xs text-ink-3">
                        {m.email} · {t('joined {date}', { date: new Date(m.joinedAt).toLocaleDateString(locale) })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <div className="w-32">
                        <Select aria-label={t('Role')} value={m.role} onChange={(e) => setRole.mutate({ userId: m.userId, role: e.target.value as Role })}>
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {t(ROLE_LABEL[r])}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : (
                      <Badge tone={m.role === 'owner' ? 'accent' : 'neutral'}>{t(ROLE_LABEL[m.role])}</Badge>
                    )}
                    {(isOwner || self) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const ok = await confirm({
                            title: self ? t('Leave organization') : t('Remove member'),
                            message: self ? t('Leave "{name}"? You lose access to its devices and screens.', { name: data.name }) : t('Remove {email} from the organization?', { email: m.email }),
                            confirmLabel: self ? t('Leave') : t('Remove'),
                            danger: true,
                          });
                          if (ok) removeMember.mutate(m.userId);
                        }}
                      >
                        {self ? t('Leave') : t('Remove')}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      {data.invitations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
            {t('Pending invitations')} <span className="ml-1 text-ink-3">{data.invitations.length}</span>
          </h2>
          <Card>
            <ul className="divide-y divide-line">
              {data.invitations.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.email}</p>
                    <p className="text-xs text-ink-3">
                      {t(ROLE_LABEL[i.role])} · {t('expires {date}', { date: new Date(i.expiresAt).toLocaleDateString(locale) })}
                    </p>
                  </div>
                  {isOwner && (
                    <Button variant="ghost" size="sm" loading={revoke.isPending && revoke.variables === i.id} onClick={() => revoke.mutate(i.id)}>
                      {t('Revoke')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <Section title={t('Roles')}>
        <dl className="grid gap-4 sm:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r}>
              <dt className="text-sm font-medium">{t(ROLE_LABEL[r])}</dt>
              <dd className="mt-0.5 text-xs text-ink-2">{t(ROLE_HELP[r])}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}

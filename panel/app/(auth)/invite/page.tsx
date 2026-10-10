'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getSession, setSession, Session, useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ROLE_LABEL } from '@/lib/labels';

interface InviteInfo {
  organizationName: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  userExists: boolean;
}

function InviteForm() {
  const t = useT();
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const session = useSession();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return setProblem(t('This invitation link is incomplete.'));
    api<InviteInfo>('/auth/invitation/info', { method: 'POST', body: JSON.stringify({ token }), auth: false })
      .then(setInfo)
      .catch((e) => setProblem(e instanceof Error ? e.message : t('Something went wrong')));
  }, [token, t]);

  async function accept(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Sends the current access token when signed in (existing accounts must be signed in as the invitee).
      const next = await api<Session>('/auth/invitation/accept', {
        method: 'POST',
        body: JSON.stringify({ token, password: password || undefined, name: name || undefined }),
        auth: !!getSession(),
      });
      setSession(next);
      router.replace('/devices');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong'));
    } finally {
      setLoading(false);
    }
  }

  if (problem) {
    return (
      <div className="w-full max-w-sm space-y-3">
        <h1 className="text-[28px] font-semibold tracking-tightest">{t('Invitation not valid')}</h1>
        <p className="text-sm text-ink-2">{problem}</p>
        <Link href="/login" className="text-sm text-accent hover:underline">
          {t('Back to sign in')}
        </Link>
      </div>
    );
  }
  if (!info) return <p className="text-sm text-ink-3">{t('Loading…')}</p>;

  const signedInAsInvitee = session?.user.email.toLowerCase() === info.email.toLowerCase();

  return (
    <div className="w-full max-w-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{t('Invitation')}</p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tightest">
        {t('Join {org}', { org: info.organizationName })}
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-2">
        {t('You are invited as')} <Badge tone="accent">{t(ROLE_LABEL[info.role])}</Badge> · {info.email}
      </p>

      {info.userExists ? (
        <div className="mt-8 space-y-4">
          {signedInAsInvitee ? (
            <Button size="lg" loading={loading} onClick={() => accept()} className="w-full">
              {t('Accept invitation')}
            </Button>
          ) : (
            <>
              <p className="text-sm text-ink-2">{t('An account with this email already exists. Sign in to accept the invitation.')}</p>
              <Link
                href={`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`}
                className="inline-flex h-12 w-full items-center justify-center rounded bg-accent-fill px-5 text-[15px] font-medium text-accent-ink hover:bg-accent-fill/90"
              >
                {t('Sign in')}
              </Link>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={accept} className="mt-8 space-y-4">
          <Field label={t('Your name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
          </Field>
          <Field label={t('Choose a password')} hint={t('At least 8 characters')}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
          </Field>
          <Button type="submit" size="lg" loading={loading} className="w-full">
            {t('Create account and join')}
          </Button>
        </form>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteForm />
    </Suspense>
  );
}

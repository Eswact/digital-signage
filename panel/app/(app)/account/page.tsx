'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { api, logout, refreshProfile } from '@/lib/api';
import { setSession, Session, useRole } from '@/lib/session';
import { useAction } from '@/lib/hooks';
import { msg, useT } from '@/lib/i18n';
import { ThemePref, useTheme } from '@/lib/theme';
import { PALETTES } from '@/lib/brand';
import { cn } from '@/lib/cn';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/Confirm';
import { Field, Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/Misc';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Badge } from '@/components/ui/Badge';
import { IconCopy, IconMoon, IconSun, IconSystem } from '@/components/ui/icons';

function PasswordSection() {
  const t = useT();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);

  const change = useAction(() => api<Session>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: next }) }), {
    success: 'Password changed — other devices were signed out',
    onSuccess: (session) => {
      setSession(session);
      setCurrent('');
      setNext('');
      setAgain('');
    },
  });

  return (
    <Section title={t('Password')} description={t('Changing it signs you out everywhere else.')}>
      <form
        className="max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (next !== again) return setError(t('Passwords do not match'));
          setError(null);
          change.mutateAsync().catch((err: Error) => setError(err.message));
        }}
      >
        <Field label={t('Current password')}>
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Field label={t('New password')} hint={t('At least 8 characters')}>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} autoComplete="new-password" required />
        </Field>
        <Field label={t('Repeat new password')} error={error}>
          <Input type="password" value={again} onChange={(e) => setAgain(e.target.value)} minLength={8} autoComplete="new-password" required />
        </Field>
        <Button type="submit" loading={change.isPending}>
          {t('Change password')}
        </Button>
      </form>
    </Section>
  );
}

function TwoFactorSection() {
  const t = useT();
  const { session } = useRole();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const enabled = session?.user.twoFactorEnabled ?? false;

  useEffect(() => {
    if (!setup) return setQr(null);
    QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 192 }).then(setQr, () => setQr(null));
  }, [setup]);


  const start = useAction(() => api<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', { method: 'POST' }), { onSuccess: setSetup });
  const enable = useAction(() => api<{ recoveryCodes: string[] }>('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code: code.trim() }) }), {
    success: 'Two-factor authentication is on',
    onSuccess: async (res) => {
      setRecovery(res.recoveryCodes);
      setSetup(null);
      setCode('');
      await refreshProfile();
    },
  });
  const disable = useAction(() => api('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password, code: code.trim() }) }), {
    success: 'Two-factor authentication is off',
    onSuccess: async () => {
      setDisabling(false);
      setPassword('');
      setCode('');
      await refreshProfile();
    },
  });

  return (
    <Section
      title={t('Two-factor authentication')}
      description={t('Ask for a code from an authenticator app when you sign in.')}
      action={<Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? t('On') : t('Off')}</Badge>}
    >
      {recovery && (
        <div className="mb-5 space-y-3 rounded border border-warn/40 bg-warn-soft p-4">
          <p className="text-sm font-medium text-warn">{t('Save your recovery codes. Each works once if you lose your phone. They are not shown again.')}</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
            {recovery.map((c) => (
              <li key={c} className="rounded bg-surface px-2 py-1.5 ring-1 ring-warn/30">
                {c}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(recovery.join('\n'))}>
              <IconCopy className="h-4 w-4" /> {t('Copy')}
            </Button>
            <Button size="sm" onClick={() => setRecovery(null)}>
              {t('I saved them')}
            </Button>
          </div>
        </div>
      )}

      {!enabled && !setup && (
        <Button loading={start.isPending} onClick={() => start.mutate()}>
          {t('Set up two-factor authentication')}
        </Button>
      )}

      {!enabled && setup && (
        <div className="grid max-w-xl gap-6 sm:grid-cols-[auto_1fr]">
          <div className="h-48 w-48 rounded border border-line bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt="QR code" className="h-full w-full" />}
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              enable.mutateAsync().catch((err: Error) => setError(err.message));
            }}
          >
            <ol className="list-decimal space-y-1 pl-4 text-sm text-ink-2">
              <li>{t('Scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy…).')}</li>
              <li>{t('Enter the 6-digit code it shows.')}</li>
            </ol>
            <p className="break-all font-mono text-xs text-ink-3">
              {t('Or enter this key by hand:')} {setup.secret}
            </p>
            <Field label={t('Verification code')} error={error}>
              <Input value={code} onChange={(e) => { setCode(e.target.value); setError(null); }} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="max-w-40 font-mono tracking-widest" autoFocus />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" loading={enable.isPending} disabled={code.trim().length < 6}>
                {t('Turn on')}
              </Button>
              <Button variant="ghost" onClick={() => setSetup(null)}>
                {t('Cancel')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {enabled && !disabling && (
        <Button variant="secondary" onClick={() => setDisabling(true)}>
          {t('Turn off…')}
        </Button>
      )}
      {enabled && disabling && (
        <form
          className="max-w-sm space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            disable.mutateAsync().catch((err: Error) => setError(err.message));
          }}
        >
          <Field label={t('Password')}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Field label={t('Code from your app (or a recovery code)')} error={error}>
            <Input value={code} onChange={(e) => { setCode(e.target.value); setError(null); }} className="font-mono" required />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={disable.isPending}>
              {t('Turn off')}
            </Button>
            <Button variant="ghost" onClick={() => setDisabling(false)}>
              {t('Cancel')}
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

const MODES: { value: ThemePref; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: msg('Light'), icon: <IconSun className="h-4 w-4" /> },
  { value: 'system', label: msg('System'), icon: <IconSystem className="h-4 w-4" /> },
  { value: 'dark', label: msg('Dark'), icon: <IconMoon className="h-4 w-4" /> },
];

/** Color theme + light/dark mode; kept in this browser (lib/theme). Each theme option shows its app icon. */
function AppearanceSection() {
  const t = useT();
  const { pref, setPref, palette, setPalette } = useTheme();
  return (
    <Section title={t('Appearance')} description={t('Saved in this browser only.')}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium text-ink-2">{t('Color theme')}</p>
          <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={palette === p.id}
                onClick={() => setPalette(p.id)}
                className={cn(
                  'flex items-center gap-3 rounded border bg-surface px-3 py-2.5 text-left text-sm font-medium transition-colors',
                  palette === p.id ? 'border-accent ring-2 ring-accent/20' : 'border-line-strong hover:border-ink-3',
                )}
              >
                <BrandMark size={28} colors={p.icon} className="flex-none" />
                {t(p.label)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-ink-2">{t('Mode')}</p>
          <SegmentedControl<ThemePref>
            value={pref}
            onChange={setPref}
            options={MODES.map((m) => ({ value: m.value, label: t(m.label), icon: m.icon }))}
          />
        </div>
      </div>
    </Section>
  );
}

export default function AccountPage() {
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const { session } = useRole();

  const signOutAll = useAction(() => api('/auth/logout-all', { method: 'POST' }), {
    onSuccess: async () => {
      await logout();
      router.replace('/login');
    },
  });

  if (!session) return null;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('Account')} title={session.user.name || session.user.email} description={session.user.email} actions={session.user.role === 'superadmin' && <Badge tone="accent">{t('Platform administrator')}</Badge>} />

      <AppearanceSection />
      <PasswordSection />
      <TwoFactorSection />

      <Section title={t('Sessions')} description={t('Signed in on a device you no longer use? End every session, including this one.')}>
        <Button
          variant="danger"
          loading={signOutAll.isPending}
          onClick={async () => {
            const ok = await confirm({ title: t('Sign out everywhere'), message: t('All sessions on all devices end, including this one. You will need to sign in again.'), confirmLabel: t('Sign out everywhere'), danger: true });
            if (ok) signOutAll.mutate();
          }}
        >
          {t('Sign out everywhere')}
        </Button>
      </Section>
    </div>
  );
}

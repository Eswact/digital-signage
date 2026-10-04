'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, login, loginTwoFactor, registerFirstUser } from '@/lib/api';
import { getSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

type Step = 'credentials' | 'setup' | 'two-factor';

/** Only same-site relative paths are accepted as the post-login destination. */
const safeNext = (value: string | null) => (value && value.startsWith('/') && !value.startsWith('//') ? value : '/devices');

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));

  const [step, setStep] = useState<Step>('credentials');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getSession()) router.replace(next);
  }, [router, next]);

  // First run: no users yet → the first account becomes the platform administrator.
  useEffect(() => {
    api<{ needsSetup: boolean }>('/auth/setup', { auth: false })
      .then((r) => r.needsSetup && setStep('setup'))
      .catch(() => undefined);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (step === 'setup') {
        await registerFirstUser(email, password, name);
        router.replace(next);
      } else if (step === 'credentials') {
        const res = await login(email, password);
        if ('twoFactorRequired' in res) {
          setChallenge(res.challenge);
          setStep('two-factor');
        } else {
          router.replace(next);
        }
      } else {
        await loginTwoFactor(challenge, code);
        router.replace(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong'));
    } finally {
      setLoading(false);
    }
  }

  const title =
    step === 'setup' ? t('Create the administrator account') : step === 'two-factor' ? t('Two-factor verification') : t('Sign in');
  const subtitle =
    step === 'setup'
      ? t('This is a fresh installation. The first account manages the whole platform.')
      : step === 'two-factor'
        ? t('Enter the 6-digit code from your authenticator app, or one of your recovery codes.')
        : t('Welcome back. Enter your details to continue.');

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tightest">{title}</h1>
      <p className="mt-2 text-sm text-ink-2">{subtitle}</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {step === 'two-factor' ? (
          <Field label={t('Verification code')}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              autoComplete="one-time-code"
              inputMode="text"
              placeholder="123456"
              className="font-mono tracking-widest"
              required
            />
          </Field>
        ) : (
          <>
            {step === 'setup' && (
              <Field label={t('Name')}>
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            <Field label={t('Email')}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                placeholder="you@company.com"
              />
            </Field>
            <Field label={t('Password')}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={step === 'setup' ? 'new-password' : 'current-password'}
                required
                minLength={step === 'setup' ? 6 : undefined}
              />
            </Field>
          </>
        )}

        {error && (
          <p role="alert" className="rounded border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {step === 'setup' ? t('Create account') : step === 'two-factor' ? t('Verify') : t('Sign in')}
        </Button>
      </form>

      {step === 'credentials' && (
        <div className="mt-6 space-y-2 text-sm text-ink-2">
          <Link href="/forgot-password" className="text-accent hover:underline">
            {t('Forgot your password?')}
          </Link>
          <p>{t('No account yet? Ask your administrator for an invitation.')}</p>
        </div>
      )}
      {step === 'two-factor' && (
        <button
          type="button"
          onClick={() => {
            setStep('credentials');
            setCode('');
            setError(null);
          }}
          className="mt-6 text-sm text-accent hover:underline"
        >
          {t('Back to sign in')}
        </button>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

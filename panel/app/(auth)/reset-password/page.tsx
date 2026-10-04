'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

function ResetForm() {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError(t('Passwords do not match'));
    setError(null);
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }), auth: false });
      toast(t('Password updated — sign in with your new password'), 'success');
      router.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm space-y-3">
        <h1 className="text-[28px] font-semibold tracking-tightest">{t('Link not valid')}</h1>
        <p className="text-sm text-ink-2">{t('This reset link is incomplete. Request a new one.')}</p>
        <Link href="/forgot-password" className="text-sm text-accent hover:underline">
          {t('Request a new link')}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tightest">{t('Choose a new password')}</h1>
      <p className="mt-2 text-sm text-ink-2">{t('Signing in on every other device will end.')}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label={t('New password')} hint={t('At least 8 characters')}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoFocus autoComplete="new-password" />
        </Field>
        <Field label={t('Repeat new password')}>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required autoComplete="new-password" />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {t('Update password')}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}

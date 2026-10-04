'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }), auth: false });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tightest">{t('Reset your password')}</h1>
      {sent ? (
        <div className="mt-4 space-y-4 text-sm text-ink-2">
          <p>{t('If an account exists for {email}, a reset link is on its way. It is valid for one hour.', { email })}</p>
          <Link href="/login" className="text-accent hover:underline">
            {t('Back to sign in')}
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-2">{t('Enter your email and we will send you a link to choose a new password.')}</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label={t('Email')}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required autoComplete="username" />
            </Field>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" loading={loading} className="w-full">
              {t('Send reset link')}
            </Button>
          </form>
          <Link href="/login" className="mt-6 inline-block text-sm text-accent hover:underline">
            {t('Back to sign in')}
          </Link>
        </>
      )}
    </div>
  );
}

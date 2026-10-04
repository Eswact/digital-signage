'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useT } from '@/lib/i18n';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  type?: 'text' | 'password';
  /** Return an error string to keep the dialog open. */
  validate?: (value: string) => string | null;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
type PromptFn = (opts: PromptOptions) => Promise<string | null>;

const ConfirmContext = createContext<{ confirm: ConfirmFn; prompt: PromptFn } | null>(null);

type Pending =
  | ({ kind: 'confirm' } & ConfirmOptions)
  | ({ kind: 'prompt' } & PromptOptions);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const resolveRef = useRef<((v: never) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve as (v: never) => void;
      setPending({ kind: 'confirm', ...opts });
    });
  }, []);

  const prompt = useCallback<PromptFn>((opts) => {
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve as (v: never) => void;
      setValue(opts.initial ?? '');
      setError(null);
      setPending({ kind: 'prompt', ...opts });
    });
  }, []);

  const finish = (result: boolean | string | null) => {
    (resolveRef.current as ((v: boolean | string | null) => void) | null)?.(result);
    resolveRef.current = null;
    setPending(null);
  };

  const cancel = () => finish(pending?.kind === 'prompt' ? null : false);

  const submitPrompt = () => {
    if (pending?.kind !== 'prompt') return;
    const problem = pending.validate?.(value) ?? null;
    if (problem) setError(problem);
    else finish(value);
  };

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}
      <Dialog
        open={!!pending}
        onClose={cancel}
        size="sm"
        title={pending?.kind === 'confirm' ? (pending.title ?? t('Are you sure?')) : (pending?.title ?? '')}
        description={pending?.kind === 'confirm' ? pending.message : pending?.message}
        footer={
          pending && (
            <>
              <Button variant="secondary" size="sm" onClick={cancel}>
                {pending.kind === 'confirm' ? (pending.cancelLabel ?? t('Cancel')) : t('Cancel')}
              </Button>
              {pending.kind === 'confirm' ? (
                <Button variant={pending.danger ? 'danger' : 'primary'} size="sm" onClick={() => finish(true)} autoFocus>
                  {pending.confirmLabel ?? t('Confirm')}
                </Button>
              ) : (
                <Button size="sm" onClick={submitPrompt}>
                  {pending.confirmLabel ?? t('Save')}
                </Button>
              )}
            </>
          )
        }
      >
        {pending?.kind === 'prompt' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitPrompt();
            }}
            className="space-y-1.5"
          >
            {pending.label && <label className="block text-[13px] font-medium">{pending.label}</label>}
            <Input
              autoFocus
              type={pending.type ?? 'text'}
              value={value}
              placeholder={pending.placeholder}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
            {error && <p className="text-xs text-danger">{error}</p>}
          </form>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/** `const confirm = useConfirm(); if (await confirm({ message })) …` */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)?.confirm ?? (async (o) => window.confirm(o.message));
}

/** `const prompt = usePrompt(); const name = await prompt({ title: 'Rename' })` → string | null */
export function usePrompt(): PromptFn {
  return useContext(ConfirmContext)?.prompt ?? (async (o) => window.prompt(o.title, o.initial ?? ''));
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage, useToast } from '@/components/ui/Toast';
import { TFunction, useT } from '@/lib/i18n';

/**
 * A mutation that invalidates the given query keys and reports the outcome with a toast.
 * `success`/`failure` are English source strings (translated here); a `success` function
 * receives `t` and returns the final, already translated text.
 */
export function useAction<TVars = void, TRes = unknown>(
  fn: (vars: TVars) => Promise<TRes>,
  opts: {
    invalidate?: string[][];
    success?: string | ((res: TRes, vars: TVars, t: TFunction) => string);
    failure?: string;
    onSuccess?: (res: TRes, vars: TVars) => void;
  } = {},
) {
  const qc = useQueryClient();
  const toast = useToast();
  const t = useT();
  return useMutation({
    mutationFn: fn,
    onSuccess: (res, vars) => {
      opts.invalidate?.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
      if (opts.success) toast(typeof opts.success === 'function' ? opts.success(res, vars, t) : t(opts.success), 'success');
      opts.onSuccess?.(res, vars);
    },
    onError: (err) => toast(errorMessage(err, t(opts.failure ?? 'Something went wrong')), 'error'),
  });
}

import { useEffect, useState } from 'react';

/** `useMediaQuery('(min-width: 1280px)')` — false during SSR/first render. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { API_URL, freshAccessToken } from './api';
import { useSession } from './session';

/**
 * Live updates: the backend streams "something changed" hints (server-sent events,
 * read with fetch so the Authorization header works). Each hint invalidates the
 * matching React Query keys — no data travels on the stream. While the stream is
 * down, queries fall back to polling (`useLiveInterval`).
 */
interface LiveContextValue {
  connected: boolean;
}
const LiveContext = createContext<LiveContextValue>({ connected: false });

type ChangeType = 'devices' | 'screens' | 'screen' | 'groups' | 'media' | 'schedules' | 'organization';

function handleChange(qc: QueryClient, type: ChangeType, id?: string) {
  switch (type) {
    case 'devices':
      qc.invalidateQueries({ queryKey: ['devices'] });
      break;
    case 'screens':
      qc.invalidateQueries({ queryKey: ['screens'] });
      break;
    case 'screen':
      qc.invalidateQueries({ queryKey: ['screens'] });
      if (id) qc.invalidateQueries({ queryKey: ['screen', id] });
      break;
    case 'groups':
      qc.invalidateQueries({ queryKey: ['groups'] });
      break;
    case 'media':
      qc.invalidateQueries({ queryKey: ['media'] });
      qc.invalidateQueries({ queryKey: ['organization'] });
      break;
    case 'schedules':
      qc.invalidateQueries({ queryKey: ['schedules'] });
      break;
    case 'organization':
      qc.invalidateQueries({ queryKey: ['organization'] });
      break;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const session = useSession();
  const userId = session?.user.id;
  const orgId = session?.organization?.id;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    let controller: AbortController | null = null;

    async function run() {
      let delay = 1000;
      while (!stopped) {
        controller = new AbortController();
        try {
          const token = await freshAccessToken();
          if (!token) break;
          const res = await fetch(`${API_URL}/live`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error(`live stream ${res.status}`);
          setConnected(true);
          delay = 1000;
          qc.invalidateQueries(); // resync everything after (re)connecting

          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            let end: number;
            while ((end = buffer.indexOf('\n\n')) >= 0) {
              const block = buffer.slice(0, end);
              buffer = buffer.slice(end + 2);
              if (!/^event: change/m.test(block)) continue;
              const data = /^data: (.*)$/m.exec(block)?.[1];
              if (!data) continue;
              try {
                const evt = JSON.parse(data) as { type: ChangeType; id?: string };
                handleChange(qc, evt.type, evt.id);
              } catch {
                // malformed hint: ignore
              }
            }
          }
        } catch {
          // network error / aborted: fall through to retry
        }
        setConnected(false);
        if (stopped) break;
        await sleep(delay);
        delay = Math.min(delay * 2, 30_000);
      }
    }
    void run();

    return () => {
      stopped = true;
      controller?.abort();
      setConnected(false);
    };
  }, [qc, userId, orgId]);

  return <LiveContext.Provider value={{ connected }}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);

/** `refetchInterval` for a query: off while the live stream is up, `ms` otherwise. */
export function useLiveInterval(ms: number): number | false {
  return useLive().connected ? false : ms;
}

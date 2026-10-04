'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/** Taslağın üst seviye alanlarını günceller (değer ya da önceki taslaktan türetilmiş). */
export type DraftUpdate<T> = (patch: Partial<T> | ((prev: T) => Partial<T>)) => void;

/**
 * Ekran verisinin yerel taslağı + gecikmeli otomatik kayıt.
 *
 * - `update({ key: value })` taslağı hemen günceller, `delay` ms sessizlikten
 *   sonra yalnızca değişen üst seviye anahtarları `save(merge)` ile gönderir.
 * - Sunucudan yeni veri gelirse (polling, ingest) taslak onunla yenilenir;
 *   kullanıcının henüz kaydedilmemiş/gönderilmekte olan anahtarları korunur.
 *   Böylece POS'un eklediği sipariş/sıra, başlık düzenlenirken ezilmez.
 */
export function useScreenDraft<T extends object>(
  remote: T,
  save: (merge: Record<string, unknown>) => Promise<unknown>,
  delay = 400,
) {
  const [draft, setDraft] = useState<T>(remote);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const draftRef = useRef<T>(remote);
  const dirty = useRef(new Set<string>());
  const inflight = useRef(new Set<string>());
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  // Sunucu verisini benimse; yerelde düzenlenen anahtarlar kazanır.
  useEffect(() => {
    const local: Record<string, unknown> = {};
    const current = draftRef.current as Record<string, unknown>;
    for (const k of [...dirty.current, ...inflight.current]) local[k] = current[k];
    const next = { ...remote, ...local } as T;
    draftRef.current = next;
    setDraft(next);
  }, [remote]);

  const flush = useCallback(async () => {
    timer.current = null;
    if (saving.current) {
      // Önceki kayıt bitmeden yenisini gönderme (sıra bozulmasın).
      timer.current = setTimeout(flush, delay);
      return;
    }
    const keys = [...dirty.current];
    if (keys.length === 0) return;
    dirty.current.clear();
    keys.forEach((k) => inflight.current.add(k));
    const current = draftRef.current as Record<string, unknown>;
    const merge = Object.fromEntries(keys.map((k) => [k, current[k] ?? null]));

    saving.current = true;
    setStatus('saving');
    try {
      await saveRef.current(merge);
      setStatus(dirty.current.size > 0 ? 'pending' : 'saved');
    } catch {
      keys.forEach((k) => dirty.current.add(k));
      setStatus('error');
    } finally {
      keys.forEach((k) => inflight.current.delete(k));
      saving.current = false;
    }
  }, [delay]);

  const update: DraftUpdate<T> = useCallback(
    (patch) => {
      const p = typeof patch === 'function' ? patch(draftRef.current) : patch;
      const next = { ...draftRef.current, ...p };
      Object.keys(p).forEach((k) => dirty.current.add(k));
      draftRef.current = next;
      setDraft(next);
      setStatus('pending');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  // Sayfadan çıkarken bekleyen değişikliği kaybetme.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void flush();
      }
    },
    [flush],
  );

  return { draft, update, status };
}

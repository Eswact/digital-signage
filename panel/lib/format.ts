import type { TFunction } from '@/lib/i18n';

/** Relative time: "just now", "5 min ago", "2 d ago". */
export function timeAgo(t: TFunction, iso?: string | null): string {
  if (!iso) return t('never');
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return t('just now');
  if (s < 60) return t('{n} s ago', { n: s });
  const m = Math.floor(s / 60);
  if (m < 60) return t('{n} min ago', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('{n} h ago', { n: h });
  return t('{n} d ago', { n: Math.floor(h / 24) });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

/** 83 → "1:23" ; 3725 → "1:02:05". */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function percent(used: number, max: number): number {
  if (max <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.round((used / max) * 100));
}

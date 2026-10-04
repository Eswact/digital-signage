'use client';

import { useEffect, useState } from 'react';
import { MediaPlayerData } from '@/lib/api';
import { backgroundCss, resolvePalette } from '@/lib/design';
import { MediaBox } from '@/components/media/MediaBox';
import { useT } from '@/lib/i18n';

/** How long a slide stays on screen (seconds): videos play to the end, images use their own or the default time. */
export function slideSeconds(item: MediaPlayerData['items'][number], fallback: number): number {
  if (item.kind === 'video') return Math.max(1, (item.durationMs ?? 10_000) / 1000);
  return Math.max(1, item.durationSec ?? fallback);
}

/**
 * Counterpart of Android MediaPlayerTemplate. Shows one slide at a time; when `playing`
 * it cycles like the device (image time / video length, with the chosen transition).
 * Editors control `index`; thumbnails show the first slide still.
 */
export function MediaPlayerPreview({
  data,
  index = 0,
  playing = false,
  onIndexChange,
  onPan,
}: {
  data: MediaPlayerData;
  index?: number;
  playing?: boolean;
  onIndexChange?: (next: number) => void;
  /** Cover-mode drag in the editor: updates the visible part of the current slide. */
  onPan?: (slideId: string, focalX: number, focalY: number) => void;
}) {
  const t = useT();
  const items = data.items ?? [];
  const palette = resolvePalette(data.appearance);
  const current = items[Math.min(index, items.length - 1)];
  const fallback = data.defaultDurationSec ?? 10;

  // Auto-advance while playing.
  const [, force] = useState(0);
  useEffect(() => {
    if (!playing || !onIndexChange || items.length < 2 || !current) return;
    const id = setTimeout(() => onIndexChange((index + 1) % items.length), slideSeconds(current, fallback) * 1000);
    return () => clearTimeout(id);
  }, [playing, index, items.length, current, fallback, onIndexChange]);
  useEffect(() => force((n) => n + 1), [data.transition]);

  if (!current) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: backgroundCss(palette), color: palette.muted }}>
        <span style={{ fontSize: 'calc(32 * var(--u))', fontFamily: "'SG Roboto', system-ui, sans-serif" }}>{t('No media yet')}</span>
      </div>
    );
  }

  const transition = data.transition ?? 'fade';
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div key={current.id} className={transition === 'fade' ? 'h-full w-full animate-fade-in' : transition === 'slide' ? 'h-full w-full animate-slide-in' : 'h-full w-full'}>
        <MediaBox
          asset={current}
          fit={current.fit ?? 'cover'}
          focalX={current.focalX}
          focalY={current.focalY}
          fill={current.fill ?? 'match'}
          fillColor={current.fillColor}
          playing={playing}
          muted={current.muted ?? true}
          onPan={onPan ? (fx, fy) => onPan(current.id, fx, fy) : undefined}
        />
      </div>
    </div>
  );
}

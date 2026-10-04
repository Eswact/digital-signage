'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Orientation } from '@/lib/api';
import { RESOLUTIONS, Resolution, UNIT_VAR } from '@/lib/design';
import { useT } from '@/lib/i18n';
import { Select } from '@/components/ui/Select';

const CanvasContext = createContext<{ portrait: boolean; unitPx: number }>({
  portrait: false,
  unitPx: 0,
});

/**
 * Orientation of the preview canvas (Android: maxHeight > maxWidth) and the pixel
 * value of one relative unit (for calculations that need measuring, e.g. pagination).
 */
export const useCanvas = () => useContext(CanvasContext);

const STORAGE_KEY = 'signage:preview-res';

function optionsFor(orientation: Orientation): Resolution[] {
  if (orientation === 'landscape') return RESOLUTIONS.filter((r) => r.w > r.h);
  if (orientation === 'portrait') return RESOLUTIONS.filter((r) => r.h > r.w);
  return RESOLUTIONS;
}

function readStored(orientation: Orientation): string | null {
  try {
    return localStorage.getItem(`${STORAGE_KEY}:${orientation}`);
  } catch {
    return null;
  }
}

function store(orientation: Orientation, id: string) {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${orientation}`, id);
  } catch {
    // storage blocked: the choice only lasts for this session
  }
}

/**
 * The drawing surface: fixes the aspect ratio, defines `--u` (short side / 1080)
 * through a container query and provides the canvas context. Templates give all
 * measures in that unit, so every resolution matches the device proportionally.
 */
export function StageCanvas({
  res,
  children,
  onCanvasClick,
  maxWidth,
  className,
}: {
  res: { w: number; h: number };
  children: React.ReactNode;
  onCanvasClick?: () => void;
  /** CSS width cap (editor: derived from viewport height). */
  maxWidth?: string;
  className?: string;
}) {
  const portrait = res.h > res.w;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [unitPx, setUnitPx] = useState(0);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setUnitPx(Math.min(width, height) / 1080);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={`relative overflow-hidden bg-black ring-1 ring-ink/15 ${className ?? ''}`}
      style={{
        aspectRatio: `${res.w} / ${res.h}`,
        width: maxWidth ? `min(100%, ${maxWidth})` : '100%',
        containerType: 'size',
      }}
    >
      <div
        ref={canvasRef}
        onClick={onCanvasClick}
        className="absolute inset-0 overflow-hidden"
        style={{ '--u': UNIT_VAR } as React.CSSProperties}
      >
        <CanvasContext.Provider value={{ portrait, unitPx }}>{children}</CanvasContext.Provider>
      </div>
    </div>
  );
}

/** Preview with a resolution selector (editor). */
export function PreviewStage({
  orientation,
  children,
  onCanvasClick,
  toolbar,
  compact = false,
}: {
  orientation: Orientation;
  children: React.ReactNode;
  onCanvasClick?: () => void;
  /** Extra controls on the right of the header (e.g. play/pause). */
  toolbar?: React.ReactNode;
  /** Smaller stage (phones, where the preview is pinned above the controls). */
  compact?: boolean;
}) {
  const t = useT();
  const options = optionsFor(orientation);
  const [resId, setResId] = useState<string | null>(null);
  useEffect(() => setResId(readStored(orientation)), [orientation]);
  const res = options.find((r) => r.id === resId) ?? options[0];

  const option = (r: Resolution) => (
    <option key={r.id} value={r.id}>
      {t(r.label)} — {r.w}×{r.h}
    </option>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">{t('Preview')}</p>
        <div className="flex items-center gap-2">
          {toolbar}
          <Select
            value={res.id}
            onChange={(e) => {
              setResId(e.target.value);
              store(orientation, e.target.value);
            }}
            className="h-8 max-w-[230px] text-xs"
            aria-label={t('Preview resolution')}
          >
            {orientation === 'auto' ? (
              <>
                <optgroup label={t('Landscape')}>{options.filter((r) => r.w > r.h).map(option)}</optgroup>
                <optgroup label={t('Portrait')}>{options.filter((r) => r.h > r.w).map(option)}</optgroup>
              </>
            ) : (
              options.map(option)
            )}
          </Select>
        </div>
      </div>

      <div className={`flex justify-center rounded-md border border-line bg-sunken ${compact ? 'p-2' : 'p-3'}`}>
        <StageCanvas res={res} onCanvasClick={onCanvasClick} maxWidth={`calc(min(${compact ? '26vh, 260px' : '52vh, 560px'}) * ${res.w / res.h})`} className="rounded-sm shadow-lg">
          {children}
        </StageCanvas>
      </div>

      <p className={`text-center text-xs text-ink-3 ${compact ? 'hidden' : ''}`}>
        {orientation === 'auto'
          ? t('Adaptive: the layout switches between landscape and portrait as the device rotates. Try both here.')
          : t('Sizes scale with the short side of the screen, so proportions hold at every resolution.')}
      </p>
    </div>
  );
}

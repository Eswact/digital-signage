'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CropRect, loadImage } from '@/lib/media';
import { useT, msg } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

type AspectId = 'free' | '16:9' | '9:16' | '4:3' | '1:1' | '32:9' | '9:32';

const ASPECTS: { id: AspectId; label: string; ratio: number | null }[] = [
  { id: 'free', label: msg('Free'), ratio: null },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '32:9', label: msg('Wide banner'), ratio: 32 / 9 },
  { id: '9:32', label: msg('Tall banner'), ratio: 9 / 32 },
];

const MIN = 32; // smallest crop side, natural pixels
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Largest centered rect of `ratio` inside the image. */
function fitRect(iw: number, ih: number, ratio: number | null): CropRect {
  if (!ratio) return { x: 0, y: 0, w: iw, h: ih };
  let w = iw;
  let h = w / ratio;
  if (h > ih) {
    h = ih;
    w = h * ratio;
  }
  return { x: (iw - w) / 2, y: (ih - h) / 2, w, h };
}

type Handle = 'move' | 'tl' | 'tr' | 'bl' | 'br';

/**
 * Crop step shown before an image is uploaded. The rectangle can be moved and
 * resized from its corners, optionally locked to an aspect ratio (a wide banner
 * strip, a square badge, …). Confirming returns the rectangle in natural pixels.
 */
export function CropDialog({
  file,
  initialAspect = 'free',
  onConfirm,
  onUseOriginal,
  onCancel,
}: {
  file: File;
  initialAspect?: AspectId;
  onConfirm: (crop: CropRect) => void;
  onUseOriginal: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [natural, setNatural] = useState<{ w: number; h: number; url: string } | null>(null);
  const [aspect, setAspect] = useState<AspectId>(initialAspect);
  const [rect, setRect] = useState<CropRect>({ x: 0, y: 0, w: 1, h: 1 });
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1); // display px per natural px

  const ratio = ASPECTS.find((a) => a.id === aspect)?.ratio ?? null;

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    loadImage(file)
      .then(({ img, url }) => {
        revoke = url;
        if (cancelled) return URL.revokeObjectURL(url);
        setNatural({ w: img.naturalWidth, h: img.naturalHeight, url });
        setRect(fitRect(img.naturalWidth, img.naturalHeight, ASPECTS.find((a) => a.id === initialAspect)?.ratio ?? null));
      })
      .catch(() => onUseOriginal());
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Display scale follows the stage width.
  useEffect(() => {
    if (!natural || !stage.current) return;
    const el = stage.current;
    const update = () => setScale(el.clientWidth / natural.w);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [natural]);

  function chooseAspect(id: AspectId) {
    setAspect(id);
    if (natural) setRect(fitRect(natural.w, natural.h, ASPECTS.find((a) => a.id === id)?.ratio ?? null));
  }

  function startDrag(e: React.PointerEvent, handle: Handle) {
    if (!natural || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const start = { px: e.clientX, py: e.clientY, rect };
    const { w: iw, h: ih } = natural;

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / scale;
      const dy = (ev.clientY - start.py) / scale;
      const r = start.rect;
      if (handle === 'move') {
        setRect({ ...r, x: clamp(r.x + dx, 0, iw - r.w), y: clamp(r.y + dy, 0, ih - r.h) });
        return;
      }
      // The corner opposite the dragged one stays put.
      const fixedX = handle === 'tl' || handle === 'bl' ? r.x + r.w : r.x;
      const fixedY = handle === 'tl' || handle === 'tr' ? r.y + r.h : r.y;
      const dirX = handle === 'tl' || handle === 'bl' ? -1 : 1;
      const dirY = handle === 'tl' || handle === 'tr' ? -1 : 1;
      let w = clamp(r.w + dirX * dx, MIN, dirX < 0 ? fixedX : iw - fixedX);
      let h = clamp(r.h + dirY * dy, MIN, dirY < 0 ? fixedY : ih - fixedY);
      if (ratio) {
        // Follow the dominant drag direction, then fit inside the available room.
        const roomW = dirX < 0 ? fixedX : iw - fixedX;
        const roomH = dirY < 0 ? fixedY : ih - fixedY;
        if (Math.abs(dx) >= Math.abs(dy * ratio)) h = w / ratio;
        else w = h * ratio;
        if (w > roomW) {
          w = roomW;
          h = w / ratio;
        }
        if (h > roomH) {
          h = roomH;
          w = h * ratio;
        }
        w = Math.max(MIN, w);
        h = Math.max(MIN, h);
      }
      setRect({ x: dirX < 0 ? fixedX - w : fixedX, y: dirY < 0 ? fixedY - h : fixedY, w, h });
    };
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }

  const shade = useMemo(() => 'rgba(0,0,0,.55)', []);
  const handle = (h: Exclude<Handle, 'move'>, cls: string) => (
    <span
      onPointerDown={(e) => startDrag(e, h)}
      className={cn('absolute h-5 w-5 touch-none rounded-sm border-2 border-white bg-accent shadow', cls)}
    />
  );

  return (
    <Dialog
      open
      onClose={onCancel}
      size="lg"
      title={t('Crop image')}
      description={t('Drag the frame, resize it from the corners. The result is what gets uploaded.')}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t('Cancel')}
          </Button>
          <Button variant="secondary" onClick={onUseOriginal}>
            {t('Use original')}
          </Button>
          <Button onClick={() => onConfirm({ x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) })} disabled={!natural}>
            {t('Crop and upload')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => chooseAspect(a.id)}
              className={cn(
                'h-8 rounded border px-3 text-[13px] font-medium',
                aspect === a.id ? 'border-ink bg-ink text-paper' : 'border-line-strong text-ink-2 hover:text-ink',
              )}
            >
              {t(a.label)}
            </button>
          ))}
        </div>

        <div className="flex justify-center rounded border border-line bg-sunken p-2">
          {natural ? (
            <div ref={stage} className="relative select-none" style={{ width: `min(100%, ${natural.w}px, calc(58vh * ${natural.w / natural.h}))` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={natural.url} alt="" draggable={false} className="block w-full" />
              <div
                onPointerDown={(e) => startDrag(e, 'move')}
                className="absolute cursor-move touch-none border-2 border-white"
                style={{
                  left: rect.x * scale,
                  top: rect.y * scale,
                  width: rect.w * scale,
                  height: rect.h * scale,
                  boxShadow: `0 0 0 9999px ${shade}`,
                }}
              >
                {handle('tl', '-left-2.5 -top-2.5 cursor-nwse-resize')}
                {handle('tr', '-right-2.5 -top-2.5 cursor-nesw-resize')}
                {handle('bl', '-bottom-2.5 -left-2.5 cursor-nesw-resize')}
                {handle('br', '-bottom-2.5 -right-2.5 cursor-nwse-resize')}
              </div>
            </div>
          ) : (
            <div className="h-48 animate-pulse" />
          )}
        </div>

        {natural && (
          <p className="text-xs tabular-nums text-ink-3">
            {t('Selection')}: {Math.round(rect.w)} × {Math.round(rect.h)} px · {t('Original')}: {natural.w} × {natural.h} px
          </p>
        )}
      </div>
    </Dialog>
  );
}

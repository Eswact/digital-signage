'use client';

import { useRef } from 'react';
import { AssetRef, Fill, Fit, mediaUrl } from '@/lib/api';
import { cn } from '@/lib/cn';

export interface MediaBoxProps {
  asset: AssetRef | undefined;
  fit?: Fit;
  /** Visible part when `cover`, 0–100 (CSS object-position). */
  focalX?: number;
  focalY?: number;
  fill?: Fill;
  fillColor?: string;
  /** Videos play (preview) or just show their first frame. */
  playing?: boolean;
  muted?: boolean;
  /** Dragging the picture changes the visible part (cover only). */
  onPan?: (focalX: number, focalY: number) => void;
  className?: string;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Renders a library image/video the way the device does (Android MediaBox):
 *  - cover: fills the box, `focal*` picks which part stays visible;
 *  - contain: whole picture visible, the leftover space is filled with a blurred copy
 *    of it ("match"), a color, or left empty.
 * Videos cannot use the blurred copy (too expensive on devices) → they fall back to the color.
 */
export function MediaBox({
  asset,
  fit = 'cover',
  focalX = 50,
  focalY = 50,
  fill = 'match',
  fillColor = '#000000',
  playing = true,
  muted = true,
  onPan,
  className,
}: MediaBoxProps) {
  const box = useRef<HTMLDivElement>(null);
  if (!asset) return <div className={cn('h-full w-full bg-sunken', className)} />;

  const src = mediaUrl(asset.mediaId);
  const isVideo = asset.kind === 'video';
  const blurFill = fit === 'contain' && fill === 'match' && !isVideo;
  const colorFill = fit === 'contain' && (fill === 'color' || (fill === 'match' && isVideo));
  // The device crops videos around their center (ExoPlayer), so the visible part is only adjustable for images.
  const objectPosition = isVideo ? 'center' : `${focalX}% ${focalY}%`;
  const canPan = !!onPan && !isVideo && fit === 'cover' && !!asset.width && !!asset.height;

  function startPan(e: React.PointerEvent<HTMLDivElement>) {
    if (!canPan || e.button !== 0 || !box.current) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    const rect = box.current.getBoundingClientRect();
    const iw = asset!.width!;
    const ih = asset!.height!;
    const scale = Math.max(rect.width / iw, rect.height / ih);
    const overflowX = iw * scale - rect.width;
    const overflowY = ih * scale - rect.height;
    const start = { x: e.clientX, y: e.clientY, fx: focalX, fy: focalY };
    target.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      // Dragging the picture right reveals more of its left side → focal moves the other way.
      const fx = overflowX > 0.5 ? clamp(start.fx - ((ev.clientX - start.x) / overflowX) * 100, 0, 100) : start.fx;
      const fy = overflowY > 0.5 ? clamp(start.fy - ((ev.clientY - start.y) / overflowY) * 100, 0, 100) : start.fy;
      onPan!(Math.round(fx), Math.round(fy));
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

  const common = { objectFit: fit, objectPosition } as const;
  return (
    <div
      ref={box}
      onPointerDown={startPan}
      className={cn('relative h-full w-full overflow-hidden', canPan && 'cursor-grab touch-none active:cursor-grabbing', className)}
      style={{ backgroundColor: colorFill ? fillColor : undefined }}
    >
      {blurFill && asset.avgColor && <div className="absolute inset-0" style={{ backgroundColor: asset.avgColor }} />}
      {blurFill && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl" />
      )}
      {isVideo ? (
        <video
          key={src}
          src={src}
          className="relative h-full w-full"
          style={common}
          muted={muted}
          loop
          playsInline
          autoPlay={playing}
          preload="metadata"
          ref={(el) => {
            if (!el) return;
            if (playing) void el.play().catch(() => undefined);
            else el.pause();
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} className="relative h-full w-full" style={common} />
      )}
    </div>
  );
}

'use client';

import { BulletStyle, InfoBlock, InfoBoardData, Palette } from '@/lib/api';
import {
  BLOCK_DEFAULTS,
  backgroundCss,
  resolvePalette,
  resolveStyle,
  textCss,
  u,
} from '@/lib/design';
import { cn } from '@/lib/cn';
import { useSelection } from '@/components/studio/Selection';
import { useT } from '@/lib/i18n';

export const blockKey = (id: string) => `block:${id}`;

export function bulletMarker(bullet: BulletStyle | undefined, index: number): string {
  switch (bullet ?? 'dot') {
    case 'dash':
      return '–';
    case 'number':
      return `${index + 1}.`;
    case 'check':
      return '✓';
    case 'none':
      return '';
    default:
      return '•';
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const snap = (v: number) => Math.round(v * 2) / 2;

/**
 * Info & announcement board: free-form text/list blocks. In the editor (when
 * `onBlockChange` is given) blocks can be dragged and widened from their right edge.
 * Same layout as Android InfoBoardTemplate: x/y/w are percentages of the template area.
 */
export function InfoBoardPreview({
  data,
  onBlockChange,
}: {
  data: InfoBoardData;
  onBlockChange?: (id: string, patch: Partial<InfoBlock>) => void;
}) {
  const palette = resolvePalette(data.appearance);
  return (
    <div className="relative h-full w-full" style={{ background: backgroundCss(palette) }}>
      {(data.blocks ?? []).map((b) => (
        <BlockView key={b.id} block={b} palette={palette} onChange={onBlockChange} />
      ))}
    </div>
  );
}

function BlockContent({
  block,
  palette,
  placeholder,
}: {
  block: InfoBlock;
  palette: Palette;
  placeholder: boolean;
}) {
  const t = useT();
  const style = resolveStyle(BLOCK_DEFAULTS, block.style);
  if (block.kind === 'list') {
    const items = block.items ?? [];
    if (items.length === 0 && placeholder) {
      return <div style={{ opacity: 0.4 }}>• {t('Item')}</div>;
    }
    return (
      <div className="flex flex-col" style={{ gap: u(style.size * 0.35) }}>
        {items.map((item, i) => {
          const marker = bulletMarker(block.bullet, i);
          return (
            <div key={i} className="flex" style={{ gap: u(style.size * 0.4) }}>
              {marker && (
                <span
                  className="flex-shrink-0"
                  style={{ color: palette.accent, minWidth: u(style.size * 0.8) }}
                >
                  {marker}
                </span>
              )}
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{item}</span>
            </div>
          );
        })}
      </div>
    );
  }
  if (!block.text && placeholder) return <div style={{ opacity: 0.4 }}>{t('Text')}</div>;
  return <div className="whitespace-pre-wrap break-words">{block.text}</div>;
}

function BlockView({
  block,
  palette,
  onChange,
}: {
  block: InfoBlock;
  palette: Palette;
  onChange?: (id: string, patch: Partial<InfoBlock>) => void;
}) {
  const t = useT();
  const sel = useSelection();
  const css = textCss(resolveStyle(BLOCK_DEFAULTS, block.style), palette);
  const position: React.CSSProperties = {
    position: 'absolute',
    left: `${block.x}%`,
    top: `${block.y}%`,
    width: `${block.w}%`,
  };

  if (!sel || !onChange) {
    return (
      <div style={{ ...position, ...css }}>
        <BlockContent block={block} palette={palette} placeholder={false} />
      </div>
    );
  }

  const key = blockKey(block.id);
  const active = sel.selected === key;

  function startDrag(e: React.PointerEvent<HTMLElement>, mode: 'move' | 'resize') {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    sel!.select(key);
    const target = e.currentTarget;
    const canvas = target.closest('[data-canvas]');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, x: block.x, y: block.y, w: block.w };
    target.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - start.px) / rect.width) * 100;
      const dy = ((ev.clientY - start.py) / rect.height) * 100;
      if (mode === 'move') {
        onChange!(block.id, {
          x: clamp(snap(start.x + dx), 0, 100 - start.w),
          y: clamp(snap(start.y + dy), 0, 98),
        });
      } else {
        onChange!(block.id, { w: clamp(snap(start.w + dx), 5, 100 - start.x) });
      }
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

  return (
    <div
      style={{ ...position, ...css }}
      onPointerDown={(e) => startDrag(e, 'move')}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'cursor-move touch-none select-none rounded-[2px] outline-offset-2',
        active
          ? 'outline outline-2 outline-accent'
          : 'hover:outline hover:outline-1 hover:outline-dashed hover:outline-accent/70',
      )}
    >
      <BlockContent block={block} palette={palette} placeholder />
      {active && (
        <span
          onPointerDown={(e) => startDrag(e, 'resize')}
          title={t('Width')}
          className="absolute -right-[7px] top-1/2 h-6 w-3 -translate-y-1/2 cursor-ew-resize rounded-sm border border-white bg-accent shadow"
        />
      )}
    </div>
  );
}

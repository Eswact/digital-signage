'use client';

import { useEffect, useRef, useState } from 'react';
import { OrderBoardData, OrderColumn, OrderItem, Palette } from '@/lib/api';
import {
  FONTS,
  ORDER_BOARD_ELEMENTS,
  backgroundCss,
  elementCss,
  resolvePalette,
  resolveStyle,
  u,
} from '@/lib/design';
import { Sel } from '@/components/studio/Selection';
import { useCanvas } from '@/components/studio/PreviewStage';
import { useI18n } from '@/lib/i18n';

/*
 * Pagination measures (relative units) — same formula as Android OrderBoardTemplate.
 * Text line height = size × 1.2.
 */
const headerHeightU = (headerSize: number) => 14 * 2 + Math.max(headerSize * 1.2, 24 * 1.2 + 4);
const cardHeightU = (codeSize: number, labelSize: number | null) =>
  14 * 2 + codeSize * 1.2 + (labelSize != null ? 4 + labelSize * 1.2 : 0);
function pageCapacity(columnU: number, headerU: number, cardU: number) {
  const avail = columnU - headerU - 12 * 2;
  return Math.max(1, Math.floor((avail + 12) / (cardU + 12)));
}

const sizeOf = (data: OrderBoardData, key: string) =>
  resolveStyle(ORDER_BOARD_ELEMENTS.find((e) => e.key === key)!.defaults, data.styles?.[key]).size;

/** All columns turn their page at the same moment. */
function usePageTick(seconds: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), Math.max(3, seconds) * 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return tick;
}

function useClock() {
  const { locale } = useI18n();
  const [t, setT] = useState('');
  useEffect(() => {
    const f = () =>
      setT(
        new Date().toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    f();
    const id = setInterval(f, 10000);
    return () => clearInterval(id);
  }, [locale]);
  return t;
}

/** One-to-one counterpart of the Android OrderBoardTemplate layout (relative units). */
export function OrderBoardPreview({ data }: { data: OrderBoardData }) {
  const columns = data.columns ?? [];
  const orders = data.orders ?? [];
  const showLabel = data.showLabel ?? true;
  const showClock = data.showClock ?? true;
  const palette = resolvePalette(data.appearance);
  const css = (key: string) =>
    elementCss(ORDER_BOARD_ELEMENTS, key, data.styles, palette);
  const clock = useClock();
  const pageTick = usePageTick(data.pageSeconds ?? 8);

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ background: backgroundCss(palette), padding: u(32) }}
    >
      {/* Top bar */}
      {(data.title || showClock) && (
        <div
          className="flex items-center"
          style={{ marginBottom: u(24), padding: `0 ${u(6)}`, gap: u(16) }}
        >
          <Sel k="title" className="min-w-0 flex-1 truncate" style={css('title')}>
            {data.title || '\u00a0'}
          </Sel>
          {showClock && (
            <Sel k="clock" className="tabular-nums" style={css('clock')}>
              {clock}
            </Sel>
          )}
        </div>
      )}

      {/* Columns */}
      <div
        className="grid min-h-0 flex-1"
        style={{
          gap: u(20),
          gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0,1fr))`,
        }}
      >
        {columns.map((col) => (
          <BoardColumn
            key={col.id}
            col={col}
            items={orders.filter((o) => o.columnId === col.id)}
            data={data}
            palette={palette}
            showLabel={showLabel}
            pageTick={pageTick}
            css={css}
          />
        ))}
      </div>
    </div>
  );
}

function BoardColumn({
  col,
  items,
  data,
  palette,
  showLabel,
  pageTick,
  css,
}: {
  col: OrderColumn;
  items: OrderItem[];
  data: OrderBoardData;
  palette: Palette;
  showLabel: boolean;
  pageTick: number;
  css: (key: string) => React.CSSProperties;
}) {
  const accent = col.accent ?? palette.accent;
  const { unitPx } = useCanvas();
  const ref = useRef<HTMLDivElement>(null);
  const [heightPx, setHeightPx] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setHeightPx(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Orders that do not fit are paginated (same calculation as Android).
  const capacity =
    unitPx > 0 && heightPx > 0
      ? pageCapacity(
          heightPx / unitPx,
          headerHeightU(sizeOf(data, 'columnHeader')),
          cardHeightU(sizeOf(data, 'orderCode'), showLabel ? sizeOf(data, 'orderLabel') : null),
        )
      : Math.max(items.length, 1);
  const pages: OrderItem[][] = [];
  for (let i = 0; i < items.length; i += capacity) pages.push(items.slice(i, i + capacity));
  if (pages.length === 0) pages.push([]);
  const page = pageTick % pages.length;

  return (
    <div
      ref={ref}
      className="flex min-h-0 flex-col overflow-hidden"
      style={{ borderRadius: u(24), backgroundColor: palette.surface }}
    >
      <div
        className="flex items-center"
        style={{ backgroundColor: accent, padding: `${u(14)} ${u(20)}`, gap: u(12) }}
      >
        <Sel k="columnHeader" className="min-w-0 flex-1 truncate" style={css('columnHeader')}>
          {col.title}
        </Sel>
        {pages.length > 1 && (
          <span
            style={{
              color: 'rgba(255,255,255,.8)',
              fontSize: u(22),
              fontFamily: FONTS.roboto.css,
              lineHeight: 1.2,
            }}
          >
            {page + 1}/{pages.length}
          </span>
        )}
        <span
          className="rounded-full font-bold text-white"
          style={{
            backgroundColor: 'rgba(0,0,0,.2)',
            padding: `${u(2)} ${u(12)}`,
            fontSize: u(24),
            fontFamily: FONTS.roboto.css,
            lineHeight: 1.2,
          }}
        >
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center"
          style={{ color: palette.muted, fontSize: u(40) }}
        >
          —
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden" style={{ padding: u(12), gap: u(12) }}>
          {pages[page].map((o) => (
            <div
              key={o.id}
              className="flex flex-shrink-0 overflow-hidden"
              style={{ borderRadius: u(18), backgroundColor: palette.card }}
            >
              <div style={{ width: u(6), backgroundColor: accent }} />
              <div className="min-w-0 flex-1" style={{ padding: `${u(14)} ${u(20)}` }}>
                <Sel k="orderCode" className="whitespace-nowrap" style={css('orderCode')}>
                  {o.code || '\u00a0'}
                </Sel>
                {showLabel && o.label && (
                  <Sel
                    k="orderLabel"
                    className="truncate"
                    style={{ ...css('orderLabel'), marginTop: u(4) }}
                  >
                    {o.label}
                  </Sel>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

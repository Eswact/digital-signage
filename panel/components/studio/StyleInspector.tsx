'use client';

import { ElementStyle, ElementStyles, Palette, TextAlign } from '@/lib/api';
import { ElementSpec, FONTS, FONT_KEYS, StyleSpec, WEIGHTS, resolveColor, resolveStyle } from '@/lib/design';
import { useT, msg } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ColorInput } from '@/components/ui/ColorInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { IconX } from '@/components/ui/icons';

const TOKEN_CHIPS: { token: string; label: string }[] = [
  { token: 'text', label: msg('Text') },
  { token: 'muted', label: msg('Secondary') },
  { token: 'accent', label: msg('Accent') },
];

/** Frame of an inspector: micro-label, title, optional "reset", close button. */
export function InspectorCard({
  title,
  onClose,
  onReset,
  children,
}: {
  title: string;
  onClose: () => void;
  onReset?: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <Card>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t('Selected element')}</p>
          <h3 className="truncate font-semibold">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {onReset && (
            <button type="button" onClick={onReset} className="rounded px-2 py-1 text-xs text-ink-2 hover:bg-sunken hover:text-ink">
              {t('Reset to default')}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label={t('Close')} className="rounded p-1.5 text-ink-3 hover:bg-sunken hover:text-ink">
            <IconX className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </Card>
  );
}

/**
 * Text style of the selected element: font, size, weight, color, alignment, italic.
 * Only properties that differ from the default are kept in `value`.
 */
export function StyleInspector({
  title,
  defaults,
  value,
  palette,
  onChange,
  onClose,
  children,
}: {
  title: string;
  defaults: StyleSpec;
  value?: ElementStyle;
  palette: Palette;
  onChange: (next: ElementStyle | undefined) => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const t = useT();
  const eff = resolveStyle(defaults, value);
  const set = (patch: ElementStyle) => onChange({ ...(value ?? {}), ...patch });
  const customized = !!value && Object.keys(value).length > 0;

  return (
    <InspectorCard title={title} onClose={onClose} onReset={customized ? () => onChange(undefined) : undefined}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t('Font')}</Label>
          <Select value={eff.font} onChange={(e) => set({ font: e.target.value as StyleSpec['font'] })} style={{ fontFamily: FONTS[eff.font]?.css }}>
            {FONT_KEYS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: FONTS[f].css }}>
                {t(FONTS[f].label)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('Weight')}</Label>
          <Select value={eff.weight} onChange={(e) => set({ weight: Number(e.target.value) })}>
            {WEIGHTS.map((w) => (
              <option key={w.value} value={w.value}>
                {t(w.label)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t('Size')}</Label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={8}
            max={600}
            value={eff.size}
            onChange={(e) => set({ size: Number(e.target.value) })}
            className="flex-1 accent-[rgb(var(--accent))]"
            aria-label={t('Size')}
          />
          <input
            type="number"
            min={8}
            max={1200}
            value={eff.size}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0) set({ size: n });
            }}
            className="h-9 w-20 rounded border border-line-strong bg-surface px-2 text-right text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t('Color')}</Label>
        <div className="flex flex-wrap gap-1.5">
          {TOKEN_CHIPS.map((c) => (
            <button
              key={c.token}
              type="button"
              onClick={() => set({ color: c.token })}
              className={cn(
                'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs',
                eff.color === c.token ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong text-ink-2 hover:text-ink',
              )}
            >
              <span className="h-3 w-3 rounded-full ring-1 ring-black/15" style={{ backgroundColor: resolveColor(c.token, palette) }} />
              {t('Theme')}: {t(c.label)}
            </button>
          ))}
        </div>
        <ColorInput value={resolveColor(eff.color, palette)} onChange={(hex) => set({ color: hex })} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<TextAlign>
          value={eff.align}
          onChange={(align) => set({ align })}
          options={[
            { value: 'start', label: t('Left') },
            { value: 'center', label: t('Center') },
            { value: 'end', label: t('Right') },
          ]}
        />
        <button
          type="button"
          onClick={() => set({ italic: !eff.italic })}
          className={cn(
            'h-9 rounded border px-3 text-sm italic',
            eff.italic ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong text-ink-2 hover:text-ink',
          )}
        >
          {t('Italic')}
        </button>
      </div>

      {children && <div className="space-y-4 border-t border-line pt-4">{children}</div>}
    </InspectorCard>
  );
}

/** Inspector for a template's fixed elements (title, number…); styles live in the `styles` map. */
export function ElementInspector({
  elements,
  styles,
  palette,
  selected,
  onChange,
  onClose,
}: {
  elements: ElementSpec[];
  styles?: ElementStyles;
  palette: Palette;
  selected: string | null;
  onChange: (styles: ElementStyles) => void;
  onClose: () => void;
}) {
  const t = useT();
  const el = elements.find((e) => e.key === selected);
  if (!el) return null;
  return (
    <StyleInspector
      title={t(el.label)}
      defaults={el.defaults}
      value={styles?.[el.key]}
      palette={palette}
      onClose={onClose}
      onChange={(style) => {
        const next = { ...(styles ?? {}) };
        if (style) next[el.key] = style;
        else delete next[el.key];
        onChange(next);
      }}
    />
  );
}

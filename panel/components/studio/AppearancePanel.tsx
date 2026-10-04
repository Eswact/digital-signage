'use client';

import { Appearance, ColorToken, ThemeMode } from '@/lib/api';
import { COLOR_TOKENS, PRESETS, backgroundCss, defaultPreset, findPreset, resolvePalette } from '@/lib/design';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Section } from '@/components/ui/Card';
import { ColorInput } from '@/components/ui/ColorInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

/** Light/dark mode, ready-made themes and custom colors (all templates). */
export function AppearancePanel({ value, onChange }: { value?: Appearance; onChange: (next: Appearance) => void }) {
  const t = useT();
  const preset = findPreset(value);
  const palette = resolvePalette(value);
  const colors = value?.colors ?? {};

  function setColor(key: ColorToken, hex: string | null) {
    const next = { ...colors };
    if (hex) next[key] = hex;
    else delete next[key];
    onChange({ mode: preset.mode, preset: preset.id, colors: next });
  }

  return (
    <div className="space-y-4">
      <Section
        title={t('Theme')}
        action={
          <SegmentedControl<ThemeMode>
            size="sm"
            value={preset.mode}
            onChange={(mode) => onChange({ mode, preset: defaultPreset(mode).id })}
            options={[
              { value: 'dark', label: t('Dark') },
              { value: 'light', label: t('Light') },
            ]}
          />
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRESETS.filter((p) => p.mode === preset.mode).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ mode: p.mode, preset: p.id })}
              className={cn(
                'overflow-hidden rounded border text-left transition-shadow',
                p.id === preset.id ? 'border-accent ring-2 ring-accent/30' : 'border-line-strong hover:border-ink-3',
              )}
            >
              <div className="flex h-14 items-end justify-between p-2" style={{ background: backgroundCss(p.palette) }}>
                <span className="text-lg font-bold leading-none" style={{ color: p.palette.text }}>
                  Aa
                </span>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.palette.accent }} />
              </div>
              <div className="px-2 py-1.5 text-xs font-medium text-ink">{t(p.label)}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section
        title={t('Custom colors')}
        description={t('Applied on top of the selected theme; picking another theme resets them.')}
        action={
          Object.keys(colors).length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ mode: preset.mode, preset: preset.id })}
              className="rounded px-2 py-1 text-xs text-ink-2 hover:bg-sunken hover:text-ink"
            >
              {t('Reset all')}
            </button>
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {COLOR_TOKENS.map((c) => (
            <div key={c.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-2">{t(c.label)}</span>
                {colors[c.key] && (
                  <button type="button" onClick={() => setColor(c.key, null)} className="text-[11px] text-ink-3 hover:text-ink">
                    {t('reset')}
                  </button>
                )}
              </div>
              <ColorInput value={palette[c.key]} onChange={(hex) => setColor(c.key, hex)} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

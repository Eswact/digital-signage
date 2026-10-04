import type { CSSProperties } from 'react';
import type {
  Appearance,
  Orientation,
  ColorToken,
  ElementStyle,
  FontKey,
  Palette,
  TextAlign,
  ThemeMode,
} from '@/lib/api';
import { DESIGN_TOKENS, TokenElement } from '@/lib/design-tokens';
import { msg } from '@/lib/i18n';

/*
 * Screen design system. Themes and element defaults are generated from
 * shared/design-tokens.json (lib/design-tokens.ts; Android DesignTokens.kt comes
 * from the same source). Layout measures (padding, gaps) must stay identical
 * between the previews and the Android templates.
 */

// --- Relative unit ---
// All sizes assume the screen's short side = 1080. The preview frame defines
// `--u` through a container query (`cqmin`).

/** Converts n relative units to a CSS length. */
export const u = (n: number) => `calc(${n} * var(--u))`;

export const UNIT_VAR = 'calc(100cqmin / 1080)';

// --- Fonts (panel/public/fonts + android assets/fonts) ---

export const FONTS: Record<FontKey, { label: string; css: string }> = {
  roboto: { label: msg('Roboto'), css: "'SG Roboto', system-ui, sans-serif" },
  inter: { label: msg('Inter'), css: "'SG Inter', system-ui, sans-serif" },
  montserrat: { label: msg('Montserrat'), css: "'SG Montserrat', system-ui, sans-serif" },
  oswald: { label: msg('Oswald (condensed)'), css: "'SG Oswald', system-ui, sans-serif" },
  bebas: { label: msg('Bebas Neue (display)'), css: "'SG Bebas Neue', system-ui, sans-serif" },
  playfair: { label: msg('Playfair Display (serif)'), css: "'SG Playfair Display', Georgia, serif" },
  mono: { label: msg('Roboto Mono (numbers)'), css: "'SG Roboto Mono', ui-monospace, monospace" },
};

export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

export const WEIGHTS: { value: number; label: string }[] = [
  { value: 400, label: msg('Regular') },
  { value: 500, label: msg('Medium') },
  { value: 600, label: msg('Semibold') },
  { value: 700, label: msg('Bold') },
  { value: 800, label: msg('Extra bold') },
  { value: 900, label: msg('Black') },
];

// --- Themes ---

export interface ThemePreset {
  id: string;
  label: string;
  mode: ThemeMode;
  palette: Palette;
}

export const PRESETS: ThemePreset[] = DESIGN_TOKENS.presets;

export const COLOR_TOKENS: { key: ColorToken; label: string }[] = [
  { key: 'background', label: msg('Background') },
  { key: 'background2', label: msg('Background (gradient end)') },
  { key: 'surface', label: msg('Panel') },
  { key: 'card', label: msg('Card') },
  { key: 'text', label: msg('Text') },
  { key: 'muted', label: msg('Secondary text') },
  { key: 'accent', label: msg('Accent') },
];

export function defaultPreset(mode: ThemeMode): ThemePreset {
  return PRESETS.find((p) => p.mode === mode)!;
}

export function findPreset(appearance?: Appearance): ThemePreset {
  const mode = appearance?.mode === 'light' ? 'light' : 'dark';
  return PRESETS.find((p) => p.id === appearance?.preset) ?? defaultPreset(mode);
}

export function resolvePalette(appearance?: Appearance): Palette {
  return { ...findPreset(appearance).palette, ...(appearance?.colors ?? {}) };
}

/** A color value is either hex or a palette key. */
export function resolveColor(color: string, palette: Palette): string {
  if (color.startsWith('#')) return color;
  return palette[color as ColorToken] ?? palette.text;
}

// --- Element styles ---

export interface StyleSpec {
  font: FontKey;
  size: number;
  weight: number;
  color: string;
  italic: boolean;
  align: TextAlign;
}

export interface ElementSpec {
  key: string;
  label: string;
  defaults: StyleSpec;
}

const toSpec = (e: Omit<TokenElement, 'key' | 'label'>): StyleSpec => ({
  font: e.font,
  size: e.size,
  weight: e.weight,
  color: e.color,
  italic: false,
  align: e.align,
});

const toElements = (list: TokenElement[]): ElementSpec[] =>
  list.map((e) => ({ key: e.key, label: e.label, defaults: toSpec(e) }));

export const ORDER_BOARD_ELEMENTS = toElements(DESIGN_TOKENS.elements['order-board']);

export const QUEUE_ELEMENTS = toElements(DESIGN_TOKENS.elements['queue-number']);

/** Default style of info-board blocks (text and list). */
export const BLOCK_DEFAULTS: StyleSpec = toSpec(DESIGN_TOKENS.blockDefaults);

export function resolveStyle(defaults: StyleSpec, override?: ElementStyle): StyleSpec {
  return { ...defaults, ...(override ?? {}) } as StyleSpec;
}

const ALIGN_CSS: Record<TextAlign, CSSProperties['textAlign']> = {
  start: 'left',
  center: 'center',
  end: 'right',
};

/** Turns a resolved style into CSS (Android: TextStyle). */
export function textCss(style: StyleSpec, palette: Palette): CSSProperties {
  return {
    fontFamily: FONTS[style.font]?.css ?? FONTS.roboto.css,
    fontSize: u(style.size),
    fontWeight: style.weight,
    fontStyle: style.italic ? 'italic' : 'normal',
    color: resolveColor(style.color, palette),
    textAlign: ALIGN_CSS[style.align],
    lineHeight: 1.2,
  };
}

/** Ready CSS for a template element: default + user style. */
export function elementCss(
  elements: ElementSpec[],
  key: string,
  styles: Record<string, ElementStyle> | undefined,
  palette: Palette,
): CSSProperties {
  const el = elements.find((e) => e.key === key);
  if (!el) return {};
  return textCss(resolveStyle(el.defaults, styles?.[key]), palette);
}

export function backgroundCss(palette: Palette): string {
  return `linear-gradient(180deg, ${palette.background}, ${palette.background2})`;
}

// --- Preview resolutions ---

export interface Resolution {
  id: string;
  label: string;
  w: number;
  h: number;
}

export const RESOLUTIONS: Resolution[] = [
  { id: 'tv-fhd', label: msg('TV Full HD'), w: 1920, h: 1080 },
  { id: 'tv-4k', label: msg('TV 4K'), w: 3840, h: 2160 },
  { id: 'tv-hd', label: msg('TV HD'), w: 1280, h: 720 },
  { id: 'tab-10', label: msg('Tablet 10" (16:10)'), w: 1920, h: 1200 },
  { id: 'tab-8', label: msg('Tablet 8" (16:10)'), w: 1280, h: 800 },
  { id: 'tab-43', label: msg('Tablet 4:3'), w: 2048, h: 1536 },
  { id: 'phone', label: msg('Phone (20:9)'), w: 2400, h: 1080 },
  { id: 'bar', label: msg('Ultra-wide strip (32:9)'), w: 3840, h: 1080 },
  { id: 'kiosk-fhd', label: msg('Portrait kiosk Full HD'), w: 1080, h: 1920 },
  { id: 'kiosk-4k', label: msg('Portrait kiosk 4K'), w: 2160, h: 3840 },
  { id: 'tab-10-p', label: msg('Tablet 10" portrait'), w: 1200, h: 1920 },
  { id: 'tab-8-p', label: msg('Tablet 8" portrait'), w: 800, h: 1280 },
  { id: 'tab-43-p', label: msg('Tablet 4:3 portrait'), w: 1536, h: 2048 },
  { id: 'phone-p', label: msg('Phone portrait'), w: 1080, h: 2400 },
];

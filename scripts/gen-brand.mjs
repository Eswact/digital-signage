// shared/brand.json → the logo and colour themes for the panel and the Android app.
// The mark is drawn from parameters (100-unit thinking, like the design tokens), so the favicon,
// the panel's Brand, the launcher icon, the TV banner and the pairing screen are the same drawing.
// The generated files are never edited by hand.
//
//   node scripts/gen-brand.mjs           # write the files
//   node scripts/gen-brand.mjs --check   # exit code 1 when stale (CI)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = JSON.parse(readFileSync(join(root, 'shared/brand.json'), 'utf8'));
const SOURCE = 'GENERATED — do not edit by hand. Source: shared/brand.json · Regenerate: node scripts/gen-brand.mjs';

const n = (v) => String(+v.toFixed(2));
const palette = (id) => brand.palettes.find((p) => p.id === id);
const DEFAULT = palette(brand.defaultPalette);

// ---------- Mark geometry (mark units: the D is `width` × `height`) ----------

function buildMark(m) {
  const H = m.dHeight, R = H / 2, flat = m.dFlat, rc = m.dCornerRadius;
  const rows = m.s.length, cols = m.s[0].length;
  const pitch = m.sHeight / (rows - 1 + 2 * m.pixelRatio), r = pitch * m.pixelRatio;
  const x0 = m.sCenterX - ((cols - 1) * pitch) / 2, y0 = R - ((rows - 1) * pitch) / 2;
  const inset = r + m.pixelInset;
  // A pixel belongs to the grid when its centre is inside the D shrunk by `inset` (so the whole square stays inside).
  const inD = (x, y) => x >= inset && y >= inset && y <= H - inset && (x <= flat || (x - flat) ** 2 + (y - R) ** 2 <= (R - inset) ** 2);
  const pixels = [];
  const span = Math.ceil(H / pitch);
  for (let j = -span; j < rows + span; j++) {
    for (let i = -span; i < cols + span; i++) {
      const x = x0 + i * pitch, y = y0 + j * pitch;
      if (!inD(x, y)) continue;
      const inS = j >= 0 && j < rows && i >= 0 && i < cols;
      pixels.push({ x: x - r, y: y - r, lit: inS && m.s[j][i] === 'X', accent: j === m.accentPixel[0] && i === m.accentPixel[1] });
    }
  }
  const rect = ({ x, y }) => {
    const s = 2 * r, k = r * m.pixelCorner;
    return `M${n(x + k)} ${n(y)}H${n(x + s - k)}A${n(k)} ${n(k)} 0 0 1 ${n(x + s)} ${n(y + k)}V${n(y + s - k)}A${n(k)} ${n(k)} 0 0 1 ${n(x + s - k)} ${n(y + s)}H${n(x + k)}A${n(k)} ${n(k)} 0 0 1 ${n(x)} ${n(y + s - k)}V${n(y + k)}A${n(k)} ${n(k)} 0 0 1 ${n(x + k)} ${n(y)}Z`;
  };
  const outline = `M${rc} 0H${flat}A${R} ${R} 0 0 1 ${flat} ${H}H${rc}A${rc} ${rc} 0 0 1 0 ${H - rc}V${rc}A${rc} ${rc} 0 0 1 ${rc} 0Z`;
  return {
    width: flat + R,
    height: H,
    // The D with every pixel cut out (even-odd): lit pixels show whatever is behind the mark (the plate).
    body: outline + pixels.map(rect).join(''),
    // Unlit pixels are filled back in with the D's colour at `unlitAlpha`.
    unlit: pixels.filter((p) => !p.lit).map(rect).join(''),
    accent: pixels.filter((p) => p.lit && p.accent).map(rect).join(''),
    unlitAlpha: m.unlitAlpha,
  };
}
const MARK = buildMark(brand.mark);

/** Scale + offset that puts the mark `height` units tall, centred on (cx, cy). */
function place(height, cx, cy) {
  const s = height / MARK.height;
  return { s, x: cx - (MARK.width * s) / 2, y: cy - height / 2 };
}

// ---------- Panel ----------

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const channels = (hex) => rgb(hex).join(' ');
const mix = (hex, over, t) => {
  const a = rgb(hex), b = rgb(over);
  return a.map((v, i) => Math.round(b[i] + (v - b[i]) * t)).join(' ');
};
function cssTokens(t, dark) {
  return [
    ['paper', channels(t.paper)], ['surface', channels(t.surface)], ['sunken', channels(t.sunken)],
    ['line', channels(t.line)], ['line-strong', channels(t.lineStrong)],
    ['ink', channels(t.ink)], ['ink-2', channels(t.ink2)], ['ink-3', channels(t.ink3)],
    ['accent', channels(t.accent)], ['accent-soft', mix(t.accent, t.surface, dark ? 0.18 : 0.1)],
    ['accent-fill', channels(t.accentFill)], ['accent-ink', channels(t.accentInk)], ['brand-hi', channels(t.brandHi)],
  ].map(([k, v]) => `  --${k}: ${v};`).join('\n');
}

function paletteCss() {
  const blocks = [
    `/* ${SOURCE}\n * Colour themes: the default (${DEFAULT.id}) on :root / .dark, the others under [data-palette] on <html>\n * (set before first paint by lib/theme THEME_INIT_SCRIPT). Space-separated RGB so Tailwind can add opacity. */`,
    `:root {\n${cssTokens(DEFAULT.light, false)}\n}`,
    `.dark {\n${cssTokens(DEFAULT.dark, true)}\n}`,
  ];
  for (const p of brand.palettes.filter((q) => q !== DEFAULT)) {
    blocks.push(`[data-palette='${p.id}'] {\n${cssTokens(p.light, false)}\n}`);
    blocks.push(`.dark[data-palette='${p.id}'] {\n${cssTokens(p.dark, true)}\n}`);
  }
  return blocks.join('\n\n') + '\n';
}

function brandTs() {
  const ids = brand.palettes.map((p) => `'${p.id}'`).join(' | ');
  const list = brand.palettes.map((p) => `  { id: '${p.id}', label: msg('${p.label}'), icon: ${JSON.stringify(p.icon)} },`).join('\n');
  return `// ${SOURCE}
import { msg } from '@/lib/i18n';

/**
 * The logo mark in its own units (the D is \`width\` × \`height\`): \`body\` is the D with every LED pixel cut out
 * (fill-rule even-odd, so the plate shows through the lit S), \`unlit\` fills the unlit pixels back in at \`unlitAlpha\`,
 * \`accent\` is the highlighted pixel.
 */
export const BRAND_MARK = {
  width: ${n(MARK.width)},
  height: ${n(MARK.height)},
  unlitAlpha: ${MARK.unlitAlpha},
  body: '${MARK.body}',
  unlit: '${MARK.unlit}',
  accent: '${MARK.accent}',
} as const;

export type PaletteId = ${ids};
export const DEFAULT_PALETTE: PaletteId = '${DEFAULT.id}';

/** Colour themes (tokens live in app/palettes.css); \`icon\` = plate, mark and highlight colours of the app icon. */
export const PALETTES: { id: PaletteId; label: string; icon: { plate: string; ink: string; hi: string } }[] = [
${list}
];

/** Fixed colours of the sign-in poster: the default theme's dark mode. */
export const POSTER = { background: '${DEFAULT.dark.paper}', accent: '${DEFAULT.dark.accentFill}' } as const;
`;
}

function markSvg(colors, height, cx, cy) {
  const p = place(height, cx, cy);
  return `<g transform="translate(${n(p.x)} ${n(p.y)}) scale(${n(p.s)})"><path fill="${colors.ink}" fill-rule="evenodd" d="${MARK.body}"/><path fill="${colors.ink}" fill-opacity="${MARK.unlitAlpha}" d="${MARK.unlit}"/><path fill="${colors.hi}" d="${MARK.accent}"/></g>`;
}

function faviconSvg() {
  const c = DEFAULT.icon;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="23" fill="${c.plate}"/>${markSvg(c, 64, 50, 50)}</svg>\n`;
}

// ---------- Android ----------

const XML_HEAD = `<?xml version="1.0" encoding="utf-8"?>\n<!-- ${SOURCE} -->`;
const A = 'xmlns:android="http://schemas.android.com/apk/res/android"';
const roundRect = (x, y, w, h, r) =>
  `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}V${n(y + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z`;

function markGroup(colors, height, cx, cy, { accent = true } = {}) {
  const p = place(height, cx, cy);
  const paths = [
    `        <path android:fillColor="${colors.ink}" android:fillType="evenOdd" android:pathData="${MARK.body}" />`,
    `        <path android:fillColor="${colors.ink}" android:fillAlpha="${MARK.unlitAlpha}" android:pathData="${MARK.unlit}" />`,
  ];
  if (accent) paths.push(`        <path android:fillColor="${colors.hi}" android:pathData="${MARK.accent}" />`);
  return `    <group android:translateX="${n(p.x)}" android:translateY="${n(p.y)}" android:scaleX="${n(p.s)}" android:scaleY="${n(p.s)}">\n${paths.join('\n')}\n    </group>`;
}

const vector = (wDp, hDp, vw, vh, body) =>
  `${XML_HEAD}\n<vector ${A}\n    android:width="${wDp}dp"\n    android:height="${hDp}dp"\n    android:viewportWidth="${vw}"\n    android:viewportHeight="${vh}">\n${body}\n</vector>\n`;

// Adaptive icon: 108 dp layers, the mark 44 dp tall (inside the 66 dp safe circle).
const launcherForeground = () => vector(108, 108, 108, 108, markGroup(DEFAULT.icon, 44, 54, 54));
// Android 13 themed icon: only alpha counts; the highlighted pixel stays lit like the rest of the S.
const launcherMonochrome = () => vector(108, 108, 108, 108, markGroup({ ink: '#FFFFFF', hi: '#FFFFFF' }, 44, 54, 54, { accent: false }));
const adaptiveIcon = () =>
  `${XML_HEAD}\n<adaptive-icon ${A}>\n    <background android:drawable="@color/ic_launcher_background" />\n    <foreground android:drawable="@drawable/ic_launcher_foreground" />\n    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />\n</adaptive-icon>\n`;
// API 24–25 launchers: the plate is part of the drawing.
const legacyIcon = () =>
  vector(48, 48, 100, 100, `    <path android:fillColor="${DEFAULT.icon.plate}" android:pathData="${roundRect(0, 0, 100, 100, 23)}" />\n${markGroup(DEFAULT.icon, 60, 50, 50)}`);
// Pairing screen: the panel's Brand in the default theme's dark mode.
const brandMarkDrawable = () => {
  const d = DEFAULT.dark;
  return vector(32, 32, 100, 100, `    <path android:fillColor="${d.accentFill}" android:pathData="${roundRect(0, 0, 100, 100, 23)}" />\n${markGroup({ ink: d.accentInk, hi: d.brandHi }, 64, 50, 50)}`);
};

// Android TV banner (320 × 180 px at xhdpi): app icon + wordmark on the dark paper.
function tvBanner() {
  const W = 320, Hh = 180, plate = 84, gap = 18, cap = 32;
  const wm = brand.wordmark, ws = cap / wm.capHeight, wordW = wm.advance * ws;
  const x0 = (W - (plate + gap + wordW)) / 2, py = (Hh - plate) / 2;
  const wordX = x0 + plate + gap, capTop = Hh / 2 - cap / 2;
  return vector(160, 90, W, Hh, [
    `    <path android:fillColor="${DEFAULT.dark.paper}" android:pathData="M0 0H${W}V${Hh}H0Z" />`,
    `    <path android:fillColor="${DEFAULT.icon.plate}" android:pathData="${roundRect(x0, py, plate, plate, plate * 0.23)}" />`,
    markGroup(DEFAULT.icon, plate * 0.64, x0 + plate / 2, Hh / 2),
    `    <group android:translateX="${n(wordX)}" android:translateY="${n(capTop)}" android:scaleX="${ws.toFixed(5)}" android:scaleY="${ws.toFixed(5)}">`,
    `        <path android:fillColor="${DEFAULT.dark.ink}" android:pathData="${wm.path}" />`,
    `    </group>`,
  ].join('\n'));
}

const colorsXml = () =>
  `${XML_HEAD}\n<resources>\n    <color name="ic_launcher_background">${DEFAULT.icon.plate}</color>\n    <color name="brand_window_background">${DEFAULT.dark.paper}</color>\n</resources>\n`;

function brandColorsKt() {
  const d = DEFAULT.dark;
  const c = (hex) => `Color(0xFF${hex.slice(1).toUpperCase()})`;
  const rows = [
    ['Paper', d.paper], ['Surface', d.surface], ['Sunken', d.sunken], ['Line', d.line], ['LineStrong', d.lineStrong],
    ['Ink', d.ink], ['Ink2', d.ink2], ['Ink3', d.ink3], ['Accent', d.accent], ['AccentFill', d.accentFill], ['AccentInk', d.accentInk], ['BrandHi', d.brandHi],
  ];
  return `// ${SOURCE}
package com.eswact.signage.ui.theme

import androidx.compose.ui.graphics.Color

/** The default theme (${DEFAULT.id}) in dark mode — the device's own UI (pairing, settings) is always dark. */
internal object BrandColors {
${rows.map(([k, v]) => `    val ${k} = ${c(v)}`).join('\n')}
}
`;
}

// ---------- Write ----------

const res = 'android/app/src/main/res';
const outputs = [
  ['panel/lib/brand.ts', brandTs()],
  ['panel/app/palettes.css', paletteCss()],
  ['panel/app/icon.svg', faviconSvg()],
  [`${res}/drawable/ic_launcher_foreground.xml`, launcherForeground()],
  [`${res}/drawable/ic_launcher_monochrome.xml`, launcherMonochrome()],
  [`${res}/mipmap-anydpi-v26/ic_launcher.xml`, adaptiveIcon()],
  [`${res}/mipmap/ic_launcher.xml`, legacyIcon()],
  [`${res}/drawable/brand_mark.xml`, brandMarkDrawable()],
  [`${res}/drawable/tv_banner.xml`, tvBanner()],
  [`${res}/values/brand_colors.xml`, colorsXml()],
  ['android/app/src/main/java/com/eswact/signage/ui/theme/BrandColors.kt', brandColorsKt()],
];

const check = process.argv.includes('--check');
let stale = false;
for (const [rel, content] of outputs) {
  const file = join(root, rel);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (current === content) continue;
  if (check) {
    console.error(`Out of date: ${rel} — run node scripts/gen-brand.mjs`);
    stale = true;
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    console.log(`written: ${rel}`);
  }
}
process.exit(stale ? 1 : 0);

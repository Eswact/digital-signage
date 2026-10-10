// shared/design-tokens.json → panel (TS) + Android (Kotlin) source files.
// Theme/element values live in one place so the panel preview and the device
// render identically; the generated files are never edited by hand.
//
//   node scripts/gen-design-tokens.mjs           # write the files
//   node scripts/gen-design-tokens.mjs --check   # exit code 1 when stale (CI)
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(root, 'shared/design-tokens.json'), 'utf8'));
const HEADER = 'GENERATED — do not edit by hand. Source: shared/design-tokens.json\n// Regenerate: node scripts/gen-design-tokens.mjs';

const PALETTE_KEYS = ['background', 'background2', 'surface', 'card', 'text', 'muted', 'accent'];
const kstr = (s) => JSON.stringify(s);
const kfloat = (n) => `${n}f`;

function kotlin() {
  const presets = tokens.presets
    .map((p) => `        preset(${[p.id, p.mode, ...PALETTE_KEYS.map((k) => p.palette[k])].map(kstr).join(', ')}),`)
    .join('\n');
  const spec = (e) =>
    `spec(${kstr(e.font)}, ${kfloat(e.size)}, ${e.weight}, ${kstr(e.color)}, ${kstr(e.align)})`;
  const elements = (list) =>
    list.map((e) => `        ${kstr(e.key)} to ${spec(e)},`).join('\n');
  return `// ${HEADER}
package com.eswact.signage.ui.design

/** Same values as panel lib/design-tokens.ts (single source: shared/design-tokens.json). */
internal object DesignTokens {
    val presets: List<ThemePreset> = listOf(
${presets}
    )

    val orderBoard: Map<String, StyleSpec> = mapOf(
${elements(tokens.elements['order-board'])}
    )

    val queueNumber: Map<String, StyleSpec> = mapOf(
${elements(tokens.elements['queue-number'])}
    )

    val blockDefaults: StyleSpec = ${spec(tokens.blockDefaults)}
}
`;
}

function typescript() {
  const { $comment: _c, ...data } = tokens;
  return `// ${HEADER}
import type { FontKey, Palette, TextAlign, ThemeMode } from '@/lib/api';

export interface TokenElement {
  key: string;
  label: string;
  font: FontKey;
  size: number;
  weight: number;
  color: string;
  align: TextAlign;
}

export const DESIGN_TOKENS: {
  presets: { id: string; label: string; mode: ThemeMode; palette: Palette }[];
  elements: Record<'order-board' | 'queue-number', TokenElement[]>;
  blockDefaults: Omit<TokenElement, 'key' | 'label'>;
} = ${JSON.stringify(data, null, 2)};
`;
}

const outputs = [
  ['panel/lib/design-tokens.ts', typescript()],
  ['android/app/src/main/java/com/eswact/signage/ui/design/DesignTokens.kt', kotlin()],
];

const check = process.argv.includes('--check');
let stale = false;
for (const [rel, content] of outputs) {
  const file = join(root, rel);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (current === content) continue;
  if (check) {
    console.error(`Out of date: ${rel} — run node scripts/gen-design-tokens.mjs`);
    stale = true;
  } else {
    writeFileSync(file, content);
    console.log(`written: ${rel}`);
  }
}
process.exit(stale ? 1 : 0);

// Lists user-facing strings (`t('…')`, `msg('…')`) that the Turkish dictionary does not cover,
// and dictionary entries nothing uses any more.
//
//   node scripts/check-i18n.mjs            # report; exit 1 when translations are missing
//   node scripts/check-i18n.mjs --print    # print missing keys as a TS object skeleton
import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['app', 'components', 'lib'];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) && !full.endsWith(join('i18n', 'tr.ts')) ? [full] : [];
  });
}

const CALL = /(?:\b(?:t|tr|msg)\(|\b(?:success|failure):)\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`[^`$]*`)/g;
const unquote = (lit) => {
  const body = lit.slice(1, -1);
  return lit[0] === '`' ? body : body.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n');
};

const keys = new Map();
for (const dir of SOURCES) {
  for (const file of walk(join(root, dir))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(CALL)) keys.set(unquote(m[1]), file.replace(`${root}/`, ''));
  }
}

const trSrc = readFileSync(join(root, 'lib/i18n/tr.ts'), 'utf8');
const dict = new Map();
for (const m of trSrc.matchAll(/^\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"):\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"),?\s*$/gm)) {
  const k = (m[1] ?? m[2]).replace(/\\(['"\\])/g, '$1');
  dict.set(k, (m[3] ?? m[4]).replace(/\\(['"\\])/g, '$1'));
}

// Keys that are proper nouns / numbers / code and need no translation.
const SKIP = (k) => !/[A-Za-z]{2}/.test(k) || (/^[a-z0-9\-\/\[\]:. ]+$/.test(k) && k.includes('-')) || /^[A-Z0-9_.\-/ ]+$/.test(k) || /^(Roboto|Inter|Montserrat|ffprobe|APK|QR code)$/.test(k) || /^(POST|PUT|PATCH|DELETE|GET) /.test(k);

const missing = [...keys.keys()].filter((k) => !dict.has(k) && !SKIP(k));
const unused = [...dict.keys()].filter((k) => !keys.has(k));

if (process.argv.includes('--print')) {
  for (const k of missing) console.log(`  ${JSON.stringify(k)}: ${JSON.stringify(k)},`);
} else {
  console.log(`${keys.size} source strings, ${dict.size} Turkish entries.`);
  if (missing.length) {
    console.log(`\nMissing Turkish translations (${missing.length}):`);
    for (const k of missing) console.log(`  - ${k}   (${keys.get(k)})`);
  }
  if (unused.length) {
    console.log(`\nUnused dictionary entries (${unused.length}):`);
    for (const k of unused) console.log(`  - ${k}`);
  }
}
process.exit(missing.length ? 1 : 0);

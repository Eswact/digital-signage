// Fake queue machine (API key) — feeds a queue-number screen:
// adds people to the waiting list and calls the next one.
// Uses the ingest endpoints (X-API-Key); no email/password needed.
//
// Usage (from the project root):
//   node scripts/fake-queue-ingest.mjs <API_KEY>
//   API_KEY=sk_... node scripts/fake-queue-ingest.mjs
//
// Environment variables:
//   API_URL   (default http://localhost:3001/api)
//   INTERVAL  (seconds, default 4)

const API = process.env.API_URL ?? 'http://localhost:3001/api';
const KEY = process.argv[2] ?? process.env.API_KEY;
const INTERVAL = Number(process.env.INTERVAL ?? 4) * 1000;
const MAX_WAITING = 8;

if (!KEY) {
  console.error('Usage: node scripts/fake-queue-ingest.mjs <API_KEY>');
  process.exit(1);
}

const HEADERS = { 'Content-Type': 'application/json', 'X-API-Key': KEY };
const NAMES = ['Jane D.', 'Mark K.', 'Zoe A.', 'Alan V.', 'Ella D.', 'Chris T.', 'Sally O.', 'Ben S.'];

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function tick() {
  const state = await call('GET', '/ingest/state');
  const waiting = state.queue ?? [];
  if (waiting.length === 0 || (waiting.length < MAX_WAITING && Math.random() < 0.55)) {
    // No number given → the server continues from the last one (A041 → A042).
    const name = Math.random() < 0.7 ? pick(NAMES) : '';
    const item = await call('POST', '/ingest/queue/items', { name });
    console.log(`+ ${item.number}${item.name ? ` (${item.name})` : ''} joined the queue`);
  } else {
    const next = await call('POST', '/ingest/queue/next');
    console.log(`→ ${next.current}${next.currentName ? ` (${next.currentName})` : ''} called`);
  }
}

async function main() {
  const state = await call('GET', '/ingest/state');
  if (!('current' in state)) {
    console.error('This key is not attached to a queue-number screen.');
    process.exit(1);
  }
  console.log(`Fake queue machine started → every ${INTERVAL / 1000}s (current: ${state.current})`);
  await tick().catch((e) => console.error(e.message));
  setInterval(() => tick().catch((e) => console.error(e.message)), INTERVAL);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

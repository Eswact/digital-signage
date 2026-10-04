// Fake POS (API key) — 4-column flow: prep / ready / delivered / canceled.
// Uses the ingest endpoints (X-API-Key); no email/password needed.
//
// Usage (from the project root):
//   node scripts/fake-pos-ingest.mjs <API_KEY>
//   API_KEY=sk_... node scripts/fake-pos-ingest.mjs
//
// Environment variables:
//   API_URL   (default http://localhost:3001/api)
//   INTERVAL  (seconds, default 3)

const API = process.env.API_URL ?? 'http://localhost:3001/api';
const KEY = process.argv[2] ?? process.env.API_KEY;
const INTERVAL = Number(process.env.INTERVAL ?? 3) * 1000;

// Match the board's column codes (columnId) — whatever you set in the panel.
const COLS = {
  prep: 'prep', // new orders go here
  ready: 'ready', // ready
  delivered: 'delivered', // delivered
  canceled: 'canceled', // cancelled (side branch)
};

// Delivered orders disappear from the board automatically after this many seconds.
const DELIVERED_TTL = Number(process.env.DELIVERED_TTL ?? 20) * 1000;
const deliveredAt = new Map(); // orderId -> delivery time (ms)

if (!KEY) {
  console.error('Usage: node scripts/fake-pos-ingest.mjs <API_KEY>');
  process.exit(1);
}

const HEADERS = { 'Content-Type': 'application/json', 'X-API-Key': KEY };
const LABELS = ['Latte', 'Americano', 'Tea', 'Sandwich', 'Tost', 'Limonata', 'Mocha'];

async function getState() {
  const res = await fetch(`${API}/ingest/state`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Could not read state: ${res.status}`);
  return res.json();
}
async function addOrder(code, label, columnId) {
  await fetch(`${API}/ingest/orders`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ code, label, columnId }),
  });
}
async function moveOrder(id, columnId) {
  await fetch(`${API}/ingest/orders/${id}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({ columnId }),
  });
}
async function removeOrder(id) {
  await fetch(`${API}/ingest/orders/${id}`, { method: 'DELETE', headers: HEADERS });
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const inCol = (orders, ...ids) => orders.filter((o) => ids.includes(o.columnId));

let counter = 40;

/** Removes delivered orders whose time is up from the board. */
async function sweepDelivered(orders) {
  const now = Date.now();
  for (const o of inCol(orders, COLS.delivered)) {
    // Seen for the first time (e.g. delivered before the script started): start counting now.
    if (!deliveredAt.has(o.id)) deliveredAt.set(o.id, now);
    if (now - deliveredAt.get(o.id) >= DELIVERED_TTL) {
      await removeOrder(o.id);
      deliveredAt.delete(o.id);
      console.log(`⏱ #${o.code} removed (${DELIVERED_TTL / 1000}s elapsed)`);
    }
  }
}

async function tick() {
  const state = await getState();
  const orders = state.orders ?? [];
  await sweepDelivered(orders); // clear delivered orders whose time is up
  const roll = Math.random();

  if (roll < 0.4 || orders.length === 0) {
    // New order → prep
    counter += 1;
    await addOrder(String(counter), pick(LABELS), COLS.prep);
    console.log(`+ #${counter} → preparing`);
  } else if (roll < 0.62) {
    // prep → ready
    const o = pick(inCol(orders, COLS.prep));
    if (o) {
      await moveOrder(o.id, COLS.ready);
      console.log(`→ #${o.code} ready`);
    }
  } else if (roll < 0.78) {
    // ready → delivered
    const o = pick(inCol(orders, COLS.ready));
    if (o) {
      await moveOrder(o.id, COLS.delivered);
      deliveredAt.set(o.id, Date.now()); // start the delivery clock (for the TTL)
      console.log(`✓ #${o.code} delivered`);
    }
  } else if (roll < 0.9) {
    // prep or ready → canceled (flexible side branch)
    const o = pick(inCol(orders, COLS.prep, COLS.ready));
    if (o) {
      await moveOrder(o.id, COLS.canceled);
      console.log(`✕ #${o.code} CANCELLED`);
    }
  } else {
    // canceled → remove from the board (delivered ones leave automatically via the TTL).
    const o = pick(inCol(orders, COLS.canceled));
    if (o) {
      await removeOrder(o.id);
      console.log(`− #${o.code} cancellation cleared`);
    }
  }
}

async function main() {
  // Startup check: do the expected columns exist on the board?
  const state = await getState();
  const ids = new Set((state.columns ?? []).map((c) => c.id));
  const missing = Object.values(COLS).filter((id) => !ids.has(id));
  if (missing.length) {
    console.warn(
      `Warning: these column codes are not on the board: ${missing.join(', ')}. ` +
        `Codes on the board: ${[...ids].join(', ')}. Update COLS in this script.`,
    );
  }
  console.log(`Fake POS (4 columns) started → every ${INTERVAL / 1000}s`);
  await tick().catch((e) => console.error(e.message));
  setInterval(() => tick().catch((e) => console.error(e.message)), INTERVAL);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

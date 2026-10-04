import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/* --- Base32 (RFC 4648) --- */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of str.replace(/=+$/, '').toUpperCase()) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/* --- TOTP (RFC 6238, SHA-1, 6 hane, 30 sn) --- */
const STEP = 30;

export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

export function totp(secret: string, atMs = Date.now()): string {
  return hotp(secret, Math.floor(atMs / 1000 / STEP));
}

/** Saat sapmasına karşı ±1 adım (≈30 sn) toleranslı doğrulama. */
export function verifyTotp(secret: string, code: string, atMs = Date.now()): boolean {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(atMs / 1000 / STEP);
  for (const delta of [0, -1, 1]) {
    const expected = Buffer.from(hotp(secret, counter + delta));
    if (timingSafeEqual(expected, Buffer.from(clean))) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, account: string, issuer = 'Signage'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=${STEP}`;
}

/* --- Gizli anahtar şifreleme (AES-256-GCM) --- */
function key(appSecret: string): Buffer {
  return createHash('sha256').update(`totp:${appSecret}`).digest();
}

export function encryptSecret(plain: string, appSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(appSecret), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('hex')).join(':');
}

export function decryptSecret(stored: string, appSecret: string): string {
  const [iv, tag, enc] = stored.split(':').map((h) => Buffer.from(h, 'hex'));
  const decipher = createDecipheriv('aes-256-gcm', key(appSecret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/* --- Kurtarma kodları --- */
export const hashCode = (code: string) =>
  createHash('sha256').update(code.trim().toLowerCase()).digest('hex');

export function generateRecoveryCodes(n = 8): string[] {
  return Array.from({ length: n }, () => {
    const hex = randomBytes(5).toString('hex');
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
}

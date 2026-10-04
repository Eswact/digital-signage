import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/** Dakikada istek sınırları (IP başına; ingest'te API anahtarı başına). */
export const LIMITS = {
  login: { default: { ttl: 60_000, limit: 10 } },
  /** Parola sıfırlama, davet kabulü, 2FA kodu, parola değiştirme: kaba kuvvete karşı sıkı. */
  sensitive: { default: { ttl: 60_000, limit: 10 } },
  refresh: { default: { ttl: 60_000, limit: 60 } },
  deviceRegister: { default: { ttl: 60_000, limit: 30 } },
  ingest: { default: { ttl: 60_000, limit: 300 } },
};

/**
 * Ingest uçlarında sınır API anahtarı başına sayılır (aynı NAT arkasındaki
 * farklı kasalar birbirini kısıtlamasın); anahtar yoksa IP'ye düşer.
 */
@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const key = req.headers['x-api-key'];
    const raw = Array.isArray(key) ? key[0] : key;
    return raw ? `key:${raw.slice(0, 64)}` : (req.ip ?? 'unknown');
  }
}

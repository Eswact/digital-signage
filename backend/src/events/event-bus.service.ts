import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

/**
 * Süreç-içi mesaj yolu (Redis Pub/Sub yerine). HTTP tarafındaki servisler
 * `publish` eder, WebSocket Gateway `onMessage` ile dinleyip ilgili cihazın
 * soketine iletir. Tek backend süreci için Redis'e gerek yoktur; davranış aynıdır.
 * (Yatay ölçekleme gerekirse tekrar Redis'e dönülebilir.)
 */
export type LiveEventType =
  | 'devices'
  | 'screens'
  | 'screen'
  | 'groups'
  | 'media'
  | 'schedules'
  | 'organization';

export const orgChannel = (orgId: string) => `org:${orgId}`;

@Injectable()
export class EventBusService {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Çok sayıda cihaz/dinleyici için limit uyarısını kapat.
    this.emitter.setMaxListeners(0);
  }

  /** Bir kanala mesaj yayınlar (ör. `device:ABC123`). */
  async publish(channel: string, message: unknown): Promise<void> {
    this.emitter.emit('message', channel, JSON.stringify(message));
  }

  /**
   * Tells the panels of an organization that something changed (served as SSE by
   * `/api/live`). Payloads are invalidation hints, not data: the panel refetches.
   */
  notifyOrg(orgId: string | null | undefined, type: LiveEventType, id?: string): void {
    if (!orgId) return;
    this.emitter.emit('message', orgChannel(orgId), JSON.stringify({ type, id, ts: Date.now() }));
  }

  /** Tüm yayınları dinler; handler (channel, rawJson) alır. */
  onMessage(handler: (channel: string, raw: string) => void): void {
    this.emitter.on('message', handler);
  }

  offMessage(handler: (channel: string, raw: string) => void): void {
    this.emitter.off('message', handler);
  }
}

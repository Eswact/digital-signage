import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ScreensService } from '../screens/screens.service';
import { assertTemplate } from './template-guard';
import {
  QueueItemDto,
  ReplaceQueueDto,
  SetCurrentDto,
  UpdateQueueItemDto,
} from './dto/queue.dto';

export interface QueueItem {
  id: string;
  number: string;
  name?: string;
}

/** queue-number ekranının canlı (dış sistem/panel tarafından değişen) kısmı. */
export interface QueueState {
  current: string;
  currentName: string;
  queue: QueueItem[];
}

/** data üzerinde (yerinde) kuyruk görünümü — eksik alanlar tamamlanır. */
export function queueOf(data: Record<string, unknown>): QueueState {
  const q = data as unknown as QueueState;
  if (typeof q.current !== 'string') q.current = q.current == null ? '—' : String(q.current);
  if (typeof q.currentName !== 'string') q.currentName = '';
  if (!Array.isArray(q.queue)) q.queue = [];
  return q;
}

const NUMBER_RE = /^(.*?)(\d+)(\D*)$/;

/**
 * Numaranın son sayısal kısmını `delta` kadar değiştirir; önek/sonek ve sıfır
 * dolgusu korunur: "A042" → "A043", "9" → "10". Sayı yoksa (ör. "—")
 * ileri adım "1" verir, geri adım değiştirmez. 0'ın altına inmez.
 */
export function stepNumber(value: string, delta: number): string {
  const m = NUMBER_RE.exec(value.trim());
  if (!m) return delta > 0 ? '1' : value;
  const [, prefix, digits, suffix] = m;
  const n = Math.max(0, parseInt(digits, 10) + delta);
  return prefix + String(n).padStart(digits.length, '0') + suffix;
}

function snapshot(q: QueueState): QueueState {
  return { current: q.current, currentName: q.currentName, queue: structuredClone(q.queue) };
}

/**
 * Sıra numarası işlemleri. Hem ingest API (X-API-Key) hem panel (JWT) aynı
 * servisi kullanır; işlemler sunucuda ve ekran başına sıralı yapılır, böylece
 * eş zamanlı POS + panel değişiklikleri birbirini ezmez.
 */
@Injectable()
export class QueueService {
  constructor(private readonly screens: ScreensService) {}

  private newId(): string {
    return `q_${randomBytes(6).toString('hex')}`;
  }

  private mutate<R>(screenId: string, fn: (q: QueueState) => R): Promise<R> {
    return this.screens.mutateData(screenId, (data, screen) => {
      assertTemplate(screen, 'queue-number');
      return fn(queueOf(data));
    });
  }

  private findItem(q: QueueState, itemId: string): QueueItem {
    const item = q.queue.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Queue entry not found');
    return item;
  }

  /** Sıradakini çağırır: liste doluysa ilk kayıt, boşsa numara bir artar. */
  next(screenId: string): Promise<QueueState> {
    return this.mutate(screenId, (q) => {
      const first = q.queue.shift();
      if (first) {
        q.current = first.number;
        q.currentName = first.name ?? '';
      } else {
        q.current = stepNumber(q.current, 1);
        q.currentName = '';
      }
      return snapshot(q);
    });
  }

  /** Aktif numarayı bir azaltır. */
  prev(screenId: string): Promise<QueueState> {
    return this.mutate(screenId, (q) => {
      q.current = stepNumber(q.current, -1);
      q.currentName = '';
      return snapshot(q);
    });
  }

  setCurrent(screenId: string, dto: SetCurrentDto): Promise<QueueState> {
    return this.mutate(screenId, (q) => {
      q.current = dto.number;
      q.currentName = dto.name ?? '';
      return snapshot(q);
    });
  }

  /** Listeye ekler. Numara verilmezse son numaradan (yoksa aktiften) devam eder. */
  addItem(screenId: string, dto: QueueItemDto): Promise<QueueItem> {
    return this.mutate(screenId, (q) => {
      if (dto.id && q.queue.some((i) => i.id === dto.id)) {
        throw new BadRequestException(`This id is already in the list: ${dto.id}`);
      }
      const last = q.queue[q.queue.length - 1]?.number ?? q.current;
      const item: QueueItem = {
        id: dto.id ?? this.newId(),
        number: dto.number ?? stepNumber(last, 1),
        name: dto.name ?? '',
      };
      q.queue.push(item);
      return item;
    });
  }

  updateItem(
    screenId: string,
    itemId: string,
    dto: UpdateQueueItemDto,
  ): Promise<QueueItem> {
    return this.mutate(screenId, (q) => {
      const item = this.findItem(q, itemId);
      if (dto.number !== undefined) item.number = dto.number;
      if (dto.name !== undefined) item.name = dto.name;
      return { ...item };
    });
  }

  removeItem(screenId: string, itemId: string): Promise<void> {
    return this.mutate(screenId, (q) => {
      this.findItem(q, itemId);
      q.queue = q.queue.filter((i) => i.id !== itemId);
    });
  }

  /** Listeyi tamamen değiştirir (dış sistem kendi kuyruğunu senkronlar). */
  replaceItems(screenId: string, dto: ReplaceQueueDto): Promise<QueueState> {
    return this.mutate(screenId, (q) => {
      let last = q.current;
      q.queue = dto.items.map((i) => {
        const number = i.number ?? stepNumber(last, 1);
        last = number;
        return { id: i.id ?? this.newId(), number, name: i.name ?? '' };
      });
      return snapshot(q);
    });
  }

  /** Listedeki belirli bir kaydı (sırası gelmeden) aktif numara yapar. */
  call(screenId: string, itemId: string): Promise<QueueState> {
    return this.mutate(screenId, (q) => {
      const item = this.findItem(q, itemId);
      q.queue = q.queue.filter((i) => i.id !== itemId);
      q.current = item.number;
      q.currentName = item.name ?? '';
      return snapshot(q);
    });
  }
}

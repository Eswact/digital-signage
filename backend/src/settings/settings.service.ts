import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './setting.entity';

/** Platform ayarları: anahtar → JSON değer (süper yönetici sayfasından değişir). */
@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Setting) private readonly repo: Repository<Setting>) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.repo.findOne({ where: { key } });
    return row ? (row.value as T) : fallback;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.repo.save({ key, value });
  }
}

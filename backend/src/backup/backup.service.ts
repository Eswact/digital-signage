import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { mkdir, readdir, rm } from 'fs/promises';
import { join } from 'path';
import type { Database } from 'better-sqlite3';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Zamanlanmış SQLite yedeği. BACKUP_DIR verilirse her gün BACKUP_HOUR'da
 * (yerel saat, vars. 3) çalışan veritabanının tutarlı bir kopyası alınır
 * (better-sqlite3 online backup — yazmaları durdurmaz) ve en yeni
 * BACKUP_KEEP (vars. 14) dosya tutulur. Geri yükleme: deploy/README.md.
 */
@Injectable()
export class BackupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BackupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  private get dir(): string | undefined {
    return this.config.get<string>('BACKUP_DIR') || undefined;
  }

  onApplicationBootstrap() {
    if (!this.dir || this.config.get('DB_FILE') === ':memory:') return;
    const hour = Number(this.config.get('BACKUP_HOUR') ?? 3);
    const next = new Date();
    next.setHours(hour, 0, 0, 0);
    if (next.getTime() <= Date.now()) next.setTime(next.getTime() + DAY_MS);
    this.schedule(next.getTime() - Date.now());
    this.logger.log(`Daily backup: ${this.dir} (first: ${next.toLocaleString()})`);
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(delayMs: number) {
    this.timer = setTimeout(async () => {
      await this.run().catch((e) => this.logger.error(`Backup failed: ${e.message}`));
      this.schedule(DAY_MS);
    }, delayMs);
  }

  /** Yedeği alır, eski dosyaları temizler; oluşan dosya yolunu döner. */
  async run(): Promise<string> {
    const dir = this.dir;
    if (!dir) throw new Error('BACKUP_DIR is not set');
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(dir, `signage-${stamp}.db`);
    const db = (this.dataSource.driver as unknown as { databaseConnection: Database })
      .databaseConnection;
    await db.backup(file);
    await this.prune(dir);
    this.logger.log(`Backup written: ${file}`);
    return file;
  }

  private async prune(dir: string) {
    const keep = Number(this.config.get('BACKUP_KEEP') ?? 14);
    const files = (await readdir(dir))
      .filter((f) => /^signage-.*\.db$/.test(f))
      .sort()
      .reverse();
    await Promise.all(files.slice(keep).map((f) => rm(join(dir, f))));
  }
}

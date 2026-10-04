import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Screen } from './screen.entity';

type Data = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Eski `announcement` ({title, body}) verisini serbest yerleşimli bloklara
 * çevirir. Android (InfoBoardTemplate → legacyBlocks) aynı yerleşimi kullanır.
 */
export function announcementBlocks(data: Data): Data[] {
  const blocks: Data[] = [];
  if (str(data.title)) {
    blocks.push({
      id: 'b_title', kind: 'text', text: str(data.title), x: 6, y: 30, w: 88,
      style: { size: 88, weight: 700, align: 'center' },
    });
  }
  if (str(data.body)) {
    blocks.push({
      id: 'b_body', kind: 'text', text: str(data.body), x: 10, y: 52, w: 80,
      style: { size: 44, color: 'muted', align: 'center' },
    });
  }
  return blocks;
}

/** Eski `info-board` ({title, items, footer}) verisini bloklara çevirir. */
export function infoBoardBlocks(data: Data): Data[] {
  const blocks: Data[] = [];
  const items = Array.isArray(data.items) ? data.items.map(String) : [];
  if (str(data.title)) {
    blocks.push({
      id: 'b_title', kind: 'text', text: str(data.title), x: 6, y: 8, w: 88,
      style: { size: 72, weight: 700 },
    });
  }
  if (items.length > 0) {
    blocks.push({
      id: 'b_list', kind: 'list', items, bullet: 'dot', x: 6, y: 26, w: 88,
      style: { size: 44 },
    });
  }
  if (str(data.footer)) {
    blocks.push({
      id: 'b_footer', kind: 'text', text: str(data.footer), x: 6, y: 88, w: 88,
      style: { size: 32, color: 'muted' },
    });
  }
  return blocks;
}

/**
 * Açılışta ekran verisini güncel yapıya taşır (idempotent):
 * - announcement → info-board (bloklar) — iki şablon birleştirildi
 * - eski info-board (title/items/footer) → bloklar
 * - order-board `theme: 'dark' | 'light'` → `appearance`
 */
@Injectable()
export class ScreenMigrationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScreenMigrationsService.name);

  constructor(
    @InjectRepository(Screen)
    private readonly screens: Repository<Screen>,
  ) {}

  async onApplicationBootstrap() {
    const all = await this.screens.find();
    let migrated = 0;
    for (const screen of all) {
      if (this.migrate(screen)) {
        await this.screens.save(screen);
        migrated++;
      }
    }
    if (migrated > 0) {
      this.logger.log(`${migrated} screens migrated to the new data structure`);
    }
  }

  private migrate(screen: Screen): boolean {
    const data = screen.data ?? {};
    // DB'de eski şablon adı kalmış olabilir (TemplateType'tan çıkarıldı).
    const template: string = screen.template;

    if (template === 'announcement') {
      screen.template = 'info-board';
      screen.data = {
        appearance: { mode: 'dark', preset: 'carbon' },
        blocks: announcementBlocks(data),
      };
      return true;
    }
    if (template === 'info-board' && !Array.isArray(data.blocks)) {
      screen.data = {
        appearance: { mode: 'dark', preset: 'midnight' },
        blocks: infoBoardBlocks(data),
      };
      return true;
    }
    if (template === 'order-board' && typeof data.theme === 'string') {
      const { theme, ...rest } = data;
      const light = theme === 'light';
      screen.data = {
        ...rest,
        appearance: { mode: light ? 'light' : 'dark', preset: light ? 'paper' : 'midnight' },
      };
      return true;
    }
    return false;
  }
}

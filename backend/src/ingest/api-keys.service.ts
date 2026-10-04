import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ApiKey } from './api-key.entity';
import { Screen } from '../screens/screen.entity';
import { AuthUser } from '../auth/current-user.decorator';
import { inScope } from '../common/scope';

const PREFIX_LENGTH = 11; // "sk_" + 8 karakter

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Oluşturma yanıtı: ham anahtar yalnızca burada, bir kez döner. */
export type CreatedApiKey = Omit<ApiKey, 'legacyKey' | 'keyHash'> & { key: string };

@Injectable()
export class ApiKeysService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly keys: Repository<ApiKey>,
    @InjectRepository(Screen)
    private readonly screens: Repository<Screen>,
  ) {}

  /** Eski sürümde düz metin saklanan anahtarları hash'e taşır (idempotent). */
  async onApplicationBootstrap() {
    const legacy = await this.keys.find({
      where: { legacyKey: Not(IsNull()) },
      select: { id: true, legacyKey: true },
    });
    for (const k of legacy) {
      const raw = k.legacyKey!;
      await this.keys.update(
        { id: k.id },
        { keyHash: hashApiKey(raw), prefix: raw.slice(0, PREFIX_LENGTH), legacyKey: null },
      );
    }
    if (legacy.length > 0) {
      this.logger.log(`${legacy.length} API keys migrated to hashed storage`);
    }
  }

  private generateKey(): string {
    return `sk_${randomBytes(24).toString('hex')}`;
  }

  /** İzole: kullanıcı yalnızca kendi ekranının anahtarlarını yönetir (superadmin hepsini). */
  private async screenForViewer(viewer: AuthUser, screenId: string): Promise<Screen> {
    const screen = await this.screens.findOne({ where: { id: screenId } });
    if (!screen || !inScope(viewer, screen.organizationId)) {
      throw new NotFoundException('Screen not found');
    }
    return screen;
  }

  async create(viewer: AuthUser, screenId: string, name: string): Promise<CreatedApiKey> {
    const screen = await this.screenForViewer(viewer, screenId);
    const raw = this.generateKey();
    const saved = await this.keys.save(
      this.keys.create({
        keyHash: hashApiKey(raw),
        prefix: raw.slice(0, PREFIX_LENGTH),
        name,
        // Anahtar ekranın organizasyonuna ait (superadmin başkasının ekranına açsa da).
        organizationId: screen.organizationId,
        screenId,
      }),
    );
    const { keyHash: _hash, legacyKey: _legacy, ...pub } = saved;
    return { ...pub, key: raw };
  }

  async listForScreen(viewer: AuthUser, screenId: string): Promise<ApiKey[]> {
    await this.screenForViewer(viewer, screenId);
    return this.keys.find({
      where: { screenId },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(viewer: AuthUser, screenId: string, keyId: string): Promise<void> {
    await this.screenForViewer(viewer, screenId);
    const key = await this.keys.findOne({ where: { id: keyId } });
    if (!key || key.screenId !== screenId) {
      throw new NotFoundException('API key not found');
    }
    await this.keys.remove(key);
  }

  /** Ingest guard tarafından: ham anahtardan kayıt çözümler. */
  async verify(rawKey: string): Promise<ApiKey | null> {
    const key = await this.keys.findOne({ where: { keyHash: hashApiKey(rawKey) } });
    if (!key) return null;
    // Son kullanım zamanını güncelle (await beklenmez, kritik değil).
    void this.keys.update({ id: key.id }, { lastUsedAt: new Date() });
    return key;
  }
}

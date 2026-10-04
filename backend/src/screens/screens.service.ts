import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { compare } from 'fast-json-patch';
import { Screen } from './screen.entity';
import { Device } from '../devices/device.entity';
import { Group } from '../groups/group.entity';
import { EventBusService } from '../events/event-bus.service';
import { AuthUser } from '../auth/current-user.decorator';
import { inScope, orgScope, ownerOrgId } from '../common/scope';
import { LimitsService } from '../organizations/limits.service';
import { MediaService } from '../media/media.service';
import { ScheduleEngine } from '../schedules/schedule-engine.service';
import { validateScreenData } from '../templates/validate-data';
import { CreateScreenDto, UpdateScreenDto } from './dto/screen.dto';
import {
  deviceChannel,
  screenPatchMessage,
  screenUpdateMessage,
  ScreenPayload,
} from '../realtime/messages';

@Injectable()
export class ScreensService {
  constructor(
    @InjectRepository(Screen)
    private readonly screens: Repository<Screen>,
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
    private readonly bus: EventBusService,
    private readonly limits: LimitsService,
    private readonly media: MediaService,
    private readonly engine: ScheduleEngine,
  ) {}

  /** İzole: yalnızca etkin organizasyonun ekranları (superadmin hepsini). */
  listForViewer(viewer: AuthUser): Promise<Screen[]> {
    return this.screens.find({
      where: orgScope(viewer),
      order: { updatedAt: 'DESC' },
    });
  }

  async findForViewer(viewer: AuthUser, id: string): Promise<Screen> {
    const screen = await this.screens.findOne({ where: { id } });
    if (!screen || !inScope(viewer, screen.organizationId)) {
      throw new NotFoundException('Screen not found');
    }
    return screen;
  }

  async create(viewer: AuthUser, dto: CreateScreenDto): Promise<Screen> {
    const organizationId = ownerOrgId(viewer);
    await this.limits.assertCanAdd(viewer, organizationId, 'screens');
    const data = await this.checkedData(organizationId, dto.template, dto.data ?? {});
    const screen = this.screens.create({
      name: dto.name,
      template: dto.template,
      orientation: dto.orientation ?? 'landscape',
      data,
      organizationId,
    });
    const saved = await this.screens.save(screen);
    this.bus.notifyOrg(organizationId, 'screens', saved.id);
    return saved;
  }

  /**
   * Ekranı günceller. Sadece data değiştiyse SCREEN_PATCH (delta) yayınlar;
   * yön değiştiyse tam SCREEN_UPDATE gönderir (cihaz yeniden senkron olur).
   * `merge` verilirse yalnızca o üst seviye anahtarlar yazılır (null → silinir).
   */
  async update(
    viewer: AuthUser,
    id: string,
    dto: UpdateScreenDto,
  ): Promise<Screen> {
    const existing = await this.findForViewer(viewer, id);
    // Validate before taking the lock; media ownership is checked against the screen's organization.
    if (dto.data !== undefined) {
      dto = { ...dto, data: await this.checkedData(existing.organizationId, existing.template, dto.data) };
    }
    if (dto.merge !== undefined) {
      dto = { ...dto, merge: await this.checkedData(existing.organizationId, existing.template, dto.merge) };
    }
    return this.withLock(id, async () => {
      // Kilit içinde taze oku — bekleyen ingest yazımlarını ezmemek için.
      const screen = await this.getByIdInternal(id);
      const prevData = screen.data ?? {};
      const prevUpdatedAt = screen.updatedAt?.toISOString() ?? null;

      let orientationChanged = false;
      if (dto.name !== undefined) screen.name = dto.name;
      if (dto.orientation !== undefined && dto.orientation !== screen.orientation) {
        screen.orientation = dto.orientation;
        orientationChanged = true;
      }
      if (dto.data !== undefined) screen.data = dto.data;
      if (dto.merge !== undefined) {
        const next: Record<string, unknown> = { ...(screen.data ?? {}) };
        for (const [key, value] of Object.entries(dto.merge)) {
          if (value === null) delete next[key];
          else next[key] = value;
        }
        screen.data = next;
      }

      const saved = await this.screens.save(screen);

      if (orientationChanged) {
        await this.broadcastFull(saved);
      } else if (dto.data !== undefined || dto.merge !== undefined) {
        await this.broadcastPatch(saved, prevData, prevUpdatedAt);
      }
      this.bus.notifyOrg(saved.organizationId, 'screen', saved.id);
      return saved;
    });
  }

  async remove(viewer: AuthUser, id: string): Promise<void> {
    const screen = await this.findForViewer(viewer, id);
    // Silinen ekranı gösteren cihazlar (FK → null olur) pairing'e dönsün.
    const showing = await this.devices.find({
      where: [{ activeScreenId: screen.id }, { currentScreenId: screen.id }],
      select: { id: true },
    });
    await this.screens.remove(screen);
    // Groups hold a plain id (no relation) → clear it by hand.
    await this.screens.manager.update(Group, { currentScreenId: id }, { currentScreenId: null });
    // FK is SET NULL on the devices; each one now falls back to its remaining base screen or pairing.
    for (const d of showing) await this.engine.syncDevice(d.id, { force: true });
    this.bus.notifyOrg(screen.organizationId, 'screens', id);
  }

  /** Ingest için: kullanıcı kontrolü olmadan ekranı getirir. */
  async getByIdInternal(id: string): Promise<Screen> {
    const screen = await this.screens.findOne({ where: { id } });
    if (!screen) throw new NotFoundException('Screen not found');
    return screen;
  }

  /**
   * data'yı ekran başına sıralı (kilitli) olarak değiştirir, kaydeder ve
   * SCREEN_PATCH ile yayınlar (ingest API + panel kuyruk işlemleri).
   * `mutate` data'nın bir kopyasını yerinde değiştirir; hata fırlatırsa
   * hiçbir şey kaydedilmez.
   */
  mutateData<R>(
    screenId: string,
    mutate: (data: Record<string, unknown>, screen: Screen) => R,
  ): Promise<R> {
    return this.withLock(screenId, async () => {
      const screen = await this.getByIdInternal(screenId);
      const prevData = screen.data ?? {};
      const prevUpdatedAt = screen.updatedAt?.toISOString() ?? null;
      // Kopya üzerinde çalış → compare(prevData, newData) doğru diff üretir.
      const next = structuredClone(prevData);
      const result = mutate(next, screen);
      screen.data = next;
      const saved = await this.screens.save(screen);
      await this.broadcastPatch(saved, prevData, prevUpdatedAt);
      this.bus.notifyOrg(saved.organizationId, 'screen', saved.id);
      return result;
    });
  }

  /**
   * Aynı ekrana gelen yazımları sıraya sokar (oku → değiştir → yaz yarışı
   * olmasın). Tek süreç için yeterli; yatay ölçeklemede DB kilidi gerekir.
   */
  private readonly locks = new Map<string, Promise<unknown>>();

  private withLock<T>(screenId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(screenId) ?? Promise.resolve();
    const run = prev.then(fn);
    const tail = run.catch(() => undefined);
    this.locks.set(screenId, tail);
    void tail.then(() => {
      if (this.locks.get(screenId) === tail) this.locks.delete(screenId);
    });
    return run;
  }

  // --- Yayın yardımcıları ---

  /** Validates the template-specific keys and normalizes media references from the library. */
  private async checkedData(
    orgId: string,
    template: Screen['template'],
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    validateScreenData(template, data);
    return this.media.normalizeRefs(orgId, data);
  }

  /** Devices currently showing the screen (a schedule may differ from the base assignment). */
  private async devicesShowing(screenId: string): Promise<string[]> {
    const devices = await this.devices.find({
      where: { activeScreenId: screenId },
      select: { deviceId: true },
    });
    return devices.map((d) => d.deviceId);
  }

  private toPayload(screen: Screen): ScreenPayload {
    return {
      id: screen.id,
      template: screen.template,
      orientation: screen.orientation,
      data: screen.data,
      updatedAt: screen.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /** Tam ekran verisi (SCREEN_UPDATE). */
  private async broadcastFull(screen: Screen): Promise<void> {
    const payload = this.toPayload(screen);
    const deviceIds = await this.devicesShowing(screen.id);
    await Promise.all(
      deviceIds.map((id) =>
        this.bus.publish(deviceChannel(id), screenUpdateMessage(payload)),
      ),
    );
  }

  /** Sadece değişen alanlar (SCREEN_PATCH / JSON Patch). */
  private async broadcastPatch(
    screen: Screen,
    prevData: Record<string, unknown>,
    prevUpdatedAt: string | null,
  ): Promise<void> {
    const patch = compare(prevData, screen.data);
    if (patch.length === 0) return;
    const deviceIds = await this.devicesShowing(screen.id);
    const msg = screenPatchMessage({
      screenId: screen.id,
      patch,
      base: prevUpdatedAt,
      updatedAt: screen.updatedAt?.toISOString() ?? new Date().toISOString(),
    });
    await Promise.all(
      deviceIds.map((id) => this.bus.publish(deviceChannel(id), msg)),
    );
  }
}

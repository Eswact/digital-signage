import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { Device, DeviceStatus } from './device.entity';
import { Screen } from '../screens/screen.entity';
import { Group } from '../groups/group.entity';
import { EventBusService } from '../events/event-bus.service';
import { AuthUser } from '../auth/current-user.decorator';
import { inScope, orgScope, ownerOrgId } from '../common/scope';
import { LimitsService } from '../organizations/limits.service';
import { ScheduleEngine } from '../schedules/schedule-engine.service';
import {
  AssignScreenDto,
  PairDeviceDto,
  RegisterDeviceDto,
  UpdateDeviceDto,
} from './dto/device.dto';
import {
  deviceChannel,
  ScreenPayload,
  screenClearMessage,
  PROTOCOL_VERSION,
} from '../realtime/messages';

const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex');

export interface RegisterResult {
  deviceId: string;
  /** Yalnızca anahtar yeni üretildiğinde (ilk kayıt) döner. */
  secret?: string;
  /** Sunucunun konuştuğu WS protokol sürümü. */
  protocol: number;
  /** Panel adresi (QR ile eşleştirme linki için); PANEL_URL yoksa null. */
  panelUrl: string | null;
}

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
    @InjectRepository(Screen)
    private readonly screens: Repository<Screen>,
    @InjectRepository(Group)
    private readonly groups: Repository<Group>,
    private readonly bus: EventBusService,
    private readonly config: ConfigService,
    private readonly limits: LimitsService,
    private readonly engine: ScheduleEngine,
  ) {}

  /**
   * Android her bağlantı denemesinden önce kendini kaydeder (idempotent).
   * - Yeni cihaz ya da henüz anahtarı olmayan (eski sürüm) kayıt → gizli
   *   anahtar üretilir ve YALNIZCA bu yanıtta döner.
   * - Anahtarı olan kayıt → doğru anahtar gönderilmeli; aksi halde 409.
   *   Böylece Device ID'yi bilen biri cihazın yerine geçemez.
   * Cihaz sürümü ve desteklediği şablonlar her kayıtta güncellenir.
   */
  async register(dto: RegisterDeviceDto): Promise<RegisterResult> {
    const existing = await this.devices.findOne({
      where: { deviceId: dto.deviceId },
      select: { id: true, deviceId: true, secretHash: true },
    });

    let secret: string | undefined;
    if (existing?.secretHash) {
      if (!dto.secret || hashSecret(dto.secret) !== existing.secretHash) {
        throw new ConflictException('This Device ID belongs to another device');
      }
    } else {
      secret = randomBytes(32).toString('hex');
    }

    const device = existing
      ? await this.devices.findOneOrFail({ where: { id: existing.id } })
      : this.devices.create({ deviceId: dto.deviceId, name: dto.name, status: 'offline' });
    if (secret) device.secretHash = hashSecret(secret);
    if (dto.appVersion !== undefined) device.appVersion = dto.appVersion;
    if (dto.appVersionName !== undefined) device.appVersionName = dto.appVersionName;
    if (dto.templates !== undefined) device.templates = dto.templates;
    await this.devices.save(device);

    return {
      deviceId: device.deviceId,
      ...(secret ? { secret } : {}),
      protocol: PROTOCOL_VERSION,
      panelUrl: this.config.get<string>('PANEL_URL') || null,
    };
  }

  /** WS el sıkışması: cihaz kayıtlı mı ve anahtarı doğru mu? */
  async authenticate(deviceId: string, secret: string | null): Promise<boolean> {
    if (!secret) return false;
    const device = await this.devices.findOne({
      where: { deviceId },
      select: { id: true, secretHash: true },
    });
    return !!device?.secretHash && hashSecret(secret) === device.secretHash;
  }

  /**
   * Panelden Device ID (cihaz ekranındaki kod) girilerek cihaz hesaba
   * sahiplenilir (pairing). İzole model: cihaz başka bir hesaba bağlıysa
   * (superadmin değilse) sahiplenilemez → başkasının cihazı kapılamaz.
   */
  async pair(viewer: AuthUser, dto: PairDeviceDto): Promise<Device> {
    const device = await this.devices.findOne({
      where: { deviceId: dto.deviceId },
    });
    if (!device) {
      throw new NotFoundException('No device found with this Device ID');
    }
    const orgId = ownerOrgId(viewer);
    if (
      device.organizationId &&
      device.organizationId !== orgId &&
      viewer.role !== 'superadmin'
    ) {
      throw new ForbiddenException('The device is linked to another organization');
    }
    if (device.organizationId !== orgId) {
      await this.limits.assertCanAdd(viewer, orgId, 'devices');
    }

    device.organizationId = orgId;
    device.pairedAt = device.pairedAt ?? new Date();
    if (dto.name) device.name = dto.name;
    const saved = await this.devices.save(device);
    this.bus.notifyOrg(orgId, 'devices', saved.id);
    return saved;
  }

  /** İzole: yalnızca etkin organizasyonun cihazları (superadmin hepsini). */
  listForViewer(viewer: AuthUser): Promise<Device[]> {
    return this.devices.find({
      where: orgScope(viewer),
      relations: { currentScreen: true, group: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findForViewer(viewer: AuthUser, id: string): Promise<Device> {
    return this.findScoped(viewer, id, true);
  }

  /**
   * Değişiklik yapan yollar cihazı İLİŞKİSİZ yükler: ilişki nesnesi
   * (currentScreen/group) ile FK alanı aynı sütunu paylaşır ve save()
   * sırasında yüklü ilişki kazanır — `currentScreenId` değişikliği sessizce
   * eski değere dönerdi.
   */
  private findOwned(viewer: AuthUser, id: string): Promise<Device> {
    return this.findScoped(viewer, id, false);
  }

  private async findScoped(viewer: AuthUser, id: string, withRelations: boolean): Promise<Device> {
    const device = await this.devices.findOne({
      where: { id },
      relations: withRelations ? { currentScreen: true, group: true } : undefined,
    });
    if (!device || !inScope(viewer, device.organizationId)) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }

  async update(
    viewer: AuthUser,
    id: string,
    dto: UpdateDeviceDto,
  ): Promise<Device> {
    const device = await this.findOwned(viewer, id);
    if (dto.name !== undefined) device.name = dto.name;

    // A device joining a group takes over the group's current screen (if any).
    let reassigned = false;
    let groupChanged = false;
    if (dto.groupId !== undefined) {
      groupChanged = dto.groupId !== device.groupId;
      device.groupId = dto.groupId;
      if (groupChanged && dto.groupId) {
        const group = await this.groups.findOne({
          where: { id: dto.groupId },
        });
        if (group?.currentScreenId) {
          const screen = await this.screens.findOne({
            where: { id: group.currentScreenId },
          });
          if (screen) {
            device.currentScreenId = screen.id;
            reassigned = true;
          }
        }
      }
    }

    const saved = await this.devices.save(device);
    // Group membership can change which schedules apply, even without a new base screen.
    if (reassigned || groupChanged) {
      saved.activeScreenId = await this.engine.syncDevice(saved.id, { force: reassigned });
    }
    this.bus.notifyOrg(saved.organizationId, 'devices', saved.id);
    return saved;
  }

  async remove(viewer: AuthUser, id: string): Promise<void> {
    const device = await this.findOwned(viewer, id);
    await this.devices.remove(device);
    // Otherwise the physical device keeps showing its last screen: send it back to pairing.
    await this.bus.publish(deviceChannel(device.deviceId), screenClearMessage());
    this.bus.notifyOrg(device.organizationId, 'devices', id);
  }

  /** Cihazdan ekranı kaldırır (atamayı boşa alır) ve cihazı pairing'e döndürür. */
  async clearScreen(viewer: AuthUser, id: string): Promise<Device> {
    const device = await this.findOwned(viewer, id);
    device.currentScreenId = null;
    const saved = await this.devices.save(device);
    // A schedule may still be active; the engine decides what the device shows.
    saved.activeScreenId = await this.engine.syncDevice(saved.id, { force: true });
    return saved;
  }

  /**
   * Cihazın eşleştirmesini tamamen koparır (unpair): ekran + grup + sahip
   * bilgisi temizlenir; cihaz sahipsiz kalır ve fiziksel ekran pairing
   * (Device ID) görünümüne döner. Sahibi veya superadmin yapabilir.
   */
  async unpair(viewer: AuthUser, id: string): Promise<Device> {
    const device = await this.findOwned(viewer, id);
    device.currentScreenId = null;
    device.groupId = null;
    const previousOrg = device.organizationId;
    device.organizationId = null;
    device.pairedAt = null;
    const saved = await this.devices.save(device);
    saved.activeScreenId = await this.engine.syncDevice(saved.id, { force: true });
    this.bus.notifyOrg(previousOrg, 'devices', saved.id);
    return saved;
  }

  /**
   * Süper-admin: cihazı başka bir organizasyona taşır (kurtarma/yeniden atama).
   * Eski organizasyonun ekran/grup bağları temizlenir; cihaz yeni organizasyonun
   * "bekleyen"ine düşer ve pairing'e döner.
   */
  async transfer(id: string, newOrganizationId: string): Promise<Device> {
    const device = await this.devices.findOne({ where: { id } });
    if (!device) throw new NotFoundException('Device not found');
    const previousOrg = device.organizationId;
    device.organizationId = newOrganizationId;
    device.currentScreenId = null;
    device.groupId = null;
    device.pairedAt = new Date();
    const saved = await this.devices.save(device);
    saved.activeScreenId = await this.engine.syncDevice(saved.id, { force: true });
    this.bus.notifyOrg(previousOrg, 'devices', saved.id);
    this.bus.notifyOrg(newOrganizationId, 'devices', saved.id);
    return saved;
  }

  /** Cihaza ekran atar ve WebSocket üzerinden (event bus) anında iletir. */
  async assignScreen(
    viewer: AuthUser,
    id: string,
    dto: AssignScreenDto,
  ): Promise<Device> {
    const device = await this.findOwned(viewer, id);
    const screen = await this.screens.findOne({
      where: { id: dto.screenId },
    });
    // İzole: yalnızca kendi organizasyonunun ekranını atayabilir (superadmin serbest).
    if (!screen || !inScope(viewer, screen.organizationId)) {
      throw new NotFoundException('Screen not found');
    }

    device.currentScreenId = screen.id;
    const saved = await this.devices.save(device);
    saved.activeScreenId = await this.engine.syncDevice(saved.id, { force: true });
    return saved;
  }

  // --- WebSocket Gateway tarafından kullanılan yardımcılar ---

  findByDeviceId(deviceId: string): Promise<Device | null> {
    return this.devices.findOne({ where: { deviceId } });
  }

  async setStatus(deviceId: string, status: DeviceStatus): Promise<void> {
    await this.devices.update(
      { deviceId },
      { status, lastSeenAt: new Date() },
    );
    const device = await this.devices.findOne({
      where: { deviceId },
      select: { id: true, organizationId: true },
    });
    if (device) this.bus.notifyOrg(device.organizationId, 'devices', device.id);
  }

  async touch(deviceId: string): Promise<void> {
    await this.devices.update({ deviceId }, { lastSeenAt: new Date() });
  }

  /** Cihaz bağlandığında gösterilecek mevcut ekranı döner. */
  async getCurrentScreenPayload(
    deviceId: string,
  ): Promise<ScreenPayload | null> {
    const device = await this.devices.findOne({ where: { deviceId } });
    if (!device) return null;
    // Re-evaluate schedules at connect time (stored value may be stale after downtime).
    const screenId = await this.engine.syncDevice(device.id, { silent: true });
    if (!screenId) return null;
    const screen = await this.screens.findOne({ where: { id: screenId } });
    return screen ? toScreenPayload(screen) : null;
  }
}

export function toScreenPayload(screen: Screen): ScreenPayload {
  return {
    id: screen.id,
    template: screen.template,
    orientation: screen.orientation,
    data: screen.data,
    updatedAt: screen.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

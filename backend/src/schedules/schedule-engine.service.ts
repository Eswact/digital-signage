import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Schedule } from './schedule.entity';
import { pickSchedule } from './schedule.logic';
import { Device } from '../devices/device.entity';
import { Screen } from '../screens/screen.entity';
import { Organization } from '../organizations/organization.entity';
import { EventBusService } from '../events/event-bus.service';
import {
  deviceChannel,
  screenAssignMessage,
  screenClearMessage,
  ScreenPayload,
} from '../realtime/messages';

const TICK_MS = 15_000;

const toPayload = (screen: Screen): ScreenPayload => ({
  id: screen.id,
  template: screen.template,
  orientation: screen.orientation,
  data: screen.data,
  updatedAt: screen.updatedAt?.toISOString() ?? new Date().toISOString(),
});

/**
 * Decides which screen each device shows right now: an active schedule if there
 * is one, otherwise the base assignment (`currentScreenId`). The result is kept
 * in `Device.activeScreenId`, and every change is pushed to the device.
 */
@Injectable()
export class ScheduleEngine implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ScheduleEngine.name);
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(Screen) private readonly screens: Repository<Screen>,
    @InjectRepository(Schedule) private readonly schedules: Repository<Schedule>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    private readonly bus: EventBusService,
  ) {}

  async onApplicationBootstrap() {
    await this.tick().catch((e: Error) => this.logger.error(`Initial schedule tick failed: ${e.message}`));
    this.timer = setInterval(() => {
      this.tick().catch((e: Error) => this.logger.error(`Schedule tick failed: ${e.message}`));
    }, TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Screen the device should show at `now` (schedule override, else base assignment). */
  private async effectiveScreenId(
    device: Pick<Device, 'id' | 'groupId' | 'currentScreenId' | 'organizationId'>,
    now: Date,
  ): Promise<string | null> {
    if (!device.organizationId) return device.currentScreenId ?? null;
    const schedules = await this.schedules.find({
      where: { organizationId: device.organizationId, enabled: true },
    });
    if (schedules.length === 0) return device.currentScreenId ?? null;
    const org = await this.orgs.findOne({ where: { id: device.organizationId } });
    const winner = pickSchedule(schedules, device, now, org?.timezone || 'UTC');
    return winner?.screenId ?? device.currentScreenId ?? null;
  }

  /**
   * Recomputes one device. `force` re-sends the screen even if it did not change
   * (explicit assignment from the panel); `silent` only updates the stored value
   * (used when a device connects and is sent its screen directly).
   */
  async syncDevice(
    id: string,
    opts: { force?: boolean; silent?: boolean; now?: Date } = {},
  ): Promise<string | null> {
    const device = await this.devices.findOne({ where: { id } });
    if (!device) return null;
    const effective = await this.effectiveScreenId(device, opts.now ?? new Date());
    const changed = effective !== (device.activeScreenId ?? null);
    if (changed) await this.devices.update({ id }, { activeScreenId: effective });
    if (!opts.silent && (changed || opts.force)) await this.push(device, effective);
    if (changed || opts.force) this.bus.notifyOrg(device.organizationId, 'devices', device.id);
    return effective;
  }

  /** Recomputes all paired devices; returns how many switched screens. */
  async tick(now = new Date()): Promise<number> {
    if (this.ticking) return 0;
    this.ticking = true;
    try {
      const [devices, schedules, orgs] = await Promise.all([
        this.devices.find({ where: { organizationId: Not(IsNull()) } }),
        this.schedules.find({ where: { enabled: true } }),
        this.orgs.find({ select: { id: true, timezone: true } }),
      ]);
      const tz = new Map(orgs.map((o) => [o.id, o.timezone || 'UTC']));
      const byOrg = new Map<string, Schedule[]>();
      for (const s of schedules) byOrg.set(s.organizationId, [...(byOrg.get(s.organizationId) ?? []), s]);

      let switched = 0;
      for (const device of devices) {
        const winner = pickSchedule(byOrg.get(device.organizationId!) ?? [], device, now, tz.get(device.organizationId!) ?? 'UTC');
        const effective = winner?.screenId ?? device.currentScreenId ?? null;
        if (effective === (device.activeScreenId ?? null)) continue;
        await this.devices.update({ id: device.id }, { activeScreenId: effective });
        await this.push(device, effective);
        this.bus.notifyOrg(device.organizationId, 'devices', device.id);
        switched++;
      }
      return switched;
    } finally {
      this.ticking = false;
    }
  }

  private async push(device: Pick<Device, 'deviceId'>, screenId: string | null): Promise<void> {
    const screen = screenId ? await this.screens.findOne({ where: { id: screenId } }) : null;
    await this.bus.publish(
      deviceChannel(device.deviceId),
      screen ? screenAssignMessage(toPayload(screen)) : screenClearMessage(),
    );
  }
}

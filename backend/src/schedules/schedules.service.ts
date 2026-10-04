import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './schedule.entity';
import { isActive } from './schedule.logic';
import { ScheduleEngine } from './schedule-engine.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { Device } from '../devices/device.entity';
import { Group } from '../groups/group.entity';
import { Screen } from '../screens/screen.entity';
import { Organization } from '../organizations/organization.entity';
import { EventBusService } from '../events/event-bus.service';
import { AuthUser } from '../auth/current-user.decorator';
import { inScope, orgScope, ownerOrgId } from '../common/scope';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule) private readonly repo: Repository<Schedule>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(Group) private readonly groups: Repository<Group>,
    @InjectRepository(Screen) private readonly screens: Repository<Screen>,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    private readonly engine: ScheduleEngine,
    private readonly bus: EventBusService,
  ) {}

  async list(viewer: AuthUser) {
    const rows = await this.repo.find({ where: orgScope(viewer), order: { createdAt: 'ASC' } });
    const zones = new Map((await this.orgs.find({ select: { id: true, timezone: true } })).map((o) => [o.id, o.timezone]));
    const now = new Date();
    return rows.map((s) => ({ ...s, activeNow: s.enabled && isActive(s, now, zones.get(s.organizationId) || 'UTC') }));
  }

  private async findForViewer(viewer: AuthUser, id: string): Promise<Schedule> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row || !inScope(viewer, row.organizationId)) throw new NotFoundException('Schedule not found');
    return row;
  }

  /** Target device/group and screen must belong to the schedule's organization. */
  private async assertRefs(orgId: string, targetType: string, targetId: string, screenId: string) {
    const target =
      targetType === 'device'
        ? await this.devices.findOne({ where: { id: targetId, organizationId: orgId } })
        : await this.groups.findOne({ where: { id: targetId, organizationId: orgId } });
    if (!target) throw new NotFoundException(`${targetType === 'device' ? 'Device' : 'Group'} not found`);
    if (!(await this.screens.findOne({ where: { id: screenId, organizationId: orgId } }))) {
      throw new NotFoundException('Screen not found');
    }
  }

  private assertTimes(startTime?: string | null, endTime?: string | null) {
    if (!!startTime !== !!endTime) {
      throw new BadRequestException('Provide both a start and an end time, or neither for an all-day schedule');
    }
  }

  async create(viewer: AuthUser, dto: CreateScheduleDto): Promise<Schedule> {
    const orgId = ownerOrgId(viewer);
    this.assertTimes(dto.startTime, dto.endTime);
    await this.assertRefs(orgId, dto.targetType, dto.targetId, dto.screenId);
    const saved = await this.repo.save(
      this.repo.create({
        organizationId: orgId,
        name: dto.name,
        targetType: dto.targetType,
        targetId: dto.targetId,
        screenId: dto.screenId,
        days: [...dto.days].sort(),
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        priority: dto.priority ?? 0,
        enabled: dto.enabled ?? true,
      }),
    );
    await this.applyNow(orgId);
    return saved;
  }

  async update(viewer: AuthUser, id: string, dto: UpdateScheduleDto): Promise<Schedule> {
    const row = await this.findForViewer(viewer, id);
    const next = { ...row, ...dto } as Schedule;
    if (dto.startTime === null) next.startTime = null;
    if (dto.endTime === null) next.endTime = null;
    this.assertTimes(next.startTime, next.endTime);
    await this.assertRefs(row.organizationId, next.targetType, next.targetId, next.screenId);
    Object.assign(row, {
      name: next.name,
      targetType: next.targetType,
      targetId: next.targetId,
      screenId: next.screenId,
      days: [...next.days].sort(),
      startTime: next.startTime || null,
      endTime: next.endTime || null,
      priority: next.priority,
      enabled: next.enabled,
    });
    const saved = await this.repo.save(row);
    await this.applyNow(row.organizationId);
    return saved;
  }

  async remove(viewer: AuthUser, id: string): Promise<void> {
    const row = await this.findForViewer(viewer, id);
    await this.repo.remove(row);
    await this.applyNow(row.organizationId);
  }

  /** Re-evaluates the organization's devices right away instead of waiting for the next tick. */
  private async applyNow(orgId: string) {
    this.bus.notifyOrg(orgId, 'schedules');
    const devices = await this.devices.find({ where: { organizationId: orgId }, select: { id: true } });
    for (const d of devices) await this.engine.syncDevice(d.id);
  }
}

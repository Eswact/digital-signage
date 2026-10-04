import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './group.entity';
import { Device } from '../devices/device.entity';
import { DevicesService } from '../devices/devices.service';
import { AuthUser } from '../auth/current-user.decorator';
import { inScope, orgScope, ownerOrgId } from '../common/scope';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groups: Repository<Group>,
    @InjectRepository(Device)
    private readonly devices: Repository<Device>,
    private readonly devicesService: DevicesService,
    private readonly bus: EventBusService,
  ) {}

  /** İzole: yalnızca etkin organizasyonun grupları (superadmin hepsini). */
  listForViewer(viewer: AuthUser): Promise<Group[]> {
    return this.groups.find({
      where: orgScope(viewer),
      order: { createdAt: 'DESC' },
    });
  }

  private async findForViewer(viewer: AuthUser, groupId: string): Promise<Group> {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group || !inScope(viewer, group.organizationId)) {
      throw new NotFoundException('Group not found');
    }
    return group;
  }

  async create(viewer: AuthUser, name: string): Promise<Group> {
    const group = this.groups.create({ name, organizationId: ownerOrgId(viewer) });
    const saved = await this.groups.save(group);
    this.bus.notifyOrg(saved.organizationId, 'groups', saved.id);
    return saved;
  }

  async remove(viewer: AuthUser, id: string): Promise<void> {
    const group = await this.findForViewer(viewer, id);
    await this.groups.remove(group);
    this.bus.notifyOrg(group.organizationId, 'groups', id);
  }

  /** Gruptaki tüm cihazlara bir ekran atar (her birine anında iletilir). */
  async assignScreen(
    viewer: AuthUser,
    groupId: string,
    screenId: string,
  ): Promise<{ assigned: number }> {
    const group = await this.findForViewer(viewer, groupId);
    const devices = await this.devices.find({
      where: { groupId },
      select: { id: true },
    });
    for (const device of devices) {
      await this.devicesService.assignScreen(viewer, device.id, { screenId });
    }
    group.currentScreenId = screenId;
    await this.groups.save(group);
    this.bus.notifyOrg(group.organizationId, 'groups', groupId);
    return { assigned: devices.length };
  }

  /** Gruptaki tüm cihazlardan ekranı kaldırır. */
  async unassignScreen(
    viewer: AuthUser,
    groupId: string,
  ): Promise<{ cleared: number }> {
    const group = await this.findForViewer(viewer, groupId);
    const devices = await this.devices.find({
      where: { groupId },
      select: { id: true },
    });
    for (const device of devices) {
      await this.devicesService.clearScreen(viewer, device.id);
    }
    group.currentScreenId = null;
    await this.groups.save(group);
    this.bus.notifyOrg(group.organizationId, 'groups', groupId);
    return { cleared: devices.length };
  }
}

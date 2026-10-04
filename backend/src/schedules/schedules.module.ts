import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from './schedule.entity';
import { Device } from '../devices/device.entity';
import { Group } from '../groups/group.entity';
import { Screen } from '../screens/screen.entity';
import { Organization } from '../organizations/organization.entity';
import { ScheduleEngine } from './schedule-engine.service';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { OrganizationsModule } from '../organizations/organizations.module';

/** Leaf module: devices/screens/groups depend on the engine, never the other way round. */
@Module({
  imports: [TypeOrmModule.forFeature([Schedule, Device, Group, Screen, Organization]), OrganizationsModule],
  providers: [ScheduleEngine, SchedulesService],
  controllers: [SchedulesController],
  exports: [ScheduleEngine],
})
export class SchedulesModule {}

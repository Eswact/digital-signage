import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './device.entity';
import { Screen } from '../screens/screen.entity';
import { Group } from '../groups/group.entity';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [TypeOrmModule.forFeature([Device, Screen, Group]), OrganizationsModule, SchedulesModule],
  providers: [DevicesService],
  controllers: [DevicesController],
  exports: [DevicesService],
})
export class DevicesModule {}

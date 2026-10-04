import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from './group.entity';
import { Device } from '../devices/device.entity';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [TypeOrmModule.forFeature([Group, Device]), DevicesModule],
  providers: [GroupsService],
  controllers: [GroupsController],
})
export class GroupsModule {}

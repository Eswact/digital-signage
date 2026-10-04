import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Screen } from './screen.entity';
import { Device } from '../devices/device.entity';
import { ScreensService } from './screens.service';
import { ScreensController } from './screens.controller';
import { ScreenMigrationsService } from './screen-migrations.service';
import { MediaModule } from '../media/media.module';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [TypeOrmModule.forFeature([Screen, Device]), OrganizationsModule, MediaModule, SchedulesModule],
  providers: [ScreensService, ScreenMigrationsService],
  controllers: [ScreensController],
  exports: [ScreensService],
})
export class ScreensModule {}

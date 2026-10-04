import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { Membership } from './membership.entity';
import { Invitation } from './invitation.entity';
import { Setting } from '../settings/setting.entity';
import { User } from '../users/user.entity';
import { Screen } from '../screens/screen.entity';
import { Device } from '../devices/device.entity';
import { MediaAsset } from '../media/media-asset.entity';
import { SettingsService } from '../settings/settings.service';
import { LimitsService } from './limits.service';
import { OrganizationsService } from './organizations.service';
import { OrganizationBackfillService } from './organization-backfill.service';
import { OrganizationsController } from './organizations.controller';
import { AdminController } from './admin.controller';
import { OrgRoleGuard } from '../auth/org-role.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, Membership, Invitation, Setting, User, Screen, Device, MediaAsset]),
  ],
  providers: [
    SettingsService,
    LimitsService,
    OrganizationsService,
    OrganizationBackfillService,
    OrgRoleGuard,
  ],
  controllers: [OrganizationsController, AdminController],
  exports: [OrganizationsService, LimitsService, SettingsService, OrgRoleGuard],
})
export class OrganizationsModule {}

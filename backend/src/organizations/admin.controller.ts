import { Body, Controller, Get, Param, Patch, Put, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { LimitsService } from './limits.service';
import { SettingsService } from '../settings/settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminUpdateOrgDto, LimitsDto } from './dto/organization.dto';

/** Süper yönetici: tüm organizasyonlar, plan limitleri ve platform varsayılanları. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly limits: LimitsService,
    private readonly settings: SettingsService,
  ) {}

  @Get('organizations')
  list() {
    return this.orgs.listAll();
  }

  @Patch('organizations/:id')
  async update(@Param('id') id: string, @Body() dto: AdminUpdateOrgDto) {
    await this.orgs.adminUpdate(id, dto);
    return { ok: true };
  }

  @Get('limits')
  defaults() {
    return this.limits.platformDefaults();
  }

  /** Platform varsayılan limitleri (organizasyon istisnası olmayanlar için). */
  @Put('limits')
  async setDefaults(@Body() dto: LimitsDto) {
    await this.settings.set('limits', dto);
    return this.limits.platformDefaults();
  }
}

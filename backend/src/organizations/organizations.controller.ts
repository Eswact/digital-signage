import { Body, Controller, Delete, Get, Param, Patch, Post, ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrgAuth, MinOrgRole } from '../auth/org-role.guard';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { InviteDto, RenameOrgDto, SetRoleDto } from './dto/organization.dto';

/** Etkin organizasyon: üyeler, davetler, kullanım ve limitler. */
@OrgAuth()
@Controller('organization')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  private orgId(user: AuthUser): string {
    if (!user.orgId) throw new ForbiddenException('You are not a member of any organization');
    return user.orgId;
  }

  @Get()
  detail(@CurrentUser() user: AuthUser) {
    return this.orgs.detail(this.orgId(user));
  }

  @MinOrgRole('owner')
  @Patch()
  async rename(@CurrentUser() user: AuthUser, @Body() dto: RenameOrgDto) {
    await this.orgs.updateSettings(this.orgId(user), dto);
    return { ok: true };
  }

  @MinOrgRole('owner')
  @Post('invitations')
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteDto) {
    return this.orgs.invite(user, this.orgId(user), dto.email, dto.role);
  }

  @MinOrgRole('owner')
  @Delete('invitations/:id')
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.orgs.revokeInvitation(this.orgId(user), id);
    return { ok: true };
  }

  @MinOrgRole('owner')
  @Patch('members/:userId')
  async setRole(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body() dto: SetRoleDto,
  ) {
    await this.orgs.setMemberRole(this.orgId(user), userId, dto.role);
    return { ok: true };
  }

  /** Sahip başkasını çıkarır; herkes kendi ayrılabilir (servis kontrol eder). */
  @MinOrgRole('viewer')
  @Delete('members/:userId')
  async remove(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    await this.orgs.removeMember(user, this.orgId(user), userId);
    return { ok: true };
  }
}

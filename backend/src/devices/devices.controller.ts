import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { LIMITS } from '../common/throttle';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgAuth } from '../auth/org-role.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import {
  AssignScreenDto,
  PairDeviceDto,
  RegisterDeviceDto,
  UpdateDeviceDto,
} from './dto/device.dto';

class TransferDeviceDto {
  @IsUUID()
  organizationId: string;
}

@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  /** Android cihaz kaydı — auth gerektirmez (cihaz gizli anahtarıyla korunur). */
  @UseGuards(ThrottlerGuard)
  @Throttle(LIMITS.deviceRegister)
  @Post('register')
  register(@Body() dto: RegisterDeviceDto) {
    return this.devices.register(dto);
  }

  @OrgAuth()
  @Post('pair')
  pair(@CurrentUser() user: AuthUser, @Body() dto: PairDeviceDto) {
    return this.devices.pair(user, dto);
  }

  @OrgAuth()
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.devices.listForViewer(user);
  }

  @OrgAuth()
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devices.findForViewer(user, id);
  }

  @OrgAuth()
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devices.update(user, id, dto);
  }

  @OrgAuth()
  @Post(':id/assign-screen')
  assignScreen(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignScreenDto,
  ) {
    return this.devices.assignScreen(user, id, dto);
  }

  @OrgAuth()
  @Delete(':id/screen')
  clearScreen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devices.clearScreen(user, id);
  }

  /** Eşleştirmeyi koparır — sahibi veya superadmin. Cihaz pairing'e döner. */
  @OrgAuth()
  @Post(':id/unpair')
  unpair(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devices.unpair(user, id);
  }

  /** Süper-admin: cihazı başka bir hesaba taşır. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  @Post(':id/transfer')
  transfer(@Param('id') id: string, @Body() dto: TransferDeviceDto) {
    return this.devices.transfer(id, dto.organizationId);
  }

  @OrgAuth()
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devices.remove(user, id);
  }
}

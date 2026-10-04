import { Controller, Get, UseGuards } from '@nestjs/common';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/** Superadmin: runtime facts the settings page shows (storage driver, ffprobe availability). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('admin/system')
export class AdminSystemController {
  constructor(private readonly media: MediaService) {}

  @Get()
  async system() {
    return { media: await this.media.systemInfo() };
  }
}

import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { OrgAuth } from '../auth/org-role.guard';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

@OrgAuth()
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.schedules.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateScheduleDto) {
    return this.schedules.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScheduleDto) {
    return this.schedules.update(user, id, dto);
  }

  @HttpCode(200)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.schedules.remove(user, id);
    return { ok: true };
  }
}

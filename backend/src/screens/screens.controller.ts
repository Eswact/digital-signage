import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ScreensService } from './screens.service';
import { OrgAuth } from '../auth/org-role.guard';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CreateScreenDto, UpdateScreenDto } from './dto/screen.dto';
import { TEMPLATES } from '../templates/template.types';

@OrgAuth()
@Controller('screens')
export class ScreensController {
  constructor(private readonly screens: ScreensService) {}

  /** Panelde şema-driven form için şablon tanımları. */
  @Get('templates')
  templates() {
    return Object.values(TEMPLATES);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.screens.listForViewer(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.screens.findForViewer(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateScreenDto) {
    return this.screens.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateScreenDto,
  ) {
    return this.screens.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.screens.remove(user, id);
  }
}

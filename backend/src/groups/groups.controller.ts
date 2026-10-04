import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { IsString, IsUUID, MinLength } from 'class-validator';
import { GroupsService } from './groups.service';
import { OrgAuth } from '../auth/org-role.guard';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';

class CreateGroupDto {
  @IsString()
  @MinLength(1)
  name: string;
}

class AssignScreenDto {
  @IsUUID()
  screenId: string;
}

@OrgAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.groups.listForViewer(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
    return this.groups.create(user, dto.name);
  }

  @Post(':id/assign-screen')
  assignScreen(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignScreenDto,
  ) {
    return this.groups.assignScreen(user, id, dto.screenId);
  }

  @Delete(':id/screen')
  unassignScreen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.unassignScreen(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.remove(user, id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { OrgAuth } from '../auth/org-role.guard';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CreateApiKeyDto } from './dto/ingest.dto';

/** Panel (admin) tarafından ekran-kapsamlı API anahtarı yönetimi. */
@OrgAuth()
@Controller('screens/:screenId/keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('screenId') screenId: string) {
    return this.apiKeys.listForScreen(user, screenId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('screenId') screenId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeys.create(user, screenId, dto.name);
  }

  @Delete(':keyId')
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('screenId') screenId: string,
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeys.revoke(user, screenId, keyId);
  }
}

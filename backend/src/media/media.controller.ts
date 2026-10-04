import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { MediaService } from './media.service';
import { MediaKind } from './media-asset.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgRoleGuard, OrgAuth } from '../auth/org-role.guard';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { LimitsService } from '../organizations/limits.service';

const MB = 1024 * 1024;

class RenameMediaDto {
  @IsString()
  @MinLength(1)
  name: string;
}

class UploadFieldsDto {
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() avgColor?: string;
  @IsOptional() @IsString() name?: string;
}

/** Rejects an oversized upload from its Content-Length before the body is read. */
@Injectable()
export class UploadSizeGuard implements CanActivate {
  constructor(private readonly limits: LimitsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser;
    if (user.role === 'superadmin' || !user.orgId) return true;
    const declared = Number(req.headers['content-length']);
    if (!Number.isFinite(declared)) return true;
    const { maxUploadMb } = await this.limits.effective(user.orgId);
    if (declared > maxUploadMb * MB + MB) {
      throw new BadRequestException({
        message: `File is too large: the limit is ${maxUploadMb} MB per file.`,
        code: 'LIMIT_REACHED',
        resource: 'upload',
        limit: maxUploadMb,
      });
    }
    return true;
  }
}

@Controller('media')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  @OrgAuth()
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('kind') kind?: string) {
    return this.media.list(user, kind === 'image' || kind === 'video' ? (kind as MediaKind) : undefined);
  }

  /** multipart/form-data: `file` plus optional `origin`, `avgColor`, `name`. */
  @UseGuards(JwtAuthGuard, OrgRoleGuard, UploadSizeGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file')) // storage + hard size cap: MulterModule in MediaModule
  async upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() fields: UploadFieldsDto,
  ) {
    if (!file) throw new BadRequestException('Attach a file in the "file" field');
    return this.media.upload(user, file, fields);
  }

  @OrgAuth()
  @Patch(':id')
  rename(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RenameMediaDto) {
    return this.media.rename(user, id, dto.name);
  }

  @OrgAuth()
  @HttpCode(200)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.media.remove(user, id);
    return { ok: true };
  }

  /**
   * Public: devices (OkHttp/ExoPlayer/Coil) and the panel fetch media without
   * auth headers. The random UUID is the capability; files are immutable per id.
   */
  @Get('file/:id')
  async file(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('range') range: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() res: Response,
  ) {
    const { asset, object, range: r } = await this.media.openFile(id, range);
    const tag = `"${asset.sha256}"`;
    res.setHeader('ETag', tag);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', asset.mimeType);
    if (ifNoneMatch === tag) {
      object.stream.destroy();
      res.status(304).end();
      return;
    }
    if (r) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${r.start}-${r.end}/${asset.sizeBytes}`);
      res.setHeader('Content-Length', String(r.end - r.start + 1));
    } else {
      res.setHeader('Content-Length', String(asset.sizeBytes));
    }
    object.stream.on('error', () => res.destroy());
    res.on('close', () => object.stream.destroy());
    object.stream.pipe(res);
  }
}

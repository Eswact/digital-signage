import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { MediaAsset } from './media-asset.entity';
import { Screen } from '../screens/screen.entity';
import { MediaService, mediaTmpDir } from './media.service';
import { MediaController, UploadSizeGuard } from './media.controller';
import { AdminSystemController } from './admin-system.controller';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaAsset, Screen]),
    OrganizationsModule,
    // Incoming files stream straight to disk (never held in memory); the real
    // per-organization limits are checked after the type/duration are known.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: { fileSize: MediaService.hardMaxBytes(config), files: 1 },
        storage: diskStorage({
          destination: (_req, _file, cb) => {
            const dir = mediaTmpDir(config);
            fs.mkdir(dir, { recursive: true }).then(() => cb(null, dir), (e) => cb(e, dir));
          },
          filename: (_req, _file, cb) => cb(null, randomUUID()),
        }),
      }),
    }),
  ],
  providers: [MediaService, UploadSizeGuard],
  controllers: [MediaController, AdminSystemController],
  exports: [MediaService],
})
export class MediaModule {}

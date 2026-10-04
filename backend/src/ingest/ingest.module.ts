import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './api-key.entity';
import { Screen } from '../screens/screen.entity';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from './api-key.guard';
import { IngestService } from './ingest.service';
import { IngestController } from './ingest.controller';
import { ApiKeysController } from './api-keys.controller';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { ScreensModule } from '../screens/screens.module';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey, Screen]), ScreensModule],
  providers: [ApiKeysService, ApiKeyGuard, IngestService, QueueService],
  controllers: [IngestController, ApiKeysController, QueueController],
})
export class IngestModule {}

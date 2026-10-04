import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { validateEnv } from './config/env.validation';
import { databaseOptions } from './database/data-source';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DevicesModule } from './devices/devices.module';
import { ScreensModule } from './screens/screens.module';
import { GroupsModule } from './groups/groups.module';
import { RealtimeModule } from './realtime/realtime.module';
import { EventsModule } from './events/events.module';
import { IngestModule } from './ingest/ingest.module';
import { BackupModule } from './backup/backup.module';
import { MailModule } from './mail/mail.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { MediaModule } from './media/media.module';
import { SchedulesModule } from './schedules/schedules.module';
import { LiveModule } from './live/live.module';

@Module({
  imports: [
    // DSN yoksa no-op (bkz. instrument.ts).
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Sınırlar uç bazında @Throttle ile verilir (common/throttle.ts); global guard yok.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseOptions({
          NODE_ENV: config.get<string>('NODE_ENV'),
          DB_FILE: config.get<string>('DB_FILE'),
        }),
        // Tek dosyalık yerel veritabanı (Postgres'e gerek yok). Geliştirmede
        // otomatik şema, production'da migration (database/data-source.ts).
        autoLoadEntities: true,
      }),
    }),
    MailModule,
    EventsModule,
    OrganizationsModule,
    UsersModule,
    AuthModule,
    DevicesModule,
    ScreensModule,
    GroupsModule,
    RealtimeModule,
    IngestModule,
    BackupModule,
    MediaModule,
    SchedulesModule,
    LiveModule,
  ],
  // Yakalanmayan hatalar (5xx) Sentry'ye; 4xx'ler yine Nest'in normal yanıtı.
  providers: [{ provide: APP_FILTER, useClass: SentryGlobalFilter }],
})
export class AppModule {}

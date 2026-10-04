// Sentry, diğer modüllerden önce yüklenmeli (opsiyonel; SENTRY_DSN ile açılır).
import './instrument';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`Backend ready → http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`WebSocket → ws://localhost:${port}/ws`, 'Bootstrap');
}
bootstrap();

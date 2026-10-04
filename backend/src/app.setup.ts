import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

/** Uygulama ayarları — main.ts ve e2e testleri aynı yapılandırmayı kullanır. */
export function configureApp(app: NestExpressApplication) {
  // Güvenlik başlıkları. (İleride medya dosyaları başka origin'den yüklenecek.)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Reverse proxy (Caddy/Nginx) arkasında gerçek istemci IP'si — rate limit için.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

  // Ham WebSocket (Android OkHttp ile uyumlu — socket.io değil)
  app.useWebSocketAdapter(new WsAdapter(app));

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
}

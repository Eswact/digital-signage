import * as Sentry from '@sentry/nestjs';

/**
 * Hata raporlama (opsiyonel). SENTRY_DSN verilmezse SDK başlatılmaz ve
 * hiçbir veri dışarı gönderilmez. main.ts'te her şeyden önce import edilir.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0,
  });
}

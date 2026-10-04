import 'reflect-metadata';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * TypeORM ayarları — uygulama (app.module) ve migration CLI'ı aynı kaynağı
 * kullanır. Geliştirmede şema `synchronize` ile kurulur; production'da
 * (`NODE_ENV=production`) synchronize kapalıdır ve açılışta migration'lar
 * çalışır (`migrationsRun`).
 *
 * Entity değiştirince:
 *   npm run migration:generate -- src/database/migrations/<Ad>
 * (boş/güncel bir veritabanına karşı; bkz. README "Migration").
 */
export function databaseOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  const production = env.NODE_ENV === 'production';
  return {
    type: 'better-sqlite3',
    database: env.DB_FILE || 'signage.db',
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: !production,
    migrationsRun: production,
  };
}

/** Migration CLI'ı için (typeorm -d src/database/data-source.ts). */
export default new DataSource({ ...databaseOptions(), synchronize: false, migrationsRun: false });

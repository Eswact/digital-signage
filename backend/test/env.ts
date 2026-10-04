// Testler yerel .env'den bağımsız, bellek içi SQLite ile çalışır.
import { tmpdir } from 'os';
import { join } from 'path';

process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'admin-test-password';
process.env.PANEL_URL = 'http://panel.test';
process.env.BACKUP_DIR = join(tmpdir(), `signage-test-backup-${process.pid}`);
process.env.MEDIA_DIR = join(tmpdir(), `signage-test-media-${process.pid}`);
process.env.FFPROBE_PATH = join(__dirname, 'fixtures', 'fake-ffprobe.js');
delete process.env.SENTRY_DSN;
delete process.env.TRUST_PROXY;

// Manual SQLite backup (safe while the server is running — online backup).
//
// Usage (from backend/):
//   npm run backup                       # DB_FILE → ./backups/
//   DB_FILE=/data/signage.db BACKUP_DIR=/data/backups npm run backup
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';

const dbFile = process.env.DB_FILE || 'signage.db';
const dir = process.env.BACKUP_DIR || 'backups';
mkdirSync(dir, { recursive: true });
const file = join(dir, `signage-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);

const db = new Database(dbFile, { readonly: true, fileMustExist: true });
await db.backup(file);
db.close();
console.log(`Backup written: ${file}`);

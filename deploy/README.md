# Server setup

The backend (NestJS + SQLite) and the panel (Next.js) run behind a single origin:
`/api` and `/ws` go to the backend, everything else goes to the panel. Devices get
the server address from their own settings screen (e.g. `signage.example.com`).

## 1. With Docker (recommended, one command)

```bash
cp deploy/.env.example deploy/.env   # fill in the values (see below)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

- If `SITE_ADDRESS` is a domain name (its DNS record must point at the server; ports
  80/443 open) Caddy obtains and renews the Let's Encrypt certificate by itself.
- The database, backups and uploaded media live on the `signage-data` volume
  (`/data/signage.db`, `/data/backups/`, `/data/media/`). The schema is created by
  migrations at first start.
- The backend image includes `ffmpeg`: uploaded video length is verified with `ffprobe`.
- Updating: `git pull` → the same `up -d --build` command. Migrations run
  automatically at startup.
- Logs: `docker compose -f deploy/docker-compose.yml logs -f backend`

**Required variables** (the backend refuses to start if they are missing or weak):

| Variable | Description |
|---|---|
| `JWT_SECRET` | At least 32 characters, e.g. `openssl rand -hex 32` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The first superadmin (password of at least 10 characters) |
| `PANEL_URL` | The panel's public address — used for the QR pairing link on devices and links in emails |
| `CORS_ORIGIN` | Usually the same as `PANEL_URL` |

**Optional:**

| Variable | Description |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email for invitations and password reset. Without `SMTP_HOST` nothing is sent: the links are logged. |
| `MEDIA_STORAGE=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | Store media in an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO) instead of the local disk. Not verified against a real bucket in this repository. |
| `MEDIA_DIR` | Local media directory (`/data/media` in Docker). |
| `JWT_EXPIRES_IN`, `REFRESH_TTL_DAYS` | Access-token lifetime (default 15m) and refresh-token lifetime (default 30 days). |

**On a LAN without a domain name:** `SITE_ADDRESS=:80` serves plain HTTP only.
Release APKs refuse cleartext connections (only the debug APK allows them); use a
domain name + TLS for field installs.

**Uploads behind your own proxy:** allow large request bodies on `/api/media`
(`client_max_body_size`, see `nginx.conf`) and do not buffer `/api/live` (server-sent
events). The bundled Caddyfile and nginx.conf already do both.

## 2. Without Docker (systemd or pm2)

Node 22 is required (prebuilt `better-sqlite3` binary), plus `ffmpeg` for video uploads.

```bash
# Backend
cd /opt/signage/backend && npm ci && npm run build
sudo mkdir -p /etc/signage /var/lib/signage && sudo chown signage /var/lib/signage
sudo cp deploy/signage-backend.service /etc/systemd/system/
# /etc/signage/backend.env: NODE_ENV=production, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD,
#   DB_FILE=/var/lib/signage/signage.db, BACKUP_DIR=/var/lib/signage/backups,
#   MEDIA_DIR=/var/lib/signage/media, PANEL_URL, CORS_ORIGIN, TRUST_PROXY=1

# Panel
cd /opt/signage/panel && npm ci && NEXT_PUBLIC_API_URL=/api npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
sudo cp deploy/signage-panel.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now signage-backend signage-panel
```

Put `deploy/nginx.conf` in front (or `deploy/Caddyfile`, with `backend:3001` →
`127.0.0.1:3001`). If you prefer pm2 use `deploy/ecosystem.config.cjs`.

## 3. Backup and restore

- **Automatic:** when `BACKUP_DIR` is set the backend takes a `signage-<time>.db`
  backup every day at `BACKUP_HOUR` (local time) and keeps the newest `BACKUP_KEEP`
  files. A backup does not stop the running server (SQLite online backup).
- **Manual:** `cd backend && DB_FILE=… BACKUP_DIR=… npm run backup`
  (in Docker: `docker compose -f deploy/docker-compose.yml exec backend npm run backup`).
- **Copy backups off the server:** move the backup directory regularly to another
  machine / object storage (`rclone`, `rsync`, …); a backup on the same disk does not
  protect against a disk failure.
- **Media files are not part of the SQLite backup.** Back up `MEDIA_DIR` (or rely on
  your bucket's own durability) separately.

**Restore:**

```bash
# Docker
docker compose -f deploy/docker-compose.yml stop backend
docker compose -f deploy/docker-compose.yml run --rm --entrypoint sh backend -c \
  'cp /data/backups/signage-<time>.db /data/signage.db && rm -f /data/signage.db-wal /data/signage.db-shm'
docker compose -f deploy/docker-compose.yml start backend

# systemd
sudo systemctl stop signage-backend
cp /var/lib/signage/backups/signage-<time>.db /var/lib/signage/signage.db
rm -f /var/lib/signage/signage.db-wal /var/lib/signage/signage.db-shm
sudo systemctl start signage-backend
```

If the restored backup has an older schema version, the migrations bring it up to
date at startup.

## 4. Error reporting (optional)

With `SENTRY_DSN` set, backend errors go to Sentry; when empty no data is sent. For
Android the DSN is passed at build time: `./gradlew assembleRelease -PSENTRY_DSN=…`.

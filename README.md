# Digital Signage

A real-time digital signage management system driven by JSON. Instead of pushing video files for everything, the server sends small JSON documents and the Android devices render them with predefined templates. Pictures and videos are supported too: they live in a media library, are downloaded to the device ahead of time and play from its disk, even offline.

For the detailed architecture see [CLAUDE.md](CLAUDE.md), for how the pieces work together see [HOW-IT-WORKS.md](HOW-IT-WORKS.md), for the roadmap [TODO.md](TODO.md), for analyses and reports [docs/](docs/).

> **Status:** Prototype. It works end to end on a local network; what must be closed before a production launch is listed in the [productization analysis](docs/2026-10-04-urunlesme-ve-rakip-analizi.md) (written in Turkish).

## Components

| Folder | What | Stack |
|--------|------|-------|
| [backend/](backend/) | API + WebSocket gateway | NestJS · SQLite · in-process event bus |
| [panel/](panel/) | Admin panel (English, Turkish translation) | Next.js 14 · Tailwind · React Query |
| [android/](android/) | Screen APK | Kotlin · Compose · OkHttp · Hilt · Room · Coil · Media3 |
| [scripts/](scripts/) | Test helpers, design-token generator | Node.js |
| [shared/](shared/) | Design values shared by panel + Android | JSON |
| [deploy/](deploy/) | Server setup | Docker Compose · Caddy · Nginx · systemd |
| [docs/](docs/) | Analyses and reports | Markdown |

**No infrastructure is needed for development** — no Docker, Postgres or Redis. For a real server see [deploy/README.md](deploy/README.md) (Docker Compose + automatic TLS, or systemd). The database is a single SQLite file (`signage.db`); the real-time bridge is an in-process event bus.

## Requirements

- **Node.js 22 LTS** — the `better-sqlite3` native module may fail to build on newer versions (24+) for lack of a prebuilt binary.
- **Android Studio 2024.1+** (AGP 8.5) and **JDK 17–21** for Gradle. If Studio's bundled JDK is newer, pick 17/21 under *Settings → Build Tools → Gradle → Gradle JDK*.
- **ffmpeg** (its `ffprobe`) on the server if you want video uploads: the server verifies each video's length with it. Without it videos are rejected — for development you can set `MEDIA_ALLOW_UNVERIFIED_VIDEO=true`.

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env   # ADMIN_EMAIL / ADMIN_PASSWORD bootstrap the administrator
npm install
npm run start:dev      # http://localhost:3001/api  ·  ws://localhost:3001/ws
```

At every start `ADMIN_EMAIL` from `.env` is checked: if the user does not exist it is created as **superadmin** with `ADMIN_PASSWORD`; if it exists it is promoted (its password is not changed). In development the schema is created by `synchronize`; with `NODE_ENV=production` migrations run at startup.

Without `SMTP_*` settings no email is sent: invitation and password-reset links are written to the server log instead (and shown in the panel for invitations).

### 2. Panel

```bash
cd panel
cp .env.example .env
npm install
npm run dev            # http://localhost:3000
```

Sign in with the bootstrap administrator → **Devices** / **Screens** / **Media** / **Schedules** / **Groups** / **Team** / **Plan & usage**. Public registration is closed (only the very first account can register, on a fresh install); new people join through **Team → Invite**, platform administrators can also create accounts under **Users**. The panel speaks English; Turkish is built in (language selector in the sidebar).

### 3. Android

Open `android/` in Android Studio (AGP 8.5 → Studio 2024.1+) and run on an emulator or a real device.

- Emulator: the server is `10.0.2.2`.
- Real device: enter the server address in the app — on the pairing screen press **Server & kiosk settings** (while a screen is showing, long-press it). E.g. `192.168.1.61:3001`; it is stored on the device, no rebuild when the network changes. `API_URL` in `app/build.gradle.kts` is only the first-install default.

The device shows an 8-character Device ID → in the panel **Devices → Add device** → enter the ID → give it a screen → changes reach the device instantly.

## End-to-end flow

```
Android (generates Device ID) ──register──▶ Backend ──▶ SQLite (signage.db)
        │                                              ▲
        └──WS: ws?deviceId=XXX──▶ Gateway              │ pair / assign / update
                                     ▲                 │
Panel ──REST──▶ Backend ──publish──▶ event bus ───────┘
   ▲                                 │
   └──── SSE /api/live ◀─────────────┤  (panel refreshes itself)
                                     ▼
                              Gateway ──WS──▶ Android (renders template, plays cached media)
```

## Features

**Templates:** `media-player` (picture, video or slideshow) · `info-board` (free-form text and lists) · `order-board` (dynamic columns of orders) · `queue-number` (current number + up next) · `webview` (an external web page)

**Banners & badges** on every template: a strip at the top/bottom and a mark in each corner, with images (crop on upload, cover/contain, drag to choose the visible part, blurred or colored letterbox) or text.

**Media:** per-organization library ("Uploads") with quota and limits, images/videos added from any screen land there; the device caches files by checksum and plays them offline.

**Schedules:** switch a device's or group's screen by weekday and time of day, in the organization's time zone (past-midnight ranges, priorities).

**Customization:** light/dark mode, themes, custom colors; click an element in the preview to change font, size, color, alignment; preview with resolution selector

**Data sources:** panel editor (autosave) or ingest API (POS / queue machine push, `X-API-Key`)

**Teams:** organizations with owner / editor / viewer roles, email invitations, plan limits (screens, devices, members, media), password reset, session management, optional two-factor authentication (TOTP). Fully isolated tenants; a platform administrator manages all of them.

**Live panel:** the panel updates through a server-sent-events stream instead of polling.

**Security:** per-device secret (WS handshake) · hashed refresh tokens with rotation and theft detection · hashed API keys shown once · rate limiting + helmet · weak `JWT_SECRET`/password refused in production · schema by migrations

**Field:** kiosk (start at boot, launcher, screen always on, restart after crash) · Android TV launcher · QR pairing · device version/template compatibility · daily SQLite backup · optional Sentry

**Reliability:** WebSocket reconnect · heartbeat (15 s ping / 45 s timeout) · offline Room cache + media cache · `SCREEN_PATCH` delta sync · device online/offline status in the panel

## Test: POS simulation

After creating an ingest API key for an order-board screen:

```bash
node scripts/fake-pos-ingest.mjs <API_KEY>
```

For a queue-number screen: `node scripts/fake-queue-ingest.mjs <API_KEY>`.

## Tests and CI

```bash
cd backend && npm run test:e2e      # device flow, isolation, ingest, teams, media, schedules, live stream, migrations
cd backend && npm run lint
cd panel && npx next lint && npm run i18n:check
node scripts/gen-design-tokens.mjs --check   # shared/design-tokens.json and the generated files agree
node scripts/gen-brand.mjs --check           # shared/brand.json (logo, color themes, app icons) and the generated files agree
```

GitHub Actions: [.github/workflows/ci.yml](.github/workflows/ci.yml).

# Digital Signage Project

A real-time digital signage management system driven by JSON. The control plane is small JSON; Android devices render it with predefined templates. Pictures and videos are separate: they live in a media library and are cached on the device.

**Language:** English is the primary language of the product, the code, the docs and the UI (panel + Android); Turkish is a translation (panel i18n dictionary, Android `values-tr`). Code comments written before this decision may still be Turkish — new code and comments are English.

## Components

- `backend/` — NestJS API + WebSocket gateway
- `panel/` — Next.js admin panel
- `android/` — Kotlin + Jetpack Compose APK
- `scripts/` — development helpers (`fake-pos-ingest.mjs` order simulation, design-token generator)
- `docs/` — analyses and reports (see "Documentation & analyses" below)

## Documentation & analyses

- `README.md` — setup and overview · `HOW-IT-WORKS.md` — system flow (plain explanation) · `TODO.md` — roadmap · `deploy/README.md` — server setup
- **`docs/`** — every analysis/research/report the user asks for goes here; no new analysis files in the repository root.
  - File name: `YYYY-MM-DD-topic.md` (date + kebab-case title), written in English. (The two existing files from 2026-10-04 are in Turkish.)
  - Start with the date + scope; if external sources were used, end with a "Sources" list.
  - If an analysis contains a finding that changes the architecture/setup, update the relevant CLAUDE.md/README section too.
- Existing: [`docs/2026-10-04-urunlesme-ve-rakip-analizi.md`](docs/2026-10-04-urunlesme-ve-rakip-analizi.md) — productization blockers and competitor comparison (Turkish). [`docs/2026-10-04-remaining-work-plan.md`](docs/2026-10-04-remaining-work-plan.md) — plan for everything still open in TODO.md. [`docs/2026-10-04-demo-deployment-plan.md`](docs/2026-10-04-demo-deployment-plan.md) — plan for a free public demo (hosting, demo mode, APK distribution). TODO.md lists only unfinished work; delete finished items instead of ticking them.

## Tech stack

**Backend:** NestJS · SQLite (TypeORM, better-sqlite3) · in-process event bus · TypeScript  
**Panel:** Next.js 14 (App Router) · Tailwind CSS · React Query · Boxicons (`react-icons/bi`) · own UI primitives (`components/ui/`) · own i18n (`lib/i18n`)  
**Android:** Kotlin · Jetpack Compose · OkHttp WebSocket · Hilt · Room · kotlinx.serialization · Coil · Media3 ExoPlayer

## How it works

1. Android starts → generates a unique Device ID → shows it on screen
2. An admin enters the Device ID in the panel → the device is paired to an organization
3. A screen is assigned to the device (or a schedule picks one)
4. JSON is sent over WebSocket → the device renders the template
5. Changes travel event bus → WebSocket gateway → device

## Database & event bus

**SQLite (single file `signage.db`, TypeORM + better-sqlite3).** No Postgres/Redis/Docker needed. In development the schema is created by `synchronize`; with `NODE_ENV=production` `synchronize` is off and **migrations** run at startup (`database/data-source.ts`, `database/migrations/`). **When you change an entity, generate a migration:** against a database that already ran the existing migrations, `DB_FILE=<scratch>.db npm run migration:run && DB_FILE=<scratch>.db npm run migration:generate -- src/database/migrations/<Name>` (data backfills are appended by hand); the e2e `Migration` test checks that migrations and entities agree exactly. Relations need `@JoinColumn({ name: '<x>_id' })` — otherwise TypeORM creates a separate empty FK column and `onDelete` rules do not work. In production a weak/missing `JWT_SECRET` (<32 chars) or `ADMIN_PASSWORD` stops the server (`config/env.validation.ts`). At startup a bootstrap **superadmin** is created from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (`users/admin-bootstrap.service.ts`).

**The real-time bridge is the in-process event bus** (`events/event-bus.service.ts`, `EventBusService.publish`/`onMessage`) — instead of Redis; with a single backend process it does exactly the same job. `device:*` channels are forwarded to the matching socket by the gateway; `org:<id>` channels (`bus.notifyOrg(orgId, type, id?)`) carry "something changed" hints that `GET /api/live` (SSE, `live/`) streams to that organization's panels. (Horizontal scaling would require bridging back to Redis.)

## Organizations, roles & isolation

Resources (devices, screens, groups, API keys, media, schedules) belong to an **organization** (`organization_id`), not to a user. Users join through **memberships** with a role **owner / editor / viewer** (`OrgRoleGuard`, `@OrgAuth()`, `@MinOrgRole()`: reads need membership, writes need editor, member management needs owner). The JWT carries the active organization (`org`) but role and membership are re-read from the DB on every request. Platform role **`superadmin`** sees every organization (`common/scope.ts`: `orgScope`/`inScope`/`ownerOrgId`), is exempt from plan limits, moves devices between organizations and edits limits/settings.

Registration is closed (only while there are no users; the panel asks `GET /auth/setup`): the first user is superadmin, everyone else joins by **invitation** (`POST /organization/invitations`, hashed token, 7 days, mail or link shown once) or is created by a superadmin under `/users`. `OrganizationBackfillService` migrates old `user_id` ownership into personal organizations at startup (idempotent; the `user_id` columns are kept for now as `legacyUserId`). Rate limits (`common/throttle.ts`, `@Throttle`): login 10/min (IP), sensitive account actions 10/min, refresh 60/min, device registration 30/min (IP), ingest 300/min (API key). Behind a reverse proxy set `TRUST_PROXY=1`.

**Sessions** (`auth/`): short-lived access token (`JWT_EXPIRES_IN`, default 15m) + opaque rotating refresh token (hashed in the DB; reusing a revoked one revokes the whole family); `tokenVersion` invalidates issued access tokens (password change/reset, "sign out everywhere", admin password set). Password reset and invitations by email (`mail/`; without `SMTP_HOST` the content is logged and kept in `MailService.outbox` for tests). Optional **TOTP 2FA** (`auth/totp/`; secret AES-256-GCM, hashed single-use recovery codes). The panel keeps tokens in localStorage, refreshes once at a time across tabs (Web Locks) and handles the 2FA step.

**Plan limits** (`organizations/limits.service.ts`): `maxScreens`, `maxDevices`, `maxMembers` (invitations count), `maxMediaFiles`, `storageQuotaMb`, `maxUploadMb`, `maxVideoSeconds` — code defaults < platform defaults (`settings` table, superadmin `PUT /admin/limits`) < per-organization override. Exceeding one gives 403 `{ code: 'LIMIT_REACHED', resource, limit }`.

**Mutating device paths use `findOwned` (no relations), not `findForViewer` (currentScreen/group loaded):** the relation object and the FK column share one column and a loaded relation wins on `save()` — `currentScreenId` assignments silently reverted. The e2e test "persists" locks this.

Device ownership by Device ID code: the pairing screen shows an 8-character code; entering it in the panel claims the device (`POST /devices/pair`). A device linked to another organization cannot be claimed (except by superadmin). `POST /devices/:id/transfer` (superadmin, `organizationId`) moves it; `POST /devices/:id/unpair` releases it completely; `DELETE /devices/:id/screen` only clears the assignment. These, device deletion and screen deletion send SCREEN_CLEAR. QR pairing: the device shows a QR of `PANEL_URL/devices?pair=CODE`.

## WebSocket

**Raw WebSocket (`@nestjs/platform-ws`), NOT socket.io** — the Android side speaks raw OkHttp WebSocket and socket.io's protocol is incompatible. A device connects with `ws://host:3001/ws?deviceId=XXX&proto=1` and the `X-Device-Secret` header (`backend/src/realtime/`).

**Device identity:** `POST /devices/register` (before every connection attempt, idempotent) returns a per-device secret on first registration (only its SHA-256 is stored); a Device ID that has a secret cannot be registered with a missing/wrong secret (409 → Android generates a new identity). On registration the device reports its APK version (`appVersion`) and supported templates (`templates: { type: version }`, Android `TemplateRegistry.manifest`); the panel compares them with backend `TEMPLATES[...].version`/`minAppVersion` and flags incompatible assignments. Close codes: 4003 invalid secret · 4004 device not registered · 4010 protocol mismatch (`PROTOCOL_VERSION`) · 4001 a newer connection from the same device replaced this one (a late disconnect of the old one does not remove the new one).

Message types (`realtime/messages.ts`):
```typescript
SCREEN_UPDATE   // full screen data (on connect + orientation change)
SCREEN_PATCH    // only changed fields (fast-json-patch / RFC 6902 delta)
SCREEN_ASSIGN   // a new screen assignment (also sent when a schedule switches the screen)
SCREEN_CLEAR    // screen/pairing removed → device clears its cache, shows pairing
PING / PONG     // heartbeat (server 15 s ping, 45 s timeout)
DEVICE_ACK      // device confirmation
REQUEST_SCREEN  // device is out of sync → asks for a full SCREEN_UPDATE (patch fallback)
```
A data change sends SCREEN_PATCH (delta); an orientation change sends a full SCREEN_UPDATE. If a device cannot apply a patch (base `updatedAt` mismatch) it asks for a full sync with REQUEST_SCREEN.

## Template system

Every template is an independent unit. On Android it is registered in `TemplateRegistry`; a new template is one registry line plus a Composable. **End to end**, a new template touches all of: backend `TemplateType` (`screen.entity.ts`) + `TEMPLATE_TYPES` (`screens/dto/screen.dto.ts`) + `TEMPLATES` (`templates/template.types.ts`) + `validateScreenData` (`templates/validate-data.ts`); panel `TemplateType` (`lib/api.ts`) + `TEMPLATE_META`/`TEMPLATE_ORDER` (`lib/labels.ts`) + editor (`components/editors/`) + preview (`components/previews/`, `ScreenPreview.tsx`) + the editor switch in `app/(app)/screens/[id]/page.tsx`; Android Composable + `TemplateRegistry` (template + manifest version) + `minAppVersion` in the backend definition. The panel preview (React) and the device render (Compose) are separate code; when you change one, keep the other identical.

Implemented templates (all live): `media-player` (picture/video/slideshow) · `info-board` (free-form text/list blocks) · `order-board` (dynamic columns) · `queue-number` (number + up next, API-feedable) · `webview` (external page). The old `announcement` template was merged into `info-board`; `ScreenMigrationsService` idempotently migrates old data at startup. Backend definitions are in `templates/template.types.ts` (`defaultData`, `version`, `minAppVersion`, which APK versionCode first renders it: 2 for the original three, 3 for `media-player`/`webview`). Every template has a custom panel editor (`components/editors/`) built on the shared `StudioLayout`.

**info-board blocks:** `blocks: [{ id, kind: 'text'|'list', text, items, bullet, x, y, w, style }]` — x/y/w are percentages of the template area (top-left corner + width). Drag/resize in the panel preview (`InfoBoardPreview`); on Android `offset`/`width` (`InfoBoardTemplate.kt`).

**order-board is dynamic:** columns (name/color) and orders come entirely from `screen.data` (JSON). Custom editor `OrderBoardEditor.tsx`; responsive on Android (`OrderBoardTemplate.kt`).

**media-player:** `items: [Slide]` where a slide is the asset descriptor (`mediaId`, `kind`, `sha256`, `bytes`, `width`, `height`, `durationMs`, `avgColor` — rewritten by the server from the library) plus `fit` (`cover`|`contain`), `focalX/focalY` (0–100, cover only, images only), `fill` (`match` blurred copy | `color` | `none`), `fillColor`, `durationSec` (images; videos play to the end), `muted`; plus `transition` (`fade`|`slide`|`none`), `defaultDurationSec`, `shuffle`. Android: `MediaPlayerTemplate.kt`, `ui/media/MediaBox.kt` (`ImageBox`, `VideoBox`). The blurred `match` fill needs Android 12+ (older: the asset's average color); videos only offer the color fill and are cropped around the center.

**webview:** `{ url, reloadSeconds }`; `WebViewTemplate.kt` retries every 30 s while the page is unreachable. A hidden 72 dp corner area keeps the settings long-press working because WebView swallows touches.

**Banners & badges (every template):** `screen.data.overlays = { banners: [...≤2: top/bottom], badges: [...≤4: tl/tr/bl/br] }`, each an image (`media` descriptor + `fit/focal/fill/fillColor`) or text (`text`, `background`, style in `styles['banner:<id>']`/`styles['badge:<id>']`). Banners reserve space (`heightPct` of the screen height), the template gets the rest; badges float over a corner (`sizePct`/`marginPct` of the short side; circle/rounded/square). Panel: `previews/OverlayFrame.tsx` + `studio/Overlays.tsx`; Android: `ui/media/OverlayHost.kt` (wraps every template inside `TemplateRegistry.Render`, and provides the relative unit of the WHOLE screen through `LocalUnitOverride`, like the panel's `--u`). Old APKs simply ignore `overlays`.

## Appearance & customization (all templates)

Two common fields in `screen.data`: `appearance` (`mode` dark/light, `preset` theme, `colors` custom colors) and `styles` (element key → `{ font, size, color, weight, italic, align }`; only properties the user changed). Schema in the comment of `templates/template.types.ts`.

- **One source, two copies:** themes and element defaults come from `shared/design-tokens.json`; after editing run `node scripts/gen-design-tokens.mjs` (generates panel `lib/design-tokens.ts` + Android `ui/design/DesignTokens.kt`; never edited by hand; CI checks it). Labels in the JSON are English and translated in the panel (`lib/i18n/extra.ts` lists them for the checker).
- **Relative unit:** all measures assume the screen's short side = 1080. Panel preview uses a container query (`--u = 100cqmin/1080`, `u(n)`), Android `ScreenCanvas` → `LocalUnit`/`u(n)`. Resolution changes keep proportions.
- **Fonts are embedded:** `panel/public/fonts` and `android/app/src/main/assets/fonts` hold the same 7 OFL files (Roboto, Inter, Montserrat, Oswald, Bebas Neue, Playfair Display, Roboto Mono; licenses next to them). Variable fonts use the `wght` axis. **Do NOT use `res/font` + Compose `Font(resId, weight)` on Android:** different weights of one variable font get mixed up in the cache. `SignageFonts` builds a separate Typeface per weight with `Typeface.Builder(...).setFontVariationSettings("'wght' N")`.
- **Preview:** `PreviewStage` has a resolution selector (TV/tablet/kiosk/phone, landscape/portrait); clicking an element (`Sel`) opens its inspector. On phones the preview is pinned above the controls.
- **Autosave:** editors use `useScreenDraft` and, after 400 ms, send only the changed top-level keys with `PATCH /screens/:id { merge }`; server data (live updates) is applied to keys that are not being edited, so an order/queue entry added by the POS is not overwritten while a title is edited.

## Media

One library per organization (`media/`): `MediaAsset` rows + a `MediaStorage` driver (`LocalDiskStorage` default via `MEDIA_DIR`; `S3Storage` for S3-compatible buckets via `MEDIA_STORAGE=s3` — not verified against a real bucket). Upload is `POST /media` (multipart, multer streams to disk): the real type is detected from magic bytes (JPEG/PNG/GIF/WebP/MP4/WebM, never SVG), the SHA-256 deduplicates per organization, image size is read, **video length is read with `ffprobe` on the server** (`FFPROBE_PATH` or PATH; without it video is rejected unless `MEDIA_ALLOW_UNVERIFIED_VIDEO=true`), then plan limits are checked. Filenames from multer are latin1-decoded and must be re-decoded as UTF-8. Files are served publicly by random UUID at `GET /media/file/:id` (Range, ETag, immutable cache) so devices need no headers. `MediaService.normalizeRefs` validates every `mediaId` in screen data (must belong to the organization) and overwrites the descriptor fields from the library; deleting a file a screen uses gives 409 `MEDIA_IN_USE`. **The "JSON only" principle is now: the control plane is JSON; media is separate, checksummed and cached.** Panel: crop/resize on upload happens client-side (`lib/media.ts`, `CropDialog`), the picker is `MediaPicker`, uploads go through `useMediaUpload` (progress via XHR). Android: `data/media/MediaCache.kt` downloads the current screen's assets ahead of time (`MainViewModel` → `collectAssets`), verifies SHA-256, keeps a 2 GB / 40 %-of-free-space LRU quota, and players read from disk (streaming only while online and not yet downloaded).

## Schedules

`schedules/` — a schedule = target (device or group) + screen + weekdays + start/end time (null = all day; end earlier than start runs past midnight) + priority + enabled, evaluated in the organization's `timezone` (`Intl`, no dependency; `schedule.logic.ts` is pure and unit-tested). `Device.currentScreenId` is the base assignment; **`Device.activeScreenId` is what the device shows now** (schedule winner, else base). `ScheduleEngine` (`schedule-engine.service.ts`) keeps it up to date: every 15 s, on startup, at connect time and after any assignment/group/schedule change (`syncDevice`); it pushes SCREEN_ASSIGN/SCREEN_CLEAR only when the result changes (or `force` for an explicit assignment). Patches (`devicesShowing`) go to devices by `activeScreenId`. A device-specific schedule beats a group one; higher priority wins.

## Orientation

Every screen has an `orientation`: `landscape` | `portrait` | `auto` (first-class on the Screen entity). It is per screen: the device rotates to the orientation of its assigned screen (`SignageRoot` → `requestedOrientation`). `auto` (panel: "Adaptive") does not lock the orientation (`SCREEN_ORIENTATION_UNSPECIFIED`) and the layout changes as the device rotates. Templates adapt to both (Compose `BoxWithConstraints`, panel `useCanvas().portrait`).

## Data sources (order-board, queue-number)

1. **Panel editor** — an admin manages orders/queue by hand; a change is a PATCH → live.
2. **Ingest API** — an external system (POS, queue machine) pushes (`backend/src/ingest/`). Screen-scoped API key (`X-API-Key`), granular endpoints; an endpoint returns 400 if the key's screen has the wrong template. Keys are managed in the editor's "Feed via API" section.
   - order-board: `POST/PATCH/DELETE /ingest/orders`, `PUT /ingest/orders`, `GET /ingest/state`. Test: `scripts/fake-pos-ingest.mjs <API_KEY>`.
   - queue-number: `POST /ingest/queue/next` (calls the first list entry, or adds 1 to the number when empty; "A042"→"A043") · `POST /ingest/queue/prev` · `PUT /ingest/queue/current` · `POST/PUT /ingest/queue/items`, `PATCH/DELETE /ingest/queue/items/:id`, `POST /ingest/queue/items/:id/call`. The panel does the same through `screens/:id/queue/*` (JWT, `QueueService`). Test: `scripts/fake-queue-ingest.mjs <API_KEY>`.
3. **Serialized writes:** ingest/queue operations and the panel PATCH enter a per-screen queue through `ScreensService.mutateData`/`withLock` (no read-modify-write races; single-process assumption).

## Reliability

- **Reconnect:** Android exponential backoff (1 s→30 s), raw OkHttp WS (`SignageSocket`).
- **Heartbeat:** server 15 s PING / 45 s timeout; the Android watchdog reconnects after 45 s of silence.
- **Offline:** the last screen is saved in Room (`ScreenCache`); shown at startup/offline (`live ?: cached`); its media plays from `MediaCache`.
- **Delta:** SCREEN_PATCH sends only changed fields; a base mismatch → REQUEST_SCREEN → full sync.
- **Device status:** online/offline + last seen (`lastSeenAt`) in the panel.
- **Order-board pagination:** orders that do not fit a column turn pages every `pageSeconds` (default 8); capacity is computed from the style sizes (same formula on Android and in the preview).
- **Kiosk (Android `kiosk/`):** screen always on, full screen; settings can start the app at boot (`BootReceiver`) and use it as the launcher (`HomeLauncher` alias); restart after a crash (stops after 3 crashes in 2 min). Starting from the background on Android 10+ needs the "display over other apps" permission or being the launcher. Android TV: `LEANBACK_LAUNCHER` + banner; Menu/OK on the remote opens settings.
- **Backup:** with `BACKUP_DIR` a daily SQLite backup (`backup/backup.service.ts`); manual `npm run backup`. Restore in `deploy/README.md`. Media files are not part of it.
- **Error reporting:** Sentry is never started unless `SENTRY_DSN` (backend env / Android `-PSENTRY_DSN`) is set.
- **Live panel:** the panel opens `GET /api/live` (SSE read with `fetch`; `lib/live.tsx`) and invalidates React Query keys on hints; while the stream is down queries poll (`useLiveInterval`).

## Groups

Devices can be grouped; one screen is assigned to a whole group at once (`POST /groups/:id/assign-screen` → `assignScreen` + broadcast for each device). Schedules can target a group. Panel: `/groups`.

## Brand & color themes

**One source:** `shared/brand.json` holds the logo geometry, the six color themes and the outlined "Signage" wordmark; after editing run `node scripts/gen-brand.mjs` (never edit its outputs by hand; CI checks them). It generates panel `lib/brand.ts` (mark paths, theme list), `app/palettes.css` (theme tokens), `app/icon.svg` (favicon) and Android `drawable/ic_launcher_foreground.xml` + `ic_launcher_monochrome.xml` + `mipmap-anydpi-v26/ic_launcher.xml` (adaptive icon with an Android 13 themed layer), `mipmap/ic_launcher.xml` (API 24–25), `drawable/tv_banner.xml`, `drawable/brand_mark.xml` (pairing screen), `values/brand_colors.xml` and `ui/theme/BrandColors.kt`. Everything is vector; there are no PNG icons.

- **Logo ("LED Pano · piksel", chosen 2026-10-10):** a solid D (the screen) covered by an LED pixel grid that follows its curve; the pixels of an S are lit. Lit pixels are cut out of the D (even-odd), so the plate shows through; unlit pixels are the D's color at `unlitAlpha`; one lit pixel is the highlight color. Panel `components/BrandMark.tsx` draws it from `lib/brand.ts` and follows the color theme.
- **Color themes:** Cobalt (default), Graphite, Teal, Lime, Violet, Wine — each a full light + dark set. The default sits on `:root`/`.dark`, the others under `[data-palette]` on `<html>`. Roles: `accent` = text, borders, rings, indicators; `accent-fill` = primary button and logo plate, with `accent-ink` on it (they differ only where a fill color is unreadable as text, e.g. Lime); `brand-hi` = the logo's highlighted pixel. Status colors (success/warn/danger) are shared and stay in `app/globals.css`.
- **Choice:** Account → Appearance (color theme + light/system/dark), stored per browser by `lib/theme` (`signage_palette`, `signage_theme`); `THEME_INIT_SCRIPT` applies both before first paint. The device UI (pairing, settings) and the sign-in poster always use the default theme's dark mode.

## Panel (design & i18n)

Swiss-style, mobile-first (tokens: theme colors in the generated `app/palettes.css`, status colors in `app/globals.css`, light + dark; Tailwind semantic colors `paper/surface/sunken/line/ink/accent/accent-fill/…` — use them, not raw palette colors). Routes: `app/(auth)/` (sign-in split 35 % form / 65 % promo slides, forgot/reset password, invite) and `app/(app)/` (shell with sidebar on desktop and bottom bar + "More" on phones): devices, screens (+ `[id]` editor), media, schedules, groups, team, plan, account, `admin/{users,organizations,settings}`. Data hooks live in `lib/queries.ts`, mutations use `useAction` (`lib/hooks.ts`).

**i18n:** the English sentence is the key — `t('Add device')` (`useT()`), module-level constants use `msg('…')`; other languages map it in `lib/i18n/tr.ts`; a missing entry falls back to English. `npm run i18n:check` lists uncovered strings (run in CI) — wrap new strings in `t`/`msg`/`useAction` options so the checker sees them. Backend error messages and emails are English (the panel shows them as they are).

## General principles

- The control plane is JSON; media is separate, checksummed and cached on the device
- Templates live in the APK; data comes from the server
- A change must reach the device in < 1 second
- When the connection drops the device keeps showing its last screen and playing its cached media

## Development / running

```bash
cd backend && npm run start:dev        # http://localhost:3001/api · ws://localhost:3001/ws (signage.db is created automatically)
cd panel && npm run dev                # http://localhost:3000
```
No infrastructure (Docker/Postgres/Redis) is needed in development — SQLite is one file created on first start. Server setup (Docker Compose + Caddy/TLS, Nginx, systemd/pm2, backup/restore): **`deploy/README.md`**. In Docker there is one origin: `/api` + `/ws` → backend, the rest → panel (`NEXT_PUBLIC_API_URL=/api`).

- **Use Node 22 LTS:** the `better-sqlite3` native module may fail to compile on newer Node versions (24+) for lack of a prebuilt binary. On a native-module error check the Node version before upgrading dependencies.
- **ffmpeg** (`ffprobe`) is needed for video uploads; without it set `MEDIA_ALLOW_UNVERIFIED_VIDEO=true` in development.
- Android: open `android/` in Android Studio (AGP 8.5 → Studio 2024.1+). Gradle 8.7 needs **JDK 17–21** (switch the Gradle JDK if Studio's embedded one is newer). The server address is entered on the device (pairing screen "Server & kiosk settings", or long-press the screen → `ServerSettingsDialog`) and kept in SharedPreferences (`data/ServerConfig.kt`); `API_URL` in `app/build.gradle.kts` is only the first-install default (`10.0.2.2` on an emulator). The WS address is derived from it. User-visible Android strings are in `res/values/strings.xml` (+ `values-tr`).
- `.env.example`: in `backend/`, `panel/` and `deploy/` (server setup).
- **Tests:** `cd backend && npm run test:e2e` (jest + supertest + real WS, in-memory SQLite; `test/`): device flow, isolation, ingest, rate limit, backup, migration–entity agreement, organizations/roles/invitations/limits, sessions/2FA, media (a fake `ffprobe` fixture), schedules, live stream.
- **Lint:** backend `npm run lint` (ESLint 9 flat), panel `npx next lint`, `npm run i18n:check`.
- **CI:** `.github/workflows/ci.yml` — design tokens and brand up to date, backend tsc/lint/e2e/build, panel tsc/lint/i18n/build, Android assembleDebug.
- **Design values single source:** screen themes and element defaults in `shared/design-tokens.json` (`node scripts/gen-design-tokens.mjs`); logo, panel color themes and app icons in `shared/brand.json` (`node scripts/gen-brand.mjs`).

## Known limitations

The project is a prototype. Details and priorities are in the analysis files; delete an item here when it is solved.

- A release APK only connects over https/wss (cleartext only in debug); LAN installs without a domain name need the debug APK or TLS.
- No OTA update (method is an open question in TODO.md).
- The screen lock (`withLock`), the schedule engine and the rate-limit counters are in-process — single backend process assumed.
- No preview–device screenshot comparison test; layout measures (padding etc.) are in separate code on the panel and Android.
- The S3 media driver is not verified against a real bucket; there is no thumbnail generation (the panel shows originals, images are downscaled to ≤3840 px before upload) and no server-side re-encoding.
- The `user_id` columns of the old per-user ownership model are still in the schema (`legacyUserId`); remove them with a migration once every installation has been backfilled.
- There is no billing/payment screen (the commercial phase was dropped from the roadmap); "Plan & usage" shows limits and usage only.

## Coding preferences

No strict rules, but general tendencies:

- Keep the service/controller separation in the backend
- Android: ViewModel → StateFlow → Compose
- The panel is client-heavy: tokens in `localStorage`, data with React Query; pages are `'use client'`. Repeated UI goes into the `components/ui/` primitives (shadcn is not used)
- Type safety matters, avoid `any`

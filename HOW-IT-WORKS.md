# How the system works

JSON-driven digital signage. The core idea: **the control plane is small JSON, heavy media is separate and cached.** The designs shown on screens (templates) are built into the Android APK; the server only says "render this template with this data". Pictures and videos live in a media library; devices download them ahead of time and play them from disk. So changes reach a device within a second with almost no bandwidth, and screens keep working when the network drops.

## Components

| Component | What it does | Technology |
|---|---|---|
| **backend/** | API + real-time bridge | NestJS · SQLite (TypeORM) |
| **panel/** | Admin interface (screens, devices, media, schedules, team) | Next.js 14 · Tailwind · React Query |
| **android/** | The app running on the screen (APK) | Kotlin · Jetpack Compose · OkHttp · Coil · Media3 |
| **scripts/** | POS simulation / test helpers | Node.js |

## End-to-end flow

```
An Android device starts
   └─ Generates a unique "Device ID" → shows it on screen
         └─ An admin enters this ID in the panel → the device is PAIRED to an organization
               └─ A SCREEN is assigned to the device (or a schedule picks one)
                     └─ The device receives the data over WebSocket → renders the template
                           └─ A change in the panel → visible on the device in < 1 s
```

## Organizations, roles and isolation

Every customer is an **organization**; devices, screens, groups, media, schedules and API keys belong to the organization, not to a person. People join through memberships:

- **owner** — manages members, invitations, organization settings and everything below;
- **editor** — creates and edits screens, media, devices, groups and schedules;
- **viewer** — can look, not change.

A person can belong to several organizations and switches between them in the panel. On top of that sits the platform role **superadmin** (the installation's owner): sees every organization, moves a device between organizations, edits plan limits and platform settings.

Registration is closed: the first account on a fresh install becomes superadmin; everyone else joins by **invitation** (an emailed link, valid 7 days) or is created by a superadmin. Sessions use a short-lived access token (15 min) plus a rotating refresh token; reuse of an old refresh token revokes the whole session family. Password reset by email, "sign out everywhere" and optional two-factor authentication (TOTP with recovery codes) are built in.

**Plan limits** (screens, devices, members, media files, storage, upload size, video length) come from platform defaults that a superadmin edits under *Settings*, optionally overridden per organization.

**How does a device get into an organization? (claiming by Device ID code)**

1. A freshly started device shows an 8-character **Device ID** and a "waiting" (pairing) view.
2. Someone enters that code in the panel (or scans the QR code on the device, which opens the pairing form with the code filled in) → the device is **claimed** by their organization.
3. Whoever cannot see the code cannot take the device; a device already linked to another organization cannot be claimed (except by a superadmin).
4. Claimed devices without a screen show under **Waiting for a screen**; assign one from there.

## HTTP side → WebSocket side bridge (event bus)

The panel sends a change to the backend over HTTP, but the device is connected over a **persistent WebSocket**. The change has to jump from the HTTP side to the WebSocket side. A **process-local event bus** (`events/event-bus.service.ts` — a plain `EventEmitter`) does it:

```
Panel ──HTTP──> Backend ──publish──> event bus channel "device:ABC123"
                                          │
                                          ▼ (onMessage → "device:*")
                              WebSocket Gateway (where the device is connected)
                                          │
                                          ▼
                                    Android device
```

- When a screen is updated the backend **publishes** to `device:<deviceId>`; the gateway writes it to that device's socket.
- The same bus carries `org:<id>` messages — "something changed" hints that the **live endpoint** (`GET /api/live`, server-sent events) forwards to the panels of that organization, which then refetch. The panel therefore does not poll while the stream is up.

> All real data (users, devices, screens, media metadata) is in one **SQLite** file (`signage.db`). The event bus stores nothing; it only carries live messages. Redis Pub/Sub would only be needed to run several backend processes; with one process the in-process bus does exactly the same job (and could be bridged back to Redis if scaling ever requires it).

## Why a raw WebSocket, not socket.io?

The Android side speaks a raw WebSocket through **OkHttp**; socket.io has its own handshake/framing that OkHttp cannot speak. So the backend uses `@nestjs/platform-ws`. A device connects to:

```
ws://<host>:3001/ws?deviceId=XXXX&proto=1      (header X-Device-Secret)
```

### Message types (`realtime/messages.ts`)

| Type | When | Content |
|---|---|---|
| `SCREEN_UPDATE` | On connect + when the orientation changes | Full screen data |
| `SCREEN_PATCH` | When data changes | Only the changed fields (RFC 6902 delta) |
| `SCREEN_ASSIGN` | A new screen is assigned (or a schedule switches it) | The new screen's full data |
| `SCREEN_CLEAR` | Screen/pairing removed | The device clears its cache and returns to pairing |
| `PING` / `PONG` | Every 15 s | Heartbeat |
| `DEVICE_ACK` | Device confirmation | — |
| `REQUEST_SCREEN` | The device is out of sync | Asks for a full `SCREEN_UPDATE` (when a patch fails) |

**Delta logic:** for a small change (a new order) only the difference travels. If a device cannot apply a patch (its base does not match) it asks for the full data with `REQUEST_SCREEN`. An orientation change always sends a full `SCREEN_UPDATE`.

## Template system

Every template is an independent unit. The design is in the APK; the server only sends data.

- On Android a template is registered in `TemplateRegistry` (`"order-board" → OrderBoardTemplate`): a new template is **one line plus one Composable**.
- On the backend the definition lives in `templates/template.types.ts` (`defaultData`, version, `minAppVersion`); `templates/validate-data.ts` checks the keys the server understands.
- In the panel every template has its own editor sharing one layout: Content / Appearance / Banners & badges tabs beside a preview with a resolution selector. Clicking an element in the preview customizes its font, size, color, weight and alignment. Changes are saved automatically.
- Appearance (light/dark, theme, custom colors) and element styles are JSON too (`appearance`, `styles`); the device draws with the same fonts and relative measures, so the preview looks like the device.

### Templates

| Template | What it shows |
|---|---|
| `media-player` | A picture or video full screen, or a slideshow (per-slide time, fade/slide transition, shuffle). Cover (drag to choose the visible part) or contain (blurred/colored/empty letterbox) |
| `info-board` | Free-form text and bullet-list blocks placed anywhere on the screen |
| `order-board` | Dynamic columns of orders (columns and orders come entirely from JSON) |
| `queue-number` | A big queue number (+ name) and an optional "up next" list |
| `webview` | An external web page (needs a connection; reloads on an interval; retries when unreachable) |

### Banners and badges (every template)

`screen.data.overlays` holds up to two **banners** (top/bottom strips that take space from the template) and four **badges** (a mark in each corner, round/rounded/square). Each is a library image or a text. For images: *cover* with a draggable visible part, or *contain* with the empty space filled with a blurred copy, a color or nothing. The panel preview and the Android `OverlayHost` implement the same layout; the relative unit (short side = 1080) always comes from the whole screen.

## Media

- **One library per organization** ("Uploads"). Anything added from a screen editor or an overlay also lands there. Limits (files, storage, upload size, video length) come from the plan.
- **Upload:** `POST /api/media` (multipart, streamed to disk). The server detects the real file type from its bytes (JPEG, PNG, GIF, WebP, MP4, WebM; never SVG), hashes it (a duplicate returns the existing file), reads image size, and checks the video length with `ffprobe`. The panel crops/downsizes images before uploading (canvas) and computes an average color.
- **References:** screens reference files by `mediaId`; the server rewrites the descriptor (hash, size, kind, duration) from the library so clients cannot forge it, rejects other organizations' files, and refuses to delete a file that a screen still uses (409 with the screen names).
- **Storage:** `MediaStorage` driver — local disk (default, `MEDIA_DIR`) or S3-compatible (`MEDIA_STORAGE=s3`; AWS S3, Cloudflare R2, MinIO — not verified against a real bucket in this repository).
- **Serving:** `GET /api/media/file/:id` is public (the random UUID is the capability) with `Range`, `ETag` and immutable caching, so OkHttp/ExoPlayer/Coil need no headers.
- **On the device (`MediaCache`):** the media of the current screen is downloaded in order ahead of time, verified against the announced SHA-256, kept under a disk quota (least-recently-used removed first), and played from disk. Until a file is downloaded it streams while online and is skipped while offline.

## Schedules

A schedule says "show screen X on device/group Y on these weekdays between these times" (organization time zone; a range may run past midnight; higher priority wins; a device-specific schedule beats a group one). While one is active it overrides the base assignment (`currentScreenId`); `activeScreenId` always holds what the device shows now. The `ScheduleEngine` re-evaluates every 15 s and whenever schedules, assignments or groups change, and pushes `SCREEN_ASSIGN`/`SCREEN_CLEAR` only when the result changes. Data patches go to the devices showing a screen right now.

## Orientation

Every screen has an `orientation`: `landscape`, `portrait` or `auto` (adaptive). The device rotates to the orientation of its assigned screen; with `auto` it is not locked and shows the layout of however the device is standing. Templates adapt to both (Compose `BoxWithConstraints`; the panel preview offers TV/tablet/kiosk resolutions).

## Data sources (order-board and queue-number)

1. **Panel editor** — an admin manages orders/queue by hand; every change goes live instantly.
2. **Ingest API** — an external system **pushes** data with a screen-scoped API key (`X-API-Key`), created under "Feed via API" in the editor.
   - Order board (POS): `POST/PATCH/DELETE /ingest/orders`, `GET /ingest/state`, `PUT /ingest/orders`. Test: `scripts/fake-pos-ingest.mjs <API_KEY>`.
   - Queue number (queue machine): `POST /ingest/queue/next`, `POST /ingest/queue/prev`, `PUT /ingest/queue/current`, `POST /ingest/queue/items` … Test: `scripts/fake-queue-ingest.mjs <API_KEY>`.

## Reliability

- **Reconnect:** Android retries with a growing delay (1 s → 30 s).
- **Heartbeat:** the server pings every 15 s and drops a device after 45 s of silence; Android reconnects after 45 s of silence too.
- **Offline resilience:** the last screen is saved in Room and shown when the network is gone or at startup (`live ?: cached`); its media is played from the media cache.
- **Device status:** online/offline + last seen, APK version and an "update needed" warning in the panel.
- **Busy order board:** orders that do not fit a column turn pages every few seconds (scrolling is useless on an unattended screen).
- **Kiosk:** the screen never sleeps and runs full screen; optionally the device starts the app at boot or uses it as its launcher; the app restarts itself after a crash.

## Security

- **Device secret:** a device gets its own secret at first registration and sends it on every connection; knowing the Device ID is not enough to connect or impersonate it.
- **API keys** are stored only as hashes; the panel shows a key once, when it is created. Refresh tokens and invitation/reset tokens are stored hashed too.
- **Limits:** login attempts, device registration, ingest requests and sensitive account actions are rate-limited per minute.
- **Production:** the server refuses to start with a weak or example `JWT_SECRET`/administrator password; the schema is created by migrations and a daily backup can be taken (see `deploy/README.md`).

## Groups

Devices can be grouped; one screen is assigned to the whole group at once (`POST /groups/:id/assign-screen` → `assignScreen` + broadcast for every device). Schedules can target a group.

## Summary of principles

- The control plane is JSON; heavy media is separate, checksummed and cached on the device.
- Templates live in the APK; data comes from the server.
- A change must reach the device in < 1 second.
- When the connection drops the device keeps showing its last screen and playing its cached media.

## Running it

```bash
cd backend && npm run start:dev         # http://localhost:3001/api · ws://localhost:3001/ws (signage.db is created automatically)
cd panel && npm run dev                 # http://localhost:3000
```

No infrastructure (Docker/Postgres/Redis) is needed for development — the database is a single file created on first start. For a real server see `deploy/README.md` (one-command Docker Compose + automatic HTTPS).

Android: open `android/` in Android Studio. On a real device the server address is entered in the app (pairing screen → "Server & kiosk settings"; with a screen showing, long-press it), e.g. your PC's LAN IP `192.168.1.61:3001`. On an emulator use `10.0.2.2:3001`.

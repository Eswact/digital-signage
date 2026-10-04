# Plan for the remaining work

**Date:** 2026-10-04 · **Scope:** everything still open in [TODO.md](../TODO.md): fleet management and monitoring, device delivery (setup, OTA, preview/device parity) and follow-ups from the media/panel work.

Work packages are ordered so that each one builds on the previous. Every package ends with the same checks: backend `tsc` + `eslint` + e2e + build, panel `tsc` + `next lint` + `i18n:check` + build, Android `assembleDebug`, and — for anything the user sees — a look at it in Chrome (desktop + phone width) and on the connected phone.

## Decisions to make first

- **OTA method** (blocks WP8). Options: (a) self-hosted APK + in-app download and system installer prompt — needs a person to confirm each install unless the app is a device owner; (b) MDM (Android Enterprise) — silent, but external tooling; (c) Play Store — easiest, only for devices with Google services. Recommendation: (a) with a version manifest on the backend, plus documentation for MDM users.
- **Notification channel** (WP3): email first (SMTP already exists); Telegram as a second channel behind a bot token setting.
- **Proof-of-play granularity** (WP6): one record per slide/screen *shown* (start time + duration) is enough for reporting and keeps the volume manageable.

## WP1 — Device info reporting
Extend `POST /devices/register` (and a periodic report over WS) with `model`, `androidVersion`, `freeStorageMb`, `lastError`; store on `Device`, show in the device row/detail, migration. Android collects them (`Build`, `StatFs`, last crash/exception captured by the crash handler). Old APKs simply omit the fields.

## WP2 — Basic metrics
`GET /api/admin/metrics` (superadmin) and a small panel card: connected devices, devices by organization, WS message counts, delivery latency (time between publish and device ACK, measured in the gateway). In-process counters only; Prometheus text format endpoint behind a token for scraping.

## WP3 — Offline notifications
A scheduler checks devices every minute; a device that stays offline longer than the organization's threshold (setting, default 10 min) sends one notification (and one "back online" notice). Recipients and channel per organization (owners by default). Deduplicate so a flapping device does not spam. Tests with a fake clock.

## WP4 — Remote screenshot and restart
New WS messages `COMMAND` (`screenshot`, `restart`) and `COMMAND_RESULT`; the device advertises `capabilities` at registration so the panel only offers actions it supports. Screenshot: Android renders the root view to a bitmap, uploads it (size-capped, short retention) and the panel shows it. Restart: relaunch the activity process. Audit entry per command. Protocol stays at version 1 (unknown types are ignored by old devices).

## WP5 — Emergency announcement
An organization-level "alert" (text, style, expiry) that devices draw above everything, including banners. Delivered as a new WS message `ALERT` / `ALERT_CLEAR` so it does not rewrite screen data; sent on connect when active. Panel: a compose dialog (all devices or selected groups/devices) and a visible "alert active" state with a clear button. Android: an overlay composable in `SignageRoot`.

## WP6 — Proof of play
Devices report `PLAY` events (screen id, slide/media id, start, duration) in batches over WS (buffered in Room while offline). Backend table with retention setting; panel report page (filters: device, screen, date range) and CSV export. Requires a protocol capability flag so old devices are skipped.

## WP7 — Runtime server setup
First-start setup screen on the device: scan a QR code (or enter a short setup code) that carries the server address; the panel shows that QR under Devices → "Set up a new device". LAN discovery (mDNS/`_signage._tcp`) as an optional extra. Keeps the typed address as the fallback.

## WP8 — OTA update
Backend: `apk_releases` (versionCode, name, file, checksum, notes), upload by superadmin, `GET /api/app/latest`. Device: at registration it learns the latest version, downloads the APK in the background (checksum verified), and prompts for install (silent when it is device owner). Panel: release list and per-device "update available" state. Depends on the decision above.

## WP9 — Load test, then maybe Redis
A script that opens N simulated devices (register, connect, ack pings) against a local backend and drives screen updates; measure memory, event-loop lag and delivery latency at 100/250/500/1000. Only if a single process fails the 500-connection target, bridge `EventBusService` to Redis pub/sub and run two backend nodes in the test.

## WP10 — Template schema and preview/device parity
Define each template's data schema once (JSON Schema or zod) and generate: backend validation, panel TypeScript types, Kotlin data classes (extending `scripts/gen-design-tokens.mjs`'s approach, checked in CI). Add a parity test: render a set of fixture screens in the panel (headless Chrome, fixed viewport) and on an Android emulator/device, diff the screenshots with a tolerance, and fail CI on regressions.

## WP11 — Follow-ups
- S3 driver: run the media e2e against MinIO in CI (service container).
- Android TV / Fire TV: test on a real box; fix focus order, banner/badge layout and video playback issues found.
- Panel UI tests: Playwright specs for upload + crop, create screen, slideshow/banner editing, invite + accept, wired into CI.
- Remove `legacyUserId` columns via migration (after a release that logs "0 rows to backfill").
- Translate remaining Turkish code comments.

## Risks
- OTA and remote commands widen the attack surface: every command is authenticated per device secret, scoped to the organization, rate-limited and audited.
- Screenshot parity tests are sensitive to font rendering; pin fonts (already embedded) and compare with a perceptual tolerance rather than exact pixels.
- Load-test numbers on a laptop are an estimate; repeat on production-like hardware before relying on them.

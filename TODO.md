# TODO

Only what is **not done yet**. Everything else (accounts and teams, media, banners/badges, schedules, webview, panel redesign, i18n, live panel updates, kiosk, TV launcher, QR pairing, template versioning, deployment, CI) is in the codebase; see [CLAUDE.md](CLAUDE.md) for how it works.

The plan for the items below is in [docs/2026-10-04-remaining-work-plan.md](docs/2026-10-04-remaining-work-plan.md). `(§x)` points to the matching section of the [productization analysis](docs/2026-10-04-urunlesme-ve-rakip-analizi.md) (written in Turkish).

---

## Fleet management and monitoring

- [ ] Device info reporting: model, Android version, free storage, last error (the APK version and supported templates are already reported) (§2.2-16)
- [ ] Basic metrics: connected devices, message latency
- [ ] Offline notification by email / Telegram when a device has been offline for a set time (§2.2-16)
- [ ] Remote screenshot and remote restart of the app (§2.2-16)
- [ ] Emergency announcement: a message above the content on all or selected screens (§7)
- [ ] Proof of play: a record of which content was shown on which screen and when, with export (§2.2-16)
- [ ] Load test with at least 500 concurrent connections
- [ ] Multi-node WebSocket support with a Redis adapter — only if the load test shows a single process is not enough

## Devices and delivery

- [ ] Runtime server setup without typing an address: QR or setup code on first start, or LAN discovery (today the address is typed on the device) (§2.1-4)
- [ ] OTA update: the APK downloads itself from your own server, or an MDM (method still open, see Open questions) (§2.2-15)
- [ ] Template data schema from a single source (JSON Schema/zod → panel + Kotlin) and a screenshot-comparison test between the panel preview (React) and the device render (Compose); design tokens are already generated (§2.2-20)

## Follow-ups from the media/panel work

- [ ] Verify the S3/R2 media driver against a real bucket (e.g. MinIO in CI)
- [ ] Try the app on an Android TV / Fire TV box (D-pad, media playback, banner/badge layout); so far only a phone was tested
- [ ] Browser-driven UI tests for the panel's main flows in CI (upload + crop, create screen, edit slides/banners, invitations)
- [ ] Remove the legacy `user_id` columns (`legacyUserId`) with a migration once every installation has been backfilled
- [ ] Translate the remaining Turkish code comments to English
- [ ] Billing/plan-change screens, if the commercial phase returns (payments and subscriptions were dropped from the roadmap)

---

## Open questions

- How will APK updates be managed — own server, MDM or Play Store? (decides the OTA item above)
- Is Android TV / Fire TV the main hardware to optimize for? (the analysis suggests yes; D-pad support exists)

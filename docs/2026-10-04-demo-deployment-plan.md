# Plan: free public demo for a portfolio

**Date:** 2026-10-04 · **Scope:** publishing the project as a low-traffic public demo (panel, backend, downloadable APK) on free hosting, and presenting it in a portfolio. Hosting limits below are from general knowledge of free tiers and change often — re-check before committing to one.

## Goal and constraints

- Visitors can open a live panel, see content change on a screen, and install the APK to pair a real device.
- Usage is occasional and low; cost must be zero or near zero.
- The project must not be abusable (public uploads, public sign-up) and must recover by itself.

## What free hosting means for this project

| Constraint (typical free web service) | Effect | Answer |
|---|---|---|
| Sleeps after ~15 min idle, 30–60 s cold start | First visitor waits; device WebSockets drop | "Server is waking up" state in the panel; optional uptime-monitor ping every 5 min (watch the monthly hour quota) |
| Ephemeral disk (no persistent disk on the free tier) | `signage.db` and uploaded media vanish on restart/redeploy | **Seed demo data at every start** (demo mode); treat resets as a feature |
| HTTPS/WSS provided | Release APK only connects over https/wss — works | Bake the demo URL into the APK |

## Hosting options

| Option | Pros | Cons |
|---|---|---|
| **Panel on Vercel/Netlify + backend on Render free** | Zero cost, simple, panel never sleeps | Backend sleeps, data resets |
| **Oracle Cloud Always Free VM** | Real VM, persistent disk, no sleeping, existing `deploy/` Docker Compose + Caddy works as is | Account sign-up friction, free VM can be reclaimed if idle for long |
| Koyeb / Fly.io / Railway | Easy deploys | Free allowances are limited or time-boxed |
| Home server + Cloudflare Tunnel | Persistent, free | Depends on your machine being on |

**Recommendation:** panel on Vercel (client-side app, `NEXT_PUBLIC_API_URL` → backend, backend `CORS_ORIGIN` → panel) and backend on Render free with demo mode. Move the backend to an Oracle VM if cold starts or resets turn out to hurt the demo.

## Presentation in the portfolio

In this order: (1) a 30–60 s screen recording/GIF — change something in the panel, the phone updates instantly; (2) live demo link with a note about the cold start; (3) APK download button; (4) a short architecture diagram (the flow in the README) and the repository link. The video is mandatory because the live demo may be asleep.

## Work packages

### WP1 — Demo mode (backend)
- `DEMO_MODE=true`: on startup create a demo organization with sample screens (one per template), sample media bundled in the repo, a sample schedule and a plan with low limits (few screens/devices, small storage, short videos).
- Reset the demo organization on a timer (e.g. nightly) and on every cold start; the in-memory/ephemeral DB makes the latter free.
- Demo-only guards: no public user creation, no password/2FA changes on demo accounts, stricter upload and rate limits, a visible "demo — data resets" notice in the panel.
- Fixed demo credentials documented in the README; real admin password and `JWT_SECRET` are separate secrets in the host's environment.

### WP2 — Visitor isolation (decision needed)
- **Option A — read-only demo user:** a *viewer* in the demo organization. Safe and trivial, but visitors cannot try editing.
- **Option B — temporary sandbox per visitor:** a "Try the demo" button creates an organization with a seeded copy of the sample content and an editor account, expiring after a few hours (cleanup job). Impressive and safe, needs a small feature: demo-session endpoint, per-sandbox limits, cleanup.
- Recommendation: B, falling back to A if time is short.

### WP3 — Release APK
- Generate a signing keystore (kept out of the repository), configure `signingConfigs` through environment variables, build a signed release APK.
- Build flavor or Gradle property for the default server address (`-PAPI_URL=https://<demo-host>/api`) so visitors never type an address.
- Publish the APK as a GitHub Release asset (stable download URL), with version name, checksum and a short install note (allow installs from unknown sources).
- Keep the debug APK out of the public release.

### WP4 — Browser device simulator
- A route such as `/player/<screenId>` (public only in demo mode, scoped to demo screens) that renders the screen full screen using the existing preview components and follows live updates — for visitors without Android or who do not want to install the APK.
- Reuses `ScreenPreview`/`OverlayFrame`; add auto-refresh through the live stream or short polling.

### WP5 — Hosting configuration and docs
- `render.yaml` for the backend, Vercel project settings for the panel (documented), environment variable table (`NODE_ENV=production`, `JWT_SECRET`, `ADMIN_*`, `CORS_ORIGIN`, `PANEL_URL`, `DEMO_MODE`, media directory).
- Panel "server is waking up" screen (retry with backoff on the first failed request).
- README section "Live demo" with the links, the APK button, credentials/notice and the recording.
- Optional: uptime-monitor setup note.

### WP6 — Verification
- Fresh deploy from scratch; cold start → seed → login → edit a screen → phone shows it.
- Install the signed APK on a clean phone and pair it to a sandbox.
- Confirm abuse guards: upload limits, rate limits, no way to create users or reach other sandboxes.
- Confirm the reset leaves the demo in a usable state.

## Order

WP1 → WP3 (can run in parallel) → WP2 → WP4 → WP5 → WP6.

## Risks

- **Free-tier changes:** quotas and sleeping behavior change; keep the deployment portable (Docker image already exists) so a move to another host is a configuration change.
- **Abuse of public uploads:** keep demo limits small; consider disabling video upload in demo mode (also avoids needing `ffprobe` on the host).
- **APK trust:** an APK from outside the Play Store triggers install warnings; document the steps and publish the checksum.
- **Shared state if Option A/B is skipped:** all visitors would see each other's devices — do not ship a single shared editable account.

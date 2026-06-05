# Gym Planner — Local Setup

## Phases shipped

- **Phase 0** — Auth, profile, optional households
- **Phase 1** — Equipment editor + exercise library + filter
- **Phase 2** — Rules-based program generator with postpartum-aware filtering
- **Phase 3** — Interactive workout logging with automatic progression
- **Phase 4** — Claude coaching: ask / swap / weekly check-in
- **Phase 5** — Polish & PWA: installable, offline-aware logging, insights dashboard, rate-limited Claude

## Prerequisites

- Node.js 18.18 or newer (Node 20 LTS recommended)
- (Optional) Anthropic API key for Phase 4 features

## First-time setup

```
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000.

## Installing to the home screen (PWA)

On a phone:
- Open the dev URL or your deployed URL in mobile Safari / Chrome
- iOS: tap Share → "Add to Home Screen"
- Android: tap the menu → "Install app" / "Add to Home screen"

The app then opens full-screen with the dumbbell icon. It works offline for any page you've already visited and queues set logs while offline (they sync on reconnect).

## Environment

`.env` checks in with dev defaults. Set:

- `NEXTAUTH_SECRET` — replace before deploying. `openssl rand -base64 32`
- `ANTHROPIC_API_KEY` — required for Claude coaching (ask / swap / weekly check-in). Leave empty to use the app without Claude.
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` — optional. With them, the "Forgot password" flow sends real email via Resend. Without them, the reset URL is logged to the server console instead (useful for dev / before DNS propagates).
- `APP_URL` — optional but recommended in production. Used to build absolute URLs in password-reset emails. e.g. `https://gym.nephatmuchiri.com`.

## Password reset — Resend setup

1. Sign up at https://resend.com.
2. Add a sender domain (e.g. the apex of your app domain). Resend will ask you to publish a small set of DNS records — usually a TXT for verification plus DKIM CNAMEs.
3. Wait for the domain to verify (minutes).
4. Generate an API key in the Resend dashboard.
5. Set in Vercel envs (and your local `.env`):
   ```
   RESEND_API_KEY=re_xxx
   RESEND_FROM_EMAIL="Gym Planner <noreply@yourdomain.com>"
   APP_URL=https://gym.yourdomain.com
   ```
6. Test by visiting `/forgot-password`, submitting your email, and clicking the link in the resulting email.

Until step 3 completes, Resend will reject sends. The console fallback kicks in automatically when `RESEND_API_KEY` is unset, so you can ship and test the flow end-to-end before DNS propagates.

## Exercise form demos — image refresh

Form-demo images come from the public-domain yuhonas/free-exercise-db dataset and are committed to `public/exercise-demos/<exercise_id>/{start,end}.jpg`. The mapping from our exercise IDs to upstream names lives in `src/data/exercise-demos.ts` (`SOURCES` object).

When you add a new exercise to the library or change a `SOURCES` mapping, re-fetch the images:

```bash
npx tsx scripts/download-demos.ts
```

The script is idempotent (skips images you already have) and reports any 404s at the end so you know which `SOURCES` entries need a different upstream name. Commit the new files under `public/exercise-demos/` and push — Vercel serves them from the Edge as static assets.

## What to try

1. Sign up → onboarding → dashboard
2. Add equipment → Workout → Generate my program
3. Start a workout, log a few sets, complete it
4. Visit **History** for the session list
5. Visit **Insights** for sessions-per-week, volume-per-week, and per-exercise bests
6. With Claude configured, use **ask** / **swap** during a session and **Weekly check-in** on the dashboard
7. Install to home screen, go airplane mode, log more sets — they queue up. Turn airplane mode off, watch them sync

## Useful scripts

- `npm run dev` — dev server
- `npm run build` — production build (PWA assets included automatically)
- `npm run db:studio` — open Prisma Studio
- `npm run db:push` — re-sync the schema to the local DB

## Project layout

```
prisma/
  schema.prisma           # All models (auth + domain + program + logging)
public/
  manifest.json           # PWA manifest
  icon.svg                # App icon
  sw.js                   # Service worker (cache + offline shell)
src/
  data/
    exercises.ts          # 75+ exercises with tags
    templates.ts          # Split templates per days/week
  lib/
    prisma.ts
    auth.ts
    claude.ts             # Anthropic SDK wrapper
    equipment.ts          # Inventory filter + load prescription
    program.ts            # Program generator
    progression.ts        # Per-session progression rules
    offline-queue.ts      # localStorage queue for offline set logs
    rate-limit.ts         # Token bucket for /api/coach/*
  components/
    SessionProviderWrapper.tsx
    CoachSheet.tsx
  app/
    layout.tsx            # PWA manifest, theme, SW registration
    page.tsx              # Landing
    (auth)/login          (auth)/signup
    onboarding
    dashboard             # nav + weekly check-in
    equipment             # editor
    exercises             # filtered library
    workout/              # program viewer
      session/[id]/       # interactive logging (offline-aware)
    history               # session list + detail
    insights              # bar charts: sessions/wk, volume/wk; per-exercise bests
    offline               # offline fallback page
    api/
      auth/[...nextauth], auth/signup
      profile, household
      equipment, equipment/[id]
      program
      sessions, sessions/[id], sessions/[id]/sets, sessions/[id]/sets/[setId]
      coach/explain, coach/swap, coach/weekly-checkin
```

## Offline behavior

- Service worker precaches the app shell, manifest, and icon on install
- HTML navigations: network-first, falls back to cached version, then `/offline`
- Static assets: stale-while-revalidate (loaded from cache instantly, refreshed in background)
- API requests: always go to the network (no stale data masquerading as fresh)
- Set logs: when offline, queued in localStorage and replayed on `online` event or on next page mount
- The active workout screen shows an "Offline" banner and a "N sets pending sync" counter when relevant

## Rate limiting

The Claude endpoints use an in-memory token bucket per user:
- `explain` and `swap`: 10-token burst, 1 token / 6s (~10/min)
- `weekly-checkin`: 3-token burst, 1 token / 60s (~1/min)

This is single-process only. If deploying to a serverless platform or multi-instance setup, swap `src/lib/rate-limit.ts` for a Redis-backed limiter (Upstash, ioredis, etc.).

## What was verified in the sandbox

- `npx tsc --noEmit` — zero TypeScript errors
- `next build` — compiles + lints + type-checks all routes; stops only at Prisma client init (sandbox limitation, works on your machine)

## Known limitations

- Service worker doesn't currently cache exercise library pages (only navigations actually visited). First visit to a new page while offline shows the `/offline` fallback.
- Rate limiter is per-process. On a serverless host (Vercel functions) each instance has its own bucket — limits will be looser than they look.
- No CSRF tokens beyond NextAuth's defaults; relies on `SameSite=Lax` session cookies.
- "Today" on the workout page is a fixed weekday rotation; it doesn't reflect actual workout history. Phase 3+ groundwork is there to base it on the last completed session, but that's not wired yet.

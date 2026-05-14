# Gym Planner — Local Setup

## What's in the app (Phase 0–4)

**Phase 0:** Auth, profile, optional households.

**Phase 1:** Free-form equipment editor, curated exercise library (75+ moves), filter logic that shows only the exercises you can do with what you own.

**Phase 2:** Rules-based program generator with split templates (full body, upper/lower, PPL), goal-aware reps/sets/rest, postpartum-aware filtering, mobility/stretch emphasis.

**Phase 3:** Interactive workout logging — start a session, log sets one at a time, complete, view history. Automatic progression (double progression for loaded, rep progression for bodyweight, time progression for iso holds).

**Phase 4:** Claude coaching layer. "Ask" any exercise during a session for a tailored explanation. "Swap" any exercise mid-workout — Claude picks an alternative from your available pool with reasoning. "Weekly check-in" on the dashboard summarizes your last 14 days and suggests next steps.

## Prerequisites

- Node.js 18.18 or newer (Node 20 LTS recommended)
- An Anthropic API key for Phase 4 features (optional — the buttons hide if not configured). Get one at https://console.anthropic.com

## First-time setup

```
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000

## Environment

`.env` is checked in with dev defaults. Set:

- `NEXTAUTH_SECRET` — replace before deploying. Generate with `openssl rand -base64 32`
- `ANTHROPIC_API_KEY` — required for Phase 4 (Ask / Swap / Weekly check-in). Leave empty to use the app without Claude.

After editing `.env`, restart the dev server.

## What to try

1. Sign up → onboarding → dashboard
2. Add equipment (e.g. dumbbells 2/5/10kg, bench, yoga mat)
3. Tap **Workout** → **Generate my program** → see your weekly split
4. Tap **Start workout** on a day → log sets as you go → **Complete workout**
5. Repeat a few sessions and watch the prescriptions adjust (load goes up if you hit the top of the rep range)
6. Visit **History** to see past sessions
7. With `ANTHROPIC_API_KEY` set:
   - During an active session, tap **ask** next to any exercise for a tailored explanation
   - Tap **swap** to get a Claude-suggested alternative with reasoning
   - On the dashboard, tap **Weekly check-in** for a summary of the last 14 days

## Useful scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run db:studio` — open Prisma Studio at http://localhost:5555
- `npm run db:push` — re-sync the schema to the local DB

## Project layout

```
prisma/
  schema.prisma           # User, Household, Equipment, Program, ProgramDay,
                          # ProgramItem, WorkoutSession, SetLog + NextAuth
src/
  data/
    exercises.ts          # 75+ exercises with tags (high_impact, postpartum_safe, etc.)
    templates.ts          # Split templates with movement-pattern slots per day
  lib/
    prisma.ts
    auth.ts
    claude.ts             # Anthropic SDK wrapper, graceful no-key fallback
    equipment.ts          # Inventory filter + load prescription
    program.ts            # Program generator (pure function)
    progression.ts        # Per-session progression rules
  components/
    SessionProviderWrapper.tsx
    CoachSheet.tsx        # Reusable modal for Claude responses
  app/
    (auth)/login, (auth)/signup
    onboarding/page.tsx
    dashboard/                          # nav + weekly check-in
    equipment/                          # editor
    exercises/                          # filtered library
    workout/                            # program viewer + day tabs
      session/[id]/                     # interactive logging
    history/                            # session list + detail
    api/
      auth/[...nextauth]
      auth/signup
      profile
      household
      equipment, equipment/[id]
      program
      sessions, sessions/[id], sessions/[id]/sets, sessions/[id]/sets/[setId]
      coach/explain
      coach/swap
      coach/weekly-checkin
```

## Claude usage notes

- **Explain (ask)** uses Haiku — cheap, fast, ~500 token responses
- **Swap** uses Sonnet — better at constrained JSON output and reasoning
- **Weekly check-in** uses Sonnet — produces the most thoughtful summaries

If you don't want to pay for Sonnet, both swap and weekly-checkin can be switched to Haiku by editing `src/lib/claude.ts` calls.

## What was verified in the sandbox

- `npx tsc --noEmit` — zero TypeScript errors
- `next build` — compiles + lints + type-checks all routes; stops only at Prisma client init (sandbox limitation)

## Limitations / things to know

- Swap is session-scoped only. The accepted swap replaces the exercise visually in the current session; logged sets are saved under the new exerciseId. Next time you start the same program day, the original prescribed exercise is back. Phase 5 may add a permanent swap.
- Progression is deterministic; it doesn't account for sleep, soreness, or how the previous session "felt" beyond what you logged.
- "Today" on the workout page is a simple weekday rotation. It does not track whether you actually worked out yesterday.

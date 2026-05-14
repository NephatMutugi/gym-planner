# Gym Planner — Local Setup

## What's in the app (Phase 0 + 1 + 2)

**Phase 0:** Auth, profile, optional households.

**Phase 1:** Free-form equipment editor, curated exercise library (60+ moves), filter logic that shows only the exercises you can do with what you own.

**Phase 2:** Rules-based program generator. From your profile + equipment, the system picks a weekly split (full body × 2/3, upper/lower × 4, PPL × 6, etc.), assigns exercises to each day from your filtered library, and computes sets, reps, target load (rounded to weights you actually own), and rest periods based on your goal mix and experience level. Two users with different goals in the same household get genuinely different programs.

## Prerequisites

- Node.js 18.18 or newer (Node 20 LTS recommended)

## First-time setup

```
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000

## Schema changes from Phase 2

The Phase 2 schema added three new tables: `Program`, `ProgramDay`, `ProgramItem`, plus a relation on `User`. You must re-run `npx prisma db push` to apply them locally (no data loss).

## What to try

1. Sign up → onboarding → dashboard
2. Add some equipment (e.g. dumbbells 2/5/10kg, a bench, a yoga mat)
3. Tap **Workout** on the dashboard → "Generate my program"
4. You'll land on Day 1 of your generated program. Use the day pills at the top to flip between training days.
5. Each exercise shows sets × reps, load (rounded to your dumbbells), rest, and an expandable form-cues section.
6. Tap **Regenerate program** at the bottom to refresh after changing equipment or profile.

For testing the goal differentiation: create a second account, choose different goals (e.g. fat_loss + endurance vs strength + muscle_gain), and compare the generated programs.

## Useful scripts

- `npm run dev` — dev server with hot reload
- `npm run build` — production build
- `npm run db:studio` — open Prisma Studio at http://localhost:5555 to inspect data
- `npm run db:push` — re-sync the schema to the local DB

## Project layout

```
prisma/
  schema.prisma                    # User, Household, Equipment, Program, ProgramDay, ProgramItem + NextAuth
src/
  data/
    exercises.ts                   # 60+ curated exercises (source of truth)
    templates.ts                   # Split templates (full body, upper/lower, PPL) with slots per day
  lib/
    prisma.ts
    auth.ts
    equipment.ts                   # Inventory filter + load prescription
    program.ts                     # Program generator (pure function)
  app/
    layout.tsx
    page.tsx                       # Landing
    globals.css
    (auth)/login/page.tsx
    (auth)/signup/page.tsx
    onboarding/page.tsx            # 6-step wizard
    dashboard/                     # Profile + nav rows
      page.tsx
      DashboardClient.tsx
    equipment/                     # Free-form inventory editor
      page.tsx
      EquipmentClient.tsx
    exercises/                     # Filtered library, grouped by pattern
      page.tsx
    workout/                       # Today's workout + day tabs + regenerate
      page.tsx
      WorkoutClient.tsx
    api/
      auth/[...nextauth]/route.ts
      auth/signup/route.ts
      profile/route.ts
      household/route.ts
      equipment/route.ts
      equipment/[id]/route.ts
      program/route.ts             # GET/POST active program
```

## How the generator decides

`src/lib/program.ts` is a pure function: `generateProgram(profile, inventory) → program`.

It chooses by:
- **Split template** — based on `daysPerWeek` (2 → full body × 2, 3 → full body × 3, 4 → upper/lower × 2, 6 → PPL × 2, etc.)
- **Slots per day** — each template day defines an ordered list of movement-pattern slots. The generator picks the best-fit exercise per slot from your filtered library.
- **Exercise selection scoring** — prefers compounds for "main" slots, avoids repeats within a day, filters by difficulty matched to your experience, biases toward loaded exercises when you have weights.
- **Sets / reps / rest** — read from a goal table (strength = 4×4-6 long rest; muscle_gain = 4×8-12 moderate rest; fat_loss = 3×10-12 short rest; etc.) and blended if you have multiple goals.
- **Set count adjustment** — beginner gets fewer sets, advanced gets more.
- **Session-length budget** — exercises per day capped to fit your declared session length (~7 min/exercise + 5 min warm-up).
- **Load estimation** — a per-exercise fraction of your bodyweight, modified by experience, then rounded to the nearest weight you actually own via `prescribeLoad`.

## What was verified in the sandbox

- `npx tsc --noEmit` — zero TypeScript errors
- `next build` — compiles, lints, and type-checks all routes; stops only at Prisma client init (sandbox can't fetch Prisma's binary engines)

## Known limitations (deferred to later phases)

- No logging or progression yet — Phase 3
- AI coaching layer not yet wired — Phase 4
- Injuries are captured but not yet used to filter exercises — Phase 4 will use Claude here
- Bodyweight is captured but starting loads are conservative estimates; real numbers come from logging
- The "today" computation maps days/week to weekdays evenly but doesn't track actual workout history yet (Phase 3 will)

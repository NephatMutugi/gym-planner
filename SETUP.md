# Gym Planner — Local Setup

## What's in the app (Phase 0 + 1)

**Phase 0:** Auth, profile, optional households.

**Phase 1:** Free-form equipment editor, curated exercise library (60+ moves), filter logic that shows only the exercises you can actually do with what you own.

Equipment → exercise filter is pure-functional and reusable for Phase 2 (plan generation) and Phase 3 (load prescription).

## Prerequisites

- Node.js 18.18 or newer (Node 20 LTS recommended)
- macOS, Linux, or WSL

## First-time setup

```
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000

The Equipment model was already in the Phase 0 schema, so no new `prisma db push` is needed beyond the initial one.

## What to try

1. Sign up → walk the 6-step onboarding → land on the dashboard
2. Tap the **Equipment** card → add your dumbbells (e.g. 2, 5, 10 kg) and anything else you own
3. Back to dashboard, tap **Exercises** → see the filtered library grouped by movement pattern
4. Add a kettlebell or remove dumbbells → notice the exercise list updates accordingly

The exercise count on the dashboard updates from the server on each page load, so after adding equipment, navigate back to `/dashboard` to see it bump.

## Useful scripts

- `npm run dev` — dev server with hot reload
- `npm run build` — production build
- `npm run db:studio` — open Prisma Studio at http://localhost:5555 to inspect data
- `npm run db:push` — re-sync the schema to the local DB (after edits to `prisma/schema.prisma`)

## Project layout

```
prisma/
  schema.prisma                    # User, Household, Equipment + NextAuth tables
src/
  data/
    exercises.ts                   # 60+ curated exercises (source of truth)
  lib/
    prisma.ts                      # Prisma client singleton
    auth.ts                        # NextAuth config
    equipment.ts                   # Inventory filter + load prescription
  types/
    next-auth.d.ts
  components/
    SessionProviderWrapper.tsx
  app/
    layout.tsx
    page.tsx                       # Landing
    globals.css
    (auth)/
      signup/page.tsx
      login/page.tsx
    onboarding/page.tsx            # 6-step wizard
    dashboard/
      page.tsx
      DashboardClient.tsx
    equipment/
      page.tsx                     # Server: load inventory
      EquipmentClient.tsx          # Client: add/remove items
    exercises/
      page.tsx                     # Filtered library, grouped by pattern
    api/
      auth/
        [...nextauth]/route.ts
        signup/route.ts
      profile/route.ts
      household/route.ts
      equipment/
        route.ts                   # GET/POST equipment
        [id]/route.ts              # PUT/DELETE equipment
```

## How the filter works

`src/lib/equipment.ts` exposes:

- `canPerform(exercise, inventory)` — true if all required equipment types are in the inventory
- `availableExercises(inventory)` — full filtered list
- `exercisesByPattern(inventory)` — grouped by movement pattern for UI
- `prescribeLoad(exercise, inventory, targetKg)` — rounds a target to the nearest weight the user can actually load (used in Phase 3)

Bodyweight exercises (`equipment: []`) are always available.

## Adding more exercises

Open `src/data/exercises.ts` and add another entry to the `EXERCISES` array. The fields are typed; new exercises automatically flow through the filter and into the browser UI.

## Household sharing

If a user is in a household, new equipment defaults to **household-shared** scope. Each user can also add **personal** items (their own DBs at the in-laws', a band they take traveling, etc.). Solo users get personal-only items by default.

## What was verified in the sandbox

- `npx tsc --noEmit` — zero TypeScript errors
- `next build` — compiles, lints, and type-checks all routes; stops only at Prisma client init (sandbox can't fetch Prisma's binary engines; works on your machine)

## What you'll verify locally

- Sign up flow → onboarding → dashboard
- Equipment editor: add dumbbell pair (2, 5, 10) → see it appear with weight chips
- Exercises page: should show ~28 moves matching dumbbell + bodyweight (rises if you also add bench, kettlebell, etc.)
- Delete an item from equipment → exercises list shrinks accordingly
- (If you set up a household) Add a household-shared item from one account → it's visible from another account that joined via invite code

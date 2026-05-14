# Gym Planner — Local Setup

Phase 0 only. The project compiles cleanly in TypeScript and ships:

- Email + password auth (NextAuth credentials + bcrypt)
- User profile model: name, age, gender, height, weight, experience, goals (multi-select, per user), days/week, session length, injuries
- Optional households (create or join via 6-char invite code) for sharing equipment with a partner
- Mobile-first dark UI, no native fonts
- SQLite for local development

Equipment editor, exercise library, and plan generation come in Phase 1+.

## Prerequisites

- Node.js 18.18 or newer (Node 20 LTS recommended)
- macOS, Linux, or WSL

## First-time setup

From the project root:

```
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000

The first command (`npm install`) may take a minute. `prisma db push` creates `prisma/dev.db` (SQLite, gitignored).

## Environment

`.env` is checked in with development defaults. Before deploying anywhere real, replace `NEXTAUTH_SECRET` with the output of:

```
openssl rand -base64 32
```

## What to try

1. Visit `/` — landing page with **Get started** button
2. Sign up with any email + 8+ char password
3. Walk through the 6-step onboarding (basics, body, goals, schedule, injuries, optional household)
4. Land on `/dashboard` showing your saved profile

Sign out from the dashboard to test login.

## Useful scripts

- `npm run dev` — dev server with hot reload
- `npm run build` — production build
- `npm run db:studio` — open Prisma Studio at http://localhost:5555 to inspect data
- `npm run db:push` — re-sync the schema to the local DB (after edits to `prisma/schema.prisma`)

## Project layout

```
prisma/
  schema.prisma         # Data model (User, Household, Equipment + NextAuth tables)
src/
  lib/
    prisma.ts           # Prisma client singleton
    auth.ts             # NextAuth config (Credentials provider, JWT sessions)
  types/
    next-auth.d.ts      # Session type augmentation (user.id)
  components/
    SessionProviderWrapper.tsx
  app/
    layout.tsx          # Root layout, wraps in SessionProvider
    page.tsx            # Landing (redirects if logged in)
    globals.css         # Tailwind + design tokens
    (auth)/
      signup/page.tsx
      login/page.tsx
    onboarding/page.tsx # 6-step wizard
    dashboard/
      page.tsx          # Server: loads profile
      DashboardClient.tsx
    api/
      auth/[...nextauth]/route.ts  # NextAuth handler
      auth/signup/route.ts          # POST /api/auth/signup
      profile/route.ts              # GET/PUT /api/profile
      household/route.ts            # POST/DELETE /api/household
```

## What was verified in the sandbox

- All source files written
- `npx tsc --noEmit` passes (no TypeScript errors)
- File structure matches the planned architecture

## What you'll verify locally

- `npx prisma generate` (sandbox couldn't reach Prisma's engine CDN)
- `npx prisma db push` (creates SQLite DB)
- `npm run dev` (start the server)
- Sign up → onboarding → dashboard end-to-end

## Notes on data shape

SQLite doesn't natively support array columns. Two fields are stored as JSON strings and parsed in code:

- `User.goals` — `'["strength","general_fitness"]'`
- `User.injuries` — `'["lower back","left knee"]'`
- `Equipment.weightsKg` — `'[2, 5, 10]'` (Phase 1 will write to this)

When swapping to Postgres later, these can become `String[]` columns; the parsing layer is a thin wrapper in the API routes.

## Two profiles, same household

You can test the partner flow by:

1. Signing up as user A → in onboarding step 6, create a household and copy the invite code
2. Sign out → sign up as user B with a different email → in onboarding step 6, join with that code

Both users now share the same household. In Phase 1 they'll share the equipment inventory but get independently generated programs from their distinct goals.

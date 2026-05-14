# Deploying Gym Planner to Vercel

A working Vercel deploy needs three things lined up:

1. A hosted Postgres database (SQLite can't run on Vercel)
2. Code pushed to GitHub
3. Environment variables configured in the Vercel project

These steps take ~20 minutes total. The order matters because Vercel will try to build immediately after import — much smoother if the DB is already set up.

---

## 1. Create a Postgres database — Neon

Vercel folded "Vercel Postgres" into their Marketplace; **Neon** is the same product (and the same Postgres-as-a-service Vercel Postgres was always running on underneath).

Two equivalent paths — pick whichever is easier:

### From the Vercel dashboard (recommended — auto-wires env vars)

1. Vercel dashboard → **Storage** → **Marketplace Database Providers** → **Neon** → **Create**
2. Pick a region. Match it to where you'll deploy the app (`iad1` / Washington DC is the default and fine if you don't have a preference).
3. When prompted to connect it to a project, you can do it now or skip — we'll do it during the project import step. Either works.

After creation, Vercel shows you the connection details. There are two URLs that matter — copy both:

- **`DATABASE_URL`** — the pooled connection (hostname contains `-pooler`). Used for runtime queries.
- **`DIRECT_URL`** — the direct connection (hostname without `-pooler`). Used for `prisma db push` / migrations.

If you connect the database to the project during creation, Vercel will set `DATABASE_URL` automatically. You'll still need to add `DIRECT_URL` manually because Prisma uses a non-standard env name.

### Or sign up at neon.tech directly

Same product, lets you create the project before any Vercel involvement. You'll add the connection strings into Vercel manually later. Pick a region close to your Vercel project's region.

Either way you should end up with two connection strings that look like:

```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
```

Keep both — `DATABASE_URL` is the pooled one for runtime queries, `DIRECT_URL` is the unpooled one for migrations.

---

## 2. Switch the Prisma schema to Postgres

Edit `prisma/schema.prisma`:

```diff
 datasource db {
-  provider = "sqlite"
-  url      = env("DATABASE_URL")
+  provider  = "postgresql"
+  url       = env("DATABASE_URL")
+  directUrl = env("DIRECT_URL")
 }
```

A couple of nuances to handle while you're in this file:

**SQLite-only `String?` JSON fields work fine in Postgres**, so no change needed there. The exercise list, goals, and weights are still stored as JSON strings — that's a known limitation we have noted in the plan and they can be migrated to native `String[]` in Postgres at a later phase if desired.

**Indexes carry over as-is.** Postgres doesn't complain about anything you'd have in a SQLite schema for this app.

After saving:

```bash
# Point your local env at the new DB temporarily
export DATABASE_URL="<pooled-connection-string>"
export DIRECT_URL="<direct-connection-string>"

# Push the schema to Postgres
npx prisma db push

# Verify
npx prisma studio
```

If `prisma db push` succeeds and Studio shows your tables, the database is ready.

**Note:** your local SQLite data (any test accounts, programs, sessions) doesn't migrate over — Postgres starts empty. That's fine since you'll be creating real accounts when you deploy.

---

## 3. Update `.env` for local development

Once you've switched to Postgres, your local dev needs the same env vars set. Update `.env`:

```
DATABASE_URL="<pooled connection string from Neon / Vercel Postgres>"
DIRECT_URL="<direct connection string>"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"

ANTHROPIC_API_KEY="<your key, or empty>"
```

Generate a fresh `NEXTAUTH_SECRET` while you're here — don't keep the dev placeholder.

`npm run dev` should now work against your Neon DB.

---

## 4. Push to GitHub

```bash
cd ~/Desktop/development_projects/gym-planner
git init                            # if not already a repo
git add .
git commit -m "Initial gym planner"
git remote add origin git@github.com:<your-username>/gym-planner.git
git push -u origin main
```

Two things to verify before pushing:

- `.gitignore` includes `.env`, `prisma/dev.db`, `node_modules`, `.next` — it does in this codebase, but double-check
- You haven't committed real secrets. Run `git ls-files | grep -E "^\.env$"` — should return nothing

---

## 5. Import the project in Vercel

In the Vercel dashboard:

1. **Add New** → **Project**
2. Pick the `gym-planner` GitHub repo (you may need to grant Vercel access to it first)
3. Vercel auto-detects Next.js. Framework preset should say "Next.js"
4. **Root directory**: leave as default (the repo root)
5. **Build command**: override to `npm run vercel-build` — this is `prisma generate && next build`, which makes sure the Prisma client is generated for the Vercel build environment. (You can also leave it as the default `next build` because `postinstall: prisma generate` will run, but `vercel-build` is more explicit.)
6. **Output directory**: leave as default
7. **Install command**: leave as default

**Don't deploy yet.** Click "Environment Variables" and add:

| Name | Value | Environments |
|---|---|---|
| `DATABASE_URL` | pooled connection string | Production, Preview, Development |
| `DIRECT_URL` | direct connection string | Production, Preview, Development |
| `NEXTAUTH_URL` | leave blank for now, you'll set it once you have a URL | Production, Preview |
| `NEXTAUTH_SECRET` | a fresh `openssl rand -base64 32` value | Production, Preview, Development |
| `ANTHROPIC_API_KEY` | your Anthropic key (or leave empty to disable coaching) | Production, Preview |

About `NEXTAUTH_URL`: NextAuth v4 needs this to match the deployment URL exactly (including protocol). Easiest pattern:
- For production: set it to your final domain (e.g. `https://gym.your-domain.com` or `https://gym-planner.vercel.app`)
- For preview deploys (every git push): leave it empty and NextAuth will fall back to `VERCEL_URL`, which is fine

Click **Deploy**.

---

## 6. Set the production URL

After the first deploy, you'll get a URL like `gym-planner-xyz-yourname.vercel.app`. Either:

- Use that URL as-is, and update `NEXTAUTH_URL` in Vercel's env vars to match it, then redeploy (Settings → Deployments → Redeploy)
- Or add a custom domain / subdomain. Since you already have a portfolio domain, the cleanest move is to point `gym.<your-portfolio-domain>` at this project:
  - In your gym-planner Vercel project → Settings → Domains → Add
  - Type `gym.<your-portfolio-domain>` and follow the DNS instructions (you'll add one CNAME at your DNS provider)
  - Once Vercel verifies it, set `NEXTAUTH_URL=https://gym.<your-portfolio-domain>` in env vars
  - Redeploy

---

## 7. Smoke test

After the deploy succeeds, open the production URL on your phone:

1. Sign up with a fresh email and password
2. Run through onboarding
3. Add some equipment
4. Generate a program, start a workout, log a set
5. Open Insights — should be empty but render
6. If `ANTHROPIC_API_KEY` is set, try the **ask** button on an exercise

If anything 500s, the Vercel dashboard → Deployments → click the deployment → **Logs** tab shows the runtime error.

Common gotchas:
- **`PrismaClientInitializationError`** → `DATABASE_URL` env var missing or wrong. Verify in Vercel env settings, redeploy.
- **`Connection terminated unexpectedly`** → you're using the direct URL instead of the pooled URL for runtime. Make sure `DATABASE_URL` is the `-pooler` one.
- **`NEXTAUTH_URL` warnings** → set the env var to match your production URL exactly.
- **"You are seeing this error because Next.js auto-prerendered..."** → some page tried to render statically. The dashboard, workout, etc. all use `getServerSession` which forces dynamic rendering, so this shouldn't happen, but if it does, add `export const dynamic = "force-dynamic"` to the route.

---

## 8. Install on your phones

Once it's live at a stable URL:

- Open the URL in Safari (iOS) or Chrome (Android)
- iOS: **Share → Add to Home Screen**
- Android: **Menu → Install app** / **Add to Home Screen**

The app installs full-screen with the dumbbell icon. Both of you can install independently and sign into your own accounts.

---

## Ongoing: pushing updates

```bash
git add .
git commit -m "..."
git push
```

Vercel auto-deploys every push to `main`. Branch pushes deploy to preview URLs. Schema changes need `npx prisma db push` (or `npx prisma migrate deploy` if you adopt migrations later) against the production DB — set the DATABASE_URL env locally and run the command before deploying.

---

## Things to fix / harden later

A few items called out in the security review that matter more in production than they did locally:

- **Rate limiter is in-memory, per-process** — on Vercel serverless functions, every cold start has its own bucket. The Claude rate limits are real but looser than they look. Swap `src/lib/rate-limit.ts` for an Upstash Redis-backed implementation when this becomes meaningful (probably never for two users; necessary if you ever invite a third party in).
- **No CSRF token on mutating routes** — NextAuth's `SameSite=Lax` session cookie covers the common cases but not all of them. Consider adding a CSRF token check on the mutating API routes (`POST /api/equipment`, `/api/sessions/...`) if this ever has more than internal users.
- **Free-text Claude inputs aren't sanitized for prompt injection** — fine while the responses only flow back to the user that initiated them. Becomes a real issue if you ever surface another user's note (e.g. a household partner's note) through Claude.
- **`prisma db push` doesn't keep migration history** — fine for a personal project. For an actual production app, switch to `prisma migrate dev` locally + `prisma migrate deploy` in the Vercel build before you have real users you can't afford to lose.

None of these block your deploy. Ship first, harden later.

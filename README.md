# DevMint

Mobile-first Roblox creator platform: AI Build Center (interview → sourced concepts → approval), analytics,
creator feed and messaging, a paid work marketplace with protected (test-mode) payments, and a leaderboard.
Built to `DevMint_Product_Spec.md` for the October 11, 2026 closed beta.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind v4 · Supabase (Auth, Postgres, Realtime, Storage, RLS) · Vercel.

## Setup

1. `npm install`
2. Create a Supabase project. In **SQL editor** (or `supabase db push`) apply, in order, `supabase/migrations/0001…0004`.
3. Auth → Providers: enable Email (disable "confirm email" for local dev) and Google (optional).
   Auth → URL configuration: add `http://localhost:3000/auth/callback` and your production `/auth/callback`.
4. Realtime: the migrations add `messages` and `notifications` to the `supabase_realtime` publication.
5. `cp .env.example .env.local` and fill in the Supabase URL, anon key and service-role key.
   Keep `AI_MODE=fixtures` until provider keys are set; then `AI_MODE=live` with `ANTHROPIC_API_KEY`,
   `OPENAI_API_KEY`, `GEMINI_API_KEY`. Model ids are overridable via `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`.
6. Seed demo content: set `SEED_DEMO_PASSWORD` (12+ chars) and run `npm run seed`. Sign in as the
   demo account (`SEED_DEMO_EMAIL`, default `demo@devmint.example`). To make yourself an admin (dispute and
   moderation queues): `update profiles set is_admin = true where handle = '<yours>';` in the SQL editor.
7. `npm run dev`

## Checks

```
npm run lint && npm run typecheck && npm test && npm run build
PGHOST=… PGUSER=… npm run db:test     # applies migrations to a scratch DB and runs supabase/tests/integration.sql
```

## Deploy (Vercel)

Set every variable from `.env.example` in the Vercel project (service-role and AI keys are server-only).
`vercel.json` schedules `/api/cron/release` hourly; set `CRON_SECRET` so Vercel sends the bearer token.
Build Center research runs after the response (`after()`), so the route sets `maxDuration = 300`; use a plan that allows it.

## Architecture notes

- **Credits** are debited server-side by `debit_credits` (service role only) and refunded once on failed jobs.
  Clients cannot write wallets, jobs, concepts, rank events or perks (RLS + revoked grants).
- **Concept approval** is enforced in Postgres: a project cannot enter `blueprint+` without an approved concept.
- **Opportunity Score** is computed by DevMint from model sub-scores (`src/lib/ai/opportunity.ts`), never taken from the model.
  Live concepts are rejected unless their cited URLs resolve (https-only, SSRF-guarded).
- **Payments** are test mode only (`PAYMENTS_MODE=test` is the only accepted value). Balances change only through
  `ledger_append`, an append-only, per-user SHA-256 hash chain (`verify_ledger`).
- **Rank** derives from `rank_events` with decay, per-component caps and a hard ceiling on generation volume.

## Assumptions to confirm

- Platform fee: flat 10% of the job amount, taken from the worker; independent of rank.
- Plan credit allowances and the 10-credit cost of a concept run are placeholders (`plan_allowances`, `src/lib/config/plans.ts`).
- Free-plan accounts get one concept run per month; checkout for paid plans is not wired (billing opens after beta).
- OpenAI/Gemini default model ids are unverified guesses; override via env.

## Not in the beta (per spec)

Roblox OAuth/sync, Studio execution, live payouts, full blueprint/script/image generation, native apps.
Push and email delivery are not implemented; notification preferences are stored and in-app preferences are enforced.

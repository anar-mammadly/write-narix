# Narix Academy

Academic writing order/management platform. Next.js (App Router, TypeScript) +
Tailwind + shadcn/ui, backed entirely by Supabase (Postgres, Auth, Storage,
Realtime), deployed to Cloudflare Workers via OpenNext.

## Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page. **Never** expose this to the client.
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — from resend.com, once you have a verified sending domain.
   - `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` locally, `https://writing.narix.az` in prod.
   - `CRON_SECRET` — any long random string; the outbox worker route requires it as a bearer token.
3. Apply the database:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push          # runs everything in supabase/migrations/*.sql
   npx supabase db execute --file supabase/seed.sql   # seed statuses/services/discounts/templates
   ```
   (Or, for local development with Docker: `npx supabase start`, then `npx supabase db reset` runs
   migrations + seed together.)
4. In the Supabase dashboard, enable the Google OAuth provider under Authentication → Providers if you
   want "Continue with Google" to work, and set the Site URL / Redirect URLs to match `NEXT_PUBLIC_SITE_URL`.
5. `npm install && npm run dev`.

## What's implemented

- Full schema, RLS, and business-logic functions in `supabase/migrations/` — pricing engine, discount
  engine (highest-value-only, no stacking), referral codes + two-sided benefits with admin approval,
  guest checkout + secure token tracking + verified-account claim, append-only payment ledger,
  admin-configurable order statuses with a lock/unlock terminal-state rule, notification/email outbox
  with retries, and a config-change audit log — all described in `supabase/migrations/*.sql` comments.
- Homepage with the live pricing calculator (`src/components/calculator/`), guest and member checkout.
- User dashboard: orders, order detail (files/messages/payments/timeline), referral program, profile,
  notifications.
- Admin dashboard: order workspace (status changes, payment requests/ledger, admin requests, discount
  breakdown, timeline), referral approval queue, order statuses, discount percentages, services/pricing
  matrix, site settings (WhatsApp number, early-order banner, referral validity).
- `/api/cron/process-notification-jobs` — the outbox worker. Needs an external scheduler hitting it
  every 1-2 minutes (a Cloudflare Cron Trigger, or any cron) with `Authorization: Bearer $CRON_SECRET`.

## Known gaps / next steps

- **Migrations are written but not yet executed against a live Postgres** — this sandbox has no Docker
  and no Supabase project, so the SQL was hand-verified (types, RLS logic, jsonb-null edge cases, race
  conditions) but not run end-to-end. Run `supabase db push` against a real project and smoke-test the
  full order → referral-approval → payment flow before going live.
- CRUD UI for deadlines/word-count tiers/languages/citation styles/additional services/promo codes isn't
  built yet — edit those tables directly in Supabase Studio for now; the schema and pricing engine already
  fully support them, only the admin screens are pending.
- Cloudflare deployment (`wrangler.jsonc`, `open-next.config.ts`, `npm run cf:build`) is scaffolded per
  the official OpenNext Cloudflare adapter setup but unverified — there's no Cloudflare account in this
  environment. Run `npm run cf:preview` locally against `wrangler`'s dev runtime before deploying.
- No automated tests yet.

## Deploying

```bash
npm run cf:deploy   # builds with OpenNext and deploys via wrangler
```

Set secrets first: `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`.
Point `writing.narix.az` at the Worker via a Cloudflare route, and add a Cron Trigger for the outbox
worker route described above.

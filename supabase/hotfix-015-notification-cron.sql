-- Schedules the email-outbox worker to run every 2 minutes via Supabase's
-- own pg_cron + pg_net extensions, instead of relying on a third-party
-- scheduler. Cloudflare Cron Triggers can't be used here — they invoke a
-- Worker's own scheduled() export directly, not an arbitrary HTTP route,
-- and this app is a Next.js app on Workers (via OpenNext) with no such
-- export. pg_net's http_post runs from inside Postgres on a cron schedule
-- instead, hitting the exact same route a Cloudflare Cron Trigger would.
--
-- IMPORTANT: replace <CRON_SECRET> below with the actual value (the same
-- one set via `wrangler secret put CRON_SECRET`) before running this in
-- the SQL Editor. Never commit the real value — this repo is public.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'process-notification-jobs',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://write.narix.az/api/cron/process-notification-jobs',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <CRON_SECRET>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

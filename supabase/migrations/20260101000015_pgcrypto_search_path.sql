-- Guest checkout was failing end-to-end: create_order(), get_order_by_token(),
-- and claim_guest_order() all use pgcrypto's gen_random_bytes()/digest() to
-- generate and hash the guest tracking token, but each is SECURITY DEFINER
-- with `set search_path = public` only. On Supabase Cloud, pgcrypto lives in
-- the `extensions` schema (the `create extension if not exists pgcrypto`
-- in the first migration was a no-op there, since it's pre-installed), so
-- these functions couldn't resolve gen_random_bytes/digest at all — every
-- guest order submission errored, and any already-placed guest order was
-- unreachable via its tracking link. Logged-in orders were unaffected,
-- since the guest-token branch only runs when there's no auth.uid().
alter function create_order(jsonb) set search_path = public, extensions;
alter function get_order_by_token(text) set search_path = public, extensions;
alter function claim_guest_order(text, text) set search_path = public, extensions;

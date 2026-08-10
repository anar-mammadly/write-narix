-- ---------------------------------------------------------------------------
-- hotfix-017: temporary introspection helper.
--
-- hotfix-016 (byte-for-byte CREATE OR REPLACE of calculate_price) did not
-- fix the referral-discount bug, which means the live function body still
-- isn't what we think it is — or there's more than one overload and calls
-- are resolving to a different one. This function lets me read the actual
-- deployed source of every function named calculate_price directly, instead
-- of guessing again. Safe to drop afterwards (see hotfix-018).
-- ---------------------------------------------------------------------------
create or replace function debug_get_function_defs(p_name text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(pg_get_functiondef(p.oid)), '[]'::jsonb)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = p_name;
$$;

revoke execute on function debug_get_function_defs(text) from public, anon, authenticated;

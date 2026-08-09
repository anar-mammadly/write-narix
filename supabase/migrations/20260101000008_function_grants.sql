-- Narix Academy — function execute grants
--
-- Postgres grants EXECUTE on every newly created function to PUBLIC by
-- default. Left alone, that means every SECURITY DEFINER function above —
-- including internal helpers that trust their parameters, such as
-- calculate_price(p_user_id, ...) or try_consume_referral_code(p_code_id) —
-- would be directly callable over PostgREST by any anon/authenticated
-- client, who could pass whatever arguments they like. We revoke that
-- default for every function in this schema, then grant EXECUTE back only
-- on the specific functions meant to be public entry points.
--
-- Supabase projects additionally run `ALTER DEFAULT PRIVILEGES IN SCHEMA
-- public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated` at the database
-- level, so every new function is auto-granted to those two roles
-- specifically — not just to the generic PUBLIC pseudo-role. Revoking only
-- `FROM PUBLIC` therefore leaves that Supabase-level grant standing. Both
-- must be revoked explicitly.

revoke execute on all functions in schema public from public, anon, authenticated;

-- Needed by RLS policies themselves (evaluated as the querying role for
-- every request), not just by application code — must stay open.
grant execute on function is_admin() to anon, authenticated;
grant execute on function owns_order(uuid) to anon, authenticated;

-- Client-facing, safe-by-construction entry points (each ignores/derives
-- any caller identity from auth.uid() rather than trusting a parameter).
grant execute on function preview_price(uuid, uuid, uuid, int, numeric, uuid, uuid, uuid[], text) to anon, authenticated;
grant execute on function validate_promo_code(text) to anon, authenticated;
grant execute on function create_order(jsonb) to anon, authenticated;
grant execute on function get_order_by_token(text) to anon, authenticated;
grant execute on function claim_guest_order(text, text) to authenticated;
grant execute on function approve_referral(uuid) to authenticated;
grant execute on function reject_referral(uuid, text) to authenticated;
grant execute on function change_order_status(uuid, uuid, text) to authenticated;
grant execute on function unlock_order(uuid) to authenticated;

-- Everything else (calculate_price, redeem_referral_code, try_consume_*,
-- enqueue_*, profile_email, next_order_number, generate_referral_code,
-- reevaluate_order_discount, all trigger functions, etc.) is intentionally
-- left unreachable via RPC — only callable from inside another SECURITY
-- DEFINER function, which executes as the function owner and is therefore
-- unaffected by this revoke.

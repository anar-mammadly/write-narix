-- Hotfix: close the function-execute security gap.
-- Supabase auto-grants EXECUTE on every new function to `anon` and
-- `authenticated` directly (via ALTER DEFAULT PRIVILEGES), not just to the
-- generic PUBLIC pseudo-role — so the original migration's
-- `revoke ... from public` left that grant standing. Run this once.

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function is_admin() to anon, authenticated;
grant execute on function owns_order(uuid) to anon, authenticated;

grant execute on function preview_price(uuid, uuid, uuid, int, numeric, uuid, uuid, uuid[], text) to anon, authenticated;
grant execute on function validate_promo_code(text) to anon, authenticated;
grant execute on function create_order(jsonb) to anon, authenticated;
grant execute on function get_order_by_token(text) to anon, authenticated;
grant execute on function claim_guest_order(text, text) to authenticated;
grant execute on function approve_referral(uuid) to authenticated;
grant execute on function reject_referral(uuid, text) to authenticated;
grant execute on function change_order_status(uuid, uuid, text) to authenticated;
grant execute on function unlock_order(uuid) to authenticated;

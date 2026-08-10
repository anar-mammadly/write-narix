-- ---------------------------------------------------------------------------
-- hotfix-018: temporary diagnostic — runs the exact same WHERE clause
-- calculate_price() uses for the referral candidate, standalone, so we can
-- see definitively whether it matches (and under which role/RLS context).
-- calculate_price()'s SQL was confirmed byte-identical to source via
-- debug_get_function_defs, yet it never produces a referral candidate even
-- when the benefit row provably satisfies every condition via direct REST
-- reads. This isolates whether the discrepancy is role/RLS-related.
-- ---------------------------------------------------------------------------
create or replace function debug_check_benefit(p_user_id uuid, p_benefit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  benefit referral_benefits;
  v_direct jsonb;
begin
  select * into benefit from referral_benefits
   where id = p_benefit_id
     and beneficiary_user_id = p_user_id
     and status = 'approved'
     and consumed_at is null
     and (expires_at is null or expires_at > now());

  select to_jsonb(rb) into v_direct from referral_benefits rb where rb.id = p_benefit_id;

  return jsonb_build_object(
    'match_found', benefit is not null,
    'benefit_row_selected', to_jsonb(benefit),
    'raw_row_by_id', v_direct,
    'current_user', current_user,
    'session_user', session_user,
    'now', now()
  );
end;
$$;

revoke execute on function debug_check_benefit(uuid, uuid) from public, anon, authenticated;

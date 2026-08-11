-- ---------------------------------------------------------------------------
-- hotfix-021:
-- 1. orders.reviewed_price — admin-entered "post-review final price" that
--    supersedes the calculator-derived total. Once set, referral/promo
--    approval percentages apply directly to it instead of recomputing via
--    calculate_price(). Existing behavior (no reviewed_price set) is
--    unchanged — reevaluate_order_discount[/for_promo] fall through to the
--    exact same calculate_price()-based path as before.
-- 2. get_order_contact(order_id) — admin-only lookup of a customer's phone
--    + email (guest columns are already on orders; email for a registered
--    user lives in auth.users, invisible to PostgREST otherwise).
-- 3. profile_email() had never been revoked from anon/authenticated (an
--    email-harvesting hole: any signed-in user could call
--    profile_email(any_uuid) directly). All of its callers are themselves
--    SECURITY DEFINER functions owned by the same role, so they keep
--    working via ownership — revoking public grants breaks nothing.
-- ---------------------------------------------------------------------------

alter table orders add column if not exists reviewed_price numeric(10,2);

create or replace function get_order_contact(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into o from orders where id = p_order_id;
  if o.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'phone', coalesce((select phone from profiles where id = o.user_id), o.guest_phone),
    'email', coalesce(profile_email(o.user_id), o.guest_email)
  );
end;
$$;

grant execute on function get_order_contact(uuid) to authenticated;
revoke execute on function get_order_contact(uuid) from anon;

revoke execute on function profile_email(uuid) from public, anon, authenticated;

create or replace function set_order_reviewed_price(p_order_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  select * into o from orders where id = p_order_id;
  if o.id is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- A fresh reviewed price replaces whatever discount was previously
  -- computed against the calculator subtotal — it's a new base, and any
  -- referral/promo approval from here on applies to *this* amount (see
  -- reevaluate_order_discount[/for_promo] below). If the admin wants a
  -- previously-approved code reflected again, they re-approve it.
  update orders set
    reviewed_price = p_amount,
    final_price = p_amount,
    discount_source = null,
    discount_percentage = null,
    discount_amount = 0
  where id = p_order_id;

  return jsonb_build_object('final_price', p_amount);
end;
$$;

grant execute on function set_order_reviewed_price(uuid, numeric) to authenticated;
revoke execute on function set_order_reviewed_price(uuid, numeric) from anon;

create or replace function reevaluate_order_discount(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
  v_pricing jsonb;
  v_applied jsonb;
  v_best_benefit_id uuid;
  v_best_pct numeric(5,2);
  v_amount numeric(10,2);
  v_final numeric(10,2);
  v_cand jsonb;
begin
  select * into o from orders where id = p_order_id;
  if o.id is null or o.locked then
    return; -- order already closed out; the benefit stays available for a future order
  end if;

  select id, percentage into v_best_benefit_id, v_best_pct from referral_benefits
   where beneficiary_user_id = o.user_id and status = 'approved' and consumed_at is null
     and (expires_at is null or expires_at > now())
   order by created_at asc limit 1;

  if v_best_benefit_id is null then
    return;
  end if;

  if o.reviewed_price is not null then
    v_amount := round(o.reviewed_price * v_best_pct / 100, 2);
    v_final := o.reviewed_price - v_amount;

    if v_amount <= o.discount_amount then
      return;
    end if;

    update referral_benefits set status = 'consumed', consumed_order_id = o.id, consumed_at = now()
     where id = v_best_benefit_id;

    update orders set
      discount_source = 'referral',
      discount_percentage = v_best_pct,
      discount_amount = v_amount,
      final_price = v_final
    where id = o.id;

    insert into discount_applications (order_id, discount_source, reference_id, percentage_considered, amount_considered, applied, reason)
    values (o.id, 'referral', v_best_benefit_id, v_best_pct, v_amount, true, 'referral approval re-evaluation (reviewed price base)');

    return;
  end if;

  v_pricing := calculate_price(
    o.service_id, o.academic_level_id, o.deadline_option_id, o.word_count, o.page_count,
    o.language_id, o.citation_style_id,
    (select array_agg(additional_service_id) from order_additional_services where order_id = o.id),
    o.user_id, null, v_best_benefit_id
  );
  v_applied := v_pricing->'applied';

  if v_applied is not null and v_applied->>'source' = 'referral'
     and coalesce((v_applied->>'amount')::numeric, 0) > o.discount_amount then
    update referral_benefits set status = 'consumed', consumed_order_id = o.id, consumed_at = now()
     where id = v_best_benefit_id;

    update orders set
      discount_source = 'referral',
      discount_percentage = (v_applied->>'percentage')::numeric,
      discount_amount = (v_applied->>'amount')::numeric,
      final_price = (v_pricing->>'final_price')::numeric
    where id = o.id;

    for v_cand in select * from jsonb_array_elements(coalesce(v_pricing->'candidates', '[]'::jsonb)) loop
      insert into discount_applications (order_id, discount_source, reference_id, percentage_considered, amount_considered, applied, reason)
      values (o.id, (v_cand->>'source')::discount_type, (v_cand->>'reference_id')::uuid,
        (v_cand->>'percentage')::numeric, (v_cand->>'amount')::numeric,
        v_cand = v_applied, 'referral approval re-evaluation');
    end loop;
  end if;
end;
$$;

create or replace function reevaluate_order_discount_for_promo(p_order_id uuid, p_percentage numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
  v_pricing jsonb;
  v_applied jsonb;
  v_best_benefit_id uuid;
  v_amount numeric(10,2);
  v_final numeric(10,2);
  v_cand jsonb;
begin
  select * into o from orders where id = p_order_id;
  if o.id is null or o.locked then
    return; -- order already closed out
  end if;

  if o.reviewed_price is not null then
    v_amount := round(o.reviewed_price * p_percentage / 100, 2);
    v_final := o.reviewed_price - v_amount;

    if v_amount <= o.discount_amount then
      return;
    end if;

    update orders set
      discount_source = 'promo',
      discount_percentage = p_percentage,
      discount_amount = v_amount,
      final_price = v_final
    where id = o.id;

    insert into discount_applications (order_id, discount_source, reference_id, percentage_considered, amount_considered, applied, reason)
    values (o.id, 'promo', null, p_percentage, v_amount, true, 'promo code approval re-evaluation (reviewed price base)');

    return;
  end if;

  select id into v_best_benefit_id from referral_benefits
   where beneficiary_user_id = o.user_id and status = 'approved' and consumed_at is null
     and (expires_at is null or expires_at > now())
   order by created_at asc limit 1;

  v_pricing := calculate_price(
    o.service_id, o.academic_level_id, o.deadline_option_id, o.word_count, o.page_count,
    o.language_id, o.citation_style_id,
    (select array_agg(additional_service_id) from order_additional_services where order_id = o.id),
    o.user_id, null, v_best_benefit_id, p_percentage
  );
  v_applied := v_pricing->'applied';

  if v_applied is not null and coalesce((v_applied->>'amount')::numeric, 0) > o.discount_amount then
    update orders set
      discount_source = (v_applied->>'source')::discount_type,
      discount_percentage = (v_applied->>'percentage')::numeric,
      discount_amount = (v_applied->>'amount')::numeric,
      final_price = (v_pricing->>'final_price')::numeric
    where id = o.id;

    for v_cand in select * from jsonb_array_elements(coalesce(v_pricing->'candidates', '[]'::jsonb)) loop
      insert into discount_applications (order_id, discount_source, reference_id, percentage_considered, amount_considered, applied, reason)
      values (o.id, (v_cand->>'source')::discount_type, (v_cand->>'reference_id')::uuid,
        (v_cand->>'percentage')::numeric, (v_cand->>'amount')::numeric,
        v_cand = v_applied, 'promo code approval re-evaluation');
    end loop;
  end if;
end;
$$;

revoke execute on function reevaluate_order_discount(uuid) from public, anon, authenticated;
revoke execute on function reevaluate_order_discount_for_promo(uuid, numeric) from public, anon, authenticated;

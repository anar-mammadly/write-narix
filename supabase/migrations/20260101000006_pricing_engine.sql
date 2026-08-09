-- Narix Academy — pricing + discount engine
--
-- calculate_price() is PURE and READ-ONLY: it writes nothing, ever. It is
-- safe to call on every calculator keystroke (the app debounces/rate-limits
-- calls at the edge regardless — see src/lib/pricing/preview-client.ts).
-- create_order() calls this same function once, server-side, at submission,
-- and is the only place discount candidates get persisted.

create or replace function calculate_price(
  p_service_id uuid,
  p_academic_level_id uuid,
  p_deadline_option_id uuid,
  p_word_count int,
  p_page_count numeric,
  p_language_id uuid,
  p_citation_style_id uuid,
  p_additional_service_ids uuid[],
  p_user_id uuid,
  p_promo_code text,
  p_referral_benefit_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rule pricing_rules;
  deadline deadline_options;
  lang languages;
  citation citation_styles;
  addon additional_services;
  addon_id uuid;
  base numeric(10,2);
  addons_total numeric(10,2) := 0;
  addons_breakdown jsonb := '[]'::jsonb;
  subtotal numeric(10,2);
  candidates jsonb := '[]'::jsonb;
  best jsonb := null;
  cand jsonb;
  member_pct numeric(5,2);
  early discounts;
  promo promo_codes;
  promo_discount discounts;
  benefit referral_benefits;
  is_verified boolean;
begin
  -- calculate_price() trusts p_user_id as given — it is an internal engine
  -- called by create_order() and reevaluate_order_discount(), which have
  -- already resolved the correct target user themselves (auth.uid() for the
  -- former, the order's own owner for the latter — these are not always the
  -- same principal, e.g. an admin re-evaluating someone else's order). It is
  -- NOT a public RPC; see preview_price() below for the client-facing,
  -- self-only entry point, and the REVOKE/GRANT block in 000008.
  select * into rule from pricing_rules
   where service_id = p_service_id and academic_level_id = p_academic_level_id and is_active = true;
  if rule is null then
    raise exception 'NO_PRICING_RULE' using errcode = 'P0001';
  end if;

  select * into deadline from deadline_options where id = p_deadline_option_id and is_active = true;
  if deadline is null then
    raise exception 'INVALID_DEADLINE' using errcode = 'P0001';
  end if;

  base := rule.base_price
        + coalesce(rule.price_per_page, 0) * coalesce(p_page_count, 0)
        + coalesce(rule.price_per_word, 0) * coalesce(p_word_count, 0);

  base := base * deadline.multiplier + deadline.fixed_fee;

  if p_language_id is not null then
    select * into lang from languages where id = p_language_id and is_active = true;
    if lang is not null then base := base + lang.extra_fee; end if;
  end if;

  if p_citation_style_id is not null then
    select * into citation from citation_styles where id = p_citation_style_id and is_active = true;
    if citation is not null then base := base + citation.extra_fee; end if;
  end if;

  if p_additional_service_ids is not null then
    foreach addon_id in array p_additional_service_ids loop
      select * into addon from additional_services where id = addon_id and is_active = true;
      if addon is not null then
        if addon.price_type = 'fixed' then
          addons_total := addons_total + addon.price_value;
        else
          addons_total := addons_total + round(base * addon.price_value / 100, 2);
        end if;
        addons_breakdown := addons_breakdown || jsonb_build_object(
          'id', addon.id, 'name', addon.name, 'price_type', addon.price_type, 'price_value', addon.price_value
        );
      end if;
    end loop;
  end if;

  subtotal := base + addons_total;

  -- ---- gather discount candidates (evaluation only, nothing persisted) ----

  if p_user_id is not null then
    select email_verified into is_verified from profiles where id = p_user_id;
    if is_verified then
      select percentage into member_pct from discounts
       where type = 'member' and active = true
       order by created_at desc limit 1;
      if member_pct is not null then
        candidates := candidates || jsonb_build_object(
          'source', 'member', 'reference_id', null,
          'percentage', member_pct, 'amount', round(subtotal * member_pct / 100, 2)
        );
      end if;
    end if;
  end if;

  select * into early from discounts
   where type = 'early_order' and active = true
     and (start_date is null or start_date <= now())
     and (end_date is null or end_date >= now())
   order by created_at desc limit 1;
  if early is not null and early.percentage is not null then
    candidates := candidates || jsonb_build_object(
      'source', 'early_order', 'reference_id', early.id,
      'percentage', early.percentage, 'amount', round(subtotal * early.percentage / 100, 2)
    );
  end if;

  if p_referral_benefit_id is not null then
    select * into benefit from referral_benefits
     where id = p_referral_benefit_id
       and beneficiary_user_id = p_user_id
       and status = 'approved'
       and consumed_at is null
       and (expires_at is null or expires_at > now());
    if benefit is not null then
      candidates := candidates || jsonb_build_object(
        'source', 'referral', 'reference_id', benefit.id,
        'percentage', benefit.percentage, 'amount', round(subtotal * benefit.percentage / 100, 2)
      );
    end if;
  end if;

  if p_promo_code is not null and length(trim(p_promo_code)) > 0 then
    select * into promo from promo_codes
     where code = upper(trim(p_promo_code))
       and active = true
       and current_uses < max_total_uses
       and (expires_at is null or expires_at > now());
    if promo is not null then
      select * into promo_discount from discounts where id = promo.discount_id and active = true;
      if promo_discount is not null and (promo_discount.minimum_order is null or subtotal >= promo_discount.minimum_order) then
        cand := jsonb_build_object('source', 'promo', 'reference_id', promo.id);
        if promo_discount.percentage is not null then
          cand := cand || jsonb_build_object(
            'percentage', promo_discount.percentage,
            'amount', round(subtotal * promo_discount.percentage / 100, 2)
          );
        else
          cand := cand || jsonb_build_object('percentage', 0, 'amount', least(promo_discount.fixed_amount, subtotal));
        end if;
        candidates := candidates || cand;
      end if;
    end if;
  end if;

  -- cap each candidate at its discount's maximum_discount where applicable, then pick the single highest amount (no stacking)
  select c into best
    from (
      select c, (c->>'amount')::numeric as amt
      from jsonb_array_elements(candidates) c
      order by (c->>'amount')::numeric desc
      limit 1
    ) x;

  -- NOTE: the 'applied' key is only ever added when a discount actually won.
  -- jsonb_build_object('applied', best) with a SQL-NULL `best` would embed a
  -- JSON `null` token rather than omitting the key, and `x->'applied'`
  -- returns that non-SQL-NULL jsonb datum — breaking every downstream
  -- `is not null` check that assumes "no discount" means a true SQL NULL.
  return jsonb_build_object(
    'base_price', base,
    'addons_total', addons_total,
    'addons_breakdown', addons_breakdown,
    'subtotal', subtotal,
    'candidates', candidates,
    'final_price', subtotal - coalesce((best->>'amount')::numeric, 0)
  ) || case when best is not null then jsonb_build_object('applied', best) else '{}'::jsonb end;
end;
$$;

-- Client-facing, read-only preview entry point. Deliberately has no
-- p_user_id parameter — it always prices for the caller's own session
-- (auth.uid(), or null for a guest), so there is no field a malicious
-- client could set to preview, or leak eligibility for, another user.
create or replace function preview_price(
  p_service_id uuid,
  p_academic_level_id uuid,
  p_deadline_option_id uuid,
  p_word_count int,
  p_page_count numeric,
  p_language_id uuid,
  p_citation_style_id uuid,
  p_additional_service_ids uuid[],
  p_promo_code text
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_benefit_id uuid;
begin
  if v_user_id is not null then
    select id into v_benefit_id from referral_benefits
     where beneficiary_user_id = v_user_id and status = 'approved' and consumed_at is null
       and (expires_at is null or expires_at > now())
     order by created_at asc limit 1;
  end if;

  return calculate_price(
    p_service_id, p_academic_level_id, p_deadline_option_id, p_word_count, p_page_count,
    p_language_id, p_citation_style_id, p_additional_service_ids, v_user_id, p_promo_code, v_benefit_id
  );
end;
$$;

-- Read-only eligibility check used by the checkout UI to show
-- "code applied — pending" feedback without consuming or persisting anything.
create or replace function validate_promo_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when pc.id is null then jsonb_build_object('valid', false, 'reason', 'not_found')
    when not pc.active then jsonb_build_object('valid', false, 'reason', 'inactive')
    when pc.expires_at is not null and pc.expires_at <= now() then jsonb_build_object('valid', false, 'reason', 'expired')
    when pc.current_uses >= pc.max_total_uses then jsonb_build_object('valid', false, 'reason', 'exhausted')
    else jsonb_build_object('valid', true, 'percentage', d.percentage, 'fixed_amount', d.fixed_amount)
  end
  from promo_codes pc
  left join discounts d on d.id = pc.discount_id
  where pc.code = upper(trim(p_code));
$$;

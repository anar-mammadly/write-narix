-- ---------------------------------------------------------------------------
-- hotfix-019: real root cause, found via debug_check_benefit.
--
-- Postgres composite-row semantics: for a row variable (not a scalar),
-- `row IS NOT NULL` only succeeds if EVERY field is non-null; `row IS NULL`
-- only succeeds if EVERY field is null. A row with a MIX of null and
-- non-null fields fails BOTH tests. calculate_price() declares `benefit
-- referral_benefits`, `early discounts`, `lang languages`, `citation
-- citation_styles`, `addon additional_services` and then does
-- `select * into <var> from ...` followed by `if <var> is not null`. Every
-- one of those tables has nullable columns (referral_benefits.consumed_at,
-- discounts.start_date/end_date, etc.), so a genuinely-matched row with any
-- null column silently fails its "was this found?" check — exactly what
-- happened to the referral benefit (consumed_at/consumed_order_id are null
-- by design until the benefit is used). Fix: check a column that's always
-- non-null when the row exists (the primary key) instead of the whole row.
-- Nothing else in the function changes.
-- ---------------------------------------------------------------------------
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
  p_referral_benefit_id uuid,
  p_promo_override_percentage numeric default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rule service_pricing_rules;
  pages int;
  lang languages;
  citation citation_styles;
  addon additional_services;
  addon_id uuid;
  addon_price numeric(10,2);
  service_base numeric(10,2);
  base numeric(10,2);
  addons_total numeric(10,2) := 0;
  addons_breakdown jsonb := '[]'::jsonb;
  deadline_surcharge_percent numeric(5,2);
  deadline_surcharge_amount numeric(10,2);
  subtotal numeric(10,2);
  candidates jsonb := '[]'::jsonb;
  best jsonb := null;
  member_pct numeric(5,2);
  early discounts;
  benefit referral_benefits;
  is_verified boolean;
begin
  if not exists (select 1 from academic_levels where id = p_academic_level_id and is_active = true) then
    raise exception 'INVALID_ACADEMIC_LEVEL' using errcode = 'P0001';
  end if;
  if not exists (select 1 from deadline_options where id = p_deadline_option_id and is_active = true) then
    raise exception 'INVALID_DEADLINE' using errcode = 'P0001';
  end if;

  select surcharge_percent into deadline_surcharge_percent
    from service_deadline_options
   where service_id = p_service_id and deadline_option_id = p_deadline_option_id;
  if deadline_surcharge_percent is null then
    raise exception 'INVALID_DEADLINE_FOR_SERVICE' using errcode = 'P0001';
  end if;

  if p_page_count is null or p_page_count <> trunc(p_page_count) or p_page_count < 1 then
    raise exception 'INVALID_PAGE_COUNT' using errcode = 'P0001';
  end if;
  pages := p_page_count::int;

  select * into rule from service_pricing_rules where service_id = p_service_id;
  if rule.id is null then
    raise exception 'NO_PRICING_RULE' using errcode = 'P0001';
  end if;

  if rule.pricing_type = 'per_page' then
    if rule.minimum_pages is not null and pages < rule.minimum_pages then
      raise exception 'BELOW_MINIMUM_PAGES:%', rule.minimum_pages using errcode = 'P0001';
    end if;
    service_base := pages * rule.price_per_page;
  else
    if pages <= rule.base_pages then
      service_base := case when rule.base_mode = 'flat' then rule.base_price else pages * rule.base_price end;
    else
      service_base := (case when rule.base_mode = 'flat' then rule.base_price else rule.base_pages * rule.base_price end)
              + (pages - rule.base_pages) * rule.additional_page_price;
    end if;
  end if;

  base := service_base;

  if p_language_id is not null then
    select * into lang from languages where id = p_language_id and is_active = true;
    if lang.id is not null then base := base + lang.extra_fee; end if;
  end if;

  if p_citation_style_id is not null then
    select * into citation from citation_styles where id = p_citation_style_id and is_active = true;
    if citation.id is not null then base := base + citation.extra_fee; end if;
  end if;

  if p_additional_service_ids is not null then
    foreach addon_id in array p_additional_service_ids loop
      select * into addon from additional_services where id = addon_id and is_active = true;
      if addon.id is not null then
        if addon.is_plagiarism_addon then
          addon_price := case when service_base >= 500 then 0 else pages * 1 end;
        elsif addon.price_type = 'fixed' then
          addon_price := addon.price_value;
        else
          addon_price := round(base * addon.price_value / 100, 2);
        end if;

        addons_total := addons_total + addon_price;
        addons_breakdown := addons_breakdown || jsonb_build_object(
          'id', addon.id, 'name', addon.name, 'price_type', addon.price_type,
          'price_value', addon.price_value, 'computed_price', addon_price,
          'is_plagiarism_addon', addon.is_plagiarism_addon
        );
      end if;
    end loop;
  end if;

  deadline_surcharge_amount := round((base + addons_total) * deadline_surcharge_percent / 100, 2);
  subtotal := base + addons_total + deadline_surcharge_amount;

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
  if early.id is not null and early.percentage is not null then
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
    if benefit.id is not null then
      candidates := candidates || jsonb_build_object(
        'source', 'referral', 'reference_id', benefit.id,
        'percentage', benefit.percentage, 'amount', round(subtotal * benefit.percentage / 100, 2)
      );
    end if;
  end if;

  if p_promo_override_percentage is not null then
    candidates := candidates || jsonb_build_object(
      'source', 'promo', 'reference_id', null,
      'percentage', p_promo_override_percentage,
      'amount', round(subtotal * p_promo_override_percentage / 100, 2)
    );
  end if;

  select c into best
    from (
      select c, (c->>'amount')::numeric as amt
      from jsonb_array_elements(candidates) c
      order by (c->>'amount')::numeric desc
      limit 1
    ) x;

  return jsonb_build_object(
    'base_price', base,
    'addons_total', addons_total,
    'addons_breakdown', addons_breakdown,
    'deadline_surcharge_percent', deadline_surcharge_percent,
    'deadline_surcharge_amount', deadline_surcharge_amount,
    'subtotal', subtotal,
    'candidates', candidates,
    'final_price', subtotal - coalesce((best->>'amount')::numeric, 0)
  ) || case when best is not null then jsonb_build_object('applied', best) else '{}'::jsonb end;
end;
$$;

-- Drop the temporary diagnostics now that they've served their purpose.
drop function if exists debug_get_function_defs(text);
drop function if exists debug_check_benefit(uuid, uuid);

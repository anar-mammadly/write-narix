-- Narix Academy — dynamic Plagiarism Check pricing
--
-- Plagiarism Check is 1 AZN/page, free once the *service* subtotal (the
-- per-service progressive/per-page formula result — before language,
-- citation, or any other add-on) reaches 500 AZN. This can't be expressed
-- by the generic fixed/percentage additional_services model, so it's
-- special-cased in calculate_price() behind this flag column, keeping the
-- generic model untouched for every other add-on.

alter table additional_services add column if not exists is_plagiarism_addon boolean not null default false;

update additional_services
   set name = 'Plagiat Yoxlanışı',
       description = '1 AZN/səhifə. Sifariş 500 AZN və yuxarı olduqda pulsuzdur.',
       is_plagiarism_addon = true,
       translations = translations || jsonb_build_object(
         'en', jsonb_build_object(
           'name', 'Plagiarism Check',
           'description', '1 AZN per page — free for orders of 500 AZN or more.'
         )
       )
 where name = 'Plagiat Hesabatı';

-- ---------------------------------------------------------------------------
-- calculate_price() — addon pricing is now fully computed here (including
-- the plagiarism special case) and returned as `computed_price` per addon;
-- create_order() persists that value directly rather than re-deriving it,
-- so there is exactly one place addon prices are ever calculated.
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
  p_referral_benefit_id uuid
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
  if not exists (select 1 from academic_levels where id = p_academic_level_id and is_active = true) then
    raise exception 'INVALID_ACADEMIC_LEVEL' using errcode = 'P0001';
  end if;
  if not exists (select 1 from deadline_options where id = p_deadline_option_id and is_active = true) then
    raise exception 'INVALID_DEADLINE' using errcode = 'P0001';
  end if;

  if p_page_count is null or p_page_count <> trunc(p_page_count) or p_page_count < 1 then
    raise exception 'INVALID_PAGE_COUNT' using errcode = 'P0001';
  end if;
  pages := p_page_count::int;

  select * into rule from service_pricing_rules where service_id = p_service_id;
  if rule is null then
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
        if addon.is_plagiarism_addon then
          -- Threshold is checked against the pure service subtotal, before
          -- language/citation fees or any other add-on — never against the
          -- running total, and never after plagiarism itself is added.
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

  subtotal := base + addons_total;

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
    'subtotal', subtotal,
    'candidates', candidates,
    'final_price', subtotal - coalesce((best->>'amount')::numeric, 0)
  ) || case when best is not null then jsonb_build_object('applied', best) else '{}'::jsonb end;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_order() — persist the addon price calculate_price() already
-- computed, instead of re-deriving it from price_type/price_value (which
-- would silently ignore the plagiarism special case and double-maintain
-- the same math in two places).
-- ---------------------------------------------------------------------------

create or replace function create_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_guest_name text := p_payload->>'guest_name';
  v_guest_email text := p_payload->>'guest_email';
  v_guest_phone text := p_payload->>'guest_phone';
  v_service_id uuid := (p_payload->>'service_id')::uuid;
  v_academic_level_id uuid := (p_payload->>'academic_level_id')::uuid;
  v_deadline_option_id uuid := (p_payload->>'deadline_option_id')::uuid;
  v_word_count_option_id uuid := (p_payload->>'word_count_option_id')::uuid;
  v_word_count int := (p_payload->>'word_count')::int;
  v_page_count numeric := (p_payload->>'page_count')::numeric;
  v_language_id uuid := (p_payload->>'language_id')::uuid;
  v_citation_style_id uuid := (p_payload->>'citation_style_id')::uuid;
  v_addon_ids uuid[];
  v_subject text := p_payload->>'subject';
  v_topic text := p_payload->>'topic';
  v_description text := p_payload->>'description';
  v_university text := p_payload->>'university';
  v_college text := p_payload->>'college';
  v_promo_code text := p_payload->>'promo_code';
  v_referral_code text := p_payload->>'referral_code';

  v_pricing jsonb;
  v_existing_benefit_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_status_id uuid;
  v_raw_token text;
  v_token_hash text;
  v_addon jsonb;
  v_cand jsonb;
  v_applied jsonb;
  v_referral_note text := null;
  admin_row record;
begin
  if v_user_id is null and (v_guest_email is null or length(trim(v_guest_email)) = 0) then
    raise exception 'GUEST_EMAIL_REQUIRED' using errcode = 'P0001';
  end if;

  select array_agg(value::uuid) into v_addon_ids
  from jsonb_array_elements_text(coalesce(p_payload->'additional_service_ids', '[]'::jsonb));

  if v_user_id is not null then
    select id into v_existing_benefit_id from referral_benefits
     where beneficiary_user_id = v_user_id and status = 'approved' and consumed_at is null
       and (expires_at is null or expires_at > now())
     order by created_at asc limit 1;
  end if;

  v_pricing := calculate_price(
    v_service_id, v_academic_level_id, v_deadline_option_id, v_word_count, v_page_count,
    v_language_id, v_citation_style_id, v_addon_ids, v_user_id, v_promo_code, v_existing_benefit_id
  );

  v_applied := v_pricing->'applied';

  if v_applied is not null then
    if v_applied->>'source' = 'promo' then
      if not try_consume_promo_code((v_applied->>'reference_id')::uuid) then
        raise exception 'PROMO_CODE_NO_LONGER_AVAILABLE' using errcode = 'P0001';
      end if;
    elsif v_applied->>'source' = 'referral' then
      update referral_benefits
         set status = 'consumed', consumed_at = now()
       where id = (v_applied->>'reference_id')::uuid
         and status = 'approved' and consumed_at is null
      returning id into v_existing_benefit_id;
      if v_existing_benefit_id is null then
        raise exception 'REFERRAL_BENEFIT_NO_LONGER_AVAILABLE' using errcode = 'P0001';
      end if;
    end if;
  end if;

  select id into v_status_id from order_statuses where slug = 'new_order' and is_active = true;
  v_order_number := next_order_number();

  if v_user_id is null then
    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
  end if;

  insert into orders (
    order_number, user_id, guest_name, guest_email, guest_phone, guest_token_hash,
    service_id, academic_level_id, deadline_option_id, word_count_option_id,
    word_count, page_count, language_id, citation_style_id,
    subject, topic, description, university, college,
    base_price, discount_source, discount_percentage, discount_amount, final_price,
    status_id
  ) values (
    v_order_number, v_user_id, v_guest_name, v_guest_email, v_guest_phone, v_token_hash,
    v_service_id, v_academic_level_id, v_deadline_option_id, v_word_count_option_id,
    v_word_count, v_page_count, v_language_id, v_citation_style_id,
    v_subject, v_topic, v_description, v_university, v_college,
    (v_pricing->>'base_price')::numeric,
    case when v_applied is not null then (v_applied->>'source')::discount_type else null end,
    coalesce((v_applied->>'percentage')::numeric, 0),
    coalesce((v_applied->>'amount')::numeric, 0),
    (v_pricing->>'final_price')::numeric,
    v_status_id
  ) returning id into v_order_id;

  insert into order_pricing_snapshots (order_id, snapshot, config_version)
  values (v_order_id, v_pricing, to_char(now(), 'YYYYMMDDHH24MISS'));

  for v_addon in select * from jsonb_array_elements(coalesce(v_pricing->'addons_breakdown', '[]'::jsonb)) loop
    insert into order_additional_services (order_id, additional_service_id, name_at_order, price_at_order)
    values (v_order_id, (v_addon->>'id')::uuid, v_addon->>'name', (v_addon->>'computed_price')::numeric);
  end loop;

  for v_cand in select * from jsonb_array_elements(coalesce(v_pricing->'candidates', '[]'::jsonb)) loop
    insert into discount_applications (order_id, discount_source, reference_id, percentage_considered, amount_considered, applied, reason)
    values (
      v_order_id, (v_cand->>'source')::discount_type, (v_cand->>'reference_id')::uuid,
      (v_cand->>'percentage')::numeric, (v_cand->>'amount')::numeric,
      v_applied is not null and v_cand = v_applied,
      case when v_applied is not null and v_cand = v_applied then 'highest value candidate'
           else 'lower value than applied ' || coalesce(v_applied->>'source', 'discount') end
    );
  end loop;

  insert into order_status_history (order_id, from_status_id, to_status_id, note)
  values (v_order_id, null, v_status_id, 'Order created');

  if v_referral_code is not null and length(trim(v_referral_code)) > 0 and v_user_id is not null then
    v_referral_note := redeem_referral_code(v_referral_code, v_user_id, v_order_id);
  end if;

  if v_user_id is not null then
    perform enqueue_notification(v_user_id, 'order_created', 'Order ' || v_order_number || ' received', 'We have received your order.', v_order_id);
    perform enqueue_email_job('order_created', 'order_created:' || v_order_id::text, 'order_created', v_user_id, profile_email(v_user_id), jsonb_build_object('order_number', v_order_number));
  else
    perform enqueue_email_job('order_created', 'order_created:' || v_order_id::text, 'order_created', null, v_guest_email, jsonb_build_object('order_number', v_order_number));
  end if;

  for admin_row in select id from profiles where role = 'admin' loop
    perform enqueue_notification(admin_row.id, 'new_order', 'New order ' || v_order_number, 'A new order was submitted.', v_order_id);
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'final_price', v_pricing->>'final_price',
    'guest_token', v_raw_token,
    'referral_status', v_referral_note
  );
end;
$$;

-- Promo codes go through the same admin-approval flow referral codes
-- already use, instead of applying instantly.
--
-- Before: entering a promo code priced it into calculate_price()'s normal
-- discount competition (member/early_order/referral/promo, highest value
-- wins) immediately, both in the live calculator preview and at order
-- creation. Referral codes never worked this way — redeeming one only
-- creates a pending `referrals` row; the discount is applied later, if an
-- admin approves it, by reevaluate_order_discount().
--
-- This migration makes promo codes follow that exact same shape: redeeming
-- one now only records a pending `promo_code_requests` row (visible in the
-- admin panel next to pending referrals) and no longer prices anything.
-- The admin panel now also lets the admin type the discount percentage by
-- hand at approval time — for BOTH referrals and promo requests — rather
-- than relying on the fixed default from the `discounts` table.
--
-- calculate_price() gains one new trailing parameter with a default of
-- null (p_promo_override_percentage). Because it's trailing and defaulted,
-- every existing caller (preview_price, create_order, the pre-existing
-- reevaluate_order_discount) keeps working completely unchanged — only
-- the new promo-approval reevaluation function passes it.

-- ---------------------------------------------------------------------------
-- New table: one row per promo-code redemption attempt, mirroring how
-- `referrals` tracks one row per referral-code redemption.
-- ---------------------------------------------------------------------------
create table promo_code_requests (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references promo_codes(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null, -- null for guest checkout
  percentage numeric(5,2), -- set by the admin at approval time
  status referral_status not null default 'pending_approval',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now()
);

create index promo_code_requests_status_idx on promo_code_requests(status);

alter table promo_code_requests enable row level security;

create policy promo_code_requests_select on promo_code_requests
  for select using (user_id = auth.uid() or is_admin());

create policy promo_code_requests_admin_write on promo_code_requests
  for update using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- calculate_price(): add the override parameter, remove the old instant
-- promo_code candidate (superseded by the override below — a promo code
-- with no matching approved request now prices nothing, exactly like an
-- unapproved referral benefit already didn't).
--
-- A trailing DEFAULT parameter still counts as part of the declared
-- signature for CREATE OR REPLACE's purposes — adding one via plain
-- CREATE OR REPLACE would NOT replace the old 11-argument function, it
-- would silently create a second, separate 12-argument overload sitting
-- alongside it. Every existing 11-argument call site would then keep
-- resolving to the OLD function (still containing the removed promo
-- branch), while the new one sat unused. The explicit DROP first is what
-- makes this an actual replacement instead of two coexisting versions.
-- ---------------------------------------------------------------------------
drop function if exists calculate_price(uuid, uuid, uuid, int, numeric, uuid, uuid, uuid[], uuid, text, uuid);

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
          -- language/citation fees, other add-ons, or the deadline surcharge
          -- — never against the running total.
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

  -- Promo codes no longer price instantly from p_promo_code (see migration
  -- header) — an admin-approved request supplies its percentage here
  -- instead, via reevaluate_order_discount_for_promo(). p_promo_code is
  -- kept as a parameter only so existing callers don't need to change.
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

-- ---------------------------------------------------------------------------
-- create_order(): stop feeding the raw promo code into calculate_price
-- (so it can never win instantly), and redeem it into a pending
-- promo_code_requests row after the order exists — exactly mirroring how
-- v_referral_code is handled a few lines below.
-- ---------------------------------------------------------------------------
create or replace function redeem_promo_code(p_code text, p_user_id uuid, p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo promo_codes;
begin
  select * into v_promo from promo_codes
   where code = upper(trim(p_code)) and active = true
     and (expires_at is null or expires_at > now());
  if v_promo is null then
    return 'not_found';
  end if;

  if exists (select 1 from promo_code_requests where promo_code_id = v_promo.id and order_id = p_order_id) then
    return 'already_requested';
  end if;

  if not try_consume_promo_code(v_promo.id) then
    return 'exhausted';
  end if;

  insert into promo_code_requests (promo_code_id, order_id, user_id)
  values (v_promo.id, p_order_id, p_user_id);

  if p_user_id is not null then
    perform enqueue_notification(
      p_user_id, 'promo_pending', 'Promo code applied',
      'Your promo code discount is pending admin approval.', p_order_id
    );
  end if;

  return 'pending_approval';
end;
$$;

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
  v_promo_note text := null;
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

  -- Promo code is deliberately NOT passed here anymore (null) — it no
  -- longer prices instantly; see redeem_promo_code() below.
  v_pricing := calculate_price(
    v_service_id, v_academic_level_id, v_deadline_option_id, v_word_count, v_page_count,
    v_language_id, v_citation_style_id, v_addon_ids, v_user_id, null, v_existing_benefit_id
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

  if v_promo_code is not null and length(trim(v_promo_code)) > 0 then
    v_promo_note := redeem_promo_code(v_promo_code, v_user_id, v_order_id);
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
    'referral_status', v_referral_note,
    'promo_status', v_promo_note
  );
end;
$$;

alter function create_order(jsonb) set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Re-evaluation for an approved promo request. Generalizes the existing
-- reevaluate_order_discount() (which only ever checked for a winning
-- 'referral' candidate) to accept whichever discount source actually wins
-- — necessary now that a promo candidate can also win.
-- ---------------------------------------------------------------------------
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
  v_cand jsonb;
begin
  select * into o from orders where id = p_order_id;
  if o is null or o.locked then
    return; -- order already closed out
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

create or replace function approve_promo_request(p_request_id uuid, p_percentage numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req promo_code_requests;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_percentage is null or p_percentage < 0 or p_percentage > 100 then
    raise exception 'INVALID_PERCENTAGE' using errcode = 'P0001';
  end if;

  select * into req from promo_code_requests where id = p_request_id and status = 'pending_approval';
  if req is null then
    raise exception 'REQUEST_NOT_PENDING' using errcode = 'P0001';
  end if;

  update promo_code_requests
     set status = 'approved', percentage = p_percentage, approved_by = auth.uid(), approved_at = now()
   where id = p_request_id;

  perform reevaluate_order_discount_for_promo(req.order_id, p_percentage);

  if req.user_id is not null then
    perform enqueue_notification(req.user_id, 'promo_approved', 'Promo code approved', 'Your promo code discount has been approved and applied.', req.order_id);
    perform enqueue_email_job('promo_approved', 'promo_approved:' || p_request_id::text, 'promo_approved', req.user_id, profile_email(req.user_id), '{}'::jsonb);
  end if;

  insert into audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'approve', 'promo_code_requests', p_request_id::text, jsonb_build_object('status', 'approved', 'percentage', p_percentage));

  return jsonb_build_object('status', 'approved');
end;
$$;

create or replace function reject_promo_request(p_request_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req promo_code_requests;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into req from promo_code_requests where id = p_request_id and status = 'pending_approval';
  if req is null then
    raise exception 'REQUEST_NOT_PENDING' using errcode = 'P0001';
  end if;

  update promo_code_requests
     set status = 'rejected', rejected_reason = p_reason, approved_by = auth.uid(), approved_at = now()
   where id = p_request_id;

  if req.user_id is not null then
    perform enqueue_notification(req.user_id, 'promo_rejected', 'Promo code rejected', coalesce(p_reason, 'Your promo code discount request was not approved.'), req.order_id);
    perform enqueue_email_job('promo_rejected', 'promo_rejected:' || p_request_id::text, 'promo_rejected', req.user_id, profile_email(req.user_id), jsonb_build_object('reason', p_reason));
  end if;

  insert into audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'reject', 'promo_code_requests', p_request_id::text, jsonb_build_object('status', 'rejected', 'reason', p_reason));

  return jsonb_build_object('status', 'rejected');
end;
$$;

-- ---------------------------------------------------------------------------
-- Referral approval now takes an admin-typed percentage too, instead of
-- the fixed default `discounts` row it was redeemed with. A NEW function
-- (rather than changing approve_referral(uuid)'s signature) — Postgres
-- treats a different argument list as a different function, so this is
-- purely additive and the old one-arg approve_referral() is left in place,
-- unused but harmless. reevaluate_order_discount() itself needs no changes
-- at all: it already reads referral_benefits.percentage dynamically, so
-- overwriting that column below is enough for the new percentage to flow
-- through calculate_price() unchanged.
-- ---------------------------------------------------------------------------
create or replace function approve_referral_with_percentage(p_referral_id uuid, p_percentage numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r referrals;
  validity_days int;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_percentage is null or p_percentage < 0 or p_percentage > 100 then
    raise exception 'INVALID_PERCENTAGE' using errcode = 'P0001';
  end if;

  select * into r from referrals where id = p_referral_id and status = 'pending_approval';
  if r is null then
    raise exception 'REFERRAL_NOT_PENDING' using errcode = 'P0001';
  end if;

  select coalesce((value->>'validity_days')::int, 90) into validity_days
  from site_settings where key = 'referral_program';

  update referrals set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_referral_id;

  update referral_benefits
     set status = 'approved', percentage = p_percentage, approved_by = auth.uid(), approved_at = now(),
         expires_at = now() + (coalesce(validity_days, 90) || ' days')::interval
   where referral_id = p_referral_id;

  perform reevaluate_order_discount(r.order_id);

  perform enqueue_notification(r.referrer_user_id, 'referral_approved', 'Referral approved', 'Your referral reward is ready to use on your next order.', null);
  perform enqueue_notification(r.referred_user_id, 'referral_approved', 'Referral discount approved', 'Your referral discount has been approved.', r.order_id);
  perform enqueue_email_job('referral_approved', 'referral_approved:referrer:' || p_referral_id::text, 'referral_approved', r.referrer_user_id, profile_email(r.referrer_user_id), '{}'::jsonb);
  perform enqueue_email_job('referral_approved', 'referral_approved:referred:' || p_referral_id::text, 'referral_approved', r.referred_user_id, profile_email(r.referred_user_id), '{}'::jsonb);

  insert into audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'approve', 'referrals', p_referral_id::text, jsonb_build_object('status', 'approved', 'percentage', p_percentage));

  return jsonb_build_object('status', 'approved');
end;
$$;

grant execute on function approve_referral_with_percentage(uuid, numeric) to authenticated;
grant execute on function approve_promo_request(uuid, numeric) to authenticated;
grant execute on function reject_promo_request(uuid, text) to authenticated;

-- Supabase auto-grants EXECUTE to anon/authenticated on every newly
-- created function (the very first fix this project ever needed —
-- hotfix-001). calculate_price was previously covered by that hotfix's
-- one-time broad revoke, but the drop+recreate above makes it a brand
-- new catalog entry, silently re-exposing it unless revoked again here.
-- redeem_promo_code and reevaluate_order_discount_for_promo have no
-- internal ownership check at all (same as redeem_referral_code) — they
-- must only ever be reachable from within create_order()/
-- approve_promo_request(), never directly via RPC.
revoke execute on function calculate_price(uuid, uuid, uuid, int, numeric, uuid, uuid, uuid[], uuid, text, uuid, numeric) from public, anon, authenticated;
revoke execute on function redeem_promo_code(text, uuid, uuid) from public, anon, authenticated;
revoke execute on function reevaluate_order_discount_for_promo(uuid, numeric) from public, anon, authenticated;

-- These three ARE self-guarded by is_admin(), but revoke anon anyway to
-- match the layered pattern approve_referral/reject_referral already
-- use — only a signed-in caller can even attempt the call.
revoke execute on function approve_referral_with_percentage(uuid, numeric) from anon;
revoke execute on function approve_promo_request(uuid, numeric) from anon;
revoke execute on function reject_promo_request(uuid, text) from anon;

-- Email templates for the two new promo notifications, matching the
-- existing referral_approved/referral_rejected pair.
insert into email_templates (key, subject, body_html, body_text) values
  ('promo_approved', 'Your promo code was approved',
   '<p>Your promo code discount has been approved and applied to order {{order_number}}.</p>', 'Your promo code discount has been approved for order {{order_number}}.'),
  ('promo_rejected', 'Promo code update',
   '<p>Your promo code discount request was not approved. {{reason}}</p>', 'Promo code request not approved. {{reason}}')
on conflict (key) do nothing;

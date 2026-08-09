-- Per-service deadline surcharge.
--
-- Dissertasiya/Buraxılış İşi get two extra long deadlines (90/60 gün) that no
-- other service offers, and every service now has a deadline-driven price
-- surcharge — but the two tables of percentages differ completely between
-- "long-form" services and everything else. Rather than branch on service
-- slug inside calculate_price(), the mapping (which deadlines a service may
-- use, its default, and its surcharge %) lives in a new join table —
-- service_deadline_options — so the pricing function stays generic and the
-- only place service names are special-cased is this one seed insert.

-- ---------------------------------------------------------------------------
-- Price increase: +2 AZN/page on both long-form services.
-- ---------------------------------------------------------------------------
update service_pricing_rules
set price_per_page = price_per_page + 2
where service_id in (
  select id from services where slug in ('dissertation', 'graduation-project')
);

-- ---------------------------------------------------------------------------
-- New deadline options: 90 gün (default for long-form) and 60 gün.
-- ---------------------------------------------------------------------------
insert into deadline_options (label, duration_hours, display_order, translations) values
  ('90 gün', 2160, 5, jsonb_build_object('en', jsonb_build_object('label', '90 days'))),
  ('60 gün', 1440, 8, jsonb_build_object('en', jsonb_build_object('label', '60 days')))
on conflict (label) do nothing;

-- ---------------------------------------------------------------------------
-- service_deadline_options: which deadlines a service offers, its default,
-- and the surcharge percentage applied to that service's subtotal.
-- ---------------------------------------------------------------------------
create table service_deadline_options (
  service_id uuid not null references services(id) on delete cascade,
  deadline_option_id uuid not null references deadline_options(id) on delete cascade,
  surcharge_percent numeric(5,2) not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (service_id, deadline_option_id)
);

alter table service_deadline_options enable row level security;

create policy service_deadline_options_read on service_deadline_options for select using (true);
create policy service_deadline_options_write on service_deadline_options for all using (is_admin()) with check (is_admin());

create trigger set_updated_at before update on service_deadline_options
  for each row execute function set_updated_at();

-- Keys on (service_id, deadline_option_id), not id — same reason
-- service_pricing_rules and site_settings got their own audit trigger.
create or replace function log_service_deadline_options_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    auth.uid(),
    lower(tg_op),
    'service_deadline_options',
    coalesce(new.service_id::text, old.service_id::text) || ':' || coalesce(new.deadline_option_id::text, old.deadline_option_id::text),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_service_deadline_options after insert or update or delete on service_deadline_options
  for each row execute function log_service_deadline_options_change();

-- Long-form services: 90 gün default, 0/10/25/35/45/55% for 90/60/30/14/7/3.
insert into service_deadline_options (service_id, deadline_option_id, surcharge_percent, is_default)
select s.id, d.id, v.pct, v.is_default
from services s
join (values
  ('90 gün', 0::numeric, true),
  ('60 gün', 10::numeric, false),
  ('30 gün', 25::numeric, false),
  ('14 gün', 35::numeric, false),
  ('7 gün', 45::numeric, false),
  ('3 gün', 55::numeric, false)
) as v(label, pct, is_default) on true
join deadline_options d on d.label = v.label
where s.slug in ('dissertation', 'graduation-project')
on conflict (service_id, deadline_option_id) do update
  set surcharge_percent = excluded.surcharge_percent, is_default = excluded.is_default;

-- All other services: 30 gün default, 0/5/10/15% for 30/14/7/3.
insert into service_deadline_options (service_id, deadline_option_id, surcharge_percent, is_default)
select s.id, d.id, v.pct, v.is_default
from services s
join (values
  ('30 gün', 0::numeric, true),
  ('14 gün', 5::numeric, false),
  ('7 gün', 10::numeric, false),
  ('3 gün', 15::numeric, false)
) as v(label, pct, is_default) on true
join deadline_options d on d.label = v.label
where s.slug not in ('dissertation', 'graduation-project')
on conflict (service_id, deadline_option_id) do update
  set surcharge_percent = excluded.surcharge_percent, is_default = excluded.is_default;

-- ---------------------------------------------------------------------------
-- calculate_price(): validate the (service, deadline) pair against
-- service_deadline_options and apply its surcharge_percent to the subtotal
-- (service price + language/citation fees + add-ons, plagiarism included)
-- BEFORE discount candidates are evaluated — so member/early-order/referral/
-- promo discounts are computed on the deadline-inflated amount, matching
-- every other discount already being computed on the full pre-discount
-- subtotal. The plagiarism free-at-500 threshold still checks service_base
-- alone, unaffected by the deadline surcharge (unchanged from before).
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
  deadline_surcharge_percent numeric(5,2);
  deadline_surcharge_amount numeric(10,2);
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
    'deadline_surcharge_percent', deadline_surcharge_percent,
    'deadline_surcharge_amount', deadline_surcharge_amount,
    'subtotal', subtotal,
    'candidates', candidates,
    'final_price', subtotal - coalesce((best->>'amount')::numeric, 0)
  ) || case when best is not null then jsonb_build_object('applied', best) else '{}'::jsonb end;
end;
$$;

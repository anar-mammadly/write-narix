-- Hotfix: replace the entire pricing engine with the new per-service,
-- page-count-only rules. This supersedes `pricing_rules` (left in place,
-- unreferenced) and removes the deadline multiplier from price entirely.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- New services: rename the existing "thesis" service back to "Tezis" (its
-- progressive pricing is distinct from the new per-page "Buraxılış İşi"),
-- and add the two services that didn't exist before: Buraxılış İşi and
-- Parafraz (Paraphrasing).
-- ---------------------------------------------------------------------------

update services set name = 'Tezis', description = 'Tezis yazılmasında dəstək.' where slug = 'thesis';

insert into services (category_id, name, slug, description, display_order)
select c.id, v.name, v.slug, v.description, v.display_order
from (values
  ('writing', 'Buraxılış İşi', 'graduation-project', 'Buraxılış (qradasiya) işinin tam yazılması.', 35),
  ('editing-review', 'Parafraz', 'paraphrasing', 'Mövcud mətnin orijinal, aydın şəkildə yenidən ifadəsi.', 75)
) as v(cat_slug, name, slug, description, display_order)
join service_categories c on c.slug = v.cat_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- service_pricing_rules table (new)
-- ---------------------------------------------------------------------------

create table if not exists service_pricing_rules (
  service_id uuid primary key references services(id) on delete cascade,
  pricing_type text not null check (pricing_type in ('progressive', 'per_page')),
  base_pages int,
  base_mode text check (base_mode in ('flat', 'linear')),
  base_price numeric(10,2),
  additional_page_price numeric(10,2),
  price_per_page numeric(10,2),
  minimum_pages int,
  updated_at timestamptz not null default now(),
  constraint progressive_fields_required check (
    pricing_type <> 'progressive' or
    (base_pages is not null and base_mode is not null and base_price is not null and additional_page_price is not null)
  ),
  constraint per_page_fields_required check (
    pricing_type <> 'per_page' or price_per_page is not null
  )
);

alter table service_pricing_rules enable row level security;

drop policy if exists service_pricing_rules_read on service_pricing_rules;
create policy service_pricing_rules_read on service_pricing_rules for select using (true);

drop policy if exists service_pricing_rules_write on service_pricing_rules;
create policy service_pricing_rules_write on service_pricing_rules for all using (is_admin()) with check (is_admin());

drop trigger if exists set_updated_at on service_pricing_rules;
create trigger set_updated_at before update on service_pricing_rules
  for each row execute function set_updated_at();

-- service_pricing_rules keys on service_id, not id, so (like site_settings)
-- it needs its own audit trigger rather than the generic one.
create or replace function log_service_pricing_rules_change()
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
    'service_pricing_rules',
    coalesce(new.service_id::text, old.service_id::text),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_service_pricing_rules on service_pricing_rules;
create trigger audit_service_pricing_rules after insert or update or delete on service_pricing_rules
  for each row execute function log_service_pricing_rules_change();

-- ---------------------------------------------------------------------------
-- Pricing rule values — the only source of price from here on
-- ---------------------------------------------------------------------------

insert into service_pricing_rules (service_id, pricing_type, base_pages, base_mode, base_price, additional_page_price, price_per_page, minimum_pages)
select s.id, v.pricing_type, v.base_pages, v.base_mode, v.base_price, v.additional_page_price, v.price_per_page, v.minimum_pages
from (values
  ('essay',             'progressive', 5,    'flat',   10::numeric, 1::numeric,  null::numeric, null::int),
  ('presentation',      'progressive', 5,    'flat',   10::numeric, 1::numeric,  null::numeric, null::int),
  ('thesis',            'progressive', 5,    'linear', 10::numeric, 5::numeric,  null::numeric, null::int),
  ('dissertation',      'per_page',    null, null,     null,        null,        10::numeric,   20),
  ('graduation-project','per_page',    null, null,     null,        null,        9::numeric,    10),
  ('translation',       'per_page',    null, null,     null,        null,        5::numeric,    null),
  ('editing',           'per_page',    null, null,     null,        null,        5::numeric,    null),
  ('paraphrasing',      'per_page',    null, null,     null,        null,        5::numeric,    null),
  ('data-analysis',     'per_page',    null, null,     null,        null,        10::numeric,   null),
  ('research-paper',    'per_page',    null, null,     null,        null,        10::numeric,   null),
  ('proofreading',      'per_page',    null, null,     null,        null,        10::numeric,   null)
) as v(slug, pricing_type, base_pages, base_mode, base_price, additional_page_price, price_per_page, minimum_pages)
join services s on s.slug = v.slug
on conflict (service_id) do update set
  pricing_type = excluded.pricing_type,
  base_pages = excluded.base_pages,
  base_mode = excluded.base_mode,
  base_price = excluded.base_price,
  additional_page_price = excluded.additional_page_price,
  price_per_page = excluded.price_per_page,
  minimum_pages = excluded.minimum_pages;

-- ---------------------------------------------------------------------------
-- calculate_price() — base price now comes from service_pricing_rules only.
-- Deadline no longer multiplies the price. Academic level is still recorded
-- on the order but no longer read for pricing.
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
    base := pages * rule.price_per_page;
  else
    if pages <= rule.base_pages then
      base := case when rule.base_mode = 'flat' then rule.base_price else pages * rule.base_price end;
    else
      base := (case when rule.base_mode = 'flat' then rule.base_price else rule.base_pages * rule.base_price end)
              + (pages - rule.base_pages) * rule.additional_page_price;
    end if;
  end if;

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

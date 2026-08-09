-- Narix Academy — functions and triggers

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'profiles','service_categories','services','academic_levels','deadline_options',
    'word_count_options','languages','citation_styles','additional_services','pricing_rules',
    'order_statuses','orders','order_requests','discounts','pages','faqs','samples','testimonials',
    'referral_benefits'
  ])
  loop
    execute format('create trigger set_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Role / ownership helpers used throughout RLS policies
-- ---------------------------------------------------------------------------

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function owns_order(target_order_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from orders where id = target_order_id and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile row + personal referral code
-- ---------------------------------------------------------------------------

create or replace function generate_referral_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := 'NARIX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    if not exists (select 1 from referral_codes where code = candidate) then
      return candidate;
    end if;
  end loop;
end;
$$;

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  insert into profiles (id, full_name, email_verified, role, referral_code)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email_confirmed_at is not null,
    'user',
    null
  );

  new_code := generate_referral_code();

  insert into referral_codes (code, owner_user_id, max_total_uses)
  values (new_code, new.id, 3);

  update profiles set referral_code = new_code where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

create or replace function handle_auth_user_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update profiles set email_verified = true where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_verified
  after update on auth.users
  for each row execute function handle_auth_user_email_verified();

-- ---------------------------------------------------------------------------
-- Order numbering — sequence-backed, race-safe under concurrent submissions
-- ---------------------------------------------------------------------------

create or replace function next_order_number()
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('order_number_seq');
  return 'NA-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment ledger: orders.paid_amount is always derived from the payments
-- ledger, never written directly by the app, so it cannot drift or be
-- double-counted under concurrent inserts.
-- ---------------------------------------------------------------------------

create or replace function recompute_order_paid_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order uuid;
  total numeric(10,2);
begin
  target_order := coalesce(new.order_id, old.order_id);
  select coalesce(sum(amount), 0) into total from payments where order_id = target_order;
  update orders set paid_amount = total, updated_at = now() where id = target_order;
  return null;
end;
$$;

create trigger payments_recompute_paid_amount
  after insert or update or delete on payments
  for each row execute function recompute_order_paid_amount();

-- ---------------------------------------------------------------------------
-- Atomic, race-safe usage counters for promo codes and referral codes.
-- Each returns true only if the increment actually happened (i.e. the code
-- was still under its limit at the moment of the update) — callers must
-- treat a false return as "code exhausted", not retry.
-- ---------------------------------------------------------------------------

create or replace function try_consume_promo_code(p_code_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated boolean;
begin
  update promo_codes
     set current_uses = current_uses + 1
   where id = p_code_id
     and active = true
     and current_uses < max_total_uses
     and (expires_at is null or expires_at > now())
  returning true into updated;

  return coalesce(updated, false);
end;
$$;

create or replace function try_consume_referral_code(p_code_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated boolean;
begin
  update referral_codes
     set current_uses = current_uses + 1
   where id = p_code_id
     and active = true
     and current_uses < max_total_uses
     and (expires_at is null or expires_at > now())
  returning true into updated;

  return coalesce(updated, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Generic config-table audit trigger (Admin Pricing Audit requirement)
-- ---------------------------------------------------------------------------

create or replace function log_config_change()
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
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'services','service_categories','academic_levels','deadline_options','word_count_options',
    'languages','citation_styles','additional_services','pricing_rules','order_statuses',
    'discounts','promo_codes','referral_codes','email_templates'
  ])
  loop
    execute format(
      'create trigger audit_%I after insert or update or delete on %I for each row execute function log_config_change()',
      t, t
    );
  end loop;
end $$;

-- site_settings keys on `key`, not `id`, so it gets its own audit trigger
create or replace function log_site_settings_change()
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
    'site_settings',
    coalesce(new.key, old.key),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_site_settings
  after insert or update or delete on site_settings
  for each row execute function log_site_settings_change();

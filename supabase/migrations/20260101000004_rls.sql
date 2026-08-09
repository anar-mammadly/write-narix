-- Narix Academy — Row Level Security
--
-- Design note: tables that require multi-step, transactionally-consistent
-- writes (orders, referral redemption, discount evaluation, payments ledger)
-- are NOT written to directly by client roles. Those writes go through
-- SECURITY DEFINER Postgres functions (see 20260101000005_mutations.sql),
-- which run as the function owner (postgres) and therefore bypass RLS by
-- design — RLS below still fully governs all direct SELECT access and
-- blocks any other write path.

alter table profiles enable row level security;
alter table site_settings enable row level security;
alter table service_categories enable row level security;
alter table services enable row level security;
alter table academic_levels enable row level security;
alter table deadline_options enable row level security;
alter table word_count_options enable row level security;
alter table languages enable row level security;
alter table citation_styles enable row level security;
alter table additional_services enable row level security;
alter table pricing_rules enable row level security;
alter table order_statuses enable row level security;
alter table orders enable row level security;
alter table order_pricing_snapshots enable row level security;
alter table order_additional_services enable row level security;
alter table order_status_history enable row level security;
alter table order_requests enable row level security;
alter table files enable row level security;
alter table messages enable row level security;
alter table payment_requests enable row level security;
alter table payments enable row level security;
alter table notifications enable row level security;
alter table email_templates enable row level security;
alter table notification_jobs enable row level security;
alter table discounts enable row level security;
alter table promo_codes enable row level security;
alter table referral_codes enable row level security;
alter table referrals enable row level security;
alter table referral_benefits enable row level security;
alter table discount_applications enable row level security;
alter table faqs enable row level security;
alter table samples enable row level security;
alter table testimonials enable row level security;
alter table pages enable row level security;
alter table audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_own_or_admin on profiles
  for select using (id = auth.uid() or is_admin());

create policy profiles_update_own_or_admin on profiles
  for update using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- Role escalation guard: a non-admin may update their own profile row, but
-- never their own role. Enforced with a trigger rather than an RLS subquery
-- because "compare new.role to the pre-update value" is not expressible in
-- a `with check` clause without re-reading the row being written.
create or replace function prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null when the write comes from the service role (direct
  -- SQL, an admin script, bootstrapping the first admin) rather than
  -- through PostgREST as a specific end user — that context is already
  -- privileged by having the service key at all, so only block the change
  -- when it's an authenticated-but-non-admin end user editing their own row.
  if new.role <> old.role and auth.uid() is not null and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on profiles
  for each row execute function prevent_self_role_escalation();

-- ---------------------------------------------------------------------------
-- Public-read / admin-write calculator configuration
-- ---------------------------------------------------------------------------

create policy service_categories_read on service_categories for select using (is_active or is_admin());
create policy service_categories_write on service_categories for all using (is_admin()) with check (is_admin());

create policy services_read on services for select using (is_active or is_admin());
create policy services_write on services for all using (is_admin()) with check (is_admin());

create policy academic_levels_read on academic_levels for select using (is_active or is_admin());
create policy academic_levels_write on academic_levels for all using (is_admin()) with check (is_admin());

create policy deadline_options_read on deadline_options for select using (is_active or is_admin());
create policy deadline_options_write on deadline_options for all using (is_admin()) with check (is_admin());

create policy word_count_options_read on word_count_options for select using (is_active or is_admin());
create policy word_count_options_write on word_count_options for all using (is_admin()) with check (is_admin());

create policy languages_read on languages for select using (is_active or is_admin());
create policy languages_write on languages for all using (is_admin()) with check (is_admin());

create policy citation_styles_read on citation_styles for select using (is_active or is_admin());
create policy citation_styles_write on citation_styles for all using (is_admin()) with check (is_admin());

create policy additional_services_read on additional_services for select using (is_active or is_admin());
create policy additional_services_write on additional_services for all using (is_admin()) with check (is_admin());

create policy pricing_rules_read on pricing_rules for select using (is_active or is_admin());
create policy pricing_rules_write on pricing_rules for all using (is_admin()) with check (is_admin());

create policy order_statuses_read on order_statuses for select using (is_active or is_admin());
create policy order_statuses_write on order_statuses for all using (is_admin()) with check (is_admin());

create policy faqs_read on faqs for select using (is_active or is_admin());
create policy faqs_write on faqs for all using (is_admin()) with check (is_admin());

create policy samples_read on samples for select using (is_active or is_admin());
create policy samples_write on samples for all using (is_admin()) with check (is_admin());

create policy testimonials_read on testimonials for select using (is_active or is_admin());
create policy testimonials_write on testimonials for all using (is_admin()) with check (is_admin());

create policy pages_read on pages for select using (is_active or is_admin());
create policy pages_write on pages for all using (is_admin()) with check (is_admin());

create policy site_settings_read on site_settings for select using (true);
create policy site_settings_write on site_settings for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Orders and everything scoped to an order
-- ---------------------------------------------------------------------------

create policy orders_select_own_or_admin on orders
  for select using (user_id = auth.uid() or is_admin());

-- Direct writes are for admin operational edits (status/assignment/notes)
-- only. Order creation, guest claim, and pricing are handled exclusively by
-- SECURITY DEFINER functions, which bypass this policy by running as owner.
create policy orders_admin_write on orders
  for update using (is_admin()) with check (is_admin());

create policy order_pricing_snapshots_select on order_pricing_snapshots
  for select using (owns_order(order_id) or is_admin());

create policy order_additional_services_select on order_additional_services
  for select using (owns_order(order_id) or is_admin());

create policy order_status_history_select on order_status_history
  for select using (owns_order(order_id) or is_admin());

create policy order_status_history_admin_insert on order_status_history
  for insert with check (is_admin());

create policy order_requests_select on order_requests
  for select using (owns_order(order_id) or is_admin());

create policy order_requests_admin_write on order_requests
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Files
-- ---------------------------------------------------------------------------

create policy files_select on files
  for select using (owns_order(order_id) or is_admin());

create policy files_insert on files
  for insert with check (owns_order(order_id) or is_admin());

create policy files_delete_admin on files
  for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

create policy messages_select on messages
  for select using (owns_order(order_id) or is_admin());

create policy messages_insert on messages
  for insert with check (
    (owns_order(order_id) and sender_id = auth.uid() and sender_is_admin = false)
    or (is_admin() and sender_is_admin = true)
  );

create policy messages_update_read_receipt on messages
  for update using (owns_order(order_id) or is_admin())
  with check (owns_order(order_id) or is_admin());

-- ---------------------------------------------------------------------------
-- Payments (admin-recorded ledger; users can only view their own)
-- ---------------------------------------------------------------------------

create policy payments_select on payments
  for select using (owns_order(order_id) or is_admin());

create policy payments_admin_write on payments
  for all using (is_admin()) with check (is_admin());

create policy payment_requests_select on payment_requests
  for select using (owns_order(order_id) or is_admin());

create policy payment_requests_admin_write on payment_requests
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Notifications (in-app)
-- ---------------------------------------------------------------------------

create policy notifications_select on notifications
  for select using (user_id = auth.uid() or is_admin());

create policy notifications_update_own on notifications
  for update using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

create policy notifications_admin_insert on notifications
  for insert with check (is_admin());

-- notification_jobs and email_templates are internal system tables
create policy notification_jobs_admin_only on notification_jobs
  for all using (is_admin()) with check (is_admin());

create policy email_templates_admin_only on email_templates
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Discounts, promo codes, referrals
-- ---------------------------------------------------------------------------

create policy discounts_read on discounts for select using (active or is_admin());
create policy discounts_write on discounts for all using (is_admin()) with check (is_admin());

-- promo codes are validated server-side via validate_promo_code(); never listed to clients
create policy promo_codes_admin_only on promo_codes
  for all using (is_admin()) with check (is_admin());

create policy referral_codes_select_own_or_admin on referral_codes
  for select using (owner_user_id = auth.uid() or is_admin());

create policy referral_codes_admin_write on referral_codes
  for all using (is_admin()) with check (is_admin());

create policy referrals_select on referrals
  for select using (referrer_user_id = auth.uid() or referred_user_id = auth.uid() or is_admin());

create policy referrals_admin_write on referrals
  for update using (is_admin()) with check (is_admin());

create policy referral_benefits_select on referral_benefits
  for select using (beneficiary_user_id = auth.uid() or is_admin());

create policy referral_benefits_admin_write on referral_benefits
  for all using (is_admin()) with check (is_admin());

-- discount_applications is a write-once evaluation log, written only by the
-- create_order()/approve_referral() functions (as owner), read by the order
-- owner and admin.
create policy discount_applications_select on discount_applications
  for select using (owns_order(order_id) or is_admin());

-- ---------------------------------------------------------------------------
-- Audit log — admin-readable, append-only (no update/delete policy at all)
-- ---------------------------------------------------------------------------

create policy audit_logs_select_admin on audit_logs
  for select using (is_admin());

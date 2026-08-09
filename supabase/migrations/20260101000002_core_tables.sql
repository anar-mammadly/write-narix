-- Narix Academy — core schema
-- Convention: every admin-configurable lookup table carries display_order + is_active.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  university text,
  academic_level text,
  country text,
  language text default 'en',
  timezone text,
  role user_role not null default 'user',
  email_verified boolean not null default false,
  referral_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

-- ---------------------------------------------------------------------------
-- Calculator configuration (admin-managed, never hardcoded in the app)
-- ---------------------------------------------------------------------------

create table service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references service_categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table academic_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table deadline_options (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  duration_hours int not null,
  multiplier numeric(6,3) not null default 1,
  fixed_fee numeric(10,2) not null default 0,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table word_count_options (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  word_count int not null,
  page_count numeric(6,2) not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table languages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  extra_fee numeric(10,2) not null default 0,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table citation_styles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  extra_fee numeric(10,2) not null default 0,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table additional_services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  price_type price_type not null default 'fixed',
  price_value numeric(10,2) not null default 0,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  academic_level_id uuid not null references academic_levels(id) on delete cascade,
  base_price numeric(10,2) not null default 0,
  price_per_page numeric(10,2) not null default 0,
  price_per_word numeric(10,4) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, academic_level_id)
);

-- ---------------------------------------------------------------------------
-- Order statuses (admin-managed workflow)
-- ---------------------------------------------------------------------------

create table order_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  color text not null default '#2A5CAA',
  icon text,
  display_order int not null default 0,
  is_active boolean not null default true,
  is_terminal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create sequence order_number_seq;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references profiles(id) on delete set null,

  -- guest checkout
  guest_name text,
  guest_email text,
  guest_phone text,
  guest_token_hash text unique,
  claimed_at timestamptz,

  -- calculator selections
  service_id uuid not null references services(id),
  academic_level_id uuid not null references academic_levels(id),
  deadline_option_id uuid not null references deadline_options(id),
  word_count_option_id uuid references word_count_options(id),
  word_count int,
  page_count numeric(6,2),
  language_id uuid references languages(id),
  citation_style_id uuid references citation_styles(id),

  subject text,
  topic text,
  description text,

  -- pricing (authoritative, server-computed)
  base_price numeric(10,2) not null,
  discount_source discount_type,
  discount_percentage numeric(5,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  final_price numeric(10,2) not null,
  paid_amount numeric(10,2) not null default 0,
  remaining_amount numeric(10,2) generated always as (final_price - paid_amount) stored,
  is_fully_paid boolean generated always as (paid_amount >= final_price) stored,

  status_id uuid not null references order_statuses(id),
  assigned_to uuid references profiles(id),
  locked boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint guest_or_user check (user_id is not null or guest_token_hash is not null)
);

create index orders_user_id_idx on orders(user_id);
create index orders_status_id_idx on orders(status_id);
create index orders_guest_token_hash_idx on orders(guest_token_hash);

create table order_pricing_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  snapshot jsonb not null,
  config_version text not null,
  created_at timestamptz not null default now()
);

create table order_additional_services (
  order_id uuid not null references orders(id) on delete cascade,
  additional_service_id uuid not null references additional_services(id),
  name_at_order text not null,
  price_at_order numeric(10,2) not null,
  primary key (order_id, additional_service_id)
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  from_status_id uuid references order_statuses(id),
  to_status_id uuid not null references order_statuses(id),
  changed_by uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create index order_status_history_order_id_idx on order_status_history(order_id);

create table order_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  title text not null,
  description text,
  requires_file boolean not null default false,
  due_date timestamptz,
  status request_status not null default 'pending',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_requests_order_id_idx on order_requests(order_id);

-- ---------------------------------------------------------------------------
-- Files
-- ---------------------------------------------------------------------------

create table files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  uploaded_by uuid references profiles(id),
  category file_category not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  order_request_id uuid references order_requests(id),
  created_at timestamptz not null default now()
);

create index files_order_id_idx on files(order_id);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

create table messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sender_id uuid references profiles(id),
  sender_is_admin boolean not null default false,
  body text,
  attachment_file_id uuid references files(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_order_id_idx on messages(order_id);

-- ---------------------------------------------------------------------------
-- Payments (append-only ledger)
-- ---------------------------------------------------------------------------

create table payment_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  amount numeric(10,2) not null,
  description text,
  due_date timestamptz,
  status payment_request_status not null default 'pending',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_requests_order_id_idx on payment_requests(order_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  payment_request_id uuid references payment_requests(id),
  amount numeric(10,2) not null,
  method text,
  note text,
  recorded_by uuid not null references profiles(id),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index payments_order_id_idx on payments(order_id);

-- ---------------------------------------------------------------------------
-- Notifications + email outbox
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  related_order_id uuid references orders(id),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on notifications(user_id, is_read);

create table email_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  subject text not null,
  body_html text not null,
  body_text text,
  updated_at timestamptz not null default now()
);

create table notification_jobs (
  id uuid primary key default gen_random_uuid(),
  channel notification_channel not null default 'email',
  event_type text not null,
  idempotency_key text not null unique,
  recipient_email text,
  recipient_user_id uuid references profiles(id),
  template_key text,
  payload jsonb not null default '{}'::jsonb,
  status job_status not null default 'pending',
  attempts int not null default 0,
  max_attempts int not null default 5,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index notification_jobs_status_idx on notification_jobs(status, next_attempt_at);

-- ---------------------------------------------------------------------------
-- Discounts, promo codes, referrals
-- ---------------------------------------------------------------------------

create table discounts (
  id uuid primary key default gen_random_uuid(),
  type discount_type not null,
  name text not null,
  percentage numeric(5,2),
  fixed_amount numeric(10,2),
  active boolean not null default true,
  start_date timestamptz,
  end_date timestamptz,
  usage_limit int,
  minimum_order numeric(10,2),
  maximum_discount numeric(10,2),
  conditions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_id uuid not null references discounts(id) on delete cascade,
  max_total_uses int not null default 1,
  current_uses int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint promo_usage_within_limit check (current_uses <= max_total_uses)
);

create table referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_user_id uuid references profiles(id) on delete cascade, -- null = admin campaign code
  max_total_uses int not null default 3,
  current_uses int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint referral_usage_within_limit check (current_uses <= max_total_uses)
);

create index referral_codes_owner_idx on referral_codes(owner_user_id);

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references referral_codes(id),
  referrer_user_id uuid not null references profiles(id),
  referred_user_id uuid not null references profiles(id),
  order_id uuid not null references orders(id),
  status referral_status not null default 'pending_approval',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  unique (referral_code_id, referred_user_id),
  constraint referrer_not_referred check (referrer_user_id <> referred_user_id)
);

create table referral_benefits (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references referrals(id) on delete cascade,
  beneficiary_user_id uuid not null references profiles(id),
  benefit_type referral_benefit_type not null,
  percentage numeric(5,2) not null,
  status referral_benefit_status not null default 'pending_approval',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  consumed_order_id uuid references orders(id),
  consumed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index referral_benefits_beneficiary_idx on referral_benefits(beneficiary_user_id, status);

create table discount_applications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  discount_source discount_type not null,
  reference_id uuid, -- promo_codes.id or referral_benefits.id, informational
  percentage_considered numeric(5,2) not null,
  amount_considered numeric(10,2) not null,
  applied boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);

create index discount_applications_order_id_idx on discount_applications(order_id);

-- ---------------------------------------------------------------------------
-- Content management
-- ---------------------------------------------------------------------------

create table faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table samples (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  service_id uuid references services(id),
  academic_level_id uuid references academic_levels(id),
  excerpt text,
  file_id uuid references files(id),
  display_order int not null default 0,
  is_active boolean not null default true,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_context text,
  quote text not null,
  rating int check (rating between 1 and 5),
  display_order int not null default 0,
  is_active boolean not null default true,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  translations jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs(entity_type, entity_id);

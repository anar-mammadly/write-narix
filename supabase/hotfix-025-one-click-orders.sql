-- ---------------------------------------------------------------------------
-- hotfix-025: "one-click order" — a lightweight lead-capture flow separate
-- from the full `orders` table/checkout. A homepage button opens a modal
-- asking only for topic + service (+ phone/email for guests; logged-in
-- users' contact info is pulled server-side from their profile/auth
-- account). Submissions land in their own `one_click_orders` table with an
-- admin-managed `status`, reviewed from a new /admin/one-click-orders page
-- — entirely independent of the existing order pipeline.
-- ---------------------------------------------------------------------------

create table if not exists one_click_orders (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id),
  user_id uuid references profiles(id),
  topic text not null,
  phone text,
  email text,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists one_click_orders_created_at_idx on one_click_orders(created_at desc);

alter table one_click_orders enable row level security;

create policy one_click_orders_admin_select on one_click_orders for select using (is_admin());
create policy one_click_orders_admin_update on one_click_orders for update using (is_admin()) with check (is_admin());

create or replace function create_one_click_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_service_id uuid := (p_payload->>'service_id')::uuid;
  v_topic text := trim(both from (p_payload->>'topic'));
  v_phone text := nullif(trim(both from coalesce(p_payload->>'phone', '')), '');
  v_email text := nullif(trim(both from coalesce(p_payload->>'email', '')), '');
  v_id uuid;
begin
  if v_service_id is null or not exists (select 1 from services where id = v_service_id and is_active) then
    raise exception 'INVALID_SERVICE' using errcode = 'P0001';
  end if;

  if v_topic is null or v_topic = '' then
    raise exception 'TOPIC_REQUIRED' using errcode = 'P0001';
  end if;

  if v_user_id is not null then
    v_phone := coalesce((select phone from profiles where id = v_user_id), v_phone);
    v_email := coalesce(profile_email(v_user_id), v_email);
  else
    if v_phone is null then
      raise exception 'PHONE_REQUIRED' using errcode = 'P0001';
    end if;
    if v_email is null then
      raise exception 'EMAIL_REQUIRED' using errcode = 'P0001';
    end if;
  end if;

  insert into one_click_orders (service_id, user_id, topic, phone, email)
  values (v_service_id, v_user_id, v_topic, v_phone, v_email)
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

grant execute on function create_one_click_order(jsonb) to anon, authenticated;

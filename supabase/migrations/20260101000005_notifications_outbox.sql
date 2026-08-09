-- Narix Academy — notification + email outbox plumbing
--
-- In-app notifications are a plain insert into `notifications` — same
-- transaction as the mutation, no external call, nothing to retry.
-- Email is the unreliable, external part, so only email goes through the
-- `notification_jobs` outbox: insert the job in the same transaction as the
-- mutation, commit, and let a background worker (Edge Function on a cron
-- schedule) deliver it via Resend with retries. A failed send therefore can
-- never roll back or invalidate the order/status/payment/referral write
-- that queued it — the two are decoupled by design.

create or replace function enqueue_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_order_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, title, body, related_order_id)
  values (p_user_id, p_type, p_title, p_body, p_order_id);
end;
$$;

create or replace function enqueue_email_job(
  p_event_type text,
  p_idempotency_key text,
  p_template_key text,
  p_recipient_user_id uuid,
  p_recipient_email text,
  p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notification_jobs (
    channel, event_type, idempotency_key, template_key,
    recipient_user_id, recipient_email, payload
  )
  values (
    'email', p_event_type, p_idempotency_key, p_template_key,
    p_recipient_user_id, p_recipient_email, p_payload
  )
  on conflict (idempotency_key) do nothing; -- idempotent: same logical event never double-queues
end;
$$;

-- Resolves a profile's email via auth.users (profiles has no email column by
-- design — auth is the source of truth for it).
create or replace function profile_email(p_user_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select email from auth.users where id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- Order status changes -> notify + email the order owner
-- ---------------------------------------------------------------------------

create or replace function notify_order_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
  s order_statuses;
begin
  if new.from_status_id is null then
    return new; -- initial "order created" row; create_order() already sends its own notification
  end if;

  select * into o from orders where id = new.order_id;
  select * into s from order_statuses where id = new.to_status_id;

  if o.user_id is not null then
    perform enqueue_notification(
      o.user_id, 'order_status_changed',
      'Order ' || o.order_number || ' updated',
      'Your order status is now "' || s.name || '".',
      o.id
    );
    perform enqueue_email_job(
      'order_status_changed', 'order_status_changed:' || new.id::text,
      'order_status_changed', o.user_id, profile_email(o.user_id),
      jsonb_build_object('order_number', o.order_number, 'status', s.name)
    );
  elsif o.guest_email is not null then
    perform enqueue_email_job(
      'order_status_changed', 'order_status_changed:' || new.id::text,
      'order_status_changed', null, o.guest_email,
      jsonb_build_object('order_number', o.order_number, 'status', s.name)
    );
  end if;
  return new;
end;
$$;

create trigger order_status_history_notify
  after insert on order_status_history
  for each row execute function notify_order_status_changed();

-- ---------------------------------------------------------------------------
-- Payment recorded -> notify + email
-- ---------------------------------------------------------------------------

create or replace function notify_payment_recorded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
begin
  select * into o from orders where id = new.order_id;

  if o.user_id is not null then
    perform enqueue_notification(
      o.user_id, 'payment_received',
      'Payment received for ' || o.order_number,
      new.amount::text || ' AZN recorded.',
      o.id
    );
  end if;

  perform enqueue_email_job(
    'payment_received', 'payment_received:' || new.id::text,
    'payment_received',
    o.user_id, coalesce(profile_email(o.user_id), o.guest_email),
    jsonb_build_object('order_number', o.order_number, 'amount', new.amount)
  );
  return new;
end;
$$;

create trigger payments_notify
  after insert on payments
  for each row execute function notify_payment_recorded();

-- ---------------------------------------------------------------------------
-- Payment requested -> notify + email
-- ---------------------------------------------------------------------------

create or replace function notify_payment_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
begin
  select * into o from orders where id = new.order_id;

  if o.user_id is not null then
    perform enqueue_notification(
      o.user_id, 'payment_requested',
      'Payment requested for ' || o.order_number,
      coalesce(new.description, new.amount::text || ' AZN due'),
      o.id
    );
  end if;

  perform enqueue_email_job(
    'payment_requested', 'payment_requested:' || new.id::text,
    'payment_requested',
    o.user_id, coalesce(profile_email(o.user_id), o.guest_email),
    jsonb_build_object('order_number', o.order_number, 'amount', new.amount, 'description', new.description)
  );
  return new;
end;
$$;

create trigger payment_requests_notify
  after insert on payment_requests
  for each row execute function notify_payment_requested();

-- ---------------------------------------------------------------------------
-- Admin requests additional info from the client -> notify + email
-- ---------------------------------------------------------------------------

create or replace function notify_order_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
begin
  select * into o from orders where id = new.order_id;

  if o.user_id is not null then
    perform enqueue_notification(
      o.user_id, 'document_requested',
      new.title,
      new.description,
      o.id
    );
  end if;

  perform enqueue_email_job(
    'document_requested', 'document_requested:' || new.id::text,
    'document_requested',
    o.user_id, coalesce(profile_email(o.user_id), o.guest_email),
    jsonb_build_object('order_number', o.order_number, 'title', new.title, 'description', new.description)
  );
  return new;
end;
$$;

create trigger order_requests_notify
  after insert on order_requests
  for each row execute function notify_order_request_created();

-- ---------------------------------------------------------------------------
-- New message -> notify the other party (admin messages notify the client;
-- client messages are surfaced to admins via the unread count in the admin
-- dashboard directly, no per-admin fan-out).
-- ---------------------------------------------------------------------------

create or replace function notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
begin
  if new.sender_is_admin then
    select * into o from orders where id = new.order_id;
    if o.user_id is not null then
      perform enqueue_notification(
        o.user_id, 'new_message', 'New message on ' || o.order_number,
        left(coalesce(new.body, 'New attachment'), 140), o.id
      );
      perform enqueue_email_job(
        'new_message', 'new_message:' || new.id::text, 'new_message',
        o.user_id, profile_email(o.user_id),
        jsonb_build_object('order_number', o.order_number)
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_notify
  after insert on messages
  for each row execute function notify_new_message();

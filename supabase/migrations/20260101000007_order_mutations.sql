-- Narix Academy — order creation, guest claim, referral approval, status changes
--
-- All of these are SECURITY DEFINER functions: they are the only path by
-- which orders, referrals, and their financial fields are ever written.
-- Direct table INSERT is blocked by RLS for non-admin roles (see 000004),
-- so client code (server actions) must call these RPCs rather than
-- constructing inserts itself. This is what makes "the server always
-- recalculates, the client never writes a price" an enforced invariant
-- rather than a convention.

-- Redeems a referral code for one user against one order. Returns a short
-- status string ('pending_approval', 'not_found', 'self_referral_blocked',
-- 'already_used_by_user', 'exhausted') and NEVER raises — a lost race on a
-- concurrent duplicate redemption (unique_violation on
-- (referral_code_id, referred_user_id)) degrades to 'already_used_by_user'
-- rather than aborting the order that called it.
create or replace function redeem_referral_code(p_code text, p_user_id uuid, p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref_code_row referral_codes;
  v_referral_id uuid;
  v_default_pct numeric(5,2);
begin
  select * into v_ref_code_row from referral_codes where code = upper(trim(p_code));
  if v_ref_code_row is null then
    return 'not_found';
  end if;
  if v_ref_code_row.owner_user_id = p_user_id then
    return 'self_referral_blocked';
  end if;
  if exists (select 1 from referrals where referral_code_id = v_ref_code_row.id and referred_user_id = p_user_id) then
    return 'already_used_by_user';
  end if;
  if not try_consume_referral_code(v_ref_code_row.id) then
    return 'exhausted';
  end if;

  select coalesce((select percentage from discounts where type = 'referral' and active = true order by created_at desc limit 1), 10)
    into v_default_pct;

  begin
    insert into referrals (referral_code_id, referrer_user_id, referred_user_id, order_id)
    values (v_ref_code_row.id, v_ref_code_row.owner_user_id, p_user_id, p_order_id)
    returning id into v_referral_id;
  exception when unique_violation then
    return 'already_used_by_user';
  end;

  insert into referral_benefits (referral_id, beneficiary_user_id, benefit_type, percentage)
  values
    (v_referral_id, v_ref_code_row.owner_user_id, 'referrer_reward', v_default_pct),
    (v_referral_id, p_user_id, 'referred_discount', v_default_pct);

  perform enqueue_notification(
    p_user_id, 'referral_pending', 'Referral code applied',
    'Your referral discount is pending admin approval.', p_order_id
  );

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
  -- Never trust a client-supplied user_id: a signed-in caller can only ever
  -- place an order as themselves, and an anonymous caller can only ever
  -- place a guest order. This is what makes it impossible for a client to
  -- create an order under someone else's account or borrow their member
  -- discount by passing an arbitrary user_id in the payload.
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

  -- A registered user may already be holding an approved, unconsumed
  -- referral benefit (typically the referrer's reward) — surface it as a
  -- candidate automatically so it can be picked if it's the best discount.
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

  -- Atomically consume whatever won, inside this same transaction. If the
  -- consumption fails (lost a race for the last use), abort the whole order
  -- rather than silently charging a price that assumed a discount which no
  -- longer applies.
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
    subject, topic, description,
    base_price, discount_source, discount_percentage, discount_amount, final_price,
    status_id
  ) values (
    v_order_number, v_user_id, v_guest_name, v_guest_email, v_guest_phone, v_token_hash,
    v_service_id, v_academic_level_id, v_deadline_option_id, v_word_count_option_id,
    v_word_count, v_page_count, v_language_id, v_citation_style_id,
    v_subject, v_topic, v_description,
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
    values (v_order_id, (v_addon->>'id')::uuid, v_addon->>'name',
      case when v_addon->>'price_type' = 'fixed' then (v_addon->>'price_value')::numeric
           else round((v_pricing->>'base_price')::numeric * (v_addon->>'price_value')::numeric / 100, 2) end);
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

  -- Referral code entered at checkout: creates a pending-approval referral,
  -- never affects this order's price directly.
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

-- ---------------------------------------------------------------------------
-- Guest tracking (by token) and guest -> account claim
-- ---------------------------------------------------------------------------

create or replace function get_order_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := encode(digest(p_token, 'sha256'), 'hex');
  o orders;
  result jsonb;
begin
  select * into o from orders where guest_token_hash = v_hash;
  if o is null then
    return null;
  end if;

  select jsonb_build_object(
    'order_number', o.order_number,
    'status', (select jsonb_build_object('name', name, 'color', color, 'slug', slug) from order_statuses where id = o.status_id),
    'final_price', o.final_price,
    'paid_amount', o.paid_amount,
    'remaining_amount', o.remaining_amount,
    'is_fully_paid', o.is_fully_paid,
    'created_at', o.created_at,
    'claimed', o.user_id is not null,
    'timeline', (
      select coalesce(jsonb_agg(jsonb_build_object('status', s.name, 'color', s.color, 'note', h.note, 'created_at', h.created_at) order by h.created_at)
      , '[]'::jsonb)
      from order_status_history h join order_statuses s on s.id = h.to_status_id
      where h.order_id = o.id
    )
  ) into result;

  return result;
end;
$$;

-- Guest -> account claim. Requires: the requester is signed in AND verified,
-- AND holds the guest tracking token. Email match alone is never sufficient.
create or replace function claim_guest_order(p_order_number text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := encode(digest(p_token, 'sha256'), 'hex');
  o orders;
  requester profiles;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select * into requester from profiles where id = auth.uid();
  if requester is null or requester.email_verified = false then
    raise exception 'EMAIL_NOT_VERIFIED' using errcode = 'P0001';
  end if;

  select * into o from orders where order_number = p_order_number and guest_token_hash = v_hash;
  if o is null then
    raise exception 'INVALID_ORDER_OR_TOKEN' using errcode = 'P0001';
  end if;
  if o.user_id is not null then
    raise exception 'ALREADY_CLAIMED' using errcode = 'P0001';
  end if;

  update orders set user_id = auth.uid(), claimed_at = now() where id = o.id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), 'claim', 'orders', o.id::text, jsonb_build_object('user_id', null), jsonb_build_object('user_id', auth.uid()));

  return jsonb_build_object('order_id', o.id, 'order_number', o.order_number);
end;
$$;

-- ---------------------------------------------------------------------------
-- Referral approval / rejection
-- ---------------------------------------------------------------------------

create or replace function reevaluate_order_discount(p_order_id uuid)
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
    return; -- order already closed out; the benefit stays available for a future order
  end if;

  select id into v_best_benefit_id from referral_benefits
   where beneficiary_user_id = o.user_id and status = 'approved' and consumed_at is null
     and (expires_at is null or expires_at > now())
   order by created_at asc limit 1;

  v_pricing := calculate_price(
    o.service_id, o.academic_level_id, o.deadline_option_id, o.word_count, o.page_count,
    o.language_id, o.citation_style_id,
    (select array_agg(additional_service_id) from order_additional_services where order_id = o.id),
    o.user_id, null, v_best_benefit_id
  );
  v_applied := v_pricing->'applied';

  if v_applied is not null and v_applied->>'source' = 'referral'
     and coalesce((v_applied->>'amount')::numeric, 0) > o.discount_amount then
    update referral_benefits set status = 'consumed', consumed_order_id = o.id, consumed_at = now()
     where id = v_best_benefit_id;

    update orders set
      discount_source = 'referral',
      discount_percentage = (v_applied->>'percentage')::numeric,
      discount_amount = (v_applied->>'amount')::numeric,
      final_price = (v_pricing->>'final_price')::numeric
    where id = o.id;

    for v_cand in select * from jsonb_array_elements(coalesce(v_pricing->'candidates', '[]'::jsonb)) loop
      insert into discount_applications (order_id, discount_source, reference_id, percentage_considered, amount_considered, applied, reason)
      values (o.id, (v_cand->>'source')::discount_type, (v_cand->>'reference_id')::uuid,
        (v_cand->>'percentage')::numeric, (v_cand->>'amount')::numeric,
        v_cand = v_applied, 'referral approval re-evaluation');
    end loop;
  end if;
end;
$$;

create or replace function approve_referral(p_referral_id uuid)
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

  select * into r from referrals where id = p_referral_id and status = 'pending_approval';
  if r is null then
    raise exception 'REFERRAL_NOT_PENDING' using errcode = 'P0001';
  end if;

  select coalesce((value->>'validity_days')::int, 90) into validity_days
  from site_settings where key = 'referral_program';

  update referrals set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_referral_id;

  update referral_benefits
     set status = 'approved', approved_by = auth.uid(), approved_at = now(),
         expires_at = now() + (coalesce(validity_days, 90) || ' days')::interval
   where referral_id = p_referral_id;

  perform reevaluate_order_discount(r.order_id);

  perform enqueue_notification(r.referrer_user_id, 'referral_approved', 'Referral approved', 'Your referral reward is ready to use on your next order.', null);
  perform enqueue_notification(r.referred_user_id, 'referral_approved', 'Referral discount approved', 'Your referral discount has been approved.', r.order_id);
  perform enqueue_email_job('referral_approved', 'referral_approved:referrer:' || p_referral_id::text, 'referral_approved', r.referrer_user_id, profile_email(r.referrer_user_id), '{}'::jsonb);
  perform enqueue_email_job('referral_approved', 'referral_approved:referred:' || p_referral_id::text, 'referral_approved', r.referred_user_id, profile_email(r.referred_user_id), '{}'::jsonb);

  insert into audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'approve', 'referrals', p_referral_id::text, jsonb_build_object('status', 'approved'));

  return jsonb_build_object('status', 'approved');
end;
$$;

create or replace function reject_referral(p_referral_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r referrals;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into r from referrals where id = p_referral_id and status = 'pending_approval';
  if r is null then
    raise exception 'REFERRAL_NOT_PENDING' using errcode = 'P0001';
  end if;

  update referrals set status = 'rejected', rejected_reason = p_reason, approved_by = auth.uid(), approved_at = now() where id = p_referral_id;
  update referral_benefits set status = 'rejected' where referral_id = p_referral_id;

  perform enqueue_notification(r.referred_user_id, 'referral_rejected', 'Referral discount rejected', coalesce(p_reason, 'Your referral discount request was not approved.'), r.order_id);
  perform enqueue_email_job('referral_rejected', 'referral_rejected:' || p_referral_id::text, 'referral_rejected', r.referred_user_id, profile_email(r.referred_user_id), jsonb_build_object('reason', p_reason));

  insert into audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'reject', 'referrals', p_referral_id::text, jsonb_build_object('status', 'rejected', 'reason', p_reason));

  return jsonb_build_object('status', 'rejected');
end;
$$;

-- ---------------------------------------------------------------------------
-- Order status transitions
-- ---------------------------------------------------------------------------

create or replace function change_order_status(p_order_id uuid, p_new_status_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
  new_status order_statuses;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into o from orders where id = p_order_id;
  if o is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if o.locked then
    raise exception 'ORDER_LOCKED' using errcode = 'P0001';
  end if;

  select * into new_status from order_statuses where id = p_new_status_id and is_active = true;
  if new_status is null then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  update orders set status_id = p_new_status_id, locked = new_status.is_terminal
   where id = p_order_id and status_id = o.status_id; -- optimistic: no-op if status changed concurrently

  if not found then
    raise exception 'CONCURRENT_STATUS_CHANGE' using errcode = 'P0001';
  end if;

  insert into order_status_history (order_id, from_status_id, to_status_id, changed_by, note)
  values (p_order_id, o.status_id, p_new_status_id, auth.uid(), p_note);

  return jsonb_build_object('status', new_status.slug);
end;
$$;

create or replace function unlock_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  update orders set locked = false where id = p_order_id;
  insert into audit_logs (actor_id, action, entity_type, entity_id)
  values (auth.uid(), 'unlock', 'orders', p_order_id::text);
end;
$$;

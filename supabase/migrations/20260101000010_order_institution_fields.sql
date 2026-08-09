-- Narix Academy — optional institution fields on orders
--
-- Informational only (never affects pricing). Free text so a student can
-- either pick from a client-side reference list or type their own — the
-- server does not validate against a fixed list.

alter table orders add column if not exists university text;
alter table orders add column if not exists college text;

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

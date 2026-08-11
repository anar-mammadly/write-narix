-- ---------------------------------------------------------------------------
-- hotfix-022: fixes a bug in hotfix-021's set_order_reviewed_price().
--
-- orders.discount_percentage is `numeric(5,2) not null default 0` — setting
-- it to null violated that constraint ("null value in column
-- discount_percentage... violates not-null constraint"), caught immediately
-- on first live test. discount_source (nullable) was fine; only the
-- percentage needs to be 0 instead of null.
-- ---------------------------------------------------------------------------
create or replace function set_order_reviewed_price(p_order_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  select * into o from orders where id = p_order_id;
  if o.id is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  update orders set
    reviewed_price = p_amount,
    final_price = p_amount,
    discount_source = null,
    discount_percentage = 0,
    discount_amount = 0
  where id = p_order_id;

  return jsonb_build_object('final_price', p_amount);
end;
$$;

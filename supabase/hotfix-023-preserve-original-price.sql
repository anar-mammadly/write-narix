-- ---------------------------------------------------------------------------
-- hotfix-023: preserve the original (calculator-computed) price.
--
-- set_order_reviewed_price() was overwriting final_price directly with no
-- memory of what it was before — the "Ümumi" summary card lost the original
-- estimate entirely once an admin entered a reviewed price. Add
-- orders.original_price, captured once (first time only, via coalesce) from
-- whatever final_price held at that moment, so the UI can show both the
-- original order price and the post-review price side by side.
-- ---------------------------------------------------------------------------

alter table orders add column if not exists original_price numeric(10,2);

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
    original_price = coalesce(o.original_price, o.final_price),
    reviewed_price = p_amount,
    final_price = p_amount,
    discount_source = null,
    discount_percentage = 0,
    discount_amount = 0
  where id = p_order_id;

  return jsonb_build_object('final_price', p_amount);
end;
$$;

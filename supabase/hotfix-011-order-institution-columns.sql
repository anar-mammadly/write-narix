-- Migration 20260101000010_order_institution_fields.sql was written to the
-- repo but never actually applied to this live project — the orders table
-- is missing the university/college columns that create_order() has been
-- inserting into ever since, so every order submission failed with
-- "column university of relation orders does not exist".
alter table orders add column if not exists university text;
alter table orders add column if not exists college text;

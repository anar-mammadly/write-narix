-- Hotfix 008: translate the "Early orders get 15% off" homepage banner.
-- Root cause: site_settings.early_order_banner stored only one English
-- string, so it displayed in English even with Azerbaijani as the default
-- locale. Now stores separate 'text' (AZ) and 'text_en' (EN) values.

update site_settings
set value = jsonb_set(
  jsonb_set(value, '{text}', '"Erkən sifarişlərə 15% endirim"'),
  '{text_en}', '"Early orders get 15% off"'
)
where key = 'early_order_banner';

insert into site_settings (key, value)
select 'early_order_banner', jsonb_build_object(
  'enabled', true,
  'text', 'Erkən sifarişlərə 15% endirim',
  'text_en', 'Early orders get 15% off'
)
where not exists (select 1 from site_settings where key = 'early_order_banner');

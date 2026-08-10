-- First-visit promotional popup — admin-controlled, reuses the existing
-- site_settings key/value config pattern (same as early_order_banner)
-- rather than introducing a second config table. Locale-aware like the
-- banner: separate _en fields resolved by the reading locale.
insert into site_settings (key, value) values
  ('promo_popup', jsonb_build_object(
    'enabled', true,
    'title', 'Xüsusi Təklif!',
    'title_en', 'Special Offer!',
    'description', 'Bu ay buraxılış və dissertasiya sifarişlərinizə endirim əldə edin — üstəlik 5 əlavə xidməti PULSUZ əldə edin.',
    'description_en', 'Get a discount on your graduation and dissertation orders this month — plus receive 5 additional services FREE.',
    'cta_text', 'Sifarişə başla',
    'cta_text_en', 'Get Started',
    'start_date', null,
    'end_date', null
  ))
on conflict (key) do nothing;

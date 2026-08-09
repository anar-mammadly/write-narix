-- Narix Academy — initial seed data (idempotent: safe to re-run)

-- ---------------------------------------------------------------------------
-- Site settings
-- ---------------------------------------------------------------------------
insert into site_settings (key, value) values
  ('whatsapp', jsonb_build_object('number', '994515600625', 'display', '051-560-06-25')),
  ('currency', jsonb_build_object('code', 'AZN', 'symbol', 'AZN')),
  ('referral_program', jsonb_build_object('validity_days', 90, 'max_uses_per_code', 3)),
  ('discount_stacking', jsonb_build_object('mode', 'highest_value_only')),
  ('early_order_banner', jsonb_build_object('enabled', true, 'text', 'Erkən sifarişlərə 15% endirim', 'text_en', 'Early orders get 15% off')),
  ('company', jsonb_build_object('name', 'Narix Academy', 'support_email', 'support@narix.az'))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Order statuses (admin can add/reorder/deactivate later)
-- ---------------------------------------------------------------------------
insert into order_statuses (name, slug, color, display_order, is_terminal) values
  ('New Order', 'new_order', '#2A5CAA', 10, false),
  ('Under Review', 'under_review', '#2A5CAA', 20, false),
  ('Awaiting Payment', 'awaiting_payment', '#9A6B23', 30, false),
  ('Payment Received', 'payment_received', '#3C7A5D', 40, false),
  ('Assigned', 'assigned', '#2A5CAA', 50, false),
  ('In Progress', 'in_progress', '#2A5CAA', 60, false),
  ('Ready for Delivery', 'ready_for_delivery', '#3C7A5D', 70, false),
  ('Delivered', 'delivered', '#3C7A5D', 80, false),
  ('Revision Requested', 'revision_requested', '#9A6B23', 90, false),
  ('Completed', 'completed', '#3C7A5D', 100, true),
  ('Cancelled', 'cancelled', '#A6402F', 110, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
insert into service_categories (name, slug, display_order) values
  ('Yazı', 'writing', 10),
  ('Redaktə və Nəzərdən keçirmə', 'editing-review', 20),
  ('Tədqiqat və Data', 'research-data', 30)
on conflict (slug) do nothing;

insert into services (category_id, name, slug, description, display_order)
select c.id, v.name, v.slug, v.description, v.display_order
from (values
  ('writing', 'Esse', 'essay', 'Fənlər və sitat üslubları üzrə fərdi esselər.', 10),
  ('writing', 'Tədqiqat İşi', 'research-paper', 'Tam mənbə araştırması ilə ətraflı tədqiqat işləri.', 20),
  ('writing', 'Tezis', 'thesis', 'Tezis yazılmasında dəstək.', 30),
  ('writing', 'Buraxılış İşi', 'graduation-project', 'Buraxılış (qradasiya) işinin tam yazılması.', 35),
  ('writing', 'Dissertasiya', 'dissertation', 'Dissertasiya fəsilləri və tam əlyazmalar.', 40),
  ('editing-review', 'Redaktə', 'editing', 'Mövcud qaralamaların sətir və struktur redaktəsi.', 50),
  ('editing-review', 'Korrektə', 'proofreading', 'Qrammatika, aydınlıq və formatlaşdırma yoxlaması.', 60),
  ('editing-review', 'Tərcümə', 'translation', 'Dillər arası akademik tərcümə.', 70),
  ('editing-review', 'Parafraz', 'paraphrasing', 'Mövcud mətnin orijinal, aydın şəkildə yenidən ifadəsi.', 75),
  ('research-data', 'Data Analizi', 'data-analysis', 'Statistik təhlil və interpretasiya.', 80),
  ('research-data', 'Təqdimat', 'presentation', 'Slayd və təqdimat materialları.', 90)
) as v(cat_slug, name, slug, description, display_order)
join service_categories c on c.slug = v.cat_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Per-service pricing rules — the ONLY source of price calculation.
-- progressive: base tier (base_pages, base_mode, base_price) then
--   additional_page_price per page beyond it.
-- per_page: a straight price_per_page rate, optionally with a required
--   minimum_pages.
-- ---------------------------------------------------------------------------
insert into service_pricing_rules (service_id, pricing_type, base_pages, base_mode, base_price, additional_page_price, price_per_page, minimum_pages)
select s.id, v.pricing_type, v.base_pages, v.base_mode, v.base_price, v.additional_page_price, v.price_per_page, v.minimum_pages
from (values
  ('essay',             'progressive', 5,    'flat',   10::numeric, 1::numeric,  null::numeric, null::int),
  ('presentation',      'progressive', 5,    'flat',   10::numeric, 1::numeric,  null::numeric, null::int),
  ('thesis',            'progressive', 5,    'linear', 10::numeric, 5::numeric,  null::numeric, null::int),
  ('dissertation',      'per_page',    null, null,     null,        null,        10::numeric,   20),
  ('graduation-project','per_page',    null, null,     null,        null,        9::numeric,    10),
  ('translation',       'per_page',    null, null,     null,        null,        5::numeric,    null),
  ('editing',           'per_page',    null, null,     null,        null,        5::numeric,    null),
  ('paraphrasing',      'per_page',    null, null,     null,        null,        5::numeric,    null),
  ('data-analysis',     'per_page',    null, null,     null,        null,        10::numeric,   null),
  ('research-paper',    'per_page',    null, null,     null,        null,        10::numeric,   null),
  ('proofreading',      'per_page',    null, null,     null,        null,        10::numeric,   null)
) as v(slug, pricing_type, base_pages, base_mode, base_price, additional_page_price, price_per_page, minimum_pages)
join services s on s.slug = v.slug
on conflict (service_id) do update set
  pricing_type = excluded.pricing_type,
  base_pages = excluded.base_pages,
  base_mode = excluded.base_mode,
  base_price = excluded.base_price,
  additional_page_price = excluded.additional_page_price,
  price_per_page = excluded.price_per_page,
  minimum_pages = excluded.minimum_pages;

-- ---------------------------------------------------------------------------
-- Academic levels
-- ---------------------------------------------------------------------------
insert into academic_levels (name, slug, display_order) values
  ('Orta məktəb', 'high-school', 10),
  ('Bakalavr', 'bachelor', 20),
  ('Magistr', 'master', 30),
  ('Doktorantura (PhD)', 'phd', 40)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Deadlines
-- ---------------------------------------------------------------------------
insert into deadline_options (label, duration_hours, multiplier, fixed_fee, display_order) values
  ('30 gün', 720, 1.0, 0, 10),
  ('14 gün', 336, 1.15, 0, 20),
  ('7 gün', 168, 1.35, 0, 30),
  ('3 gün', 72, 1.7, 5, 40)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Word count / page tiers
-- ---------------------------------------------------------------------------
insert into word_count_options (label, word_count, page_count, display_order) values
  ('300 söz (1 səhifə)', 300, 1, 10),
  ('500 söz (~2 səhifə)', 500, 2, 20),
  ('1000 söz (~4 səhifə)', 1000, 4, 30),
  ('2000 söz (~8 səhifə)', 2000, 8, 40),
  ('5000 söz (~20 səhifə)', 5000, 20, 50)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Languages / citation styles / add-ons
-- ---------------------------------------------------------------------------
insert into languages (name, code, extra_fee, display_order) values
  ('English', 'en', 0, 10),
  ('Azerbaijani', 'az', 0, 20),
  ('Russian', 'ru', 5, 30)
on conflict (code) do nothing;

insert into citation_styles (name, extra_fee, display_order) values
  ('APA', 0, 10),
  ('MLA', 0, 20),
  ('Chicago', 0, 30),
  ('Harvard', 0, 40)
on conflict do nothing;

insert into additional_services (name, description, price_type, price_value, display_order) values
  ('Plagiat Hesabatı', 'Çatdırılma zamanı tam oxşarlıq hesabatı daxildir.', 'fixed', 8, 10),
  ('Əvvəlcə Qaralama Planı', 'Tam yazı başlamazdan əvvəl planı əldə edin.', 'fixed', 6, 20),
  ('Aparıcı Yazar', 'Təcrübəli aparıcı yazara həvalə edilir.', 'percentage', 15, 30),
  ('Fərdi Məsləhət', '30 dəqiqəlik məsləhət zəngi.', 'fixed', 15, 40)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Pricing rules (base_price per service x academic level, price_per_page)
-- ---------------------------------------------------------------------------
insert into pricing_rules (service_id, academic_level_id, base_price, price_per_page)
select s.id, l.id,
  case l.slug
    when 'high-school' then 6
    when 'bachelor' then 9
    when 'master' then 12
    when 'phd' then 16
  end,
  case l.slug
    when 'high-school' then 4
    when 'bachelor' then 6
    when 'master' then 8
    when 'phd' then 11
  end
from services s
cross join academic_levels l
on conflict (service_id, academic_level_id) do nothing;

-- ---------------------------------------------------------------------------
-- Discount rules (percentages are placeholders — admin-editable)
-- ---------------------------------------------------------------------------
insert into discounts (type, name, percentage, active) values
  ('member', 'Registered & verified member discount', 5, true),
  ('early_order', 'Early order discount', 15, true),
  ('referral', 'Referral program benefit', 10, true)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Email templates (plain placeholders; admin-editable later)
-- ---------------------------------------------------------------------------
insert into email_templates (key, subject, body_html, body_text) values
  ('order_created', 'Your Narix Academy order {{order_number}} was received',
   '<p>Thank you — we have received your order <strong>{{order_number}}</strong>.</p>', 'We have received your order {{order_number}}.'),
  ('order_status_changed', 'Order {{order_number}} — status update',
   '<p>Your order <strong>{{order_number}}</strong> status is now <strong>{{status}}</strong>.</p>', 'Order {{order_number}} status is now {{status}}.'),
  ('payment_requested', 'Payment requested for order {{order_number}}',
   '<p>{{description}} — amount due: {{amount}} AZN.</p>', 'Payment requested for {{order_number}}: {{amount}} AZN.'),
  ('payment_received', 'Payment received for order {{order_number}}',
   '<p>We recorded a payment of {{amount}} AZN on your order.</p>', 'Payment of {{amount}} AZN recorded on {{order_number}}.'),
  ('document_requested', 'Additional information needed — {{order_number}}',
   '<p>{{title}}: {{description}}</p>', '{{title}}: {{description}}'),
  ('new_message', 'New message on order {{order_number}}',
   '<p>You have a new message regarding order {{order_number}}.</p>', 'New message on {{order_number}}.'),
  ('referral_approved', 'Your referral benefit was approved',
   '<p>Your referral benefit has been approved and is ready to use.</p>', 'Your referral benefit has been approved.'),
  ('referral_rejected', 'Referral request update',
   '<p>Your referral discount request was not approved. {{reason}}</p>', 'Referral request not approved. {{reason}}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Placeholder content — clearly labeled, replace via admin panel
-- ---------------------------------------------------------------------------
insert into faqs (question, answer, display_order) values
  ('[Nümunə] Sifarişim nə qədər tez hazır olacaq?', 'Çatdırılma müddəti checkout zamanı seçdiyiniz son tarixdən asılıdır — 3 gündən 30 günə qədər.', 10),
  ('[Nümunə] Məlumatlarım məxfi qalacaqmı?', 'Bəli. Sifariş məlumatlarınız və fayllarınız yalnız sizə və səlahiyyətli işçilərə görünür.', 20),
  ('[Nümunə] Düzəliş tələb edə bilərəmmi?', 'Bəli, çatdırılmadan sonra sifariş səhifənizdən düzəliş tələb edə bilərsiniz.', 30)
on conflict do nothing;

insert into testimonials (author_name, author_context, quote, rating, display_order) values
  ('[Nümunə] A. Məmmədova', 'Magistrant', 'Aydın ünsiyyət və vaxtında çatdırılma.', 5, 10),
  ('[Nümunə] R. Hüseynov', 'Bakalavr tələbəsi', 'Qiymət kalkulyatoru xərci əvvəlcədən görməyi asanlaşdırdı.', 5, 20)
on conflict do nothing;
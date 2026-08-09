-- Narix Academy — per-locale content overrides
--
-- service_categories/services/academic_levels/deadline_options/languages/
-- additional_services store their base text in Azerbaijani (the site
-- default). `translations` holds locale-keyed overrides, e.g.
-- {"en": {"name": "Essay", "description": "..."}} — a key/field is only
-- present when it actually differs from the AZ base column, so the app can
-- always fall back to the base column for any locale/field it doesn't find.

alter table service_categories add column if not exists translations jsonb not null default '{}'::jsonb;
alter table services add column if not exists translations jsonb not null default '{}'::jsonb;
alter table academic_levels add column if not exists translations jsonb not null default '{}'::jsonb;
alter table deadline_options add column if not exists translations jsonb not null default '{}'::jsonb;
alter table languages add column if not exists translations jsonb not null default '{}'::jsonb;
alter table additional_services add column if not exists translations jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- English overrides for the seeded content
-- ---------------------------------------------------------------------------

update service_categories set translations = jsonb_build_object('en', jsonb_build_object('name', v.name_en))
from (values ('writing', 'Writing'), ('editing-review', 'Editing & Review'), ('research-data', 'Research & Data'))
  as v(slug, name_en)
where service_categories.slug = v.slug;

update services set translations = jsonb_build_object('en', jsonb_build_object('name', v.name_en, 'description', v.description_en))
from (values
  ('essay', 'Essay', 'Custom essays across subjects and citation styles.'),
  ('research-paper', 'Research Paper', 'In-depth research papers with full source work.'),
  ('thesis', 'Thesis', 'Thesis writing support.'),
  ('graduation-project', 'Graduation Project', 'Full writing of your graduation (qualification) project.'),
  ('dissertation', 'Dissertation', 'Dissertation chapters and full manuscripts.'),
  ('editing', 'Editing', 'Line and structural editing of existing drafts.'),
  ('proofreading', 'Proofreading', 'Grammar, clarity and formatting pass.'),
  ('translation', 'Translation', 'Academic translation between languages.'),
  ('paraphrasing', 'Paraphrasing', 'Original, clear rewriting of existing text.'),
  ('data-analysis', 'Data Analysis', 'Statistical analysis and interpretation.'),
  ('presentation', 'Presentation', 'Slide decks and presentation materials.')
) as v(slug, name_en, description_en)
where services.slug = v.slug;

update academic_levels set translations = jsonb_build_object('en', jsonb_build_object('name', v.name_en))
from (values ('high-school', 'High School'), ('bachelor', 'Bachelor'), ('master', 'Master'), ('phd', 'PhD'))
  as v(slug, name_en)
where academic_levels.slug = v.slug;

update deadline_options set translations = jsonb_build_object('en', jsonb_build_object('label', v.label_en))
from (values (720, '30 days'), (336, '14 days'), (168, '7 days'), (72, '3 days'))
  as v(hours, label_en)
where deadline_options.duration_hours = v.hours;

update languages set translations = jsonb_build_object('en', jsonb_build_object('name', v.name_en))
from (values ('en', 'English'), ('az', 'Azerbaijani'), ('ru', 'Russian'))
  as v(code, name_en)
where languages.code = v.code;

update additional_services set translations = jsonb_build_object('en', jsonb_build_object('name', v.name_en, 'description', v.description_en))
from (values
  ('Plagiat Hesabatı', 'Plagiarism Report', 'Full similarity report included with delivery.'),
  ('Əvvəlcə Qaralama Planı', 'Draft Outline First', 'Receive an outline before full writing begins.'),
  ('Aparıcı Yazar', 'Top Writer', 'Assigned to a senior writer.'),
  ('Fərdi Məsləhət', 'One-on-One Consultation', '30-minute consultation call.')
) as v(name_az, name_en, description_en)
where additional_services.name = v.name_az;

-- FAQs and testimonials already carry a translations column (see
-- 20260101000002_core_tables.sql) — it was just never populated or read.
update faqs set translations = jsonb_build_object('en', jsonb_build_object(
  'question', v.question_en, 'answer', v.answer_en
))
from (values
  ('[Nümunə] Sifarişim nə qədər tez hazır olacaq?',
   '[Sample] How fast can you deliver my order?',
   'Delivery time depends on the deadline you select at checkout — from 3 to 30 days.'),
  ('[Nümunə] Məlumatlarım məxfi qalacaqmı?',
   '[Sample] Is my information confidential?',
   'Yes. Your order details and files are only visible to you and authorized staff.'),
  ('[Nümunə] Düzəliş tələb edə bilərəmmi?',
   '[Sample] Can I request revisions?',
   'Yes, revisions can be requested from your order page after delivery.')
) as v(question_az, question_en, answer_en)
where faqs.question = v.question_az;

update testimonials set translations = jsonb_build_object('en', jsonb_build_object(
  'author_name', v.author_name_en, 'author_context', v.author_context_en, 'quote', v.quote_en
))
from (values
  ('[Nümunə] A. Məmmədova', '[Sample] A. Mammadova', 'Master''s student', 'Clear communication and delivered on time.'),
  ('[Nümunə] R. Hüseynov', '[Sample] R. Huseynov', 'Bachelor''s student', 'The pricing calculator made it easy to see the cost upfront.')
) as v(author_name_az, author_name_en, author_context_en, quote_en)
where testimonials.author_name = v.author_name_az;

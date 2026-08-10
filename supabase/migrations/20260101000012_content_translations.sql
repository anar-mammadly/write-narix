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
  ('Sifarişimin vəziyyətini necə izləyə bilərəm?',
   'How can I track my order status?',
   'Once you place an order, you get a unique order number and a tracking link. If you are signed in, you can track all your orders in real time from the "My Orders" section.'),
  ('Plagiat yoxlanışı sifarişimə daxildirmi?',
   'Is a plagiarism check included in my order?',
   'Not by default, but you can add the "Plagiarism Check" add-on at checkout. It becomes free once your order reaches 500 AZN.'),
  ('Məlumatlarım məxfi qalacaqmı?',
   'Will my information stay confidential?',
   'Yes. Your order details and files are only visible to you and authorized staff.'),
  ('Çatdırılmadan sonra düzəliş tələb edə bilərəmmi?',
   'Can I request revisions after delivery?',
   'Yes, you can request revisions directly from your order page after delivery.'),
  ('Hesab yaratmadan (qonaq kimi) sifariş verə bilərəmmi?',
   'Can I order without creating an account?',
   'Yes. You can check out as a guest and track your order with your order number and tracking link. You can create an account later and link the order to it.'),
  ('Son tarixi seçdikdən sonra dəyişə bilərəmmi?',
   'Can I change the deadline after placing my order?',
   'Yes, you can contact us via the messages section to request a deadline change. Note that this may affect your order price.')
) as v(question_az, question_en, answer_en)
where faqs.question = v.question_az;

update testimonials set translations = jsonb_build_object('en', jsonb_build_object(
  'author_name', v.author_name_en, 'author_context', v.author_context_en, 'quote', v.quote_en
))
from (values
  ('A.M.', 'A.M.', 'Master''s student', 'Clear communication and delivered on time — I tracked the whole process from my order page.'),
  ('R.H.', 'R.H.', 'Bachelor''s student', 'The pricing calculator made it easy to see the cost upfront.'),
  ('S.K.', 'S.K.', 'PhD student', 'I received thorough, professional support on my dissertation chapter.'),
  ('N.Q.', 'N.Q.', 'Bachelor''s student', 'Delivered right on the deadline, and the messaging section made communication easy.')
) as v(author_name_az, author_name_en, author_context_en, quote_en)
where testimonials.author_name = v.author_name_az;

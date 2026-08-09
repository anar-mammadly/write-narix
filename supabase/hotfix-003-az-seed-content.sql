-- Hotfix: translate the placeholder FAQ/testimonial seed content to
-- Azerbaijani (the site now defaults to AZ). Matches by the English
-- question/quote text already inserted by the original seed run.

update faqs set question = '[Nümunə] Sifarişim nə qədər tez hazır olacaq?',
  answer = 'Çatdırılma müddəti checkout zamanı seçdiyiniz son tarixdən asılıdır — 3 gündən 30 günə qədər.'
where question = '[Placeholder] How fast can you deliver my order?';

update faqs set question = '[Nümunə] Məlumatlarım məxfi qalacaqmı?',
  answer = 'Bəli. Sifariş məlumatlarınız və fayllarınız yalnız sizə və səlahiyyətli işçilərə görünür.'
where question = '[Placeholder] Is my information confidential?';

update faqs set question = '[Nümunə] Düzəliş tələb edə bilərəmmi?',
  answer = 'Bəli, çatdırılmadan sonra sifariş səhifənizdən düzəliş tələb edə bilərsiniz.'
where question = '[Placeholder] Can I request revisions?';

update testimonials set author_name = '[Nümunə] A. Məmmədova', author_context = 'Magistrant',
  quote = 'Aydın ünsiyyət və vaxtında çatdırılma.'
where author_name = '[Placeholder] A. Mammadova';

update testimonials set author_name = '[Nümunə] R. Hüseynov', author_context = 'Bakalavr tələbəsi',
  quote = 'Qiymət kalkulyatoru xərci əvvəlcədən görməyi asanlaşdırdı.'
where author_name = '[Placeholder] R. Huseynov';

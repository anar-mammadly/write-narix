-- Hotfix: translate service categories, services, academic levels,
-- deadlines, word-count tiers, and additional services to Azerbaijani.
-- Matched by slug where one exists (stable identifier); by current label
-- text otherwise.

-- Service categories
update service_categories set name = 'Yazı' where slug = 'writing';
update service_categories set name = 'Redaktə və Nəzərdən keçirmə' where slug = 'editing-review';
update service_categories set name = 'Tədqiqat və Data' where slug = 'research-data';

-- Services
update services set name = 'Esse', description = 'Fənlər və sitat üslubları üzrə fərdi esselər.' where slug = 'essay';
update services set name = 'Tədqiqat İşi', description = 'Tam mənbə araştırması ilə ətraflı tədqiqat işləri.' where slug = 'research-paper';
update services set name = 'Buraxılış İşi', description = 'Tam həcmli buraxılış işi yazılmasında dəstək.' where slug = 'thesis';
update services set name = 'Dissertasiya', description = 'Dissertasiya fəsilləri və tam əlyazmalar.' where slug = 'dissertation';
update services set name = 'Redaktə', description = 'Mövcud qaralamaların sətir və struktur redaktəsi.' where slug = 'editing';
update services set name = 'Korrektə', description = 'Qrammatika, aydınlıq və formatlaşdırma yoxlaması.' where slug = 'proofreading';
update services set name = 'Tərcümə', description = 'Dillər arası akademik tərcümə.' where slug = 'translation';
update services set name = 'Data Analizi', description = 'Statistik təhlil və interpretasiya.' where slug = 'data-analysis';
update services set name = 'Təqdimat', description = 'Slayd və təqdimat materialları.' where slug = 'presentation';

-- Academic levels
update academic_levels set name = 'Orta məktəb' where slug = 'high-school';
update academic_levels set name = 'Bakalavr' where slug = 'bachelor';
update academic_levels set name = 'Magistr' where slug = 'master';
update academic_levels set name = 'Doktorantura (PhD)' where slug = 'phd';

-- Deadlines (matched by current English label)
update deadline_options set label = '30 gün' where label = '30 days';
update deadline_options set label = '14 gün' where label = '14 days';
update deadline_options set label = '7 gün' where label = '7 days';
update deadline_options set label = '3 gün' where label = '3 days';

-- Word count / page tiers
update word_count_options set label = '300 söz (1 səhifə)' where label = '300 words (1 page)';
update word_count_options set label = '500 söz (~2 səhifə)' where label = '500 words (~2 pages)';
update word_count_options set label = '1000 söz (~4 səhifə)' where label = '1000 words (~4 pages)';
update word_count_options set label = '2000 söz (~8 səhifə)' where label = '2000 words (~8 pages)';
update word_count_options set label = '5000 söz (~20 səhifə)' where label = '5000 words (~20 pages)';

-- Additional services
update additional_services set name = 'Plagiat Hesabatı', description = 'Çatdırılma zamanı tam oxşarlıq hesabatı daxildir.' where name = 'Plagiarism Report';
update additional_services set name = 'Əvvəlcə Qaralama Planı', description = 'Tam yazı başlamazdan əvvəl planı əldə edin.' where name = 'Draft Outline First';
update additional_services set name = 'Aparıcı Yazar', description = 'Təcrübəli aparıcı yazara həvalə edilir.' where name = 'Top Writer';
update additional_services set name = 'Fərdi Məsləhət', description = '30 dəqiqəlik məsləhət zəngi.' where name = 'One-on-One Consultation';

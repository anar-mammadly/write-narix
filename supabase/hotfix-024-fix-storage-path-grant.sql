-- ---------------------------------------------------------------------------
-- hotfix-024: storage_path_order_id() was missing EXECUTE for anon/
-- authenticated — confirmed live via a direct RPC call ("permission denied
-- for function storage_path_order_id"). This function runs INSIDE the
-- order-files storage RLS policies (order_files_select/insert/delete all
-- call `owns_order(storage_path_order_id(name))`), evaluated as whichever
-- role made the request — so without this grant, every upload and download
-- against that bucket has been silently rejected by Supabase Storage,
-- regardless of file type, admin or not. Uploading a PDF failed the same
-- way a Word/Excel/PPT file would have.
--
-- allowed_mime_types on the bucket already includes PDF/Word/Excel (see
-- migration 20260101000009_storage.sql) but not PowerPoint — adding pptx/ppt
-- while here, since the request explicitly asked for that format too.
-- ---------------------------------------------------------------------------

grant execute on function storage_path_order_id(text) to anon, authenticated;

update storage.buckets
set
  file_size_limit = 4194304, -- 4MB, as requested
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg', 'image/webp',
    'text/csv'
  ]
where id = 'order-files';

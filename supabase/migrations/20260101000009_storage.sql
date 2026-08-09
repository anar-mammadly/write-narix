-- Narix Academy — private file storage
--
-- Single private bucket. Path convention: orders/{order_id}/{category}/{filename}
-- so ownership can be checked straight from the path, mirroring owns_order().

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-files', 'order-files', false, 26214400, -- 25MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png', 'image/jpeg', 'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- storage.objects.name for this bucket looks like: orders/<order_id>/<category>/<uuid>-<filename>
create or replace function storage_path_order_id(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when p_name ~ '^orders/[0-9a-fA-F-]{36}/'
      then split_part(p_name, '/', 2)::uuid
    else null
  end;
$$;

create policy order_files_select on storage.objects
  for select using (
    bucket_id = 'order-files'
    and (owns_order(storage_path_order_id(name)) or is_admin())
  );

create policy order_files_insert on storage.objects
  for insert with check (
    bucket_id = 'order-files'
    and (owns_order(storage_path_order_id(name)) or is_admin())
  );

create policy order_files_delete on storage.objects
  for delete using (
    bucket_id = 'order-files' and is_admin()
  );

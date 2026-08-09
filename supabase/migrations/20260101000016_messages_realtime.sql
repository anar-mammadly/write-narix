-- MessageThread subscribes to postgres_changes on `messages`, but the table
-- was never added to the supabase_realtime publication — so every message
-- was actually inserted successfully, it just never appeared anywhere,
-- neither for the sender (no optimistic update in the client either — see
-- the accompanying MessageThread fix) nor for the other side (no realtime
-- push). `if not exists` guards against re-running this against a project
-- where it was already added by hand.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

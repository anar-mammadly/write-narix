-- Hotfix: the role-escalation guard trigger was blocking legitimate
-- service-role writes too (e.g. bootstrapping the first admin), because
-- auth.uid() is null for service-role requests and the trigger treated
-- "not admin" as "block" regardless of who — or what — was writing.

create or replace function prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role and auth.uid() is not null and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

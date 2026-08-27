create or replace function public.ensure_personal_workspace(_name text, _slug text)
returns table (id uuid, name text, slug text, retention_days int, is_demo boolean, role app_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _org public.organizations%rowtype;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  select o.* into _org
  from public.organizations o
  join public.memberships m on m.org_id = o.id
  where m.user_id = _uid
  order by o.created_at asc
  limit 1;

  if _org.id is null then
    insert into public.organizations (name, slug, owner_id)
    values (coalesce(nullif(_name,''), 'Personal workspace'), coalesce(nullif(_slug,''), 'ws-' || substr(md5(random()::text),1,8)), _uid)
    returning * into _org;

    insert into public.memberships (org_id, user_id, role)
    values (_org.id, _uid, 'owner')
    on conflict do nothing;
  end if;

  return query
  select _org.id, _org.name, _org.slug, _org.retention_days, _org.is_demo,
         coalesce((select m.role from public.memberships m where m.org_id = _org.id and m.user_id = _uid), 'owner'::app_role);
end;
$$;

revoke all on function public.ensure_personal_workspace(text, text) from public;
grant execute on function public.ensure_personal_workspace(text, text) to authenticated, service_role;
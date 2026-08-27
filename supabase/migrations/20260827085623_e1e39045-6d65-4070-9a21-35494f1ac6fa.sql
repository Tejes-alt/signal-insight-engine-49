alter table public.account_snapshots
  add column if not exists source text not null default 'public_profile',
  add column if not exists reach bigint,
  add column if not exists impressions bigint,
  add column if not exists saves bigint,
  add column if not exists shares bigint,
  add column if not exists profile_visits bigint,
  add column if not exists import_id uuid,
  add column if not exists created_at timestamptz not null default now();

alter table public.public_content
  add column if not exists source text not null default 'public_profile',
  add column if not exists content_type text,
  add column if not exists caption text,
  add column if not exists shares bigint,
  add column if not exists reach bigint,
  add column if not exists impressions bigint,
  add column if not exists saves bigint,
  add column if not exists import_id uuid;

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid references public.public_accounts(id) on delete cascade,
  platform text not null,
  file_name text not null,
  file_type text not null,
  source text not null,
  row_count integer not null default 0,
  metric_count integer not null default 0,
  content_count integer not null default 0,
  status text not null default 'imported',
  summary jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.imports to authenticated;
grant all on public.imports to service_role;
alter table public.imports enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='imports' and policyname='imports_member_all') then
    create policy "imports_member_all" on public.imports for all to authenticated
      using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
  end if;
end $$;

create index if not exists imports_org_created_idx on public.imports (org_id, created_at desc);
create index if not exists snapshots_import_idx on public.account_snapshots (import_id);
create index if not exists content_import_idx on public.public_content (import_id);
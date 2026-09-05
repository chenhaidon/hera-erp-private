drop table if exists public.process_routes cascade;

create table public.process_routes (
  id text primary key,
  code text not null unique,
  name text not null,
  category text not null,
  steps jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.process_routes is '工艺路线';
alter table public.process_routes enable row level security;

create policy "process_routes_anon_select" on public.process_routes for select to anon using (true);
create policy "process_routes_auth_select" on public.process_routes for select to authenticated using (true);
create policy "process_routes_auth_insert" on public.process_routes for insert to authenticated with check (true);
create policy "process_routes_auth_update" on public.process_routes for update to authenticated using (true) with check (true);
create policy "process_routes_auth_delete" on public.process_routes for delete to authenticated using (true);
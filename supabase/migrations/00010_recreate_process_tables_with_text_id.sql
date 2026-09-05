drop table if exists public.process_param_templates cascade;
drop table if exists public.process_versions cascade;
drop table if exists public.process_knowledge cascade;

create table public.process_param_templates (
  id text primary key,
  code text not null unique,
  name text not null,
  process_name text not null,
  params jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.process_param_templates is '工艺参数模板';
alter table public.process_param_templates enable row level security;

create policy "process_param_templates_anon_select" on public.process_param_templates for select to anon using (true);
create policy "process_param_templates_auth_select" on public.process_param_templates for select to authenticated using (true);
create policy "process_param_templates_auth_insert" on public.process_param_templates for insert to authenticated with check (true);
create policy "process_param_templates_auth_update" on public.process_param_templates for update to authenticated using (true) with check (true);
create policy "process_param_templates_auth_delete" on public.process_param_templates for delete to authenticated using (true);

create table public.process_versions (
  id text primary key,
  code text not null unique,
  product_id text not null,
  product_code text not null,
  product_name text not null,
  route_id text not null,
  route_name text not null,
  effective_date text not null,
  expiry_date text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.process_versions is '工艺版本';
alter table public.process_versions enable row level security;

create policy "process_versions_anon_select" on public.process_versions for select to anon using (true);
create policy "process_versions_auth_select" on public.process_versions for select to authenticated using (true);
create policy "process_versions_auth_insert" on public.process_versions for insert to authenticated with check (true);
create policy "process_versions_auth_update" on public.process_versions for update to authenticated using (true) with check (true);
create policy "process_versions_auth_delete" on public.process_versions for delete to authenticated using (true);

create table public.process_knowledge (
  id text primary key,
  code text not null unique,
  title text not null,
  process_name text not null,
  device text not null,
  tags jsonb not null default '[]'::jsonb,
  problem text not null,
  solution text not null,
  effect text not null,
  creator text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.process_knowledge is '工艺知识库';
alter table public.process_knowledge enable row level security;

create policy "process_knowledge_anon_select" on public.process_knowledge for select to anon using (true);
create policy "process_knowledge_auth_select" on public.process_knowledge for select to authenticated using (true);
create policy "process_knowledge_auth_insert" on public.process_knowledge for insert to authenticated with check (true);
create policy "process_knowledge_auth_update" on public.process_knowledge for update to authenticated using (true) with check (true);
create policy "process_knowledge_auth_delete" on public.process_knowledge for delete to authenticated using (true);
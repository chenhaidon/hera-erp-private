create table entity_store (
  id text not null,
  entity_type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (id, entity_type)
);

create index idx_entity_store_type on entity_store(entity_type);

alter table entity_store enable row level security;

create policy "entity_store_allow_all" on entity_store for all to anon, authenticated using (true) with check (true);
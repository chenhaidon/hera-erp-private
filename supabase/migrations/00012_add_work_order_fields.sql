alter table public.work_orders add column if not exists source text not null default 'plan';
alter table public.work_orders add column if not exists priority text not null default 'medium';
alter table public.work_orders add column if not exists start_date text;
alter table public.work_orders add column if not exists end_date text;
alter table public.work_orders add column if not exists issued_at timestamptz;
alter table public.work_orders add column if not exists completed_at timestamptz;
alter table public.work_orders add column if not exists updated_at timestamptz default now();

comment on column public.work_orders.source is '工单来源：plan-计划排程，manual-手动新建';
comment on column public.work_orders.priority is '优先级：urgent-紧急，high-高，medium-中，low-低';

notify pgrst, 'reload schema';
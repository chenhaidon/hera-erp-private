alter table public.work_orders add column if not exists remark text;
comment on column public.work_orders.remark is '备注信息';
notify pgrst, 'reload schema';
-- 清理 system_users 中的重复账号，保留已关联员工档案的记录，并将 id 统一为 account
with ranked as (
  select
    id,
    entity_type,
    (data->>'account')::text as account,
    data->>'employee_id' as employee_id,
    updated_at,
    row_number() over (
      partition by (data->>'account')::text
      order by
        case when data->>'employee_id' is not null then 0 else 1 end,
        updated_at desc
    ) as rn
  from entity_store
  where entity_type = 'system_users'
)
delete from entity_store
where (id, entity_type) in (
  select id, entity_type from ranked where rn > 1
);

-- 将剩余 system_users 的 id 更新为 account，确保与前端 fallback 一致
update entity_store
set
  id = data->>'account',
  data = data || jsonb_build_object('id', data->>'account'),
  updated_at = now()
where entity_type = 'system_users';

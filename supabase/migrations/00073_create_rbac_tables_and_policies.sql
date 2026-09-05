-- RBAC 角色权限系统：角色表 + 角色-菜单-按钮关联表 + 实体映射表

-- 1. 角色表
create table sys_roles (
  role_key text primary key,
  role_name text not null,
  data_scopes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. 角色-菜单-按钮关联表
create table sys_role_menu_buttons (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  menu_key text not null,
  button_key text not null,
  created_at timestamptz not null default now(),
  constraint sys_role_menu_buttons_uq unique (role_key, menu_key, button_key)
);

-- 3. 实体类型 → 菜单映射表（供后端写拦截使用）
create table rbac_entity_menu_map (
  entity_type text primary key,
  menu_key text not null
);

-- 4. 管理员判断函数（SECURITY DEFINER 绕过 profiles RLS）
create or replace function rbac_is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role::text = 'admin');
$$;

-- 5. 写权限校验函数（后端硬拦截核心）
create or replace function rbac_write_allowed(p_entity_type text, p_action text)
returns boolean
language sql security definer stable set search_path = public
as $$
  select
    case
      -- 日志类放行（含匿名登录失败记录场景）
      when p_entity_type in ('operation_logs', 'login_logs') then true
      -- 管理员恒放行
      when rbac_is_admin() then true
      -- 当前用户角色未配置任何按钮权限 → 放行（兼容未接入 RBAC 的角色）
      when not exists (
        select 1 from sys_role_menu_buttons b
        where b.role_key = (select role::text from profiles where id = auth.uid())
      ) then true
      -- 实体类型无映射 → 放行
      when not exists (select 1 from rbac_entity_menu_map m where m.entity_type = p_entity_type) then true
      -- 严格校验：角色需持有该菜单对应按钮权限
      else exists (
        select 1
        from sys_role_menu_buttons b
        join rbac_entity_menu_map m on m.menu_key = b.menu_key
        where b.role_key = (select role::text from profiles where id = auth.uid())
          and m.entity_type = p_entity_type
          and b.button_key = case p_action
            when 'insert' then 'create'
            when 'update' then 'edit'
            when 'delete' then 'delete'
            else p_action
          end
      )
    end
$$;

-- 6. RLS 策略
alter table sys_roles enable row level security;
alter table sys_role_menu_buttons enable row level security;
alter table rbac_entity_menu_map enable row level security;

-- sys_roles：登录用户可读（加载自身角色权限），仅管理员可写
create policy sys_roles_select on sys_roles
  for select to anon, authenticated using (true);
create policy sys_roles_admin_all on sys_roles
  for all to authenticated
  using (rbac_is_admin()) with check (rbac_is_admin());

-- sys_role_menu_buttons：登录用户可读，仅管理员可写
create policy sys_role_menu_buttons_select on sys_role_menu_buttons
  for select to anon, authenticated using (true);
create policy sys_role_menu_buttons_admin_all on sys_role_menu_buttons
  for all to authenticated
  using (rbac_is_admin()) with check (rbac_is_admin());

-- rbac_entity_menu_map：所有人可读，仅管理员可写
create policy rbac_entity_menu_map_select on rbac_entity_menu_map
  for select to anon, authenticated using (true);
create policy rbac_entity_menu_map_admin_all on rbac_entity_menu_map
  for all to authenticated
  using (rbac_is_admin()) with check (rbac_is_admin());

-- 7. entity_store 写策略改造：SELECT 保持放行，写操作走 RBAC 校验
drop policy entity_store_allow_all on entity_store;

create policy entity_store_select on entity_store
  for select to anon, authenticated using (true);

create policy entity_store_insert on entity_store
  for insert to authenticated
  with check (rbac_write_allowed(entity_type, 'insert'));

create policy entity_store_update on entity_store
  for update to authenticated
  using (rbac_write_allowed(entity_type, 'update'))
  with check (rbac_write_allowed(entity_type, 'update'));

create policy entity_store_delete on entity_store
  for delete to authenticated
  using (rbac_write_allowed(entity_type, 'delete'));

-- 匿名用户仅允许写登录日志（登录失败记录）
create policy entity_store_anon_insert_logs on entity_store
  for insert to anon
  with check (entity_type = 'login_logs');
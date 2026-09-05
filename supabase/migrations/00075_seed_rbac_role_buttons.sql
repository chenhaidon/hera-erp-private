-- 角色按钮权限种子：按模板预置（生产主管/财务/仓库/销售）
-- 生成方式：菜单 × 按钮集合 交叉展开

-- 生产主管：生产/计划/工艺/质量/设备/人员全功能 + 物料只读
insert into sys_role_menu_buttons (role_key, menu_key, button_key)
select 'production', m.menu_key, b.button_key
from unnest(array[
  'planning-pool','planning-mps','planning-gantt','planning-mrp','planning-production-line',
  'process-processes','process-routes','process-params','process-versions','process-knowledge',
  'production-orders','production-operations','production-requisitions','production-progress','production-costs','production-reports',
  'quality-standards','quality-incoming','quality-process','quality-finished','quality-trace',
  'equipment-ledger','equipment-plan','equipment-maintain','equipment-repair',
  'personnel-employee','personnel-attendance',
  'materials','inventory-material'
]) as m(menu_key)
cross join unnest(array['view','create','edit','delete','export']) as b(button_key)
where not exists (
  select 1 from sys_role_menu_buttons
  where role_key='production' and menu_key=m.menu_key and button_key=b.button_key
);

-- 财务人员：财务/退税/报表全功能 + 订单/报价只读
insert into sys_role_menu_buttons (role_key, menu_key, button_key)
select 'finance', m.menu_key, b.button_key
from unnest(array[
  'finance-dashboard','finance-receivable','finance-payable','finance-payment','finance-tax-refund','finance-cost','finance-profit','finance-salary-detail',
  'reports-sales','reports-production','reports-inventory','reports-quality','reports-finance','reports-personnel',
  'marketing-orders','quotation-list'
]) as m(menu_key)
cross join unnest(array['view','create','edit','export']) as b(button_key)
where not exists (
  select 1 from sys_role_menu_buttons
  where role_key='finance' and menu_key=m.menu_key and button_key=b.button_key
);

-- 仓库管理员：库存/采购/物料全功能
insert into sys_role_menu_buttons (role_key, menu_key, button_key)
select 'warehouse', m.menu_key, b.button_key
from unnest(array[
  'inventory-product','inventory-material','inventory-location','inventory-finished_inbound','inventory-records','inventory-check','inventory-turnover',
  'purchase-po','purchase-supplier','purchase-arrival','purchase-material',
  'materials'
]) as m(menu_key)
cross join unnest(array['view','create','edit','export']) as b(button_key)
where not exists (
  select 1 from sys_role_menu_buttons
  where role_key='warehouse' and menu_key=m.menu_key and button_key=b.button_key
);

-- 销售：营销/报价/售后全功能 + 报表只读
insert into sys_role_menu_buttons (role_key, menu_key, button_key)
select 'sales', m.menu_key, b.button_key
from unnest(array[
  'marketing-customers','marketing-orders','marketing-shipments','marketing-price','marketing-stats',
  'quotation-list','quotation-create','quotation-approval','quotation-history',
  'contract-list','contract-create','contract-templates',
  'after-sales-tickets','after-sales-returns','after-sales-reshipments',
  'reports-sales'
]) as m(menu_key)
cross join unnest(array['view','create','edit','export']) as b(button_key)
where not exists (
  select 1 from sys_role_menu_buttons
  where role_key='sales' and menu_key=m.menu_key and button_key=b.button_key
);

-- 质检员：质量模块 + 物料/来料
insert into sys_role_menu_buttons (role_key, menu_key, button_key)
select 'quality', m.menu_key, b.button_key
from unnest(array[
  'quality-standards','quality-incoming','quality-process','quality-finished','quality-trace',
  'materials'
]) as m(menu_key)
cross join unnest(array['view','create','edit','export']) as b(button_key)
where not exists (
  select 1 from sys_role_menu_buttons
  where role_key='quality' and menu_key=m.menu_key and button_key=b.button_key
);

-- 生产人员：报工/工序/进度查看
insert into sys_role_menu_buttons (role_key, menu_key, button_key)
select 'worker', m.menu_key, b.button_key
from unnest(array[
  'production-orders','production-operations','production-requisitions','production-progress','production-reports',
  'quality-incoming','quality-process'
]) as m(menu_key)
cross join unnest(array['view','create']) as b(button_key)
where not exists (
  select 1 from sys_role_menu_buttons
  where role_key='worker' and menu_key=m.menu_key and button_key=b.button_key
);
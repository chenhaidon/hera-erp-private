// RBAC 角色权限系统：菜单树定义、按钮权限、数据权限、模板与加载/保存
import { useCallback } from 'react';
import { supabase } from '@/db/supabase';
import { useAppStore } from '@/store';
import { toast } from 'sonner';
import type { AppRole } from '@/lib/permissions';

// ============ 基础定义 ============

export type RbacButton = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'audit';
export type DataScope = 'all' | 'dept' | 'self';

export const RBAC_BUTTONS: { key: RbacButton; label: string; hint?: string }[] = [
  { key: 'view', label: '查看', hint: '基础权限，勾选其他权限时自动勾选' },
  { key: 'create', label: '新增' },
  { key: 'edit', label: '编辑' },
  { key: 'delete', label: '删除' },
  { key: 'export', label: '导出' },
  { key: 'audit', label: '审批' },
];

export const DATA_SCOPES: { key: DataScope; label: string; desc: string }[] = [
  { key: 'all', label: '全部数据', desc: '可查看该模块下所有数据' },
  { key: 'dept', label: '本部门及以下', desc: '仅可查看本部门及下级部门的数据' },
  { key: 'self', label: '仅本人数据', desc: '仅可查看自己创建/负责的数据' },
];

export const RBAC_ROLES: { key: AppRole; label: string }[] = [
  { key: 'admin', label: '管理员' },
  { key: 'production', label: '生产主管' },
  { key: 'worker', label: '生产人员' },
  { key: 'quality', label: '质检员' },
  { key: 'warehouse', label: '仓库管理员' },
  { key: 'finance', label: '财务人员' },
  { key: 'sales', label: '销售' },
  { key: 'planner', label: '计划员' },
  { key: 'procurement', label: '采购员' },
  { key: 'outsourcing', label: '外协员' },
  { key: 'hr', label: '人事主管' },
  { key: 'maintenance', label: '设备管理员' },
];

export interface RbacMenu {
  key: string;
  label: string;
}

export interface RbacModule {
  key: string;
  label: string;
  path: string;
  menus: RbacMenu[];
}

/** 权限树：模块 → 菜单（叶子），key 与数据库 sys_role_menu_buttons.menu_key 一致 */
export const RBAC_MODULES: RbacModule[] = [
  { key: 'home', label: '首页工作台', path: '/', menus: [{ key: 'home', label: '首页工作台' }] },
  {
    key: 'products',
    label: '成品档案',
    path: '/products',
    menus: [
      { key: 'products-products', label: '成品档案' },
      { key: 'products-dictionary', label: '基础数据字典' },
    ],
  },
  { key: 'materials', label: '物料档案', path: '/materials', menus: [{ key: 'materials', label: '物料档案' }] },
  {
    key: 'marketing',
    label: '营销管理',
    path: '/marketing',
    menus: [
      { key: 'marketing-customers', label: '客户管理' },
      { key: 'marketing-orders', label: '销售订单' },
      { key: 'marketing-shipments', label: '发货管理' },
      { key: 'marketing-price', label: '价格政策' },
      { key: 'marketing-stats', label: '销售统计' },
    ],
  },
  {
    key: 'ecommerce',
    label: '电商业务',
    path: '/ecommerce',
    menus: [
      { key: 'ecommerce-purchase-tracking', label: '采购发货跟踪单' },
      { key: 'ecommerce-platform-auth', label: '平台授权管理' },
      { key: 'ecommerce-order-sync-log', label: '订单拉取日志' },
    ],
  },
  {
    key: 'quotation',
    label: '报价管理',
    path: '/quotation',
    menus: [
      { key: 'quotation-list', label: '报价列表' },
      { key: 'quotation-create', label: '新建报价' },
      { key: 'quotation-approval', label: '审批管理' },
      { key: 'quotation-history', label: '历史报价' },
    ],
  },
  {
    key: 'contract',
    label: '合同管理',
    path: '/contract',
    menus: [
      { key: 'contract-list', label: '合同台账' },
      { key: 'contract-create', label: '新建合同' },
      { key: 'contract-templates', label: '合同模板' },
      { key: 'contract-reminders', label: '合同提醒' },
    ],
  },
  {
    key: 'planning',
    label: '计划排程',
    path: '/planning',
    menus: [
      { key: 'planning-pool', label: '订单池' },
      { key: 'planning-mps', label: '主生产计划' },
      { key: 'planning-gantt', label: '工序排产' },
      { key: 'planning-mrp', label: '轻量化 MRP' },
      { key: 'planning-production-line', label: '产线管理' },
    ],
  },
  {
    key: 'process',
    label: '工艺管理',
    path: '/process',
    menus: [
      { key: 'process-processes', label: '工序库' },
      { key: 'process-routes', label: '工艺路线库' },
      { key: 'process-params', label: '工艺参数管理' },
      { key: 'process-versions', label: '工艺版本管理' },
      { key: 'process-knowledge', label: '工艺知识库' },
    ],
  },
  {
    key: 'production',
    label: '生产管理',
    path: '/production',
    menus: [
      { key: 'production-orders', label: '生产工单' },
      { key: 'production-operations', label: '工序任务' },
      { key: 'production-requisitions', label: '生产领料' },
      { key: 'production-progress', label: '进度跟踪' },
      { key: 'production-costs', label: '工单成本' },
      { key: 'production-reports', label: '报工管理' },
    ],
  },
  {
    key: 'outsourcing',
    label: '外协管理',
    path: '/outsourcing',
    menus: [
      { key: 'outsourcing-factory', label: '加工厂' },
      { key: 'outsourcing-shipment', label: '发料单' },
      { key: 'outsourcing-return', label: '回货单' },
    ],
  },
  {
    key: 'quality',
    label: '质量管理',
    path: '/quality',
    menus: [
      { key: 'quality-standards', label: '质检标准库' },
      { key: 'quality-incoming', label: '来料检验' },
      { key: 'quality-process', label: '过程巡检' },
      { key: 'quality-finished', label: '成品检验' },
      { key: 'quality-trace', label: '质量追溯' },
    ],
  },
  {
    key: 'equipment',
    label: '设备管理',
    path: '/equipment',
    menus: [
      { key: 'equipment-ledger', label: '设备台账' },
      { key: 'equipment-plan', label: '保养计划' },
      { key: 'equipment-maintain', label: '保养记录' },
      { key: 'equipment-repair', label: '维修记录' },
    ],
  },
  {
    key: 'safety',
    label: '安全生产',
    path: '/safety',
    menus: [
      { key: 'safety-dashboard', label: '安全看板' },
      { key: 'safety-hazard', label: '隐患排查' },
      { key: 'safety-accident', label: '事故上报' },
      { key: 'safety-training', label: '安全培训' },
      { key: 'safety-fire', label: '消防检查' },
      { key: 'safety-patrol', label: '巡检计划' },
      { key: 'safety-patrol-tasks', label: '巡检任务' },
    ],
  },
  {
    key: 'inventory',
    label: '库存管理',
    path: '/inventory',
    menus: [
      { key: 'inventory-product', label: '成品库存' },
      { key: 'inventory-material', label: '物料库存' },
      { key: 'inventory-location', label: '库位管理' },
      { key: 'inventory-finished_inbound', label: '成品入库' },
      { key: 'inventory-records', label: '出入库管理' },
      { key: 'inventory-check', label: '库存盘点' },
      { key: 'inventory-turnover', label: '周转分析' },
    ],
  },
  {
    key: 'purchase',
    label: '采购管理',
    path: '/purchase',
    menus: [
      { key: 'purchase-po', label: '采购订单' },
      { key: 'purchase-supplier', label: '供应商' },
      { key: 'purchase-arrival', label: '到货入库' },
      { key: 'purchase-material', label: '物料档案' },
    ],
  },
  {
    key: 'finance',
    label: '财务管理',
    path: '/finance',
    menus: [
      { key: 'finance-dashboard', label: '资金看板' },
      { key: 'finance-receivable', label: '应收账款' },
      { key: 'finance-payable', label: '应付款' },
      { key: 'finance-payment', label: '收付款' },
      { key: 'finance-tax-refund', label: '退税管理' },
      { key: 'finance-cost', label: '成本核算' },
      { key: 'finance-profit', label: '利润分析' },
      { key: 'finance-salary-detail', label: '报工薪资明细' },
    ],
  },
  {
    key: 'personnel',
    label: '人员管理',
    path: '/personnel',
    menus: [
      { key: 'personnel-employee', label: '员工档案' },
      { key: 'personnel-attendance', label: '考勤管理' },
      { key: 'personnel-leave', label: '请假管理' },
      { key: 'personnel-performance', label: '绩效考核' },
      { key: 'personnel-training', label: '培训记录' },
      { key: 'personnel-salary', label: '工资汇总' },
    ],
  },
  {
    key: 'after-sales',
    label: '售后服务',
    path: '/after-sales',
    menus: [
      { key: 'after-sales-tickets', label: '售后工单' },
      { key: 'after-sales-returns', label: '退换货管理' },
      { key: 'after-sales-reshipments', label: '补发管理' },
      { key: 'after-sales-cost', label: '售后成本' },
      { key: 'after-sales-feedback', label: '满意度回访' },
      { key: 'after-sales-stats', label: '统计分析' },
    ],
  },
  {
    key: 'reports',
    label: '报表中心',
    path: '/reports',
    menus: [
      { key: 'reports-sales', label: '销售报表' },
      { key: 'reports-production', label: '生产报表' },
      { key: 'reports-inventory', label: '库存报表' },
      { key: 'reports-quality', label: '质量报表' },
      { key: 'reports-finance', label: '财务报表' },
      { key: 'reports-personnel', label: '人员报表' },
    ],
  },
  {
    key: 'dashboard',
    label: '数据大屏',
    path: '/dashboard',
    menus: [
      { key: 'dashboard-overview', label: '总览大屏' },
      { key: 'dashboard-production', label: '生产大屏' },
      { key: 'dashboard-warehouse', label: '仓库大屏' },
      { key: 'dashboard-quality', label: '质量大屏' },
      { key: 'dashboard-sales', label: '销售大屏' },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    path: '/system',
    menus: [
      { key: 'system-basic', label: '基础设置' },
      { key: 'system-site', label: '站点配置' },
      { key: 'system-wechat-miniapp', label: '小程序配置' },
      { key: 'system-users', label: '用户管理' },
      { key: 'system-permissions', label: '权限配置' },
      { key: 'system-modules', label: '模块可见性' },
      { key: 'system-operation', label: '操作日志' },
      { key: 'system-login', label: '登录日志' },
    ],
  },
];

/** 全部菜单 key 平铺 */
export const ALL_MENU_KEYS = RBAC_MODULES.flatMap((m) => m.menus.map((x) => x.key));

/** 菜单 key → 所属模块 */
export const MENU_MODULE_MAP: Record<string, RbacModule> = {};
RBAC_MODULES.forEach((m) => m.menus.forEach((x) => { MENU_MODULE_MAP[x.key] = m; }));

// ============ 角色模板 ============

export interface RoleTemplate {
  key: string;
  label: string;
  desc: string;
  menus: string[];
  buttons: RbacButton[];
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: 'production',
    label: '生产主管模板',
    desc: '计划排程、工艺、生产、质量、设备、人员等生产全链路，含新增/编辑/删除/导出',
    menus: [
      'planning-pool', 'planning-mps', 'planning-gantt', 'planning-mrp', 'planning-production-line',
      'process-processes', 'process-routes', 'process-params', 'process-versions', 'process-knowledge',
      'production-orders', 'production-operations', 'production-requisitions', 'production-progress', 'production-costs', 'production-reports',
      'quality-standards', 'quality-incoming', 'quality-process', 'quality-finished', 'quality-trace',
      'equipment-ledger', 'equipment-plan', 'equipment-maintain', 'equipment-repair',
      'personnel-employee', 'personnel-attendance',
      'materials', 'inventory-material',
    ],
    buttons: ['view', 'create', 'edit', 'delete', 'export'] as RbacButton[],
  },
  {
    key: 'finance',
    label: '财务模板',
    desc: '财务管理、报表中心全功能，订单与报价只读',
    menus: [
      'finance-dashboard', 'finance-receivable', 'finance-payable', 'finance-payment', 'finance-tax-refund', 'finance-cost', 'finance-profit', 'finance-salary-detail',
      'reports-sales', 'reports-production', 'reports-inventory', 'reports-quality', 'reports-finance', 'reports-personnel',
      'marketing-orders', 'quotation-list',
    ],
    buttons: ['view', 'create', 'edit', 'export'] as RbacButton[],
  },
  {
    key: 'warehouse',
    label: '仓库模板',
    desc: '库存、采购、物料档案全功能',
    menus: [
      'inventory-product', 'inventory-material', 'inventory-location', 'inventory-finished_inbound', 'inventory-records', 'inventory-check', 'inventory-turnover',
      'purchase-po', 'purchase-supplier', 'purchase-arrival', 'purchase-material',
      'materials',
    ],
    buttons: ['view', 'create', 'edit', 'export'] as RbacButton[],
  },
  {
    key: 'sales',
    label: '销售模板',
    desc: '营销、报价、合同、售后全功能，销售报表只读',
    menus: [
      'marketing-customers', 'marketing-orders', 'marketing-shipments', 'marketing-price', 'marketing-stats',
      'quotation-list', 'quotation-create', 'quotation-approval', 'quotation-history',
      'contract-list', 'contract-create', 'contract-templates',
      'after-sales-tickets', 'after-sales-returns', 'after-sales-reshipments',
      'reports-sales',
    ],
    buttons: ['view', 'create', 'edit', 'export'] as RbacButton[],
  },
];

// ============ 权限状态结构 ============

export interface RbacRoleConfig {
  /** menuKey → 已授权按钮列表 */
  buttons: Record<string, RbacButton[]>;
  /** menuKey → 数据范围 */
  dataScope: Record<string, DataScope>;
}

export const EMPTY_RBAC_CONFIG: RbacRoleConfig = { buttons: {}, dataScope: {} };

/** 是否为已配置过权限的角色（未配置角色保持开放，避免锁死老账号） */
export function isRoleConfigured(perms: Record<string, RbacRoleConfig>, role: string): boolean {
  const cfg = perms[role];
  if (!cfg) return false;
  return Object.keys(cfg.buttons).length > 0 || Object.keys(cfg.dataScope).length > 0;
}

/** 是否拥有菜单查看权限 */
export function roleCanView(perms: Record<string, RbacRoleConfig>, role: string, menuKey: string): boolean {
  if (role === 'admin') return true;
  const cfg = perms[role];
  if (!cfg) return true;
  if (menuKey === 'home') return true;
  return (cfg.buttons[menuKey] || []).includes('view');
}

/** 是否拥有菜单下某按钮权限 */
export function roleCanButton(
  perms: Record<string, RbacRoleConfig>,
  role: string,
  menuKey: string,
  button: RbacButton,
): boolean {
  if (role === 'admin') return true;
  const cfg = perms[role];
  if (!cfg) return true;
  return (cfg.buttons[menuKey] || []).includes(button);
}

/** 获取菜单数据范围（默认 all） */
export function roleDataScope(perms: Record<string, RbacRoleConfig>, role: string, menuKey: string): DataScope {
  const cfg = perms[role];
  if (!cfg) return 'all';
  return cfg.dataScope[menuKey] || 'all';
}

// ============ 路由 → 菜单映射 ============

/** 路径对应候选菜单 key（用于路由守卫，任一有查看权限即放行） */
export function routeToMenuKeys(pathname: string): string[] {
  // 首页恒可见，不纳入 RBAC 拦截
  if (pathname === '/' || pathname === '') return [];
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'mobile') return [];
  const moduleKey = segments[0];
  const mod = RBAC_MODULES.find((m) => m.key === moduleKey);
  if (!mod) return [];
  // 精确匹配二段路径（如 /system/users → system-users）
  if (segments.length >= 2) {
    const exact = `${moduleKey}-${segments[1]}`;
    if (mod.menus.some((m) => m.key === exact)) return [exact, moduleKey];
  }
  // 模块级路径：该模块下任一菜单有权限即可见
  return [...mod.menus.map((m) => m.key), moduleKey];
}

// ============ 数据权限过滤 ============

/** 按数据范围过滤列表数据 */
export function filterByDataScope<T extends Record<string, unknown>>(
  items: T[],
  scope: DataScope,
  opts: { currentUsername?: string; currentFullName?: string },
): T[] {
  if (scope === 'all') return items;
  if (scope === 'self') {
    const names = [opts.currentUsername, opts.currentFullName].filter(Boolean) as string[];
    if (!names.length) return items;
    return items.filter((it) => {
      const owner = String(it.creator || it.created_by || it.owner || it.salesperson || '');
      return owner && names.includes(owner);
    });
  }
  // dept 范围：无部门字段体系时暂按创建者本人放宽为本部门可见，返回全部（保留配置）
  return items;
}

// ============ React Hooks ============

/** 按钮权限判断 hook：can(menuKey, 'create') */
export function useCanButton() {
  const role = useAppStore((s) => s.currentRole);
  const perms = useAppStore((s) => s.rbacPermissions);
  return useCallback(
    (menuKey: string, button: RbacButton) => roleCanButton(perms, role, menuKey, button),
    [perms, role],
  );
}

/** 菜单查看权限 hook */
export function useCanView() {
  const role = useAppStore((s) => s.currentRole);
  const perms = useAppStore((s) => s.rbacPermissions);
  return useCallback(
    (menuKey: string) => roleCanView(perms, role, menuKey),
    [perms, role],
  );
}

// ============ 数据库加载 / 保存 ============

/** 加载全部角色的 RBAC 配置与实体映射（登录后调用一次） */
export async function loadRbacConfig(): Promise<void> {
  try {
    const [rolesRes, buttonsRes, mapRes] = await Promise.all([
      supabase.from('sys_roles').select('role_key, data_scopes'),
      supabase.from('sys_role_menu_buttons').select('role_key, menu_key, button_key'),
      supabase.from('rbac_entity_menu_map').select('entity_type, menu_key'),
    ]);
    if (rolesRes.error || buttonsRes.error || mapRes.error) {
      console.warn('[rbac] 加载权限配置失败', rolesRes.error || buttonsRes.error || mapRes.error);
      return;
    }
    const perms: Record<string, RbacRoleConfig> = {};
    (rolesRes.data || []).forEach((r: { role_key: string; data_scopes: Record<string, string> | null }) => {
      perms[r.role_key] = {
        buttons: perms[r.role_key]?.buttons || {},
        dataScope: (r.data_scopes as Record<string, DataScope>) || {},
      };
    });
    (buttonsRes.data || []).forEach((b: { role_key: string; menu_key: string; button_key: RbacButton }) => {
      const cfg = (perms[b.role_key] ||= { buttons: {}, dataScope: {} });
      (cfg.buttons[b.menu_key] ||= []).push(b.button_key);
    });
    Object.values(perms).forEach((cfg) => {
      Object.keys(cfg.buttons).forEach((k) => {
        cfg.buttons[k] = Array.from(new Set(cfg.buttons[k]));
      });
    });
    const map: Record<string, string> = {};
    (mapRes.data || []).forEach((m: { entity_type: string; menu_key: string }) => {
      map[m.entity_type] = m.menu_key;
    });
    useAppStore.getState().setRbacPermissions(perms);
    useAppStore.getState().setRbacEntityMenuMap(map);
  } catch (err) {
    console.warn('[rbac] 加载权限配置异常', err);
  }
}

/** 保存单个角色的权限配置（管理员专用，写入 sys_roles 与 sys_role_menu_buttons） */
export async function saveRbacConfig(
  roleKey: string,
  roleName: string,
  config: RbacRoleConfig,
): Promise<boolean> {
  try {
    // 1. 覆盖式写入按钮权限：先删后插
    const del = await supabase.from('sys_role_menu_buttons').delete().eq('role_key', roleKey);
    if (del.error) throw del.error;

    const rows = Object.entries(config.buttons).flatMap(([menuKey, buttons]) =>
      buttons.map((buttonKey) => ({ role_key: roleKey, menu_key: menuKey, button_key: buttonKey })),
    );
    if (rows.length > 0) {
      const ins = await supabase.from('sys_role_menu_buttons').insert(rows);
      if (ins.error) throw ins.error;
    }

    // 2. 写入角色数据权限
    const up = await supabase
      .from('sys_roles')
      .upsert({ role_key: roleKey, role_name: roleName, data_scopes: config.dataScope, updated_at: new Date().toISOString() });
    if (up.error) throw up.error;

    await loadRbacConfig();
    return true;
  } catch (err) {
    console.error('[rbac] 保存权限配置失败', err);
    toast.error('保存失败，请稍后重试');
    return false;
  }
}

/** store 写操作前的前端权限校验（后端 RLS 为最终防线） */
export function checkWritePermission(entityType: string, action: 'create' | 'update' | 'delete'): boolean {
  const state = useAppStore.getState();
  const role = state.currentRole;
  if (!role || role === 'admin') return true;
  const cfg = state.rbacPermissions[role];
  if (!cfg) return true;
  const menuKey = state.rbacEntityMenuMap[entityType];
  if (!menuKey) return true;
  const button = action === 'update' ? 'edit' : action;
  const allowed = (cfg.buttons[menuKey] || []).includes(button);
  if (!allowed) {
    const mod = MENU_MODULE_MAP[menuKey];
    toast.error(`无权限：${mod ? mod.label : menuKey} 模块「${button === 'edit' ? '编辑' : button === 'create' ? '新增' : '删除'}」操作被拒绝`);
  }
  return allowed;
}

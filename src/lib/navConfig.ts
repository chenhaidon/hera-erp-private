import {
  Home,
  Package,
  ShoppingCart,
  Store,
  FileText,
  ScrollText,
  CalendarDays,
  Settings2,
  Factory,
  ShieldCheck,
  Wrench,
  HardHat,
  Warehouse,
  Truck,
  Handshake,
  Banknote,
  Users,
  BarChart3,
  Monitor,
  Headset,
  ShoppingCart as PurchaseIcon,
  Factory as ProcessingIcon,
  Users as SalaryIcon,
  LayoutDashboard,
} from 'lucide-react';
import type { AppRole } from '@/lib/permissions';

export interface NavSubItem {
  label: string;
  path: string;
  roles?: AppRole[];
  children?: NavSubItem[];
  icon?: React.ComponentType<{ className?: string }>;
}

export interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavSubItem[];
  roles?: AppRole[];
}

export const defaultNavItems: NavItem[] = [
  { label: '首页工作台', path: '/', icon: Home },
  { label: '成品档案', path: '/products', icon: Package },
  { label: '物料档案', path: '/materials', icon: Warehouse },
  { label: '营销管理', path: '/marketing', icon: ShoppingCart },
  { label: '报价管理', path: '/quotation', icon: FileText },
  { label: '合同管理', path: '/contract', icon: ScrollText },
  { label: '计划排程', path: '/planning', icon: CalendarDays },
  { label: '工艺管理', path: '/process', icon: Settings2 },
  { label: '生产管理', path: '/production', icon: Factory },
  { label: '外协管理', path: '/outsourcing', icon: Handshake },
  { label: '质量管理', path: '/quality', icon: ShieldCheck },
  { label: '设备管理', path: '/equipment', icon: Wrench },
  { label: '安全生产', path: '/safety', icon: HardHat },
  { label: '库存管理', path: '/inventory', icon: Warehouse },
  { label: '采购管理', path: '/purchase', icon: Truck },
  { label: '财务管理', path: '/finance', icon: Banknote },
  { label: '人员管理', path: '/personnel', icon: Users },
  { label: '售后服务', path: '/after-sales', icon: Headset },
  { label: '报表中心', path: '/reports', icon: BarChart3 },
  { label: '数据大屏', path: '/dashboard', icon: Monitor },
  { label: '系统管理', path: '/system', icon: Settings2, roles: ['admin'] },
];

export const defaultMenuItems: Record<string, NavSubItem[]> = {};

export interface TabItem {
  key: string;
  label: string;
}

export const defaultTabItems: Record<string, TabItem[]> = {
  '/after-sales': [
    { key: 'tickets', label: '售后工单' },
    { key: 'returns', label: '退换货管理' },
    { key: 'reshipments', label: '补发管理' },
    { key: 'cost', label: '售后成本' },
    { key: 'feedback', label: '满意度回访' },
    { key: 'stats', label: '统计分析' },
  ],
  '/contract': [
    { key: 'list', label: '合同台账' },
    { key: 'create', label: '新建合同' },
    { key: 'detail', label: '合同详情' },
    { key: 'templates', label: '合同模板' },
    { key: 'reminders', label: '合同提醒' },
  ],
  '/ecommerce': [
    { key: 'purchase-tracking', label: '采购发货跟踪单' },
    { key: 'platform-auth', label: '平台授权管理' },
    { key: 'order-sync-log', label: '订单拉取日志' },
  ],
  '/dashboard': [
    { key: 'overview', label: '总览大屏' },
    { key: 'production', label: '生产大屏' },
    { key: 'warehouse', label: '仓库大屏' },
    { key: 'quality', label: '质量大屏' },
    { key: 'sales', label: '销售大屏' },
  ],
  '/equipment': [
    { key: 'ledger', label: '设备台账' },
    { key: 'plan', label: '保养计划' },
    { key: 'maintain', label: '保养记录' },
    { key: 'repair', label: '维修记录' },
  ],
  '/finance': [
    { key: 'dashboard', label: '资金看板' },
    { key: 'receivable', label: '应收账款' },
    { key: 'payable', label: '应付款' },
    { key: 'payment', label: '收付款' },
    { key: 'tax-refund', label: '退税管理' },
    { key: 'cost', label: '成本核算' },
    { key: 'profit', label: '利润分析' },
    { key: 'salary-detail', label: '报工薪资明细' },
  ],
  '/finance/tax-refund': [
    { key: 'business', label: '退税业务' },
    { key: 'check', label: '单据完整度检查' },
    { key: 'declaration', label: '退税申报' },
    { key: 'filing', label: '单证备案' },
    { key: 'risk', label: '风险预警看板' },
  ],
  '/inventory': [
    { key: 'product', label: '成品库存' },
    { key: 'material', label: '物料库存' },
    { key: 'location', label: '库位管理' },
    { key: 'finished_inbound', label: '成品入库' },
    { key: 'records', label: '出入库管理' },
    { key: 'check', label: '库存盘点' },
    { key: 'turnover', label: '周转分析' },
  ],
  '/marketing': [
    { key: 'customers', label: '客户管理' },
    { key: 'orders', label: '销售订单' },
    { key: 'shipments', label: '发货管理' },
    { key: 'price', label: '价格政策' },
    { key: 'stats', label: '销售统计' },
  ],
  '/outsourcing': [
    { key: 'factory', label: '加工厂' },
    { key: 'shipment', label: '发料单' },
    { key: 'return', label: '回货单' },
  ],
  '/personnel': [
    { key: 'employee', label: '员工档案' },
    { key: 'attendance', label: '考勤管理' },
    { key: 'leave', label: '请假管理' },
    { key: 'performance', label: '绩效考核' },
    { key: 'training', label: '培训记录' },
    { key: 'salary', label: '工资汇总' },
  ],
  '/planning': [
    { key: 'pool', label: '订单池' },
    { key: 'mps', label: '主生产计划' },
    { key: 'gantt', label: '工序排产' },
    { key: 'mrp', label: '轻量化 MRP' },
    { key: 'production-line', label: '产线管理' },
  ],
  '/process': [
    { key: 'processes', label: '工序库' },
    { key: 'routes', label: '工艺路线库' },
    { key: 'params', label: '工艺参数管理' },
    { key: 'versions', label: '工艺版本管理' },
    { key: 'knowledge', label: '工艺知识库' },
  ],
  '/production': [
    { key: 'orders', label: '生产工单' },
    { key: 'operations', label: '工序任务' },
    { key: 'requisitions', label: '生产领料' },
    { key: 'progress', label: '进度跟踪' },
    { key: 'costs', label: '工单成本' },
    { key: 'reports', label: '报工管理' },
  ],
  '/purchase': [
    { key: 'po', label: '采购订单' },
    { key: 'supplier', label: '供应商' },
    { key: 'arrival', label: '到货入库' },
    { key: 'material', label: '物料档案' },
  ],
  '/quality': [
    { key: 'standards', label: '质检标准库' },
    { key: 'incoming', label: '来料检验' },
    { key: 'process', label: '过程巡检' },
    { key: 'finished', label: '成品检验' },
    { key: 'trace', label: '质量追溯' },
  ],
  '/quotation': [
    { key: 'list', label: '报价列表' },
    { key: 'create', label: '新建报价' },
    { key: 'approval', label: '审批管理' },
    { key: 'history', label: '历史报价' },
    { key: 'detail', label: '报价详情' },
  ],
  '/products': [
    { key: 'products', label: '成品档案' },
    { key: 'dictionary', label: '基础数据字典' },
  ],
  '/reports': [
    { key: 'sales', label: '销售报表' },
    { key: 'production', label: '生产报表' },
    { key: 'inventory', label: '库存报表' },
    { key: 'quality', label: '质量报表' },
    { key: 'finance', label: '财务报表' },
    { key: 'personnel', label: '人员报表' },
  ],
  '/safety': [
    { key: 'dashboard', label: '安全看板' },
    { key: 'hazard', label: '隐患排查' },
    { key: 'accident', label: '事故上报' },
    { key: 'training', label: '安全培训' },
    { key: 'fire', label: '消防检查' },
    { key: 'patrol', label: '巡检计划' },
    { key: 'patrol-tasks', label: '巡检任务' },
  ],
  '/system': [
    { key: 'basic', label: '基础设置' },
    { key: 'site', label: '站点配置' },
    { key: 'wechat-miniapp', label: '小程序配置' },
    { key: 'users', label: '用户管理' },
    { key: 'permissions', label: '权限配置' },
    { key: 'modules', label: '模块可见性' },
    { key: 'operation', label: '操作日志' },
    { key: 'login', label: '登录日志' },
  ],
};

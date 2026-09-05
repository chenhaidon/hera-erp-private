import React from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout } from '@/components/layouts/Layout';
import { LazyRetryWrapper } from '@/components/common/RetrySuspense';

// 核心高频业务页面：静态导入，避免沙箱动态加载失败，保证首屏稳定性
import { HomePage } from '@/pages/HomePage';
import { ProductsPage } from '@/pages/ProductsPage';
import { ProductDetailPage } from '@/pages/ProductDetailPage';
import { PlanningPage } from '@/pages/PlanningPage';
import { ProductionLinePage } from '@/pages/ProductionLinePage';
import { ProcessPage } from '@/pages/ProcessPage';
import { ProductionPage } from '@/pages/ProductionPage';
import { QualityPage } from '@/pages/QualityPage';
import { EquipmentPage } from '@/pages/EquipmentPage';
import { SafetyPage } from '@/pages/SafetyPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { PurchasePage } from '@/pages/PurchasePage';
import { FinancePage } from '@/pages/FinancePage';
import { PersonnelPage } from '@/pages/PersonnelPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MarketingPage } from '@/pages/MarketingPage';
import { QuotationPage } from '@/pages/QuotationPage';
import { ContractPage } from '@/pages/ContractPage';
import { AfterSalesPage } from '@/pages/AfterSalesPage';
import { MaterialsPage } from '@/pages/MaterialsPage';
import { MaterialDetailPage } from '@/pages/MaterialDetailPage';
import { MobileWarehouseLocationPage } from '@/pages/MobileWarehouseLocationPage';

const EcommercePage = () => import('@/pages/EcommercePage').then((m) => ({ default: m.default }));
const MobileWarehousePage = () => import('@/pages/MobileWarehousePage').then((m) => ({ default: m.default }));

const MobileHomePage = () => import('@/pages/MobileHomePage').then((m) => ({ default: m.default }));
const MobileScanPage = () => import('@/pages/MobileScanPage').then((m) => ({ default: m.default }));
const MobileScanRoute = () => import('@/pages/MobileScanRoute').then((m) => ({ default: m.default }));
const MobileScanReportPage = () => import('@/pages/MobileScanReportPage').then((m) => ({ default: m.default }));
const MobileScanInspectPage = () => import('@/pages/MobileScanInspectPage').then((m) => ({ default: m.default }));
const MobileScanOutsourcingPage = () => import('@/pages/MobileScanOutsourcingPage').then((m) => ({ default: m.default }));
const MobileScanAdminPage = () => import('@/pages/MobileScanAdminPage').then((m) => ({ default: m.default }));
const MobileEquipmentPage = () => import('@/pages/MobileEquipmentPage').then((m) => ({ default: m.default }));

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

// 低频次/公开页面：保留动态导入，减少主包体积
const SystemPage = () => import('@/pages/SystemPage').then((m) => ({ default: m.SystemPage }));
const UserManagePage = () => import('@/pages/UserManagePage').then((m) => ({ default: m.UserManagePage }));
const OperationLogPage = () => import('@/pages/OperationLogPage').then((m) => ({ default: m.OperationLogPage }));
const LoginLogPage = () => import('@/pages/LoginLogPage').then((m) => ({ default: m.LoginLogPage }));
const ModuleVisibilityPage = () => import('@/pages/ModuleVisibilityPage').then((m) => ({ default: m.ModuleVisibilityPage }));
const PermissionConfigPage = () => import('@/pages/PermissionConfigPage').then((m) => ({ default: m.PermissionConfigPage }));
const SiteSettingsPage = () => import('@/pages/SiteSettingsPage').then((m) => ({ default: m.SiteSettingsPage }));
const WechatMiniProgramSettingsPage = () => import('@/pages/WechatMiniProgramSettingsPage').then((m) => ({ default: m.WechatMiniProgramSettingsPage }));
const LoginPage = () => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage }));
const MobileLoginPage = () => import('@/pages/MobileLoginPage').then((m) => ({ default: m.default }));
const RegisterPage = () => import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage }));
const OutsourcingPage = () => import('@/pages/OutsourcingPage').then((m) => ({ default: m.OutsourcingPage }));

// 带错误边界和自动重试的懒加载包装器
const lazy = (factory: () => Promise<{ default: React.ComponentType }>) => {
  return <LazyRetryWrapper factory={factory} />;
};

export const routes: RouteConfig[] = [
  {
    name: '移动端库位查询',
    path: '/mobile/warehouse/location',
    element: <MobileWarehouseLocationPage />,
  },
  {
    name: '移动端出入库工作台',
    path: '/mobile/warehouse',
    element: lazy(MobileWarehousePage),
  },
  {
    name: '移动端首页',
    path: '/mobile/home',
    element: lazy(MobileHomePage),
  },
  {
    name: '移动端扫码工作台',
    path: '/mobile/scan',
    element: lazy(MobileScanPage),
  },
  {
    name: '移动端扫码分流',
    path: '/mobile/scan/route',
    element: lazy(MobileScanRoute),
  },
  {
    name: '移动端极简报工',
    path: '/mobile/scan/report',
    element: lazy(MobileScanReportPage),
  },
  {
    name: '移动端质检录入',
    path: '/mobile/scan/inspect',
    element: lazy(MobileScanInspectPage),
  },
  {
    name: '移动端外协发起',
    path: '/mobile/scan/outsourcing',
    element: lazy(MobileScanOutsourcingPage),
  },
  {
    name: '移动端多角色测试台',
    path: '/mobile/scan/admin',
    element: lazy(MobileScanAdminPage),
  },
  {
    name: '移动端设备详情',
    path: '/mobile/equipment',
    element: lazy(MobileEquipmentPage),
  },
  {
    name: 'Layout',
    path: '/',
    element: <Layout />,
    public: true,
  },
  { name: '登录', path: '/login', element: lazy(LoginPage), public: true },
  { name: '移动端登录', path: '/mobile/login', element: lazy(MobileLoginPage), public: true },
  { name: '注册', path: '/register', element: lazy(RegisterPage), public: true },
];

export const childRoutes: RouteConfig[] = [
  { name: '首页工作台', path: '/', element: <HomePage /> },
  { name: '成品档案', path: '/products', element: <ProductsPage /> },
  { name: '产品详情', path: '/products/:id', element: <ProductDetailPage />, visible: false },
  { name: '基础数据字典', path: '/products/dictionary', element: <Navigate to="/products?tab=dictionary" replace />, visible: false },
  { name: '物料档案', path: '/materials', element: <MaterialsPage /> },
  { name: '物料详情', path: '/materials/:id', element: <MaterialDetailPage />, visible: false },
  { name: '营销管理', path: '/marketing', element: <MarketingPage /> },
  { name: '电商业务', path: '/ecommerce', element: lazy(EcommercePage) },
  { name: '智能报价管理', path: '/quotation', element: <QuotationPage /> },
  { name: '合同管理', path: '/contract', element: <ContractPage /> },
  { name: '计划排程', path: '/planning', element: <PlanningPage /> },
  { name: '产线管理', path: '/planning/production-line', element: <ProductionLinePage />, visible: false },
  { name: '工艺管理', path: '/process', element: <ProcessPage /> },
  { name: '生产管理', path: '/production', element: <ProductionPage /> },
  { name: '外协管理', path: '/outsourcing', element: lazy(OutsourcingPage) },
  { name: '质量管理', path: '/quality', element: <QualityPage /> },
  { name: '设备管理', path: '/equipment', element: <EquipmentPage /> },
  { name: '安全生产', path: '/safety', element: <SafetyPage /> },
  { name: '库存管理', path: '/inventory', element: <InventoryPage /> },
  { name: '采购管理', path: '/purchase', element: <PurchasePage /> },
  { name: '财务管理', path: '/finance', element: <FinancePage /> },
  { name: '人员管理', path: '/personnel', element: <PersonnelPage /> },
  { name: '售后服务', path: '/after-sales', element: <AfterSalesPage /> },
  { name: '报表中心', path: '/reports', element: <ReportsPage /> },
  { name: '数据大屏', path: '/dashboard', element: <DashboardPage /> },
  { name: '系统管理', path: '/system', element: lazy(SystemPage) },
  { name: '站点配置', path: '/system/site', element: lazy(SiteSettingsPage) },
  { name: '小程序配置', path: '/system/wechat-miniapp', element: lazy(WechatMiniProgramSettingsPage) },
  { name: '用户管理', path: '/system/users', element: lazy(UserManagePage) },
  { name: '操作日志', path: '/system/operation-logs', element: lazy(OperationLogPage) },
  { name: '登录日志', path: '/system/login-logs', element: lazy(LoginLogPage) },
  { name: '权限配置', path: '/system/permissions', element: lazy(PermissionConfigPage) },
  { name: '模块可见性', path: '/system/modules', element: lazy(ModuleVisibilityPage) },
];

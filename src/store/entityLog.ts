// Store 层统一操作日志拦截：为各业务实体的 add/update/delete 自动记录操作日志
import type { EntityConfig } from './dbActions';

/** 实体类型 → 操作日志展示信息（模块名 + 目标标签字段） */
interface EntityLogMeta {
  module: string;
  /** 从实体对象中提取目标展示文本的字段名列表，取首个非空值 */
  labelFields: string[];
}

const ENTITY_LOG_META: Record<string, EntityLogMeta> = {
  products: { module: '产品管理', labelFields: ['name', 'code'] },
  product_categories: { module: '产品管理', labelFields: ['name', 'code'] },
  fabric_types: { module: '产品管理', labelFields: ['name', 'code'] },
  filling_types: { module: '产品管理', labelFields: ['name', 'code'] },
  customers: { module: '客户管理', labelFields: ['name', 'company_name', 'code'] },
  sales_orders: { module: '订单管理', labelFields: ['order_no', 'customer_name', 'code'] },
  quotes: { module: '报价管理', labelFields: ['quote_no', 'customer_name', 'code'] },
  contracts: { module: '合同管理', labelFields: ['contract_no', 'customer_name', 'code'] },
  contract_templates: { module: '合同管理', labelFields: ['name', 'code'] },
  shipments: { module: '订单管理', labelFields: ['shipment_no', 'order_no', 'code'] },
  sales_outbounds: { module: '订单管理', labelFields: ['outbound_no', 'order_no', 'code'] },
  follow_ups: { module: '客户管理', labelFields: ['customer_name', 'content', 'code'] },
  price_lists: { module: '报价管理', labelFields: ['name', 'code'] },
  customer_discounts: { module: '客户管理', labelFields: ['customer_name', 'code'] },
  exchange_rates: { module: '报价管理', labelFields: ['currency', 'code'] },
  production_plans: { module: '生产管理', labelFields: ['plan_no', 'product_name', 'code'] },
  work_orders: { module: '生产管理', labelFields: ['work_order_no', 'product_name', 'code'] },
  work_order_costs: { module: '生产管理', labelFields: ['work_order_no', 'code'] },
  production_lines: { module: '计划排程', labelFields: ['name', 'code'] },
  production_line_equipments: { module: '计划排程', labelFields: ['line_name', 'equipment_name', 'code'] },
  production_exceptions: { module: '生产管理', labelFields: ['title', 'work_order_no', 'code'] },
  processes: { module: '工艺管理', labelFields: ['name', 'code'] },
  process_routes: { module: '工艺管理', labelFields: ['name', 'code'] },
  process_param_templates: { module: '工艺管理', labelFields: ['name', 'code'] },
  process_versions: { module: '工艺管理', labelFields: ['name', 'code'] },
  process_knowledge: { module: '工艺管理', labelFields: ['title', 'code'] },
  quality_standards: { module: '质量管理', labelFields: ['name', 'code'] },
  process_inspection_standards: { module: '质量管理', labelFields: ['name', 'code'] },
  quality_inspections: { module: '质量管理', labelFields: ['inspection_no', 'code'] },
  material_inspections: { module: '质量管理', labelFields: ['inspection_no', 'code'] },
  process_inspections: { module: '质量管理', labelFields: ['inspection_no', 'code'] },
  finished_inspections: { module: '质量管理', labelFields: ['inspection_no', 'code'] },
  equipment: { module: '设备管理', labelFields: ['name', 'code'] },
  maintenance_plans: { module: '设备管理', labelFields: ['name', 'code'] },
  equipment_records: { module: '设备管理', labelFields: ['name', 'code'] },
  safety_records: { module: '安全管理', labelFields: ['title', 'code'] },
  materials: { module: '物料管理', labelFields: ['code', 'name'] },
  inventory: { module: '库存管理', labelFields: ['material_code', 'material_name', 'code'] },
  warehouse_locations: { module: '库存管理', labelFields: ['code', 'name'] },
  stock_records: { module: '库存管理', labelFields: ['record_no', 'code'] },
  finished_goods_inbounds: { module: '库存管理', labelFields: ['inbound_no', 'code'] },
  suppliers: { module: '采购管理', labelFields: ['name', 'code'] },
  purchase_requests: { module: '采购管理', labelFields: ['request_no', 'code'] },
  purchase_orders: { module: '采购管理', labelFields: ['order_no', 'code'] },
  purchase_arrivals: { module: '采购管理', labelFields: ['arrival_no', 'code'] },
  purchase_returns: { module: '采购管理', labelFields: ['return_no', 'code'] },
  material_requisitions: { module: '采购管理', labelFields: ['requisition_no', 'code'] },
  payment_records: { module: '财务管理', labelFields: ['record_no', 'code'] },
  finance_records: { module: '财务管理', labelFields: ['record_no', 'code'] },
  employees: { module: '人事管理', labelFields: ['name', 'code'] },
  system_users: { module: '系统管理', labelFields: ['name', 'account'] },
  attendance_records: { module: '人事管理', labelFields: ['employee_name', 'code'] },
  leave_records: { module: '人事管理', labelFields: ['employee_name', 'code'] },
  performance_records: { module: '人事管理', labelFields: ['employee_name', 'code'] },
  performance_grade_config: { module: '人事管理', labelFields: ['name', 'code'] },
  training_records: { module: '人事管理', labelFields: ['employee_name', 'code'] },
  evaluation_items: { module: '人事管理', labelFields: ['name', 'code'] },
  inventory_turnovers: { module: '库存管理', labelFields: ['name', 'code'] },
  safety_patrol_plans: { module: '安全管理', labelFields: ['name', 'code'] },
  safety_patrol_tasks: { module: '安全管理', labelFields: ['name', 'code'] },
  alert_notifications: { module: '系统管理', labelFields: ['title', 'code'] },
  after_sales_tickets: { module: '售后管理', labelFields: ['ticket_no', 'customer_name', 'code'] },
  after_sales_returns: { module: '售后管理', labelFields: ['return_no', 'code'] },
  after_sales_reshipments: { module: '售后管理', labelFields: ['reshipment_no', 'code'] },
  material_supplier_prices: { module: '物料管理', labelFields: ['material_name', 'supplier_name', 'code'] },
  ecommerce_purchase_tracking: { module: '电商管理', labelFields: ['order_no', 'code'] },
  outsourcing_dispatches: { module: '外协管理', labelFields: ['dispatch_no', 'code'] },
  outsourcing_return_qcs: { module: '外协管理', labelFields: ['qc_no', 'code'] },
  outsource_processing_payments: { module: '外协管理', labelFields: ['payment_no', 'code'] },
  outsource_factories: { module: '外协管理', labelFields: ['name', 'code'] },
  outsource_shipments: { module: '外协管理', labelFields: ['shipment_no', 'code'] },
  outsource_returns: { module: '外协管理', labelFields: ['return_no', 'code'] },
};

/** 从实体对象中提取展示标签 */
function pickLabel(item: Record<string, unknown>, meta: EntityLogMeta): string {
  for (const f of meta.labelFields) {
    const v = item?.[f];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return String(item?.id ?? '');
}

export type LogAction = 'create' | 'update' | 'delete';

/** 判断该实体类型是否需要记录操作日志 */
export function hasEntityLogMeta(entityType: string): boolean {
  return !!ENTITY_LOG_META[entityType];
}

/** 获取实体日志元信息 */
export function getEntityLogMeta(entityType: string): EntityLogMeta | undefined {
  return ENTITY_LOG_META[entityType];
}

/** 生成操作日志记录所需的展示信息 */
export function buildEntityLogInfo(
  entityType: string,
  action: LogAction,
  item: Record<string, unknown>,
): { module: string; target: string; targetType: string; targetId: string } | null {
  const meta = ENTITY_LOG_META[entityType];
  if (!meta) return null;
  const id = String(item?.id ?? '');
  return {
    module: meta.module,
    target: pickLabel(item, meta),
    targetType: entityType,
    targetId: id,
  };
}

/** 需要排除日志记录的实体类型（日志类自身、登录日志等） */
export const LOG_EXCLUDED_TYPES = new Set(['operation_logs', 'login_logs']);

export type { EntityConfig };
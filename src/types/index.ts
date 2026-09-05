export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

export interface ProductSku {
  id: string;
  /** SKU编码（自动生成） */
  sku_code?: string;
  /** 规格描述 */
  specification: string;
  /** 尺寸 */
  size: string;
  /** 花色 */
  pattern: string;
  /** 颜色 */
  color: string;
  /** 填充克重（g） */
  filling_weight: number;
  /** 花型 */
  quilt_pattern: string;
  /** 绗缝工艺 */
  quilt_process: string;
  /** 重量（g） */
  weight: number;
  barcode: string;
  suggested_price: number;
  /** 币种，默认 CNY */
  currency?: string;
  /** 单位 */
  unit?: string;
  /** SKU状态 */
  status?: "active" | "inactive";
  stock?: number;
}

export interface ProductBom {
  id: string;
  sku_id: string;
  sku_specification: string;
  material_id: string;
  material_code: string;
  material_name: string;
  category: string;
  specification: string;
  dosage: number;
  /** 损耗率（百分比，如 5 表示 5%） */
  loss_rate?: number;
  unit: string;
  /** 部件（如包边、压条、面-中心块） */
  component?: string;
  /** 门幅（如 2.6m） */
  fabric_width?: string;
  /** 裁剪规格（如 0.045×12m，直开） */
  cutting_specification?: string;
  /** 来源工艺单 */
  source_process_order?: string;
  /** 工艺备注 */
  process_remark?: string;
  /** 备注 */
  remark?: string;
}

export interface ProductPricingStrategy {
  markup_rate: number;
  target_profit_rate: number;
  min_price: number;
  suggested_price: number;
  /** 成本价 */
  cost_price?: number;
  /** 备注 */
  remark?: string;
}

export interface ProductRouteBinding {
  route_id: string;
  route_name: string;
  route_code: string;
  version_id: string;
  version_code: string;
}

export interface ProductProcessStep {
  id: string;
  process_id: string;
  code: string;
  name: string;
  seq: number;
  hours: number;
  device: string;
  skill: string;
  price: number;
  /** 计件单价 */
  piece_price?: number;
  category?: 'internal' | 'outsourcing';
  outsourcing_price?: number;
  optional?: boolean;
  is_bottleneck?: boolean;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  /** 规格型号 */
  specification?: string;
  /** 计量单位 */
  unit?: string;
  /** 产品描述 */
  description?: string;
  /** 设计图纸文件 URL（兼容旧数据） */
  design_drawing?: string;
  /** 产品图纸文件 URL 列表 */
  drawings?: string[];
  images: string[];
  process_list: string[];
  /** 该成品专属的克隆/手动工艺工序清单，与工艺路线库相互独立 */
  process_steps?: ProductProcessStep[];
  status: 'active' | 'inactive';
  skus: ProductSku[];
  boms: ProductBom[];
  pricing_strategy: ProductPricingStrategy;
  route_binding?: ProductRouteBinding;
  /** 单位包装成本（元/件） */
  packaging_cost_per_unit?: number;
  /** 单位物流成本（元/件） */
  logistics_cost_per_unit?: number;
  /** 单位其他费用（元/件） */
  other_cost_per_unit?: number;
  created_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  phone: string;
  address: string;
  email: string;
  country: string;
  customer_type: string;
}

export interface SalesOrderItem {
  product_id?: string;
  sku_id?: string;
  product_code: string;
  product_name: string;
  sku_summary?: string;
  /** 导入时保留的原始规格文本 */
  specification?: string;
  /** 颜色 */
  color?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  image?: string;
}

export interface OrderLog {
  status: string;
  operator: string;
  time: string;
  remark: string;
}

export interface SalesOrder {
  id: string;
  order_no: string;
  order_type: '外贸' | '电商' | 'B2B';
  channel: string;
  customer_id: string;
  customer_name: string;
  currency: string;
  trade_term: string;
  destination: string;
  delivery_date: string;
  /** 交货期限（如 45天） */
  delivery_term?: string;
  total_amount: number;
  status: string;
  created_at?: string;
  payment_date?: string;
  invoice_no?: string;
  invoice_date?: string;
  invoice_file?: string;
  /** 关联合同编号 */
  contract_no?: string;
  /** 关联合同ID */
  contract_id?: string;
  items: SalesOrderItem[];
  logs: OrderLog[];
  shipped_quantity?: number;
  delivery_progress?: { shipped: number; total: number };
}

export interface ShipmentItem {
  product_id: string;
  sku_id?: string;
  product_code: string;
  product_name: string;
  sku_summary?: string;
  /** 导入时保留的原始规格文本 */
  specification?: string;
  /** 颜色 */
  color?: string;
  quantity: number;
  ordered_quantity?: number;
  shipped_quantity?: number;
  image?: string;
}

export interface ShipmentBox {
  id: string;
  box_no: string;
  product_code: string;
  product_name: string;
  quantity: number;
  gross_weight: number;
  net_weight: number;
  volume: string;
}

export interface Shipment {
  id: string;
  shipment_no: string;
  order_id: string;
  order_no: string;
  /** 关联合同编号 */
  contract_no?: string;
  customer_id: string;
  customer_name: string;
  shipment_date: string;
  logistics_company: string;
  tracking_no: string;
  status: 'pending' | 'shipped' | 'transit' | 'signed';
  items: ShipmentItem[];
  boxes?: ShipmentBox[];
  remark?: string;
  created_at?: string;
  creator?: string;
}

export interface SalesOutbound {
  id: string;
  outbound_no: string;
  shipment_id: string;
  shipment_no: string;
  order_id: string;
  order_no: string;
  customer_id: string;
  customer_name: string;
  product_id?: string;
  sku_id?: string;
  product_code: string;
  product_name: string;
  sku_summary?: string;
  quantity: number;
  warehouse: string;
  outbound_date: string;
  handler: string;
  created_at?: string;
}

export interface FollowUp {
  id: string;
  customer_id: string;
  time: string;
  operator: string;
  content: string;
  next_time: string;
}

export interface PriceList {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  price: number;
  effective_date: string;
  expiry_date: string;
}

export interface CustomerDiscount {
  id: string;
  level: string;
  discount: number;
}

export interface ExchangeRate {
  id: string;
  currency: string;
  rate: number;
  effective_date: string;
}

export interface ProductionLine {
  id: string;
  name: string;
  workshop: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionLineEquipment {
  id: string;
  production_line_id: string;
  equipment_id: string;
  created_at: string;
}

export * from './material';
export * from './quotation';
export * from './contract';
export type { MaterialSupplierPrice, MaterialInventoryInfo } from './material';

export interface ProductCategory {
  id: string;
  name: string;
  parent_id?: string;
  sort: number;
  status: 'active' | 'inactive';
}

export interface FabricType {
  id: string;
  name: string;
  composition: string;
  weight: string;
  width: string;
  status: 'active' | 'inactive';
}

export interface FillingType {
  id: string;
  name: string;
  composition: string;
  weight: string;
  resilience: string;
  status: 'active' | 'inactive';
}

export interface ProductionPlanOrder {
  order_id: string;
  order_no: string;
  customer_name: string;
  quantity: number;
}

export interface ProductionPlanSkuItem {
  sku_id: string;
  sku_summary?: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit?: string;
  source_order_ids: string[];
  source_order_nos: string[];
}

export interface ProductionPlanOperation {
  seq: number;
  code: string;
  name: string;
  hours: number;
  device: string;
  skill: string;
  load_rate: number;
  category?: 'internal' | 'outsourcing';
}

export interface ProductionPlan {
  id: string;
  plan_no: string;
  cycle: 'week' | 'day';
  contract_no?: string;
  contract_id?: string;
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  pattern?: string;
  route_id: string;
  route_name: string;
  version_id: string;
  version_code: string;
  plan_quantity: number;
  start_date: string;
  end_date: string;
  standard_hours: number;
  workers: number;
  devices: number;
  work_hours: number;
  load_rate: number;
  status: 'draft' | 'pending' | 'approved' | 'published' | 'executing' | 'completed';
  operations: ProductionPlanOperation[];
  orders: ProductionPlanOrder[];
  sku_items?: ProductionPlanSkuItem[];
  approver?: string;
  approved_at?: string;
  production_line?: string;
  approval_note?: string;
  creator: string;
  created_at: string;
  work_orders: string[];
}

export interface MRPRequirement {
  material_id: string;
  material_code: string;
  material_name: string;
  category: string;
  specification: string;
  unit: string;
  required_qty: number;
  required_date: string;
  stock_qty: number;
  in_transit_qty: number;
  available_qty: number;
  net_requirement: number;
  suggested_purchase_qty: number;
  safety_stock: number;
  gap_qty: number;
  status: 'normal' | 'shortage' | 'warning';
  unit_price: number;
  amount: number;
}

export interface OperationReportRecord {
  id: string;
  operator_id?: string;
  operator_name: string;
  qty: number;
  unit_price: number;
  amount: number;
  report_time: string;
  work_no?: string;
  operation_name: string;
  operation_code: string;
  color?: string;
  spec?: string;
}

export interface WorkOrderOperation {
  name: string;
  code: string;
  seq: number;
  plan_qty: number;
  completed_qty: number;
  status: 'pending' | 'pending_start' | 'running' | 'qc' | 'completed' | 'closed';
  completed: boolean;
  is_bottleneck?: boolean;
  device?: string;
  skill?: string;
  device_code?: string;
  process_id?: string;
  category?: 'internal' | 'outsourcing';
  outsourcing_price?: number;
  outsourcing_status?: 'pending' | 'dispatched' | 'returning' | 'returned' | 'received';
  outsourcing_supplier?: string;
  params?: Record<string, string>;
  reports?: OperationReportRecord[];
  pqc_inspection_id?: string;
  dispatch_id?: string;
  return_qc_id?: string;
}

export interface WorkOrder {
  id: string;
  work_no: string;
  plan_id: string;
  contract_no?: string;
  product_id: string;
  product_code: string;
  product_name: string;
  product_category: string;
  product_images: string[];
  sku_id?: string;
  sku_summary?: string;
  /** 颜色（来自销售订单/合同） */
  color?: string;
  plan_quantity: number;
  completed_quantity: number;
  progress: number;
  status: 'pending' | 'issued' | 'producing' | 'paused' | 'qc' | 'pending_inbound' | 'inbound' | 'completed' | 'closed';
  picking_status: 'pending' | 'picked' | 'not_required';
  source: 'plan' | 'manual';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  start_date?: string;
  end_date?: string;
  remark?: string;
  created_at: string;
  issued_at?: string;
  completed_at?: string;
  operations: WorkOrderOperation[];
}

export interface WorkOrderCost {
  work_id: string;
  fabric: number;
  lining: number;
  filling: number;
  accessory: number;
  labor: number;
  overhead: number;
  planned: number;
}

export interface ProductionException {
  id: string;
  code: string;
  work_id: string;
  work_no: string;
  operation_name: string;
  type: '设备故障' | '物料缺料' | '质量问题' | '工艺问题';
  description: string;
  submitter: string;
  created_at: string;
  status: 'pending' | 'processing' | 'resolved';
  device_id?: string;
  device?: string;
  person_id?: string;
  person?: string;
  handler_id?: string;
  handler?: string;
  handled_at?: string;
  solution?: string;
  result?: string;
}

export interface ProcessItem {
  id: string;
  code: string;
  name: string;
  price: number;
  outsourcing_price?: number;
  /** 计件单价 */
  piece_price?: number;
  standard_minutes: number;
  category: 'internal' | 'outsourcing';
  device?: string;
  skill?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ProcessStep {
  seq: number;
  name: string;
  code: string;
  price: number;
  /** 计件单价 */
  piece_price?: number;
  hours: number;
  device: string;
  skill: string;
  optional?: boolean;
  is_bottleneck?: boolean;
  process_id?: string;
  category?: 'internal' | 'outsourcing';
  outsourcing_price?: number;
  quilt_params?: {
    needle_density?: string;
    pattern?: string;
  };
}

export interface ProcessRoute {
  id: string;
  code: string;
  name: string;
  category: string;
  steps: ProcessStep[];
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ProcessParamItem {
  name: string;
  standard: number;
  upper: number;
  lower: number;
  unit: string;
}

export interface ProcessParamTemplate {
  id: string;
  code: string;
  name: string;
  process_name: string;
  params: ProcessParamItem[];
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ProcessVersion {
  id: string;
  code: string;
  product_id: string;
  product_code: string;
  product_name: string;
  route_id: string;
  route_name: string;
  effective_date: string;
  expiry_date: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ProcessEfficiency {
  process_name: string;
  standard_hours: number;
  actual_hours: number;
  completed_qty: number;
  rate: number;
  period: string;
}

export interface ProcessKnowledge {
  id: string;
  code: string;
  title: string;
  process_name: string;
  device: string;
  tags: string[];
  problem: string;
  solution: string;
  effect: string;
  creator: string;
  created_at: string;
  updated_at: string;
}

export interface QualityInspection {
  id: string;
  inspection_no: string;
  type: 'incoming' | 'process' | 'finished';
  work_order_id: string;
  material_id: string;
  product_id: string;
  result: 'qualified' | 'unqualified' | 'pending';
  qualified_qty: number;
  unqualified_qty: number;
  defect_reason: string;
  details: Record<string, string>;
}

export interface QualityStandardItem {
  name: string;
  standard: number;
  upper: number;
  lower: number;
  unit: string;
  category: 'chemical' | 'physical' | 'appearance';
}

export interface QualityStandard {
  id: string;
  code: string;
  name: string;
  category: string;
  status: 'active' | 'inactive';
  items: QualityStandardItem[];
}

export interface QualityInspectionItem {
  name: string;
  standard: number;
  upper: number;
  lower: number;
  unit: string;
  category?: 'chemical' | 'physical' | 'appearance';
  actual?: number;
  result: 'qualified' | 'unqualified' | 'pending';
}

export interface MaterialInspection {
  id: string;
  code: string;
  material_id: string;
  material_name: string;
  /** 颜色 */
  color?: string;
  category: string;
  supplier_id?: string;
  supplier: string;
  purchase_order_id?: string;
  purchase_order_no?: string;
  arrival_id?: string;
  arrival_code?: string;
  /** 关联合同编号 */
  contract_no?: string;
  batch: string;
  arrival_qty: number;
  check_qty: number;
  qualified_qty: number;
  unqualified_qty: number;
  result: 'qualified' | 'unqualified' | 'partial';
  status: 'pending' | 'inspected';
  inspector: string;
  created_at: string;
  items: QualityInspectionItem[];
  defect_reason?: string;
}

export interface ProcessInspectionStandard {
  id: string;
  code: string;
  process_id: string;
  process_name: string;
  process_code?: string;
  status: 'active' | 'inactive';
  items: QualityInspectionItem[];
  created_at: string;
  updated_at: string;
}

export interface ProcessInspection {
  id: string;
  code: string;
  work_id: string;
  work_no: string;
  operation_name: string;
  operation_code?: string;
  /** 颜色 */
  color?: string;
  /** 关联合同编号 */
  contract_no?: string;
  result: 'qualified' | 'unqualified' | 'partial' | 'pending';
  status: 'pending' | 'inspected';
  inspector: string;
  created_at: string;
  items: QualityInspectionItem[];
  defect_reason?: string;
}

export interface FinishedInspection {
  id: string;
  code: string;
  work_id: string;
  work_no: string;
  product_id: string;
  product_code: string;
  product_name: string;
  /** 颜色 */
  color?: string;
  batch: string;
  check_qty: number;
  qualified_qty: number;
  unqualified_qty: number;
  result?: 'qualified' | 'unqualified';
  status: 'pending' | 'inspected';
  inspector: string;
  created_at: string;
  /** 关联合同编号 */
  contract_no?: string;
  items: QualityInspectionItem[];
  defect_reason?: string;
}

export interface OutsourcingDispatch {
  id: string;
  code: string;
  work_id: string;
  work_no: string;
  product_id: string;
  product_code: string;
  product_name: string;
  operation_code: string;
  operation_name: string;
  supplier: string;
  qty: number;
  price: number;
  dispatch_date: string;
  return_qty: number;
  return_date?: string;
  status: 'pending' | 'dispatched' | 'returned' | 'completed';
  qc_result?: 'qualified' | 'unqualified';
}

export interface OutsourcingReturnQC {
  id: string;
  code: string;
  dispatch_id: string;
  work_id: string;
  work_no: string;
  product_code: string;
  product_name: string;
  operation_code: string;
  operation_name: string;
  supplier: string;
  return_qty: number;
  qc_qty: number;
  qualified_qty: number;
  unqualified_qty: number;
  result: 'qualified' | 'unqualified';
  inspector: string;
  qc_date: string;
  status: 'pending' | 'inspected';
  defect_reason?: string;
}

export interface OutsourceFactory {
  id: string;
  factory_name: string;
  contact_phone: string;
  processing_capability: string;
  status: 'enabled' | 'disabled';
  created_at?: string;
  updated_at?: string;
}

export interface OutsourceShipmentItem {
  id: string;
  shipment_id: string;
  material_code: string;
  material_name: string;
  quantity: number;
  unit: string;
}

export interface OutsourceShipment {
  id: string;
  shipment_no: string;
  contract_no?: string;
  work_order_id: string;
  work_order_no?: string;
  operation_code?: string;
  operation_name?: string;
  product_code: string;
  product_name: string;
  factory_id: string;
  factory_name?: string;
  shipment_date: string;
  shipment_quantity: number;
  logistics_company?: string;
  logistics_no?: string;
  status: 'pending' | 'shipped' | 'returning' | 'returned';
  items: OutsourceShipmentItem[];
  created_at?: string;
  updated_at?: string;
}

export interface OutsourceReturnItem {
  id: string;
  return_id: string;
  material_code: string;
  material_name: string;
  quantity: number;
  unit: string;
}

export interface OutsourceReturn {
  id: string;
  return_no: string;
  shipment_id: string;
  shipment_no?: string;
  contract_no?: string;
  work_order_id: string;
  work_order_no?: string;
  operation_code?: string;
  operation_name?: string;
  product_code: string;
  product_name: string;
  factory_id: string;
  factory_name?: string;
  return_date: string;
  return_type: 'semi_finished' | 'finished';
  return_quantity: number;
  qualified_quantity: number;
  defective_quantity: number;
  inspection_status: 'pending' | 'inspecting' | 'qualified' | 'partial' | 'unqualified';
  status: 'pending' | 'returned' | 'stored';
  inspector?: string;
  defect_reason?: string;
  items: OutsourceReturnItem[];
  created_at?: string;
  updated_at?: string;
}

export interface OutsourceProcessingPayment {
  id: string;
  payment_no: string;
  work_order_id: string;
  work_order_no?: string;
  operation_code?: string;
  operation_name?: string;
  product_code: string;
  product_name: string;
  product_spec?: string;
  product_color?: string;
  factory_id: string;
  factory_name?: string;
  quantity: number;
  unit_price: number;
  amount: number;
  status: 'pending' | 'confirmed' | 'paid';
  payment_date?: string;
  payment_amount?: number;
  payment_method?: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
  /** 关联合同编号 */
  contract_no?: string;
  /** 关联合同ID */
  contract_id?: string;
}

export interface MaintenancePlan {
  id: string;
  code: string;
  equipment_id: string;
  equipment_name: string;
  period_type: 'hours' | 'calendar';
  period: number;
  last_date?: string;
  next_date: string;
  content: string;
  status: 'normal' | 'upcoming' | 'overdue';
  /** 保养备注：具体保养步骤、注意事项等 */
  remarks?: string;
}

export type EquipmentStatus = 'idle' | 'using' | 'maintenance';

export interface Equipment {
  id: string;
  code: string;
  name: string;
  model: string;
  purchase_date: string;
  status: EquipmentStatus;
  workshop: string;
  category: string;
  running_hours: number;
  /** 设备备注：用途、保养注意事项等说明 */
  remarks?: string;
}

export interface EquipmentRecord {
  id: string;
  equipment_id: string;
  type: 'maintenance' | 'repair';
  record_date: string;
  description: string;
  duration: number;
  loss_output: number;
  maintainer_id?: string;
  maintainer: string;
  // 维修处理信息（新增故障后，再执行维修时填写）
  repair_status?: 'pending' | 'in_progress' | 'completed'; // 待维修/维修中/已完成
  repair_date?: string;        // 维修完成日期
  repair_technician?: string;  // 维修技术员
  repair_cost?: number;        // 维修费用
  repair_detail?: string;      // 维修内容详细描述
}

export interface SafetyRecord {
  id: string;
  type: 'hazard' | 'accident' | 'training' | 'fire';
  record_date: string;
  area?: string;
  description?: string;
  rectification_status?: string;
  completion_date?: string;
  topic?: string;
  participants?: string[];
  loss?: string;
  outcome?: string;
  responsible_person_id?: string;
  responsible_person?: string;
  /** 隐患排查操作日志 */
  operation_logs?: SafetyOperationLog[];
}

/** 安全记录操作日志条目 */
export interface SafetyOperationLog {
  id: string;
  time: string;
  action: string;
  operator?: string;
}

export interface Material {
  id: string;
  code: string;
  name: string;
  category: string;
  specification: string;
  unit: string;
  default_supplier: string;
  color: string;
  pattern_code: string;
  composition: string;
  weight: number;
  resilience_level: string;
  safety_stock: number;
  stock: number;
  status: string;
  /** 门幅 */
  width?: string;
  /** 布号 */
  fabric_no?: string;
  /** 单件尺寸 */
  piece_size?: string;
  /** 备注 */
  remark?: string;
}

export type WarehouseType = 'raw_material' | 'finished_goods';

export interface WarehouseLocation {
  id: string;
  code: string;
  warehouse: string;
  type: string;
  /** 仓库分类：raw_material=物料仓，finished_goods=成品仓 */
  warehouse_type: WarehouseType;
  capacity: number;
  status: 'active' | 'inactive';
  /** 库存内容描述，如：成品、面料、填充物、辅料、包材 */
  contents?: string;
  created_at?: string;
  zone?: string;
  row?: string;
  layer?: string;
}

export interface Inventory {
  id: string;
  product_id?: string;
  material_id?: string;
  sku_id?: string;
  type: 'product' | 'material';
  color?: string;
  specification?: string;
  quantity: number;
  min_stock: number;
  max_stock: number;
  warehouse: string;
  location_id?: string;
}

export interface StockRecord {
  id: string;
  record_no: string;
  type: 'in' | 'out' | 'take';
  subtype: string;
  product_id?: string;
  sku_id?: string;
  product_code?: string;
  product_name?: string;
  material_id?: string;
  quantity: number;
  warehouse: string;
  location_id?: string;
  related_order: string;
  related_order_id?: string;
  contract_no?: string;
  handler: string;
  record_date: string;
  remark?: string;
  actual_qty?: number;
  profit_loss?: number;
}

export interface FinishedGoodsInbound {
  id: string;
  inbound_no: string;
  work_id: string;
  work_no: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  warehouse?: string;
  location_id?: string;
  inbound_date?: string;
  status: 'pending' | 'inbound';
  created_at: string;
  created_by?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  address: string;
  supplier_type?: '常规供应商' | '电商渠道';
  status: string;
  qualification_files: string[];
}

export interface EcommercePurchaseTracking {
  id: string;
  supplier_id?: string;
  supplier_name?: string;
  product_id?: string;
  product_name: string;
  product_specification?: string;
  product_image_url?: string;
  order_quantity: number;
  cutting_quantity: number;
  production_quantity: number;
  shipment_quantity: number;
  return_quantity: number;
  platform_merchant_name: string;
  platform_order_no?: string;
  platform_code?: string;
  platform_name?: string;
  order_status?: string;
  buyer_nickname?: string;
  record_date: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export type EcommercePlatformCode = 'taobao' | 'pinduoduo' | 'douyin';

export type EcommerceAuthStatus = 'unauthorized' | 'authorized' | 'expired';

export interface EcommercePlatformAuth {
  id: string;
  platform_code: EcommercePlatformCode;
  platform_name: string;
  shop_name: string;
  app_key?: string;
  app_secret?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  auth_status: EcommerceAuthStatus;
  authorized_at?: string;
  created_at?: string;
  updated_at?: string;
  last_synced_at?: string;
  total_synced_orders: number;
}

export interface EcommerceOrderSyncLog {
  id: string;
  auth_id?: string;
  platform_code?: string;
  platform_name?: string;
  shop_name?: string;
  sync_status: 'success' | 'failed';
  synced_orders: number;
  new_orders: number;
  updated_orders: number;
  failed_reason?: string;
  execution_time_ms?: number;
  request_params?: Record<string, any>;
  response_data?: Record<string, any>;
  created_at?: string;
}

export interface EcommerceApiRateLimit {
  id: string;
  auth_id: string;
  platform_code: string;
  call_date: string;
  call_count: number;
  daily_limit: number;
  updated_at?: string;
}

export interface EcommerceAlertLog {
  id: string;
  auth_id?: string;
  platform_code?: string;
  shop_name?: string;
  alert_type: 'sync_failed' | 'token_expired' | 'rate_limited' | 'token_refresh_failed';
  alert_reason?: string;
  alert_status: 'pending' | 'resolved';
  created_at?: string;
  resolved_at?: string;
}

export interface PurchaseRequestItem {
  material_id?: string;
  material_code: string;
  material_name: string;
  specification: string;
  quantity: number;
  unit: string;
  required_date: string;
  reason?: string;
}

export interface PurchaseRequest {
  id: string;
  code: string;
  applicant: string;
  department: string;
  created_at: string;
  required_date: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'partial' | 'completed' | 'converted';
  items: PurchaseRequestItem[];
  related_order?: string;
  /** 来源：如 MRP 生成的计划编号、手工创建等 */
  source?: string;
  /** 关联主生产计划ID */
  related_plan_id?: string;
  /** 关联主生产计划编号 */
  related_plan_no?: string;
}

export interface MaterialRequisitionItem {
  material_id: string;
  material_code: string;
  material_name: string;
  specification: string;
  unit: string;
  required_qty: number;
  issued_qty?: number;
  /** 本次出库建议/选定的仓库 */
  warehouse?: string;
  /** 本次出库建议/选定的库位 */
  location_id?: string;
  /** 颜色 */
  color?: string;
}

export interface MaterialRequisition {
  id: string;
  code: string;
  applicant: string;
  department: string;
  created_at: string;
  required_date: string;
  status: 'draft' | 'pending' | 'approved' | 'issued' | 'partial' | 'completed';
  items: MaterialRequisitionItem[];
  related_plan_no?: string;
  related_work_order_no?: string;
  /** 累计已出库数量（单据级汇总） */
  total_issued_qty?: number;
  /** 出库类型 */
  issue_type?: string;
}

export interface PurchaseOrderItem {
  material_id?: string;
  material_code: string;
  material_name: string;
  color?: string;
  specification: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  arrival_qty?: number;
  received_qty?: number;
  qualified_qty?: number;
  rejected_qty?: number;
  /** 已入库数量（支持分批入库） */
  stored_qty?: number;
  /** 入库仓库（按行选择） */
  warehouse?: string;
  /** 入库库位（按行选择） */
  location_id?: string;
}

export interface PurchaseOrder {
  id: string;
  order_no: string;
  supplier_id: string;
  supplier_name: string;
  request_id?: string;
  request_code?: string;
  total_amount: number;
  currency: string;
  status: 'draft' | 'pending' | 'approved' | 'partial' | 'received' | 'completed';
  payment_status: 'unpaid' | 'partial' | 'paid';
  /** 下达采购日期 */
  issued_date: string;
  created_at: string;
  items: PurchaseOrderItem[];
  /** 关联合同编号 */
  contract_no?: string;
  /** 关联合同ID */
  contract_id?: string;
  /** 备注 */
  remark?: string;
}

export interface PurchaseArrival {
  id: string;
  code: string;
  order_id: string;
  order_no: string;
  supplier_name: string;
  arrival_date: string;
  inspector: string;
  contract_no?: string;
  status: 'pending' | 'inspected' | 'qualified' | 'rejected' | 'partial' | 'stored' | 'returned';
  items: PurchaseOrderItem[];
  related_order?: string;
  warehouse?: string;
  location_id?: string;
  inspection_files?: string[];
  inspection_remark?: string;
}

export interface PurchaseReturn {
  id: string;
  code: string;
  arrival_id: string;
  order_id: string;
  order_no: string;
  supplier_name: string;
  return_date: string;
  reason: string;
  items: PurchaseOrderItem[];
  status: 'pending' | 'completed';
}

export interface PaymentRecord {
  id: string;
  code: string;
  type: 'pay' | 'receive';
  order_id?: string;
  order_no?: string;
  /** 关联合同编号 */
  contract_no?: string;
  /** 关联合同ID */
  contract_id?: string;
  counterparty: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string;
  status: 'pending' | 'completed';
}

export interface FinanceRecord {
  id: string;
  type: '应收' | '应付' | 'cost' | 'salary';
  counterparty: string;
  currency: string;
  amount: number;
  paid_amount: number;
  work_order_id?: string;
  employee_id?: string;
  customer_id?: string;
  supplier_id?: string;
  related_order_id?: string;
  /** 关联合同编号 */
  contract_no?: string;
  month?: string;
  cost_breakdown?: Record<string, number>;
  related_order?: string;
  record_date?: string;
  status?: 'unsettled' | 'partial' | 'settled';
}

/** 工人工资单（内部计件或月薪） */
export interface SalaryRecord {
  id: string;
  salary_no: string;
  employee_id: string;
  employee_name: string;
  month: string;
  amount: number;
  status: 'confirmed' | 'pending' | 'paid';
  payment_date?: string;
  payment_method?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollDetail {
  /** 分组键：月份|来源|工人姓名|货号|颜色|规格|工序 */
  id: string;
  month: string;
  /** 工序来源：内部 / 外协 */
  process_source: 'internal' | 'outsourcing';
  employee_name: string;
  product_code: string;
  color: string;
  specification: string;
  operation_name: string;
  quantity: number;
  unit_price: number;
  /** 应发金额 = 数量 × 单价 */
  amount: number;
  /** 预支款 */
  advance_payment: number;
  /** 修补费 */
  repair_fee: number;
  /** 剪线头 */
  thread_cutting: number;
  /** 扣废被 */
  waste_deduction: number;
  /** 买材料 */
  material_purchase: number;
  /** 应扣合计 */
  total_deduction: number;
  /** 工资金额 = 应发金额 - 应扣合计 */
  salary_amount: number;
  remark: string;
  is_locked: boolean;
  updated_at: string;
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  department?: string;
  position?: string;
  skill_level: string;
  skill_tags: string[];
  hire_date: string;
  phone: string;
  status?: 'active' | 'inactive';
  id_card?: string;
  emergency_contact?: string;
}

export interface SystemUser {
  id: string;
  name: string;
  account: string;
  /** 主要角色（兼容单角色场景） */
  role: string;
  /** 多角色列表 */
  roles?: string[];
  status: 'active' | 'inactive';
  last_login: string;
  employee_id?: string;
  employee_name?: string;
  /** 登录密码，默认 123456 */
  password?: string;
}

export interface OperationLog {
  id: string;
  /** 操作时间（ISO 8601） */
  time: string;
  /** 操作人账号 */
  operator: string;
  /** 操作人姓名 */
  operator_name?: string;
  /** 操作人角色 */
  role?: string;
  /** 操作类型：create / update / delete / login / logout / export / approve / reject / print / other */
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'approve' | 'reject' | 'print' | 'other';
  /** 操作类型中文标签 */
  action_label: string;
  /** 业务模块 */
  module: string;
  /** 操作对象/业务对象，如工单号、订单号等 */
  target: string;
  /** 对象类型 */
  target_type?: string;
  /** 操作对象ID */
  target_id?: string;
  /** 操作结果：success / fail */
  result: 'success' | 'fail';
  /** 操作结果说明 */
  result_message?: string;
  /** 操作IP */
  ip?: string;
  /** 操作设备/浏览器 */
  device?: string;
  /** 操作详情（JSON 字符串或描述） */
  detail?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LoginLog {
  id: string;
  /** 登录时间（ISO 8601） */
  time: string;
  /** 登录账号 */
  account: string;
  /** 用户姓名 */
  user_name?: string;
  /** 登录状态：success / failed / locked / expired / logout */
  status: 'success' | 'failed' | 'locked' | 'expired' | 'logout';
  /** 登录IP */
  ip: string;
  /** 登录设备/浏览器 */
  device: string;
  /** 失败原因/备注 */
  reason?: string;
  /** 是否异常登录 */
  is_abnormal?: boolean;
  /** 异常原因 */
  abnormal_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  record_date: string;
  check_in?: string;
  check_out?: string;
  status: 'normal' | 'late' | 'early' | 'absent' | 'leave';
}

export interface LeaveRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  leave_type: 'annual' | 'sick' | 'personal' | 'other';
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface PerformanceRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  period: string;
  productivity_score: number;
  quality_score: number;
  attendance_score: number;
  safety_score: number;
  total_score: number;
  level: 'A' | 'B' | 'C' | 'D';
  evaluator: string;
  comment?: string;
}

/** 绩效等级评估配置：定义每个等级对应的综合分区间 */
export interface PerformanceGradeConfig {
  id: string;
  grade_name: 'A' | 'B' | 'C' | 'D';
  score_min: number;
  score_max: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingRecord {
  id: string;
  title: string;
  type: 'skill' | 'safety' | 'quality' | 'management';
  trainer: string;
  training_date: string;
  participants: string[];
  participant_ids?: string[];
  duration: number;
  status: 'planned' | 'completed';
  notes?: string;
}

export interface EvaluationItem {
  id: string;
  scene: string;
  level: number;
  status: string;
  evidence_files: string[];
}

export interface InventoryTurnover {
  id: string;
  item_id: string;
  item_type: 'product' | 'material';
  item_name: string;
  item_code: string;
  period: string;
  beginning_qty: number;
  incoming_qty: number;
  outgoing_qty: number;
  ending_qty: number;
  turnover_rate: number;
  days: number;
  status: 'normal' | 'slow' | 'dead';
}

export interface SafetyPatrolPlan {
  id: string;
  code: string;
  name: string;
  area: string;
  cycle: 'daily' | 'weekly' | 'monthly';
  check_items: string[];
  responsible_person: string;
  status: 'active' | 'paused';
  next_patrol_date: string;
}

export interface SafetyPatrolTask {
  id: string;
  code: string;
  plan_id: string;
  plan_name: string;
  area: string;
  check_items: string[];
  scheduled_date: string;
  responsible_person: string;
  status: 'pending' | 'processing' | 'completed';
  result?: string;
  findings?: string;
  remarks?: string;
  completed_at?: string;
}

export interface AlertNotification {
  id: string;
  type: 'inventory_low' | 'inventory_dead' | 'patrol_overdue' | 'safety_hazard';
  title: string;
  content: string;
  target_id?: string;
  status: 'unread' | 'read' | 'resolved';
  created_at: string;
}

export type AfterSalesIssueType = 'quality' | 'logistics' | 'size' | 'damage' | 'other';
export type AfterSalesStatus = 'pending' | 'analyzing' | 'processing' | 'awaiting_feedback' | 'resolved' | 'closed';
export type AfterSalesLiability = 'quality' | 'logistics' | 'production' | 'warehouse' | 'pending';
export type AfterSalesSolution = 'return' | 'exchange' | 'reship' | 'reship_parts' | 'refund_only' | 'other';

export interface AfterSalesRecord {
  id: string;
  handler: string;
  handled_at: string;
  content: string;
  status: AfterSalesStatus;
}

export interface AfterSalesFeedback {
  id: string;
  submitted_at: string;
  content: string;
  rating: number; // 1-5
  nps: number; // 0-10
}

export interface AfterSalesTicket {
  id: string;
  ticket_no: string;
  order_id: string;
  order_no: string;
  customer_name: string;
  contact_name?: string;
  contact_phone?: string;
  product_id?: string;
  product_code?: string;
  product_name?: string;
  issue_type: AfterSalesIssueType;
  issue_desc: string;
  attachments: string[];
  status: AfterSalesStatus;
  records: AfterSalesRecord[];
  feedback?: AfterSalesFeedback;
  // 闭环字段
  cause_analysis?: string;
  liability?: AfterSalesLiability;
  liability_basis?: string;
  solution?: AfterSalesSolution;
  solution_desc?: string;
  related_work_order_no?: string;
  related_material_batch?: string;
  related_device_code?: string;
  refund_amount?: number;
  reship_cost?: number;
  freight_bearer?: 'customer' | 'company';
  freight_amount?: number;
  total_cost?: number;
  created_at: string;
  updated_at: string;
}

export type AfterSalesReturnStatus = 'pending' | 'approved' | 'awaiting_inbound' | 'inbounded' | 'awaiting_ship' | 'shipped' | 'completed';

export interface AfterSalesReturn {
  id: string;
  return_no: string;
  ticket_id: string;
  ticket_no: string;
  customer_name: string;
  product_code?: string;
  product_name?: string;
  type: 'return' | 'exchange';
  quantity: number;
  reason: string;
  return_address?: string;
  logistics_company?: string;
  tracking_no?: string;
  inbound_time?: string;
  exchange_product_name?: string;
  ship_address?: string;
  ship_time?: string;
  status: AfterSalesReturnStatus;
  created_at: string;
  updated_at: string;
}

export type AfterSalesReshipmentStatus = 'pending' | 'approved' | 'awaiting_ship' | 'shipped' | 'completed';

export interface AfterSalesReshipment {
  id: string;
  reship_no: string;
  ticket_id: string;
  ticket_no: string;
  customer_name: string;
  product_code?: string;
  product_name?: string;
  type: 'reship' | 'reship_parts';
  quantity: number;
  reason: string;
  ship_address?: string;
  logistics_company?: string;
  tracking_no?: string;
  ship_time?: string;
  status: AfterSalesReshipmentStatus;
  created_at: string;
  updated_at: string;
}

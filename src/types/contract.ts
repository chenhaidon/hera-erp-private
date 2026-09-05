export type ContractStatus =
  | 'draft'
  | 'pending'
  | 'effective'
  | 'executing'
  | 'completed'
  | 'terminated';

export type ContractType = 'domestic' | 'export' | 'processing';
export type ContractCustomerLevel = 'normal' | 'vip' | 'strategic';

export interface ContractItem {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  specification: string;
  /** 颜色 */
  color?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  remark?: string;
}

export interface ContractClause {
  type: string;
  content: string;
  sort_order: number;
}

export type ContractApprovalResult = 'approved' | 'rejected' | 'revision';

export interface ContractApprovalLog {
  id: string;
  approver: string;
  node: string;
  result: ContractApprovalResult;
  opinion: string;
  created_at: string;
}

export type PerformanceNodeType =
  | 'production'
  | 'quality'
  | 'shipment'
  | 'invoice'
  | 'payment';

export interface ContractPerformanceNode {
  id: string;
  node_type: PerformanceNodeType;
  status: string;
  scheduled_date?: string;
  actual_date?: string;
  amount?: number;
  operator?: string;
  operated_at?: string;
  remark?: string;
}

export interface ContractVersionLog {
  id: string;
  version: string;
  reason: string;
  diff: Record<string, unknown>;
  operator: string;
  created_at: string;
}

export interface ContractAttachment {
  id: string;
  file_name: string;
  file_url: string;
  uploader: string;
  uploaded_at: string;
}

/** 生产工艺单行（货号+尺寸+颜色数量） */
export interface ContractCraftSheetRow {
  id: string;
  /** 货号 */
  product_code: string;
  /** 图片 URL */
  image?: string;
  /** 尺寸规格 */
  size: string;
  /** 颜色及数量（key: 颜色名） */
  color_quantities: Record<string, number>;
  /** 该行合计数量 */
  total_quantity: number;
}

/** 生产工艺单 */
export interface ContractCraftSheet {
  id: string;
  /** 序号 */
  seq_no: string;
  /** 工艺单标题/备注 */
  title?: string;
  /** 客户合同号 */
  customer_contract_no?: string;
  /** 完成日期 */
  finish_date?: string;
  /** 颜色列定义（如 ['米色','橄榄绿','复古蓝']） */
  colors: string[];
  /** 行数据 */
  rows: ContractCraftSheetRow[];
  /** 工艺要求 */
  process_requirements: string;
  /** 合计数量 */
  total_quantity: number;
}

export interface ContractReminder {
  id: string;
  contract_id: string;
  reminder_type: string;
  content: string;
  trigger_date: string;
  status: 'unsent' | 'sent';
  receiver: string;
  created_at: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  contract_type: ContractType;
  customer_level: ContractCustomerLevel;
  clauses: ContractClause[];
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface Contract {
  id: string;
  contract_no: string;
  /** 原合同编号 */
  original_contract_no?: string;
  title: string;
  customer_id?: string;
  customer_name: string;
  contact_name: string;
  contact_phone: string;
  customer_address: string;
  contract_type: ContractType;
  customer_level: ContractCustomerLevel;
  quotation_id?: string;
  quotation_no?: string;
  sales_order_id?: string;
  sales_order_no?: string;
  amount: number;
  currency: string;
  sign_date?: string;
  effective_date?: string;
  delivery_date?: string;
  actual_delivery_date?: string;
  /** 交货期限（如 45天） */
  delivery_term?: string;
  payment_terms: string;
  status: ContractStatus;
  sign_method?: string;
  sign_date_record?: string;
  signer?: string;
  signed_file_url?: string;
  remark: string;
  version: string;
  parent_contract_id?: string;
  items: ContractItem[];
  clauses: ContractClause[];
  approval_logs: ContractApprovalLog[];
  performance_nodes: ContractPerformanceNode[];
  version_logs: ContractVersionLog[];
  attachments: ContractAttachment[];
  /** 关联生产工艺单 */
  craft_sheets?: ContractCraftSheet[];
  reminders: ContractReminder[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContractFormData {
  title: string;
  customer_id?: string;
  customer_name: string;
  contact_name: string;
  contact_phone: string;
  customer_address: string;
  contract_type: ContractType;
  customer_level: ContractCustomerLevel;
  quotation_id?: string;
  quotation_no?: string;
  currency: string;
  sign_date?: string;
  effective_date?: string;
  delivery_date?: string;
  payment_terms: string;
  status: ContractStatus;
  remark: string;
  items: ContractItem[];
  clauses: ContractClause[];
}

export interface OverdueHint {
  type: 'delivery' | 'payment' | 'contract_expiry';
  content: string;
  days: number;
}

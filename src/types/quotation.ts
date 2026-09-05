export type QuotationStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'converted' | 'expired';

export interface QuotationCostItem {
  subject: 'fabric' | 'accessory' | 'processing' | 'packaging' | 'other';
  subject_name: string;
  auto_value: number;
  manual_value: number | null;
  final_value: number;
  is_manual: boolean;
  adjusted_by: string;
  adjusted_at: string;
}

/** 主辅料行（分区 A） */
export interface QuotationMaterialRow {
  id: string;
  name: string;
  unit: string;
  size: string;
  width: string;
  dosage: number;
  unit_price: number;
  amount: number;
  remark: string;
  source_bom_id?: string;
  category?: string;
}

/** 加工费用行（分区 B） */
export interface QuotationProcessRow {
  id: string;
  name: string;
  unit_price: number;
  dosage: number;
  amount: number;
  category: 'internal' | 'outsourcing';
  source_process_id?: string;
}

/** 包装与其它行（分区 C） */
export interface QuotationPackagingRow {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  amount: number;
}

export interface QuotationCostDetails {
  materials: QuotationMaterialRow[];
  processes: QuotationProcessRow[];
  packaging: QuotationPackagingRow[];
}

export interface QuotationItem {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  product_spec?: string;
  sku_id: string;
  sku_specification: string;
  sku?: string;
  sku_code?: string;
  barcode?: string;
  spec?: string;
  specification?: string;
  amount?: number;
  color?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface QuotationApprovalLog {
  approver: string;
  result: 'approved' | 'rejected';
  opinion: string;
  time: string;
}

export interface QuotationVersionLog {
  version: number;
  operator: string;
  time: string;
  snapshot: Quotation;
}

export interface Quotation {
  id: string;
  quotation_no: string;
  customer_id: string;
  customer_name: string;
  currency: string;
  product_id: string;
  product_code: string;
  product_name: string;
  product_spec?: string;
  /** 报价日期 */
  quotation_date?: string;
  sku_id?: string;
  sku_specification?: string;
  quantity: number;
  estimated_delivery_date?: string;
  delivery_days?: number;
  target_profit_rate: number;
  fabric_loss_rate: number;
  batch_factor: number;
  remark: string;
  status: QuotationStatus;
  contract_no?: string;
  sales_order_no?: string;
  cost_items: QuotationCostItem[];
  /** 新版纸质报价单对齐的成本明细 */
  cost_details?: QuotationCostDetails;
  total_cost: number;
  suggested_price: number;
  estimated_profit: number;
  actual_profit_rate: number;
  creator: string;
  created_at: string;
  updated_at: string;
  expiry_date?: string;
  approval_logs: QuotationApprovalLog[];
  version_logs: QuotationVersionLog[];
  items: QuotationItem[];
}

export interface QuotationFormData {
  customer_id: string;
  customer_name: string;
  currency: string;
  product_id: string;
  quantity: number;
  estimated_delivery_date?: string;
  delivery_days?: number;
  target_profit_rate: number;
  fabric_loss_rate: number;
  batch_factor: number;
  remark: string;
}

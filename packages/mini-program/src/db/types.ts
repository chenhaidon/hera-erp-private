export type UserRole = 'admin' | 'production' | 'quality' | 'warehouse' | 'finance' | 'sales';

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: string | null;
  openid: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  work_no: string;
  plan_id: string | null;
  product_id: string | null;
  product_code: string | null;
  product_name: string | null;
  product_images: string[] | null;
  plan_quantity: number;
  completed_quantity: number;
  progress: number;
  status: string;
  priority: string | null;
  operations: WorkOrderOperation[] | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderOperation {
  name: string;
  completed: boolean;
  completed_qty?: number;
  is_bottleneck?: boolean;
}

export interface QualityInspection {
  id: string;
  inspection_no: string;
  type: string;
  work_order_id: string | null;
  material_id: string | null;
  product_id: string | null;
  result: string | null;
  details: Record<string, any> | null;
  qualified_qty: number | null;
  unqualified_qty: number | null;
  defect_reason: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  product_id: string | null;
  material_id: string | null;
  type: string | null;
  quantity: number;
  min_stock: number | null;
  max_stock: number | null;
  warehouse: string | null;
  created_at: string;
}

export interface SalesOrder {
  id: string;
  order_no: string;
  customer_id: string | null;
  customer_name: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  amount: number | null;
  status: string;
  order_date: string | null;
  delivery_date: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  order_no: string;
  supplier_id: string | null;
  supplier_name: string | null;
  total_amount: number | null;
  status: string;
  expected_date: string | null;
  items: any[] | null;
  created_at: string;
}

export interface ApprovalTask {
  id: string;
  task_no: string;
  module: string;
  target_id: string;
  target_no: string;
  title: string;
  submitter_id: string;
  submitter_name: string | null;
  status: string;
  result: string | null;
  remark: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  department: string | null;
  position: string | null;
  status: string | null;
}

export type WorkOrderStatus =
  | "pending_scheduling"
  | "pending"
  | "issued"
  | "producing"
  | "in_production"
  | "pending_qc"
  | "pending_inbound"
  | "inbound"
  | "closed";

export interface WorkOrder {
  id: string;
  work_no: string;
  product_code: string;
  product_name: string;
  plan_quantity: number;
  completed_quantity: number;
  progress: number;
  material_status?: "pending" | "picked" | "not_required";
  status: WorkOrderStatus;
  plan_no?: string;
  source?: string;
  created_at?: string;
}

export type InspectionType = "incoming" | "process" | "finished";
export type InspectionStatus = "pending" | "passed" | "failed";

export interface QualityInspection {
  id: string;
  inspection_no: string;
  type: InspectionType;
  target_name: string;
  status: InspectionStatus;
  created_at?: string;
}

export type SalesOrderStatus =
  | "pending_confirm"
  | "confirmed"
  | "in_production"
  | "pending_shipment"
  | "shipped"
  | "completed"
  | "cancelled";

export interface SalesOrder {
  id: string;
  order_no: string;
  customer_name: string;
  product_code: string;
  product_name: string;
  quantity: number;
  amount: number;
  order_date: string;
  delivery_date: string;
  status: SalesOrderStatus;
}

export type PurchaseOrderStatus =
  | "pending_confirm"
  | "confirmed"
  | "pending_arrival"
  | "arrived"
  | "inbound";

export interface PurchaseOrder {
  id: string;
  order_no: string;
  supplier_name: string;
  material_name: string;
  quantity: number;
  amount: number;
  order_date: string;
  arrival_date: string;
  status: PurchaseOrderStatus;
}

export type ApprovalType = "plan" | "quotation" | "contract";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalTask {
  id: string;
  type: ApprovalType;
  doc_no: string;
  submitter: string;
  submitted_at: string;
  status: ApprovalStatus;
  result_at?: string;
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  department?: string;
  position?: string;
  skill_level?: string;
  status?: "active" | "inactive";
}

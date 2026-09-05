export interface MaterialSupplierPrice {
  id: string;
  material_id: string;
  supplier_id: string;
  supplier_name: string;
  price: number;
  currency: string;
  lead_time: number;
  moq: number;
  status: 'active' | 'inactive';
  is_default: boolean;
  effective_date: string;
  expiry_date: string;
}

export interface MaterialInventoryInfo {
  current_stock: number;
  safety_stock: number;
  in_transit: number;
  warehouse: string;
}

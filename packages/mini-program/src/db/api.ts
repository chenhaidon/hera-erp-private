import { supabase } from '@/client/supabase';

export async function getWorkOrders(status?: string, search?: string) {
  let query = supabase
    .from('work_orders')
    .select('id, work_no, product_code, product_name, plan_quantity, completed_quantity, progress, status, priority')
    .order('created_at', { ascending: false })
    .limit(50);
  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('work_no', `%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getWorkOrderById(id: string) {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateWorkOrder(id: string, values: Record<string, any>) {
  const { error } = await supabase.from('work_orders').update(values).eq('id', id);
  if (error) throw error;
}

export async function getEmployeeById(id: string) {
  const { data, error } = await supabase
    .from('employees')
    .select('id, code, name, department, position, status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getQualityInspections(type?: string, result?: string) {
  let query = supabase
    .from('quality_inspections')
    .select('id, inspection_no, type, result, qualified_qty, unqualified_qty, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (type) query = query.eq('type', type);
  if (result !== undefined) {
    if (result === 'pending') query = query.is('result', null);
    else query = query.eq('result', result);
  }
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getQualityInspectionById(id: string) {
  const { data, error } = await supabase
    .from('quality_inspections')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateQualityInspection(id: string, values: Record<string, any>) {
  const { error } = await supabase.from('quality_inspections').update(values).eq('id', id);
  if (error) throw error;
}

export async function getInventoryLowStock() {
  const { data, error } = await supabase.from('inventory').select('id, quantity, min_stock');
  if (error) throw error;
  return (Array.isArray(data) ? data : []).filter((row) => row.quantity < (row.min_stock ?? 0));
}

export async function getPurchaseOrders(status?: string) {
  let query = supabase
    .from('purchase_orders')
    .select('id, order_no, supplier_name, total_amount, status, expected_date')
    .order('created_at', { ascending: false })
    .limit(50);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getSalesOrders(status?: string) {
  let query = supabase
    .from('sales_orders')
    .select('id, order_no, customer_name, total_amount, status, delivery_date, items')
    .order('created_at', { ascending: false })
    .limit(50);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getApprovalTasks(status?: string) {
  let query = supabase
    .from('approval_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getTodoCounts() {
  const [{ count: workOrders }, { count: inspections }, { data: inventoryRows }, { count: approvals }] = await Promise.all([
    supabase.from('work_orders').select('id', { count: 'exact', head: true }).in('status', ['issued', 'producing']),
    supabase.from('quality_inspections').select('id', { count: 'exact', head: true }).is('result', null),
    supabase.from('inventory').select('id, quantity, min_stock'),
    supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  const lowStock = (inventoryRows ?? []).filter((row: any) => row.quantity < (row.min_stock ?? 0)).length;
  return {
    workOrders: workOrders ?? 0,
    inspections: inspections ?? 0,
    inbound: lowStock,
    approvals: approvals ?? 0,
  };
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getTodayStats() {
  const { start, end } = getTodayRange();

  const [productionRes, qualityRes, inboundRes, outboundRes] = await Promise.all([
    supabase
      .from('work_orders')
      .select('completed_quantity')
      .gte('completed_at', start)
      .lt('completed_at', end),
    supabase
      .from('quality_inspections')
      .select('qualified_qty, unqualified_qty')
      .gte('created_at', start)
      .lt('created_at', end),
    supabase
      .from('stock_records')
      .select('quantity')
      .eq('type', 'in')
      .gte('record_date', start.slice(0, 10))
      .lte('record_date', end.slice(0, 10)),
    supabase
      .from('stock_records')
      .select('quantity')
      .eq('type', 'out')
      .gte('record_date', start.slice(0, 10))
      .lte('record_date', end.slice(0, 10)),
  ]);

  if (productionRes.error) throw productionRes.error;
  if (qualityRes.error) throw qualityRes.error;
  if (inboundRes.error) throw inboundRes.error;
  if (outboundRes.error) throw outboundRes.error;

  const productionDone = (productionRes.data ?? []).reduce((sum, row) => sum + (row.completed_quantity ?? 0), 0);

  const totalQualified = (qualityRes.data ?? []).reduce((sum, row) => sum + (row.qualified_qty ?? 0), 0);
  const totalInspected = (qualityRes.data ?? []).reduce(
    (sum, row) => sum + (row.qualified_qty ?? 0) + (row.unqualified_qty ?? 0),
    0,
  );
  const passRate = totalInspected > 0 ? Math.round((totalQualified / totalInspected) * 1000) / 10 : 0;

  const inbound = (inboundRes.data ?? []).reduce((sum, row) => sum + (row.quantity ?? 0), 0);
  const outbound = (outboundRes.data ?? []).reduce((sum, row) => sum + (row.quantity ?? 0), 0);

  return { productionDone, passRate, inbound, outbound };
}

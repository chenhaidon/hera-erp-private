import { uuid } from '@/lib/utils';
import { fetchEntities, insertEntity, updateEntity, deleteEntity } from '@/store/dbActions';
import type { OutsourceFactory, OutsourceShipment, OutsourceShipmentItem, OutsourceReturn, OutsourceReturnItem } from '@/types';

export type { OutsourceFactory, OutsourceShipment, OutsourceShipmentItem, OutsourceReturn, OutsourceReturnItem };

export async function fetchFactories(): Promise<OutsourceFactory[]> {
  const rows = await fetchEntities('outsource_factories');
  return rows.map((row) => mapFactory(row));
}

export async function createFactory(factory: Omit<OutsourceFactory, 'id' | 'created_at' | 'updated_at'>): Promise<OutsourceFactory> {
  const id = uuid();
  const now = new Date().toISOString();
  const payload = {
    id,
    ...factory,
    created_at: now,
    updated_at: now,
  };
  await insertEntity('outsource_factories', payload);
  return mapFactory(payload);
}

export async function updateFactory(factory: OutsourceFactory): Promise<OutsourceFactory> {
  const now = new Date().toISOString();
  const payload = { ...factory, updated_at: now } as Record<string, unknown>;
  await updateEntity('outsource_factories', payload);
  return mapFactory(payload);
}

export async function deleteFactory(id: string): Promise<void> {
  const { error } = await deleteEntity('outsource_factories', id);
  if (error) throw error;
}

export async function fetchShipments(): Promise<OutsourceShipment[]> {
  const rows = await fetchEntities('outsource_shipments');
  return rows.map((row) => mapShipment(row, (row.items as Record<string, unknown>[]) || []));
}

/**
 * 数据对账：修复历史脏数据。
 * 若某工单工序的 outsourcing_status 已为 dispatched（已发料），但 outsource_shipments 中
 * 没有对应记录（旧版本移动端只改了工序状态、未持久化发料单），则自动补建一条发料单。
 * 返回补建后最新的发料单列表。
 */
export async function reconcileMissingShipments(workOrders: { id: string; work_no: string; contract_no?: string; product_code: string; product_name: string; operations: { code: string; name: string; plan_qty: number; outsourcing_status?: string }[] }[]): Promise<OutsourceShipment[]> {
  const existing = await fetchShipments();
  const existingKeys = new Set(
    existing.map((s) => `${s.work_order_id}::${s.operation_code}`),
  );
  const toCreate = workOrders.flatMap((wo) =>
    wo.operations
      .filter((op) => op.outsourcing_status === 'dispatched')
      .filter((op) => !existingKeys.has(`${wo.id}::${op.code}`))
      .map((op) => ({
        wo,
        op,
      })),
  );
  for (const { wo, op } of toCreate) {
    const now = new Date().toISOString();
    const shipment: Omit<OutsourceShipment, 'id' | 'created_at' | 'updated_at' | 'items'> = {
      shipment_no: `OS-${Date.now().toString().slice(-8)}`,
      contract_no: wo.contract_no || '',
      work_order_id: wo.id,
      work_order_no: wo.work_no,
      operation_code: op.code,
      operation_name: op.name,
      product_code: wo.product_code,
      product_name: wo.product_name,
      factory_id: '',
      factory_name: '未指定',
      shipment_date: now.slice(0, 10),
      shipment_quantity: op.plan_qty || 0,
      logistics_company: '',
      logistics_no: '',
      status: 'shipped',
    };
    const item: OutsourceShipmentItem = {
      id: uuid(),
      shipment_id: '',
      material_code: wo.product_code,
      material_name: wo.product_name || '半成品',
      quantity: op.plan_qty || 0,
      unit: '件',
    };
    try {
      const saved = await createShipment(shipment, [item]);
      existing.push(saved);
    } catch (err) {
      console.error('[outsourcing] reconcileMissingShipments failed', wo.work_no, op.code, err);
    }
  }
  return existing;
}

export async function createShipment(shipment: Omit<OutsourceShipment, 'id' | 'created_at' | 'updated_at' | 'items'>, items: OutsourceShipmentItem[]): Promise<OutsourceShipment> {
  const id = uuid();
  const now = new Date().toISOString();
  const itemRecords = normalizeShipmentItems(items, id);
  const payload = {
    id,
    ...shipment,
    items: itemRecords,
    created_at: now,
    updated_at: now,
  } as Record<string, unknown>;
  await insertEntity('outsource_shipments', payload);
  return mapShipment(payload, itemRecords);
}

export async function updateShipment(shipment: OutsourceShipment): Promise<OutsourceShipment> {
  const { items, ...rest } = shipment as unknown as Record<string, unknown>;
  const now = new Date().toISOString();
  const itemRecords = normalizeShipmentItems(items as OutsourceShipmentItem[], shipment.id);
  const payload = {
    ...rest,
    items: itemRecords,
    updated_at: now,
  } as Record<string, unknown>;
  await updateEntity('outsource_shipments', payload);
  return mapShipment(payload, itemRecords);
}

export async function deleteShipment(id: string): Promise<void> {
  // 先删除该发料单关联的回货单，保持数据一致
  const returns = await fetchEntities('outsource_returns');
  const related = returns.filter((r) => r.shipment_id === id);
  for (const ret of related) {
    const { error } = await deleteEntity('outsource_returns', String(ret.id));
    if (error) throw error;
  }
  const { error } = await deleteEntity('outsource_shipments', id);
  if (error) throw error;
}

export async function updateShipmentStatus(id: string, status: OutsourceShipment['status']): Promise<void> {
  const existing = await fetchEntities('outsource_shipments');
  const row = existing.find((r) => r.id === id);
  if (!row) return;
  const payload = { ...row, status, updated_at: new Date().toISOString() };
  await updateEntity('outsource_shipments', payload);
}

export async function fetchReturns(): Promise<OutsourceReturn[]> {
  const rows = await fetchEntities('outsource_returns');
  return rows.map((row) => mapReturn(row, (row.items as Record<string, unknown>[]) || []));
}

export async function createReturn(ret: Omit<OutsourceReturn, 'id' | 'created_at' | 'updated_at' | 'items'>, items: OutsourceReturnItem[]): Promise<OutsourceReturn> {
  const id = uuid();
  const now = new Date().toISOString();
  const itemRecords = normalizeReturnItems(items, id);
  const payload = {
    id,
    ...ret,
    items: itemRecords,
    created_at: now,
    updated_at: now,
  } as Record<string, unknown>;
  await insertEntity('outsource_returns', payload);
  return mapReturn(payload, itemRecords);
}

export async function updateReturn(ret: OutsourceReturn): Promise<OutsourceReturn> {
  const { items, ...rest } = ret as unknown as Record<string, unknown>;
  const now = new Date().toISOString();
  const itemRecords = normalizeReturnItems(items as OutsourceReturnItem[], ret.id);
  const payload = {
    ...rest,
    items: itemRecords,
    updated_at: now,
  } as Record<string, unknown>;
  await updateEntity('outsource_returns', payload);
  return mapReturn(payload, itemRecords);
}

export async function deleteReturn(id: string): Promise<void> {
  const { error } = await deleteEntity('outsource_returns', id);
  if (error) throw error;
}

export async function updateReturnInspection(id: string, patch: {
  inspection_status: OutsourceReturn['inspection_status'];
  status: OutsourceReturn['status'];
  qualified_quantity?: number;
  defective_quantity?: number;
  inspector?: string;
  defect_reason?: string;
}): Promise<void> {
  const existing = await fetchEntities('outsource_returns');
  const row = existing.find((r) => r.id === id);
  if (!row) return;
  const payload = { ...row, ...patch, updated_at: new Date().toISOString() };
  await updateEntity('outsource_returns', payload);
}

function normalizeShipmentItems(items: OutsourceShipmentItem[], shipmentId: string): Record<string, unknown>[] {
  return items.map((it) => ({
    id: it.id || uuid(),
    shipment_id: shipmentId,
    material_code: it.material_code || '',
    material_name: it.material_name || '',
    quantity: Number(it.quantity) || 0,
    unit: it.unit || '件',
  }));
}

function normalizeReturnItems(items: OutsourceReturnItem[], returnId: string): Record<string, unknown>[] {
  return items.map((it) => ({
    id: it.id || uuid(),
    return_id: returnId,
    material_code: it.material_code || '',
    material_name: it.material_name || '',
    quantity: Number(it.quantity) || 0,
    unit: it.unit || '件',
  }));
}

function mapFactory(row: Record<string, unknown>): OutsourceFactory {
  return {
    id: String(row.id),
    factory_name: String(row.factory_name || ''),
    contact_phone: String(row.contact_phone || ''),
    processing_capability: String(row.processing_capability || ''),
    status: String(row.status) as OutsourceFactory['status'],
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapShipment(row: Record<string, unknown>, items: Record<string, unknown>[]): OutsourceShipment {
  return {
    id: String(row.id),
    shipment_no: String(row.shipment_no || ''),
    contract_no: row.contract_no ? String(row.contract_no) : undefined,
    work_order_id: String(row.work_order_id || ''),
    work_order_no: row.work_order_no ? String(row.work_order_no) : undefined,
    operation_code: row.operation_code ? String(row.operation_code) : undefined,
    operation_name: row.operation_name ? String(row.operation_name) : undefined,
    product_code: String(row.product_code || ''),
    product_name: String(row.product_name || ''),
    factory_id: String(row.factory_id || ''),
    factory_name: row.factory_name ? String(row.factory_name) : undefined,
    shipment_date: String(row.shipment_date || ''),
    shipment_quantity: Number(row.shipment_quantity || 0),
    logistics_company: row.logistics_company ? String(row.logistics_company) : undefined,
    logistics_no: row.logistics_no ? String(row.logistics_no) : undefined,
    status: String(row.status) as OutsourceShipment['status'],
    items: (items || []).map((it) => mapShipmentItem(it)),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapShipmentItem(row: Record<string, unknown>): OutsourceShipmentItem {
  return {
    id: String(row.id),
    shipment_id: String(row.shipment_id || ''),
    material_code: row.material_code ? String(row.material_code) : '',
    material_name: String(row.material_name || ''),
    quantity: Number(row.quantity || 0),
    unit: row.unit ? String(row.unit) : '件',
  };
}

function mapReturn(row: Record<string, unknown>, items: Record<string, unknown>[]): OutsourceReturn {
  return {
    id: String(row.id),
    return_no: String(row.return_no || ''),
    shipment_id: String(row.shipment_id || ''),
    shipment_no: row.shipment_no ? String(row.shipment_no) : undefined,
    contract_no: row.contract_no ? String(row.contract_no) : undefined,
    work_order_id: String(row.work_order_id || ''),
    work_order_no: row.work_order_no ? String(row.work_order_no) : undefined,
    operation_code: row.operation_code ? String(row.operation_code) : undefined,
    operation_name: row.operation_name ? String(row.operation_name) : undefined,
    product_code: String(row.product_code || ''),
    product_name: String(row.product_name || ''),
    factory_id: String(row.factory_id || ''),
    factory_name: row.factory_name ? String(row.factory_name) : undefined,
    return_date: String(row.return_date || ''),
    return_type: (String(row.return_type) as OutsourceReturn['return_type']) || 'finished',
    return_quantity: Number(row.return_quantity || 0),
    qualified_quantity: Number(row.qualified_quantity || 0),
    defective_quantity: Number(row.defective_quantity || 0),
    inspection_status: String(row.inspection_status) as OutsourceReturn['inspection_status'],
    status: String(row.status) as OutsourceReturn['status'],
    inspector: row.inspector ? String(row.inspector) : undefined,
    defect_reason: row.defect_reason ? String(row.defect_reason) : undefined,
    items: (items || []).map((it) => mapReturnItem(it)),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapReturnItem(row: Record<string, unknown>): OutsourceReturnItem {
  return {
    id: String(row.id),
    return_id: String(row.return_id || ''),
    material_code: row.material_code ? String(row.material_code) : '',
    material_name: String(row.material_name || ''),
    quantity: Number(row.quantity || 0),
    unit: row.unit ? String(row.unit) : '件',
  };
}

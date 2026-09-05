import { toast } from 'sonner';
import { nanoid } from '@/lib/utils';
import type { WorkOrder, WorkOrderOperation, ProcessInspection, OutsourceReturn, ProductionPlan, SalesOrder, FinishedInspection, FinishedGoodsInbound, OperationReportRecord } from '@/types';

/** 检查前序工序是否已完工且通过 PQC 过程检验 */
export function checkOperationDependency(
  workOrder: WorkOrder,
  operation: WorkOrderOperation,
  processInspections: ProcessInspection[]
): boolean {
  const prev = workOrder.operations.find((o) => o.seq === operation.seq - 1);
  if (!prev) return true;
  if (prev.status !== 'completed') return false;
  // 外协工序：回货质检通过并标记为已完工即视为前序合格
  if (prev.category === 'outsourcing' && prev.outsourcing_status === 'returned') return true;
  return processInspections.some(
    (p) =>
      p.work_id === workOrder.id &&
      (p.operation_code === prev.code || p.operation_name === prev.name) &&
      p.result === 'qualified'
  );
}

/** 将后一道工序从“未开始”解锁为“待开工” */
export function unlockNextOperation(
  workOrder: WorkOrder,
  operation: WorkOrderOperation
): WorkOrderOperation[] {
  return workOrder.operations.map((o) => {
    if (o.seq === operation.seq + 1 && o.status === 'pending') {
      return { ...o, status: 'pending_start' };
    }
    return o;
  });
}

/** 根据工序完成情况重新计算工单进度与状态 */
export function recalcWorkOrderFromOperations(wo: WorkOrder): Partial<WorkOrder> {
  const operations = wo.operations.filter(Boolean);
  const lastOperation = [...operations].sort((a, b) => a.seq - b.seq).pop();
  const completed_quantity = lastOperation?.completed_qty ?? 0;
  const progress = operations.length > 0
    ? Math.round(
        operations.reduce((sum, o) => {
          const opProgress = o.plan_qty > 0 ? (o.completed_qty / o.plan_qty) : 0;
          return sum + Math.min(opProgress, 1);
        }, 0) / operations.length * 100
      )
    : 0;
  const allClosed = operations.every((o) => o.status === 'completed' || o.status === 'closed');
  const anyRunning = operations.some(
    (o) => o.status === 'running' || o.status === 'qc' || o.status === 'pending_start'
  );
  let status: WorkOrder['status'] = wo.status;
  if (allClosed) {
    // 已入库/已结案的状态保持不动；其余一律回到待质检，确保后续流程继续
    if (status !== 'inbound' && status !== 'closed') {
      status = 'qc';
    }
  } else if (wo.status === 'paused') {
    status = 'paused';
  } else if (anyRunning) {
    status = 'producing';
  } else if (operations.every((o) => o.status === 'pending')) {
    status = 'pending';
  }
  return { completed_quantity, progress, status };
}

/** 生成待检验成品检验单；若已存在待检验记录则不再重复生成 */
function randomWorkHourTime(date = new Date()): string {
  const d = new Date(date);
  const hour = Math.floor(8 + Math.random() * 9); // 8-16
  const minute = Math.floor(1 + Math.random() * 59);
  const second = Math.floor(1 + Math.random() * 59);
  d.setHours(hour, minute, second, 0);
  return d.toISOString();
}

export async function createPendingFinishedInspection(
  store: {
    finishedInspections: FinishedInspection[];
    addFinishedInspection: (item: FinishedInspection) => Promise<void> | void;
  },
  wo: WorkOrder
) {
  const exists = store.finishedInspections.some(
    (f) => f.work_id === wo.id && f.status === 'pending'
  );
  if (exists) return;
  const inspection: FinishedInspection = {
    id: nanoid(),
    code: `FI-${Date.now().toString().slice(-6)}`,
    work_id: wo.id,
    work_no: wo.work_no,
    product_id: wo.product_id,
    product_code: wo.product_code,
    product_name: wo.product_name,
    batch: `FB${Date.now().toString().slice(-8)}`,
    check_qty: wo.completed_quantity,
    qualified_qty: 0,
    unqualified_qty: 0,
    result: undefined,
    status: 'pending',
    inspector: '',
    created_at: randomWorkHourTime(),
    contract_no: wo.contract_no || '',
    items: [],
    defect_reason: '',
  };
  await store.addFinishedInspection(inspection);
}

export function getRelatedSalesOrder(store: { productionPlans: ProductionPlan[]; salesOrders: SalesOrder[] }, wo: WorkOrder) {
  const plan = store.productionPlans.find((p) => p.id === wo.plan_id);
  if (!plan) return null;
  const orderRef = plan.orders[0];
  if (!orderRef) return null;
  return store.salesOrders.find((o) => o.id === orderRef.order_id) || null;
}

export function isFinishedInspectionQualified(store: { finishedInspections: FinishedInspection[] }, wo: WorkOrder) {
  return store.finishedInspections.some((f) => f.work_id === wo.id && f.status === 'inspected' && f.result === 'qualified');
}

export function openDirectShip(store: { productionPlans: ProductionPlan[]; salesOrders: SalesOrder[] }, wo: WorkOrder) {
  const order = getRelatedSalesOrder(store, wo);
  if (!order) {
    toast.error('该工单未关联销售订单，无法直发出库');
    return undefined;
  }
  return { order };
}

/**
 * 为已完工但未报工的内部工序补建报工记录。
 * 用于外协回货质检通过后，自动为前序已完工的内部工序补齐报工数据。
 */
export function generateMissingInternalReports(
  wo: WorkOrder,
  products: { id: string; process_steps?: { code: string; price?: number; piece_price?: number }[] }[],
  operatorName: string = '系统'
): WorkOrder {
  // 基于工单开始日期，按工序顺序生成报工日期
  const baseDate = wo.start_date ? new Date(wo.start_date) : new Date();
  const updatedOps = wo.operations.map((op, index) => {
    if (op.category === 'outsourcing') return op;
    if (op.status !== 'completed' && op.status !== 'qc') return op;
    if (op.reports && op.reports.length > 0) return op;
    if ((op.completed_qty || 0) <= 0) return op;

    const product = products.find((p) => p.id === wo.product_id);
    const step = product?.process_steps?.find((s) => s.code === op.code);
    const unitPrice = step?.piece_price ?? step?.price ?? 0;
    const totalQty = op.completed_qty;
    const seq = (op.seq || index + 1) - 1;
    // 避免同一工序在一天内完成：<=10 不拆，11-80 拆 2 天，>80 拆 3 天
    const days = totalQty <= 10 ? 1 : totalQty <= 80 ? 2 : 3;
    const reports: OperationReportRecord[] = [];
    for (let i = 0; i < days; i++) {
      const qty = i === days - 1 ? totalQty - Math.floor(totalQty / days) * (days - 1) : Math.floor(totalQty / days);
      const reportDate = new Date(baseDate);
      reportDate.setDate(reportDate.getDate() + seq + i);
      const time = i === 0 ? '08:00:00' : i === 1 ? '10:00:00' : '12:00:00';
      reports.push({
        id: nanoid(),
        operator_id: undefined,
        operator_name: operatorName,
        qty,
        unit_price: unitPrice,
        amount: Number((qty * unitPrice).toFixed(2)),
        report_time: reportDate.toISOString().slice(0, 10) + ' ' + time,
        work_no: wo.work_no,
        operation_name: op.name,
        operation_code: op.code,
      });
    }
    return { ...op, reports };
  });
  return { ...wo, operations: updatedOps };
}


/**
 * 计算某内部工序的报工上限：取上一道外协工序回货合格数量 - 当前工序已报工累计数量。
 * 若上一道不是外协工序或尚未回货，返回 null 表示不限制。
 */
export function getOutsourceReportLimit(
  workOrder: WorkOrder,
  operation: WorkOrderOperation,
  returns: OutsourceReturn[]
): number | null {
  if (operation.category === 'outsourcing') return null;
  const prev = workOrder.operations.find((o) => o.seq === operation.seq - 1);
  if (!prev || prev.category !== 'outsourcing') return null;
  if (!prev.return_qc_id) return null;
  const ret = returns.find(
    (r) =>
      r.id === prev.return_qc_id ||
      r.operation_code === prev.code ||
      r.operation_name === prev.name
  );
  if (!ret) return null;
  const reportedQty = operation.reports?.reduce((sum, r) => sum + r.qty, 0) || 0;
  return Math.max(0, ret.qualified_quantity - reportedQty);
}

const SALES_ORDER_STATUS_ORDER = ['pending', 'confirmed', 'approval', 'approved', 'planned', 'producing', 'inspecting', 'shipping', 'shipped', 'invoicing', 'payment', 'completed'];

const WORK_ORDER_TO_SALES_ORDER: Record<string, string> = {
  pending: 'planned',
  issued: 'planned',
  producing: 'producing',
  paused: 'producing',
  qc: 'inspecting',
  pending_inbound: 'shipping',
  inbound: 'shipping',
  completed: 'shipping',
};

interface SyncSalesOrderStore {
  workOrders: WorkOrder[];
  productionPlans: ProductionPlan[];
  salesOrders: SalesOrder[];
  updateSalesOrder: (order: SalesOrder) => void;
}

/** 根据关联生产工单状态，自动同步销售订单状态（只前进、不回退） */
interface InboundStore {
  finishedInspections: FinishedInspection[];
  finishedGoodsInbounds: FinishedGoodsInbound[];
  addFinishedGoodsInbound: (item: FinishedGoodsInbound) => Promise<void> | void;
  updateWorkOrder: (item: WorkOrder) => Promise<void> | void;
}

/** 生成成品入库单；要求工单所有工序已完工且存在合格成品检验记录 */
export function createFinishedGoodsInbound(
  store: InboundStore & SyncSalesOrderStore,
  wo: WorkOrder,
  qualifiedRecord?: FinishedInspection,
) {
  if (!wo.operations.every((o) => o.status === 'completed' || o.status === 'qc' || o.status === 'closed')) {
    toast.error('存在未完工工序，无法完工入库');
    return false;
  }
  const inspected = qualifiedRecord
    ? qualifiedRecord.work_id === wo.id && qualifiedRecord.result === 'qualified'
    : store.finishedInspections.some(
        (f) => f.work_id === wo.id && f.result === 'qualified'
      );
  if (!inspected) {
    const hasPending = store.finishedInspections.some(
      (f) => f.work_id === wo.id && f.status === 'pending'
    );
    if (hasPending) {
      toast.error('成品检验尚未完成，请先完成检验并判定合格');
    } else {
      toast.error('未找到合格成品检验记录，无法完工入库');
    }
    return false;
  }
  const existing = store.finishedGoodsInbounds.find(
    (f) => f.work_id === wo.id && f.status === 'pending'
  );
  if (existing) {
    toast.error('已存在待入库成品入库单');
    return false;
  }
  const inbound: FinishedGoodsInbound = {
    id: nanoid(),
    inbound_no: `RKS-${Date.now().toString().slice(-6)}`,
    work_id: wo.id,
    work_no: wo.work_no,
    product_id: wo.product_id,
    product_code: wo.product_code,
    product_name: wo.product_name,
    quantity: wo.completed_quantity,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  store.addFinishedGoodsInbound(inbound);
  store.updateWorkOrder({ ...wo, status: 'pending_inbound' });
  syncSalesOrderStatusFromProduction(store);
  toast.success('已生成待入库成品入库单，请前往库存管理确认入库');
  return true;
}

export function syncSalesOrderStatusFromProduction(store: SyncSalesOrderStore, orderId?: string) {
  const targetOrders = orderId ? store.salesOrders.filter((o) => o.id === orderId) : store.salesOrders;

  targetOrders.forEach((order) => {
    const plans = store.productionPlans.filter((p) => p.orders.some((o) => o.order_id === order.id));
    const relatedWorkOrderIds = new Set<string>();
    plans.forEach((p) => {
      p.work_orders?.forEach((workNo) => {
        const wo = store.workOrders.find((w) => w.work_no === workNo);
        if (wo) relatedWorkOrderIds.add(wo.id);
      });
    });
    const relatedWorkOrders = store.workOrders.filter((w) => relatedWorkOrderIds.has(w.id));
    if (relatedWorkOrders.length === 0) return;

    const targetStatuses = relatedWorkOrders.map((wo) => WORK_ORDER_TO_SALES_ORDER[wo.status] || 'planned');
    const indices = targetStatuses.map((s) => SALES_ORDER_STATUS_ORDER.indexOf(s)).filter((i) => i >= 0);
    const minIndex = indices.length > 0 ? Math.min(...indices) : -1;
    if (minIndex < 0) return;

    const targetStatus = SALES_ORDER_STATUS_ORDER[minIndex];
    const currentIndex = SALES_ORDER_STATUS_ORDER.indexOf(order.status);
    if (minIndex <= currentIndex) return;

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    store.updateSalesOrder({
      ...order,
      status: targetStatus,
      logs: [...(order.logs || []), { status: targetStatus, operator: '系统', time: nowStr, remark: '根据生产进度自动更新' }],
    });
  });
}

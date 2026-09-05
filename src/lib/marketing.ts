import { nanoid } from '@/lib/utils';
import type {
  FinishedGoodsInbound,
  FinanceRecord,
  Inventory,
  Product,
  ProductSku,
  ProductionPlan,
  SalesOrder,
  SalesOrderItem,
  SalesOutbound,
  Shipment,
  ShipmentItem,
  StockRecord,
  WorkOrder,
} from '@/types';

export interface ShipmentContext {
  salesOutbounds: SalesOutbound[];
  inventory: Inventory[];
  products: Product[];
  financeRecords: FinanceRecord[];
  addSalesOutbound: (item: SalesOutbound) => Promise<void> | void;
  addStockRecord: (item: StockRecord) => Promise<void> | void;
  addShipment: (item: Shipment) => Promise<void> | void;
  addFinanceRecord: (item: FinanceRecord) => Promise<void> | void;
  updateFinanceRecord: (item: FinanceRecord) => Promise<void> | void;
  updateInventory: (item: Inventory) => Promise<void> | void;
  updateSalesOrder: (item: SalesOrder) => Promise<void> | void;
}

function resolveSkuIdFromSummary(
  product: Product | undefined,
  skuSummary?: string,
): string | undefined {
  if (!product || !skuSummary) return undefined;
  const normalized = skuSummary.toLowerCase().replace(/\s/g, '');
  return product.skus?.find(
    (s) =>
      (s.barcode || '').toLowerCase().replace(/\s/g, '') === normalized ||
      (s.specification || '').toLowerCase().replace(/\s/g, '') === normalized ||
      `${(product.code || '').toLowerCase()}-${(s.color || '').toLowerCase()}-${(s.size || '').toLowerCase()}`.replace(/\s/g, '') ===
        normalized,
  )?.id;
}

function skuMatches(
  out: SalesOutbound,
  item: SalesOrderItem,
  product?: Product,
): boolean {
  const outSkuId = out.sku_id;
  const itemSkuId =
    item.sku_id || resolveSkuIdFromSummary(product, item.sku_summary);
  if (outSkuId && itemSkuId) {
    return outSkuId === itemSkuId;
  }
  // 任一方向缺失 sku_id 时，回退到 sku_summary 精确匹配
  const outSummary = (out.sku_summary || '').toLowerCase().trim();
  const itemSummary = (item.sku_summary || '').toLowerCase().trim();
  return outSummary === itemSummary && !!outSummary;
}

export function buildShipmentItems(
  order: SalesOrder,
  salesOutbounds: SalesOutbound[],
  products: Product[] = [],
): ShipmentItem[] {
  return order.items.map((i) => {
    const product = products.find((p) => p.id === i.product_id);
    const history = salesOutbounds
      .filter(
        (out) =>
          out.order_id === order.id &&
          out.product_id === i.product_id &&
          out.quantity > 0 &&
          out.outbound_no?.startsWith('SO-') &&
          skuMatches(out, i, product),
      )
      .reduce((sum, out) => sum + out.quantity, 0);
    const remaining = Math.max(0, i.quantity - history);
    return {
      product_id: i.product_id || '',
      sku_id: i.sku_id || resolveSkuIdFromSummary(product, i.sku_summary),
      product_code: i.product_code,
      product_name: i.product_name,
      sku_summary: i.sku_summary,
      specification: i.specification,
      color: i.color,
      ordered_quantity: i.quantity,
      shipped_quantity: history,
      quantity: remaining,
      image: i.image,
    };
  });
}

export function getShippedQuantity(
  order: SalesOrder,
  salesOutbounds: SalesOutbound[],
  products: Product[] = [],
): number {
  return order.items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.product_id);
    const history = salesOutbounds
      .filter(
        (out) =>
          out.order_id === order.id &&
          out.product_id === item.product_id &&
          out.quantity > 0 &&
          out.outbound_no?.startsWith('SO-') &&
          skuMatches(out, item, product),
      )
      .reduce((s, out) => s + out.quantity, 0);
    return sum + history;
  }, 0);
}

export function getOrderTotalQuantity(order: SalesOrder): number {
  return order.items.reduce((sum, i) => sum + i.quantity, 0);
}

export interface ProductionProgressContext {
  productionPlans: ProductionPlan[];
  workOrders: WorkOrder[];
  finishedGoodsInbounds: FinishedGoodsInbound[];
}

function getSkuRelatedWorkOrders(
  ctx: ProductionProgressContext,
  order: SalesOrder,
  item: SalesOrderItem,
) {
  const relatedPlans = ctx.productionPlans.filter((p) =>
    p.orders?.some((o) => o.order_id === order.id),
  );
  const planIds = new Set(relatedPlans.map((p) => p.id));
  const workNos = new Set(
    relatedPlans.flatMap((p) => p.work_orders || []),
  );
  return ctx.workOrders.filter((w) => {
    const linkedByPlan = w.plan_id && planIds.has(w.plan_id);
    const linkedByWorkNo = workNos.has(w.work_no);
    if (!linkedByPlan && !linkedByWorkNo) return false;
    if (w.product_code !== item.product_code) return false;

    const itemSku = (item.sku_id || '').trim();
    const workSku = (w.sku_id || '').trim();
    const itemSkuText = (item.sku_summary || '').toLowerCase().trim();
    const workSkuText = (w.sku_summary || w.product_name || '').toLowerCase().trim();

    if (itemSku && workSku && itemSku === workSku) return true;
    if (itemSkuText && workSkuText &&
      (workSkuText.includes(itemSkuText) || itemSkuText.includes(workSkuText))) {
      return true;
    }
    // 销售订单行无 SKU 信息时，按产品级兜底
    if (!itemSku && !itemSkuText) return true;
    return false;
  });
}

export function getSkuProductionWorkOrder(
  ctx: ProductionProgressContext,
  order: SalesOrder,
  item: SalesOrderItem,
): string | null {
  const related = getSkuRelatedWorkOrders(ctx, order, item);
  return related.length > 0 ? related[0].work_no : null;
}

export function getSkuProductionProgress(
  ctx: ProductionProgressContext,
  order: SalesOrder,
  item: SalesOrderItem,
): '未开始' | '生产中' | '待入库' | '已入库' | '部分入库' {
  const relatedWorkOrders = getSkuRelatedWorkOrders(ctx, order, item);
  if (relatedWorkOrders.length === 0) return '未开始';

  const inboundStatuses = relatedWorkOrders.map((wo) => {
    const hasInbound = ctx.finishedGoodsInbounds.some(
      (f) => f.work_id === wo.id && f.status === 'inbound',
    );
    if (hasInbound) return '已入库';
    if (
      wo.status === 'qc' ||
      wo.status === 'pending_inbound' ||
      wo.status === 'inbound' ||
      wo.status === 'completed' ||
      wo.status === 'closed' ||
      wo.progress === 100
    ) {
      return '待入库';
    }
    if (
      wo.status === 'producing' ||
      wo.status === 'issued' ||
      wo.status === 'paused'
    ) {
      return '生产中';
    }
    return '未开始';
  });

  if (inboundStatuses.every((s) => s === '已入库')) return '已入库';
  if (inboundStatuses.includes('已入库')) return '部分入库';
  if (inboundStatuses.includes('待入库')) return '待入库';
  if (inboundStatuses.includes('生产中')) return '生产中';
  return '未开始';
}

export async function executeShipment(
  ctx: ShipmentContext,
  order: SalesOrder,
  shipment_no: string,
  contractNo: string,
  shipmentDate: string,
  logisticsCompany: string,
  trackingNo: string,
  remark: string,
  shippingItems: ShipmentItem[],
): Promise<void> {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const orderTotalQty = getOrderTotalQuantity(order);
  const shippedBefore = getShippedQuantity(order, ctx.salesOutbounds);
  const shippedNow = shippingItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const shippedTotal = shippedBefore + shippedNow;
  const nextStatus = shippedTotal >= orderTotalQty ? 'shipped' : 'partial_shipped';

  // 1. 扣减库存并生成销售出库记录
  for (const [idx, item] of shippingItems.entries()) {
    const qty = item.quantity || 0;
    if (qty <= 0) continue;
    const warehouse = '成品仓';
    const inv = ctx.inventory.find(
      (i) =>
        i.type === 'product' &&
        i.product_id === item.product_id &&
        i.warehouse === warehouse,
    );
    if (!inv) {
      throw new Error(`未找到成品库存：${item.product_name || item.product_code}`);
    }
    if (inv.quantity < qty) {
      throw new Error(
        `成品库存不足：${item.product_name || item.product_code}，可用 ${inv.quantity}，需出库 ${qty}`,
      );
    }
    await ctx.updateInventory({
      ...inv,
      quantity: inv.quantity - qty,
    });
    await ctx.addStockRecord({
      id: nanoid(),
      record_no: `SR-SH-${shipment_no}-${idx + 1}`,
      type: 'out',
      subtype: '销售出库',
      product_id: item.product_id,
      product_code: item.product_code,
      product_name: item.product_name,
      quantity: qty,
      actual_qty: qty,
      warehouse,
      location_id: 'loc-finished-1',
      related_order: shipment_no,
      related_order_id: order.id,
      contract_no: contractNo || order.contract_no,
      handler: '当前用户',
      record_date: shipmentDate,
      remark: `发货单 ${shipment_no} 销售出库（订单 ${order.order_no}）`,
    });
    const product = ctx.products.find((p) => p.id === item.product_id);
    const resolvedSkuId =
      item.sku_id || resolveSkuIdFromSummary(product, item.sku_summary);
    const outbound: SalesOutbound = {
      id: nanoid(),
      outbound_no: `SO-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(-3)}`,
      shipment_id: '',
      shipment_no,
      order_id: order.id,
      order_no: order.order_no,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      product_id: item.product_id,
      sku_id: resolvedSkuId,
      product_code: item.product_code,
      product_name: item.product_name,
      sku_summary: item.sku_summary,
      quantity: qty,
      warehouse,
      outbound_date: now,
      handler: '当前用户',
      created_at: now,
    };
    await ctx.addSalesOutbound(outbound);
  }

  // 2. 生成应收账款（按本次发货数量 × 单价）
  const receivableAmount = shippingItems.reduce((sum, item) => {
    const qty = item.quantity || 0;
    if (qty <= 0) return sum;
    const orderItem = order.items.find((i) => {
      if (item.sku_id && i.sku_id) return i.sku_id === item.sku_id;
      if (item.sku_summary && i.sku_summary) {
        return item.sku_summary.toLowerCase().trim() === i.sku_summary.toLowerCase().trim();
      }
      return item.product_code === i.product_code;
    });
    const unitPrice = orderItem?.unit_price || 0;
    return sum + qty * unitPrice;
  }, 0);

  if (receivableAmount > 0) {
    await ctx.addFinanceRecord({
      id: nanoid(),
      type: '应收',
      counterparty: order.customer_name,
      customer_id: order.customer_id,
      related_order_id: order.id,
      related_order: order.order_no,
      currency: order.currency || 'CNY',
      amount: receivableAmount,
      paid_amount: 0,
      record_date: now,
      status: 'unsettled',
    });
  }

  // 3. 生成发货单
  const shipment: Shipment = {
    id: nanoid(),
    shipment_no,
    order_id: order.id,
    order_no: order.order_no,
    contract_no: contractNo || order.contract_no,
    customer_id: order.customer_id,
    customer_name: order.customer_name,
    shipment_date: shipmentDate,
    logistics_company: logisticsCompany,
    tracking_no: trackingNo,
    status: 'shipped',
    items: shippingItems,
    boxes: [],
    remark,
    created_at: now,
    creator: '当前用户',
  };
  await ctx.addShipment(shipment);

  // 3. 更新销售订单
  await ctx.updateSalesOrder({
    ...order,
    status: nextStatus,
    shipped_quantity: shippedTotal,
    delivery_progress: { shipped: shippedTotal, total: orderTotalQty },
    logs: [
      ...(order.logs || []),
      {
        status: nextStatus,
        operator: '当前用户',
        time: now,
        remark: `发货单 ${shipment_no} 创建，本次发货 ${shippedNow} 件，累计 ${shippedTotal}/${orderTotalQty}`,
      },
    ],
  });
}

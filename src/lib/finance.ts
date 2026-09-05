import { nanoid } from "@/lib/utils";
import type { SalesOrder, FinanceRecord } from "@/types";

export async function ensureReceivableForOrder(
  order: SalesOrder,
  financeRecords: FinanceRecord[],
  addFinanceRecord: (item: FinanceRecord) => Promise<void> | void,
  updateFinanceRecord: (item: FinanceRecord) => Promise<void> | void,
) {
  const existing = financeRecords.find(
    (f) => f.type === "应收" && f.related_order_id === order.id,
  );
  const base = {
    counterparty: order.customer_name,
    customer_id: order.customer_id,
    related_order: order.order_no,
    related_order_id: order.id,
    contract_no: order.contract_no || "",
    amount: order.total_amount,
    currency: order.currency || "CNY",
    record_date: order.created_at || new Date().toISOString().split("T")[0],
  };
  if (existing) {
    await updateFinanceRecord({
      ...existing,
      ...base,
      status: existing.status || "unsettled",
    });
  } else {
    await addFinanceRecord({
      id: nanoid(),
      type: "应收",
      ...base,
      paid_amount: 0,
      status: "unsettled",
    });
  }
}

export async function syncReceivablesFromSalesOrders(
  salesOrders: SalesOrder[],
  financeRecords: FinanceRecord[],
  addFinanceRecord: (item: FinanceRecord) => Promise<void> | void,
  updateFinanceRecord: (item: FinanceRecord) => Promise<void> | void,
) {
  // 只有已发货或已完成的订单才生成应收
  const receivableStatuses = ["shipped", "completed"];
  for (const o of salesOrders.filter((o) => receivableStatuses.includes(o.status))) {
    const hasReceivable = financeRecords.some(
      (f) => f.type === "应收" && f.related_order_id === o.id,
    );
    if (hasReceivable) continue;
    await ensureReceivableForOrder(
      o,
      financeRecords,
      addFinanceRecord,
      updateFinanceRecord,
    );
  }
}

/** 当应收记录已结清但对应销售订单未更新为已完成时，自动反向修复 */
export async function syncSalesOrderStatusFromReceivables(
  salesOrders: SalesOrder[],
  financeRecords: FinanceRecord[],
  updateSalesOrder: (item: SalesOrder) => Promise<void> | void,
) {
  const paymentDate = new Date().toISOString().split("T")[0];
  const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");

  for (const f of financeRecords.filter(
    (f) =>
      f.type === "应收" &&
      (f.status === "settled" || (f.paid_amount || 0) >= f.amount),
  )) {
    const order = f.related_order_id
      ? salesOrders.find((o) => o.id === f.related_order_id)
      : salesOrders.find((o) => o.order_no === f.related_order);
    if (!order || order.status === "completed") continue;

    // 同时修复应收记录自身状态字段，防止只更新 paid_amount 未更新 status
    if (f.status !== "settled" && (f.paid_amount || 0) >= f.amount) {
      f.status = "settled";
    }

    console.log(
      `[finance-fix] 修复订单 ${order.order_no}，状态 ${order.status} → completed`,
    );
    await updateSalesOrder({
      ...order,
      status: "completed",
      payment_date: paymentDate,
      logs: [
        ...(order.logs || []),
        {
          status: "completed",
          operator: "当前用户",
          time: nowStr,
          remark: `应收账款已结清，销售订单回款完成（数据修复）`,
        },
      ],
    });
  }
}

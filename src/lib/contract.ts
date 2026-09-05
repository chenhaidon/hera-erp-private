import { nanoid } from "@/lib/utils";
import type {
  Contract,
  ContractClause,
  ContractCustomerLevel,
  ContractItem,
  ContractPerformanceNode,
  ContractTemplate,
  ContractType,
  OverdueHint,
  PerformanceNodeType,
  Quotation,
  SalesOrder,
} from "@/types";
import { PERFORMANCE_NODE_TYPES } from "@/lib/data";

/** 生成合同编号 */
export function generateContractNo(contracts: Contract[]): string {
  const prefix = "HT-";
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const existing = contracts.filter((c) =>
    c.contract_no?.startsWith(`${prefix}${dateStr}`),
  );
  const seq = existing.length + 1;
  return `${prefix}${dateStr}${String(seq).padStart(3, "0")}`;
}

/** 创建空合同表单对象 */
export function createEmptyContract(): Contract {
  return {
    id: nanoid(),
    contract_no: "",
    title: "",
    customer_name: "",
    contact_name: "",
    contact_phone: "",
    customer_address: "",
    contract_type: "domestic",
    customer_level: "normal",
    amount: 0,
    currency: "CNY",
    payment_terms: "款到发货",
    remark: "",
    version: "V1.0",
    status: "draft",
    items: [],
    clauses: [],
    approval_logs: [],
    performance_nodes: getDefaultPerformanceNodes(),
    version_logs: [],
    attachments: [],
    reminders: [],
    created_by: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** 从报价单创建合同 */
export function createContractFromQuotation(q: Quotation): Contract {
  const items: ContractItem[] = (q.items || []).map((it) => ({
    id: nanoid(),
    product_id: it.product_id || nanoid(),
    product_code: it.product_code || "",
    product_name: it.product_name || "",
    specification: it.sku_specification || it.product_spec || "",
    color: it.color || "",
    quantity: it.quantity || 1,
    unit_price: it.unit_price || 0,
    total_price: it.subtotal || (it.unit_price || 0) * (it.quantity || 1),
    remark: q.remark || "",
  }));

  const fallbackItems: ContractItem[] = items.length > 0 ? [] : [{
    id: nanoid(),
    product_id: q.product_id || nanoid(),
    product_code: q.product_code || "",
    product_name: q.product_name || "",
    specification: q.product_spec || q.sku_specification || "",
    color: (q as any).color || "",
    quantity: q.quantity || 1,
    unit_price: q.suggested_price || 0,
    total_price: (q.suggested_price || 0) * (q.quantity || 1),
    remark: q.remark || "",
  }];

  const allItems = items.length > 0 ? items : fallbackItems;
  const totalAmount = allItems.reduce((sum, it) => sum + it.total_price, 0);

  return {
    id: nanoid(),
    contract_no: "",
    title: `${q.customer_name} - ${q.product_name || ""} 销售合同`,
    customer_id: q.customer_id,
    customer_name: q.customer_name || "",
    contact_name: "",
    contact_phone: "",
    customer_address: "",
    contract_type: "domestic",
    customer_level: "normal",
    quotation_id: q.id,
    quotation_no: q.quotation_no,
    amount: totalAmount,
    currency: q.currency || "CNY",
    payment_terms: "款到发货",
    delivery_date: q.estimated_delivery_date,
    remark: q.remark || "",
    version: "V1.0",
    status: "draft",
    items: allItems,
    clauses: [],
    approval_logs: [],
    performance_nodes: getDefaultPerformanceNodes(),
    version_logs: [],
    attachments: [],
    reminders: [],
    created_by: q.creator || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** 默认履约节点 */
function getDefaultPerformanceNodes(): ContractPerformanceNode[] {
  return PERFORMANCE_NODE_TYPES.map((t) => ({
    id: nanoid(),
    node_type: t.value as ContractPerformanceNode["node_type"],
    status: t.statuses[0],
  }));
}

/** 从模板获取默认条款 */
export function getDefaultClauses(
  contractType: ContractType,
  customerLevel: ContractCustomerLevel,
  templates: ContractTemplate[],
): ContractClause[] {
  const template = templates.find(
    (t) =>
      t.contract_type === contractType &&
      t.customer_level === customerLevel &&
      t.status === "active",
  );
  if (template?.clauses?.length) {
    return template.clauses.map((c) => ({ ...c }));
  }
  return [
    {
      type: "payment",
      content: "付款方式：款到发货。",
      sort_order: 1,
    },
    {
      type: "delivery",
      content:
        "交货条款：按合同约定日期交货，逾期按日承担合同金额千分之三违约金。",
      sort_order: 2,
    },
    {
      type: "quality",
      content: "质量标准：符合国家及行业相关标准，提供出厂检验报告。",
      sort_order: 3,
    },
    {
      type: "liability",
      content: "违约责任：任何一方违约，应赔偿守约方因此遭受的直接损失。",
      sort_order: 4,
    },
  ];
}

/** 重新计算合同明细合计金额 */
export function recalcContractItems(items: ContractItem[]): number {
  return items.reduce((sum, item) => sum + (item.total_price || 0), 0);
}

const NODE_FINAL_STATUS: Record<PerformanceNodeType, string> = {
  production: "已完工",
  quality: "已合格",
  shipment: "已发货",
  invoice: "已开票",
  payment: "已结清",
};

const ORDER_STATUS_NODE_MAP: Record<string, Partial<Record<PerformanceNodeType, string>>> = {
  pending: { production: "未开始" },
  approved: { production: "排产中" },
  planned: { production: "生产中" },
  producing: { production: "生产中" },
  inspecting: { production: "已完工", quality: "检验中" },
  shipping: { production: "已完工", quality: "已合格", shipment: "部分发货" },
  shipped: { production: "已完工", quality: "已合格", shipment: "已发货" },
  invoicing: { production: "已完工", quality: "已合格", shipment: "已发货", invoice: "已开票" },
  payment: { production: "已完工", quality: "已合格", shipment: "已发货", invoice: "已开票" },
  completed: { production: "已完工", quality: "已合格", shipment: "已发货", invoice: "已开票", payment: "已结清" },
  cancelled: { production: "已完工", quality: "已合格", shipment: "已发货", invoice: "已开票", payment: "已结清" },
};

/** 根据销售订单状态/日志推断履约节点状态 */
export function syncPerformanceNodesFromSalesOrder(
  contract: Contract,
  salesOrder?: { status?: string; logs?: { status?: string; remark?: string }[] },
): ContractPerformanceNode[] {
  const nodes = (contract.performance_nodes || []).map((n) => ({ ...n }));
  const logStatuses = new Set(salesOrder?.logs?.map((l) => l.status).filter(Boolean));
  const orderStatus = salesOrder?.status || "";

  // 优先根据订单最终状态兜底
  const baseMap = ORDER_STATUS_NODE_MAP[orderStatus] || {};
  for (const node of nodes) {
    const mapped = baseMap[node.node_type];
    if (mapped) {
      node.status = mapped;
      if (!node.actual_date) node.actual_date = new Date().toISOString().split("T")[0];
      continue;
    }
    // 根据日志中是否有更明确的状态进一步细化
    if (node.node_type === "payment" && logStatuses.has("completed")) {
      node.status = "已结清";
      if (!node.actual_date) node.actual_date = new Date().toISOString().split("T")[0];
    }
    if (node.node_type === "invoice" && (logStatuses.has("payment") || logStatuses.has("invoicing"))) {
      node.status = "已开票";
      if (!node.actual_date) node.actual_date = new Date().toISOString().split("T")[0];
    }
    if (node.node_type === "shipment" && (logStatuses.has("shipped") || logStatuses.has("shipping") || logStatuses.has("invoicing"))) {
      node.status = "已发货";
      if (!node.actual_date) node.actual_date = new Date().toISOString().split("T")[0];
    }
    if (node.node_type === "quality" && (logStatuses.has("inspecting") || logStatuses.has("shipped") || logStatuses.has("invoicing"))) {
      node.status = "已合格";
      if (!node.actual_date) node.actual_date = new Date().toISOString().split("T")[0];
    }
    if (node.node_type === "production" && (logStatuses.has("planned") || logStatuses.has("producing") || logStatuses.has("inspecting"))) {
      node.status = "已完工";
      if (!node.actual_date) node.actual_date = new Date().toISOString().split("T")[0];
    }
  }

  // 合同已完结/终止时，未完成的节点强制置为最终状态
  if (contract.status === "completed" || contract.status === "terminated") {
    for (const node of nodes) {
      node.status = NODE_FINAL_STATUS[node.node_type];
      if (!node.actual_date) node.actual_date = new Date().toISOString().split("T")[0];
    }
  }

  return nodes;
}

/** 计算合同整体履约进度（基于履约节点） */
export function calculateProgress(c: Contract): number {
  // 合同已完结/终止时，进度统一为 100%，避免状态与进度不一致
  if (c.status === "completed" || c.status === "terminated") return 100;
  const nodes = c.performance_nodes || [];
  if (!nodes.length) return 0;
  const completedStatuses = ["已完工", "已合格", "已发货", "已开票", "已结清"];
  const done = nodes.filter((n) => completedStatuses.includes(n.status)).length;
  return Math.round((done / nodes.length) * 100);
}

/** 计算合同付款进度 */
export function calculatePaymentProgress(c: Contract): number {
  if (!c.amount) return 0;
  const paymentNode = (c.performance_nodes || []).find(
    (n) => n.node_type === "payment",
  );
  if (!paymentNode) return 0;
  if (paymentNode.status === "已结清") return 100;
  if (paymentNode.status === "部分回款") return 50;
  return 0;
}

/** 检查合同逾期预警 */
export function checkOverdue(c: Contract): OverdueHint[] {
  const hints: OverdueHint[] = [];
  const today = new Date();
  if (c.delivery_date && c.status !== "completed" && c.status !== "terminated") {
    const delivery = new Date(c.delivery_date);
    const diff = Math.ceil(
      (today.getTime() - delivery.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diff > 0) {
      hints.push({
        type: "delivery",
        content: `合同交货期已逾期 ${diff} 天`,
        days: diff,
      });
    }
  }
  return hints;
}

/** 当销售订单完成时，同步更新关联合同为已完结 */
export async function syncContractStatusFromSalesOrders(
  salesOrders: SalesOrder[],
  contracts: Contract[],
  updateContract: (item: Contract) => Promise<void> | void,
) {
  const nowStr = new Date().toISOString();

  for (const order of salesOrders.filter((o) => o.status === "completed")) {
    const contract = contracts.find(
      (c) =>
        c.sales_order_id === order.id ||
        c.sales_order_no === order.order_no,
    );
    if (!contract || contract.status === "completed") continue;

    console.log(
      `[contract-fix] 合同 ${contract.contract_no} 状态 ${contract.status} → completed`,
    );
    await updateContract({
      ...contract,
      status: "completed",
      sign_date: contract.sign_date,
      effective_date: contract.effective_date,
      actual_delivery_date:
        contract.actual_delivery_date ||
        order.payment_date ||
        new Date().toISOString().split("T")[0],
      updated_at: nowStr,
    });
  }
}

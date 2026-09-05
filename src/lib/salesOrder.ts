import type { Quotation, Contract, SalesOrder, SalesOrderItem, OrderLog } from '@/types';
import { nanoid } from '@/lib/utils';

export function generateSalesOrderNo(orders: SalesOrder[]): string {
  const year = new Date().getFullYear();
  const seq = orders.length + 1;
  return `SO-${year}-${String(seq).padStart(4, '0')}`;
}

function buildOrderLog(quotationNo?: string, contractNo?: string): OrderLog[] {
  const source = quotationNo
    ? `由报价单 ${quotationNo} 转入`
    : contractNo
      ? `由合同 ${contractNo} 转入`
      : '手工创建';
  return [
    {
      status: 'pending',
      operator: '当前用户',
      time: new Date().toISOString().slice(0, 16).replace('T', ' '),
      remark: source,
    },
  ];
}

export function createSalesOrderFromQuotation(q: Quotation, orders: SalesOrder[]): SalesOrder {
  const items: SalesOrderItem[] = (q.items || []).map((it) => ({
    product_id: it.product_id,
    sku_id: it.sku_id,
    product_code: it.product_code,
    product_name: it.product_name,
    sku_summary: it.sku_specification || it.product_spec,
    quantity: it.quantity,
    unit: '件',
    unit_price: it.unit_price,
    amount: it.subtotal,
  }));

  const fallbackItems: SalesOrderItem[] = items.length > 0 ? [] : [
    {
      product_id: q.product_id,
      sku_id: q.sku_id,
      product_code: q.product_code,
      product_name: q.product_name,
      sku_summary: q.sku_specification || q.product_spec,
      quantity: q.quantity,
      unit: '件',
      unit_price: q.quantity > 0 ? Number((q.suggested_price / q.quantity).toFixed(2)) : 0,
      amount: q.suggested_price,
    },
  ];

  const order: SalesOrder = {
    id: nanoid(),
    order_no: generateSalesOrderNo(orders),
    order_type: 'B2B',
    channel: '批发',
    customer_id: q.customer_id,
    customer_name: q.customer_name,
    currency: q.currency || 'CNY',
    trade_term: '',
    destination: '',
    delivery_date: q.estimated_delivery_date || '',
    total_amount: items.reduce((sum, it) => sum + it.amount, 0) || q.suggested_price,
    status: 'pending',
    created_at: new Date().toISOString(),
    items: items.length > 0 ? items : fallbackItems,
    logs: buildOrderLog(q.quotation_no, undefined),
  };
  return order;
}

export function createSalesOrderFromContract(c: Contract, orders: SalesOrder[]): SalesOrder {
  const items: SalesOrderItem[] = c.items.map((it) => ({
    product_id: it.product_id,
    product_code: it.product_code,
    product_name: it.product_name,
    sku_summary: it.specification,
    quantity: it.quantity,
    unit: '件',
    unit_price: it.unit_price,
    amount: it.total_price,
  }));

  const order: SalesOrder = {
    id: nanoid(),
    order_no: generateSalesOrderNo(orders),
    order_type: c.contract_type === 'export' ? '外贸' : 'B2B',
    channel: '批发',
    customer_id: c.customer_id || '',
    customer_name: c.customer_name,
    currency: c.currency,
    trade_term: '',
    destination: '',
    delivery_date: c.delivery_date || '',
    total_amount: c.amount,
    status: 'pending',
    created_at: new Date().toISOString(),
    items: items.length > 0 ? items : [],
    logs: buildOrderLog(undefined, c.contract_no),
  };
  return order;
}

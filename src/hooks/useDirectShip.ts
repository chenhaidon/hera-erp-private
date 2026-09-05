import { useState } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { openDirectShip } from '@/lib/production';
import { nanoid } from '@/lib/utils';
import type { WorkOrder } from '@/types';

function now() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

export function useDirectShip() {
  const store = useAppStore();
  const [directShip, setDirectShip] = useState<{ open: boolean; wo: WorkOrder | null; salesOrderNo: string; salesOrderId: string }>({
    open: false,
    wo: null,
    salesOrderNo: '',
    salesOrderId: '',
  });

  function handleDirectShip(wo: WorkOrder) {
    const result = openDirectShip(store, wo);
    if (!result) return;
    setDirectShip({ open: true, wo, salesOrderNo: result.order.order_no, salesOrderId: result.order.id });
  }

  function confirmDirectShip() {
    if (!directShip.wo || !directShip.salesOrderId) return;
    const wo = directShip.wo;
    const order = store.salesOrders.find((o) => o.id === directShip.salesOrderId);
    if (!order) return;
    const nowStr = now();
    store.updateWorkOrder({ ...wo, status: 'closed' });
    store.updateSalesOrder({
      ...order,
      status: 'shipped',
      logs: [...(order.logs || []), { status: 'shipped', operator: '当前用户', time: nowStr, remark: `工单 ${wo.work_no} 完工后直发客户` }],
    });
    store.addStockRecord({
      id: nanoid(),
      record_no: `DO-${Date.now().toString().slice(-6)}`,
      type: 'out',
      subtype: '销售出库',
      product_id: wo.product_id,
      quantity: wo.completed_quantity,
      warehouse: '生产直发',
      location_id: '生产直发',
      related_order: order.order_no,
      related_order_id: order.id,
      handler: '当前用户',
      record_date: nowStr,
      remark: `由工单 ${wo.work_no} 完工后直发客户`,
    });
    toast.success('已直发出库，工单已结案');
    setDirectShip({ open: false, wo: null, salesOrderNo: '', salesOrderId: '' });
  }

  return { directShip, setDirectShip, handleDirectShip, confirmDirectShip };
}

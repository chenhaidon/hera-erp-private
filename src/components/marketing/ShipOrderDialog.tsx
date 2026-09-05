import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { nanoid } from '@/lib/utils';
import { buildShipmentItems, executeShipment } from '@/lib/marketing';
import type { SalesOrder, ShipmentItem } from '@/types';

function now() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

function todayDateTimeLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

interface ShipOrderDialogProps {
  order: SalesOrder | null;
  open: boolean;
  onClose: () => void;
}

export function ShipOrderDialog({ order, open, onClose }: ShipOrderDialogProps) {
  const store = useAppStore();
  const [logisticsCompany, setLogisticsCompany] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [shipmentTime, setShipmentTime] = useState(todayDateTimeLocal());
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (open) {
      setLogisticsCompany('');
      setTrackingNo('');
      setShipmentTime(todayDateTimeLocal());
      setRemark('');
    }
  }, [open]);

  const items = useMemo<ShipmentItem[]>(() => {
    if (!order) return [];
    return buildShipmentItems(order, store.salesOutbounds, store.products);
  }, [order, store.salesOutbounds, store.products]);

  const [shippingItems, setShippingItems] = useState<ShipmentItem[]>([]);
  useEffect(() => {
    setShippingItems(items);
  }, [items]);

  const shippingTotal = useMemo(
    () => shippingItems.reduce((sum, i) => sum + (i.quantity || 0), 0),
    [shippingItems],
  );

  function handleConfirm() {
    if (!order) return;
    if (!logisticsCompany.trim()) {
      toast.error('请填写物流公司');
      return;
    }
    if (!trackingNo.trim()) {
      toast.error('请填写物流单号');
      return;
    }
    if (!shipmentTime) {
      toast.error('请选择发货时间');
      return;
    }
    const selected = shippingItems.filter((i) => (i.quantity || 0) > 0);
    if (selected.length === 0) {
      toast.error('请至少填写一个 SKU 的本次发货数量');
      return;
    }

    const shipmentNo = `SH-${Date.now().toString().slice(-6)}`;
    executeShipment(
      store,
      order,
      shipmentNo,
      order.contract_no || '',
      shipmentTime,
      logisticsCompany.trim(),
      trackingNo.trim(),
      remark.trim(),
      selected,
    ).then(() => {
      toast.success('发货成功，已生成发货记录');
      onClose();
    });
  }

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle>填写发货信息</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>订单编号</Label>
              <Input value={order.order_no} disabled />
            </div>
            <div className="space-y-2">
              <Label>客户</Label>
              <Input value={order.customer_name} disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label>发货产品</Label>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-sm">
              {shippingItems.map((item, idx) => (
                <div key={item.product_id || item.product_code} className="grid grid-cols-5 gap-2 items-center">
                  <span className="text-muted-foreground col-span-2 truncate">{item.product_name}</span>
                  <span className="text-xs text-muted-foreground">{item.sku_summary || '-'}</span>
                  <span className="text-right text-muted-foreground">已发 {item.shipped_quantity || 0}/{item.ordered_quantity || 0}</span>
                  <Input
                    type="number"
                    min={0}
                    max={(item.ordered_quantity || 0) - (item.shipped_quantity || 0)}
                    className="w-20 h-8 justify-self-end"
                    value={item.quantity}
                    onChange={(e) => {
                      const next = [...shippingItems];
                      const val = Number(e.target.value);
                      const max = (item.ordered_quantity || 0) - (item.shipped_quantity || 0);
                      next[idx].quantity = Math.max(0, Math.min(val, max));
                      setShippingItems(next);
                    }}
                  />
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-medium">本次发货合计</span>
                <span className="font-medium">{shippingTotal}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>物流公司 <span className="text-destructive">*</span></Label>
              <Input value={logisticsCompany} onChange={(e) => setLogisticsCompany(e.target.value)} placeholder="请输入物流公司" />
            </div>
            <div className="space-y-2">
              <Label>物流单号 <span className="text-destructive">*</span></Label>
              <Input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} placeholder="请输入物流单号" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>发货时间 <span className="text-destructive">*</span></Label>
            <Input type="datetime-local" value={shipmentTime} onChange={(e) => setShipmentTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="填写发货备注" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleConfirm}>确认发货</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

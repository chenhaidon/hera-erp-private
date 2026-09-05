import { useState } from 'react';
import { ArrowLeft, Check, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAppStore } from '@/store';
import type { WorkOrder, WorkOrderOperation } from '@/types';

const statusMap: Record<string, string> = {
  pending: '待排产',
  issued: '已下发',
  producing: '生产中',
  paused: '已暂停',
  qc: '待质检',
  pending_inbound: '待入库',
  inbound: '已入库',
  completed: '已完成',
  closed: '已结案',
};

const priorityMap: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

export function MobileProductionDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const store = useAppStore();
  const order = store.workOrders.find((w) => w.id === id);
  const updateWorkOrder = useAppStore((s) => s.updateWorkOrder);
  const [reportQty, setReportQty] = useState('');
  const [saving, setSaving] = useState(false);

  const handleToggleOperation = async (index: number) => {
    if (!order) return;
    const nextOperations: WorkOrderOperation[] = [...order.operations];
    nextOperations[index] = { ...nextOperations[index], completed: !nextOperations[index].completed };
    await updateWorkOrder({ ...order, operations: nextOperations });
  };

  const handleReport = async () => {
    if (!order) return;
    const qty = parseInt(reportQty, 10);
    if (!qty || qty <= 0) {
      alert('请输入有效数量');
      return;
    }
    setSaving(true);
    const nextCompleted = order.completed_quantity + qty;
    const nextProgress = Math.min(100, Math.round((nextCompleted / order.plan_quantity) * 100));
    await updateWorkOrder({
      ...order,
      completed_quantity: nextCompleted,
      progress: nextProgress,
      status: nextProgress >= 100 ? 'qc' : 'producing',
    });
    setSaving(false);
    setReportQty('');
    alert('报工成功');
  };

  if (!order) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="border-b border-border bg-background px-4 py-4">
          <button onClick={onBack} className="flex items-center text-sm text-muted-foreground active:opacity-70">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">未找到工单</p>
        </div>
      </div>
    );
  }

  const progress = order.progress ?? (order.plan_quantity ? Math.round((order.completed_quantity / order.plan_quantity) * 100) : 0);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-background px-4 py-4">
        <button onClick={onBack} className="flex items-center text-sm text-muted-foreground active:opacity-70">
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-6">
        <div className="mb-4 flex items-center gap-4">
          {order.product_images?.[0] ? (
            <img src={order.product_images[0]} alt={order.product_name} className="h-20 w-20 rounded-xl object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted">
              <Factory className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-lg font-bold text-foreground">{order.product_name}</p>
            <p className="text-sm text-muted-foreground">{order.product_code}</p>
          </div>
        </div>

        <Card className="mb-4 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">工单号</p>
              <p className="font-medium text-foreground">{order.work_no}</p>
            </div>
            <div>
              <p className="text-muted-foreground">状态</p>
              <p className="font-medium text-foreground">{statusMap[order.status] || order.status}</p>
            </div>
            <div>
              <p className="text-muted-foreground">优先级</p>
              <p className="font-medium text-foreground">{priorityMap[order.priority] || order.priority}</p>
            </div>
            <div>
              <p className="text-muted-foreground">计划数量</p>
              <p className="font-medium text-foreground">{order.plan_quantity}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">完成进度</span>
              <span className="text-foreground">{order.completed_quantity}/{order.plan_quantity} ({progress}%)</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </Card>

        <Card className="mb-4 p-4">
          <p className="mb-4 text-base font-semibold text-foreground">工序进度</p>
          <div className="space-y-3">
            {order.operations.map((op, index) => (
              <button
                key={op.name}
                className="flex w-full items-center justify-between rounded-xl bg-muted/50 p-3 text-left active:opacity-70"
                onClick={() => handleToggleOperation(index)}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${op.completed ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                    {op.completed && <Check className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${op.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{op.name}</p>
                    {op.completed_qty != null && <p className="text-xs text-muted-foreground">已完成 {op.completed_qty} 件</p>}
                  </div>
                </div>
                {op.is_bottleneck && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">瓶颈</span>}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-4 text-base font-semibold text-foreground">报工</p>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="本次完成数量"
              value={reportQty}
              onChange={(e) => setReportQty(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleReport} disabled={saving || !reportQty}>
              {saving ? '提交中...' : '报工'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

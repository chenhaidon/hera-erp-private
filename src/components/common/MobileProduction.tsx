import { ChevronRight, Factory } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAppStore } from '@/store';
import type { WorkOrder } from '@/types';

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待排产', color: 'bg-slate-500' },
  issued: { label: '已下发', color: 'bg-blue-500' },
  producing: { label: '生产中', color: 'bg-amber-500' },
  paused: { label: '已暂停', color: 'bg-orange-500' },
  qc: { label: '待质检', color: 'bg-purple-500' },
  pending_inbound: { label: '待入库', color: 'bg-emerald-500' },
  inbound: { label: '已入库', color: 'bg-green-600' },
  completed: { label: '已完成', color: 'bg-teal-600' },
  closed: { label: '已结案', color: 'bg-slate-400' },
};

export function MobileProduction({ onSelect }: { onSelect?: (id: string) => void }) {
  const orders = useAppStore((s) => s.workOrders);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-background px-4 pb-3 pt-6">
        <p className="text-xl font-bold text-foreground">生产工单</p>
        <p className="mt-1 text-sm text-muted-foreground">查看工单、执行领料与报工</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-6">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Factory className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">暂无工单</p>
          </div>
        ) : (
          orders.map((item: WorkOrder) => {
            const progress = item.progress ?? (item.plan_quantity ? Math.round((item.completed_quantity / item.plan_quantity) * 100) : 0);
            const status = statusMap[item.status] ?? { label: item.status, color: 'bg-slate-500' };
            return (
              <button
                key={item.id}
                className="mb-3 w-full text-left"
                onClick={() => onSelect?.(item.id)}
              >
                <Card className="p-4 active:opacity-90">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-base font-semibold text-foreground">{item.work_no}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs text-white ${status.color}`}>{status.label}</span>
                  </div>
                  <p className="mb-1 text-sm text-foreground">
                    {item.product_name} ({item.product_code})
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="mr-4 flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.completed_quantity}/{item.plan_quantity} ({progress}%)
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Card>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

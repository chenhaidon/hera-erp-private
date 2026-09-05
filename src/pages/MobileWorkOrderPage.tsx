import { useMemo } from 'react';
import { ClipboardList, CheckCircle2, Wrench, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WORK_ORDER_STATUS, getStatusLabel } from '@/lib/data';
import type { WorkOrder } from '@/types';
import { MobileUserMenu } from '@/components/common/MobileUserMenu';

interface Props {
  workOrder: WorkOrder;
  isAdmin: boolean;
  role: string;
  onBack: () => void;
  onAction: (action: 'report' | 'inspect' | 'outsourcing') => void;
}

const OP_STATUS_LABEL: Record<string, string> = {
  pending: '待开始',
  pending_start: '待开工',
  running: '生产中',
  qc: '质检中',
  completed: '已完成',
  closed: '已关闭',
};

function StatusBadge({ status }: { status: string }) {
  const label = getStatusLabel(status, WORK_ORDER_STATUS);
  const colorMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    issued: 'bg-blue-100 text-blue-700',
    producing: 'bg-orange-100 text-orange-700',
    inspecting: 'bg-pink-100 text-pink-700',
    completed: 'bg-green-100 text-green-700',
    closed: 'bg-green-100 text-green-700',
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[status] || 'bg-muted text-muted-foreground'}`}>{label}</span>;
}

export default function MobileWorkOrderPage({ workOrder, isAdmin, role, onBack, onAction }: Props) {
  const currentOp = useMemo(() => {
    return workOrder.operations.find((o) => !o.completed) || workOrder.operations[workOrder.operations.length - 1];
  }, [workOrder.operations]);

  const hasOutsourcing = useMemo(() => {
    return workOrder.operations.some((o) => o.category === 'outsourcing' && o.outsourcing_status === 'pending');
  }, [workOrder.operations]);

  const canOutsource = useMemo(() => {
    return currentOp?.category === 'outsourcing' && currentOp.outsourcing_status === 'pending';
  }, [currentOp]);

  // 与 PC 端保持一致：按工序完成比例的平均值计算总进度
  const progress = useMemo(() => {
    const ops = workOrder.operations || [];
    if (ops.length === 0) return workOrder.progress ?? 0;
    const opProgress =
      ops.reduce((sum, o) => {
        const ratio = o.plan_qty > 0 ? o.completed_qty / o.plan_qty : 0;
        return sum + Math.min(ratio, 1);
      }, 0) / ops.length;
    return Math.round(opProgress * 100);
  }, [workOrder.operations, workOrder.progress]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center border-b border-border bg-card px-4">
        <h1 className="flex-1 truncate text-center text-lg font-semibold text-foreground">工单信息</h1>
        <MobileUserMenu />
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {/* 工单概要卡片 */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">工单号</p>
              <p className="mt-0.5 truncate text-lg font-semibold text-foreground">{workOrder.work_no}</p>
            </div>
            <StatusBadge status={workOrder.status} />
          </div>
          <div className="mt-3 rounded-xl bg-muted/60 p-3">
            <p className="text-sm text-muted-foreground">产品名称</p>
            <p className="mt-0.5 text-base font-medium text-foreground">{workOrder.product_name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{workOrder.product_code}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">订单数量</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{workOrder.plan_quantity}</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">已完成</p>
              <p className="mt-1 text-lg font-semibold text-primary">{workOrder.completed_quantity}</p>
            </div>
          </div>
          {/* 进度条 */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>生产进度</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
          </div>
          {workOrder.end_date && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5" />
              <span>交货期：{workOrder.end_date}</span>
            </div>
          )}
        </div>

        {/* 当前工序 */}
        {currentOp && (
          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs font-medium text-primary">当前工序</p>
            <p className="mt-1 text-base font-semibold text-foreground">{currentOp.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentOp.completed_qty}/{currentOp.plan_qty} · {OP_STATUS_LABEL[currentOp.status] || currentOp.status}
            </p>
          </div>
        )}

        {/* 工序列表 */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-foreground">工序列表</p>
          <div className="space-y-3">
            {workOrder.operations.map((op) => (
              <div key={op.code} className="flex items-center gap-3">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${op.completed ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {op.completed ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-medium">{op.seq}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${op.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{op.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {op.completed_qty}/{op.plan_qty} · {OP_STATUS_LABEL[op.status] || op.status}
                  </p>
                </div>
                {op.category === 'outsourcing' && <Badge variant="outline" className="shrink-0 text-xs">外协</Badge>}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 操作按钮区 */}
      <div className="border-t border-border bg-card p-4">
        {isAdmin ? (
          <div className="grid grid-cols-3 gap-3">
            <Button className="h-12" onClick={() => onAction('report')}>
              <ClipboardList className="mr-1.5 h-4 w-4" />
              报工
            </Button>
            <Button variant="secondary" className="h-12" onClick={() => onAction('inspect')}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              质检
            </Button>
            <Button variant="outline" className="h-12" onClick={() => onAction('outsourcing')} disabled={!canOutsource}>
              <Wrench className="mr-1.5 h-4 w-4" />
              {canOutsource ? '外协' : '当前工序不可外协'}
            </Button>
          </div>
        ) : role === 'quality' ? (
          <Button className="h-12 w-full" onClick={() => onAction('inspect')}>
            <CheckCircle2 className="mr-2 h-5 w-5" />
            质检录入
          </Button>
        ) : role === 'outsourcing' ? (
          <Button className="h-12 w-full" onClick={() => onAction('outsourcing')} disabled={!canOutsource}>
            <Wrench className="mr-2 h-5 w-5" />
            {canOutsource ? '外协发起' : '当前工序不可外协'}
          </Button>
        ) : (
          <Button className="h-12 w-full" onClick={() => onAction('report')}>
            <ClipboardList className="mr-2 h-5 w-5" />
            工序报工
          </Button>
        )}
      </div>
    </div>
  );
}
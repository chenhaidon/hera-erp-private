import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore, type AppState } from '@/store';
import { toast } from 'sonner';
import { MobileUserMenu } from '@/components/common/MobileUserMenu';
import { nanoid } from '@/lib/utils';

interface Operation {
  name: string;
  code: string;
  seq: number;
  status: string;
  completed_qty: number;
  plan_qty: number;
  category?: string;
  process_id?: string;
}

interface WorkOrder {
  id: string;
  work_no: string;
  product_code: string;
  product_name: string;
  plan_quantity: number;
  operations: Operation[];
}

interface MobileScanReportPageProps {
  workNo?: string;
  opCode?: string;
  onBack?: () => void;
  onComplete?: () => void;
}

export default function MobileScanReportPage({
  workNo: propWorkNo,
  opCode: propOpCode,
  onBack,
  onComplete,
}: MobileScanReportPageProps = {}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workNo = propWorkNo ?? searchParams.get('workNo') ?? '';
  const opCode = propOpCode ?? searchParams.get('opCode') ?? '';
  const { profile, refreshLoginExpiry } = useAuth();
  const store = useAppStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [qty, setQty] = useState('');

  useEffect(() => {
    if (!workNo) {
      navigate('/mobile/scan', { replace: true });
      return;
    }
    let cancelled = false;
    loadWorkOrderFromStore(workNo, store)
      .then((wo) => {
        if (cancelled) return;
        setWorkOrder(wo);
        const op = opCode
          ? wo.operations.find((o) => o.code === opCode) || findCurrentOperation(wo.operations)
          : findCurrentOperation(wo.operations);
        setOperation(op || null);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : '加载工单失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workNo, opCode, navigate]);

  const remaining = operation ? Math.max(0, operation.plan_qty - operation.completed_qty) : 0;

  const handleSubmit = async () => {
    if (!workOrder || !operation) return;
    const completedQty = Number(qty);
    if (!completedQty || completedQty <= 0) {
      toast.error('请输入本次完成数量');
      return;
    }
    if (completedQty > remaining) {
      toast.error(`本次完成数量不能超过剩余数量 ${remaining}`);
      return;
    }
    setSubmitting(true);
    try {
      const raw = store.workOrders.find((w) => w.work_no === workOrder.work_no);
      if (!raw) throw new Error('工单不存在');

      const product = store.products.find((p) => p.id === raw.product_id);
      const productStep = product?.process_steps?.find((s) => s.code === operation.code);
      const route = store.processRoutes.find((r) => r.category === raw.product_category);
      const step = route?.steps.find((s) => s.code === operation.code);
      const processItem = store.processes.find((p) => p.id === operation.process_id);
      const unitPrice =
        productStep?.piece_price ??
        productStep?.price ??
        step?.piece_price ??
        step?.price ??
        processItem?.piece_price ??
        processItem?.price ??
        0;

      const emp = store.employees.find((e) => e.name === profile?.full_name);
      const report = {
        id: nanoid(),
        operator_id: emp?.id,
        operator_name: profile?.full_name || '手机报工',
        qty: completedQty,
        unit_price: unitPrice,
        amount: Number((completedQty * unitPrice).toFixed(2)),
        report_time: new Date().toISOString().split('T')[0],
        work_no: raw.work_no,
        operation_name: operation.name,
        operation_code: operation.code,
      };

      const planQty = raw.plan_quantity || 0;
      const updatedOps = raw.operations.map((op) => {
        if (op.code !== operation.code) return op;
        const newCompleted = (op.completed_qty || 0) + completedQty;
        const isCompleted = newCompleted >= planQty;
        return {
          ...op,
          completed: isCompleted,
          completed_qty: newCompleted,
          status: isCompleted ? ('qc' as const) : ('running' as const),
          reports: [...(op.reports || []), report],
        };
      });

      const activeOp = updatedOps.find((op) => !op.completed);
      const newCompletedQty = activeOp ? (activeOp.completed_qty || 0) : planQty;
      const progress = planQty > 0 ? Math.round((newCompletedQty / planQty) * 100) : 0;
      const status = progress >= 100 ? ('qc' as const) : ('producing' as const);

      await store.updateWorkOrder({
        ...raw,
        status,
        completed_quantity: newCompletedQty,
        progress,
        operations: updatedOps,
      });
      toast.success('报工成功');
      // 操作成功后刷新登录过期时间
      await refreshLoginExpiry();
      if (onComplete) {
        onComplete();
      } else {
        navigate('/mobile/scan', { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || '报工失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const goBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/mobile/scan', { replace: true });
    }
  };

  if (!workOrder || !operation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <p className="text-muted-foreground">未找到可报工工序</p>
        <Button className="mt-4 w-full max-w-sm" onClick={goBack}>
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center border-b border-border bg-card px-4">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-center text-lg font-semibold text-foreground">极简报工</h1>
        <MobileUserMenu />
      </header>

      <main className="flex flex-1 flex-col p-4">
        <Card className="mb-4">
          <CardContent className="space-y-2 p-4">
            <InfoRow label="工单编号" value={workOrder.work_no} />
            <InfoRow label="产品款号" value={workOrder.product_code} />
            <InfoRow label="品名" value={workOrder.product_name} />
            <InfoRow label="工序" value={operation.name} />
            <InfoRow label="计划数量" value={String(operation.plan_qty)} />
            <InfoRow label="已完成数量" value={String(operation.completed_qty)} />
            <InfoRow label="剩余数量" value={String(remaining)} />
          </CardContent>
        </Card>

        <div className="flex flex-1 flex-col items-center justify-center">
          <label className="mb-3 text-2xl font-bold text-foreground">本次完成数量</label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={remaining}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-20 w-full max-w-sm text-center text-4xl font-bold"
            placeholder="0"
            autoFocus
          />
          <p className="mt-2 text-sm text-muted-foreground">剩余可报：{remaining} 件</p>
        </div>

        <div className="sticky bottom-0 mt-4 bg-background pb-4 pt-2">
          <Button
            size="lg"
            className="h-14 w-full rounded-2xl text-lg font-semibold active:scale-[0.98]"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
            {submitting ? '提交中...' : '提交报工'}
          </Button>
        </div>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function loadWorkOrderFromStore(workNo: string, store: AppState): Promise<WorkOrder> {
  const raw = store.workOrders.find((w) => w.work_no === workNo);
  if (!raw) return Promise.reject(new Error('工单不存在'));
  return Promise.resolve({
    id: raw.id,
    work_no: raw.work_no,
    product_code: raw.product_code,
    product_name: raw.product_name,
    plan_quantity: raw.plan_quantity,
    operations: (raw.operations || []).map((op) => ({
      name: op.name || '',
      code: op.code || String(op.seq || 1),
      seq: op.seq || 1,
      status: op.status || 'pending',
      completed_qty: op.completed_qty || 0,
      plan_qty: op.plan_qty || raw.plan_quantity || 0,
      category: op.category || 'internal',
      process_id: op.process_id,
    })),
  });
}

function findCurrentOperation(operations: Operation[]) {
  const sorted = [...operations].sort((a, b) => a.seq - b.seq);
  return sorted.find((o) => o.status !== 'completed' && o.status !== 'closed') || sorted[sorted.length - 1];
}

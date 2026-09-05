import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/store';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { MobileUserMenu } from '@/components/common/MobileUserMenu';

interface Operation {
  name: string;
  code: string;
  seq: number;
  status: string;
  completed_qty: number;
  plan_qty: number;
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

interface MobileScanInspectPageProps {
  workNo?: string;
  opCode?: string;
  onBack?: () => void;
  onComplete?: () => void;
}

export default function MobileScanInspectPage({
  workNo: propWorkNo,
  opCode: propOpCode,
  onBack,
  onComplete,
}: MobileScanInspectPageProps = {}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workNo = propWorkNo ?? searchParams.get('workNo') ?? '';
  const opCode = propOpCode ?? searchParams.get('opCode') ?? '';
  const store = useAppStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [qualified, setQualified] = useState('');
  const [defective, setDefective] = useState('');
  const [defectReason, setDefectReason] = useState('');
  const { refreshLoginExpiry } = useAuth();

  useEffect(() => {
    if (!workNo) {
      navigate('/mobile/scan', { replace: true });
      return;
    }
    if (store.workOrders.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[MobileScanInspectPage] waiting workOrders load...', { workNo });
      return;
    }
    const raw = store.workOrders.find((w) => w.work_no === workNo);
    if (!raw) {
      // eslint-disable-next-line no-console
      console.warn('[MobileScanInspectPage] workOrder not found', { workNo, total: store.workOrders.length });
      toast.error('工单不存在');
      setLoading(false);
      return;
    }
    // eslint-disable-next-line no-console
    console.log('[MobileScanInspectPage] workOrder found', { id: raw.id, work_no: raw.work_no, ops: raw.operations?.length });
    const wo: WorkOrder = {
      id: raw.id,
      work_no: raw.work_no,
      product_code: raw.product_code,
      product_name: raw.product_name,
      plan_quantity: raw.plan_quantity,
      operations: (raw.operations || []).map((op, idx) => ({
        name: op.name || '',
        code: op.code || String(idx + 1),
        seq: op.seq ?? idx + 1,
        status: op.status || 'pending',
        completed_qty: op.completed_qty ?? 0,
        plan_qty: op.plan_qty ?? raw.plan_quantity ?? 0,
        process_id: op.process_id,
      })),
    };
    setWorkOrder(wo);
    const op = opCode
      ? wo.operations.find((o) => o.code === opCode) || findPendingQcOperation(wo.operations)
      : findPendingQcOperation(wo.operations);
    setOperation(op || null);
    if (op) {
      const remaining = op.status === 'completed' || op.status === 'closed' ? 0 : Math.max(0, op.completed_qty);
      setQualified(String(remaining));
    }
    setLoading(false);
  }, [workNo, opCode, navigate, store.workOrders]);

  const handleSubmit = async () => {
    if (!workOrder || !operation) return;
    if (operation.status === 'completed' || operation.status === 'closed') {
      toast.error('该工序已质检完成');
      return;
    }
    const qualifiedQty = Number(qualified) || 0;
    const defectiveQty = Number(defective) || 0;
    const total = qualifiedQty + defectiveQty;
    const remaining = Math.max(0, operation.completed_qty);
    if (total <= 0) {
      toast.error('请输入质检数量');
      return;
    }
    if (total !== remaining) {
      toast.error(`本次合格数量 + 本次不良数量必须等于待检数量 ${remaining}`);
      return;
    }
    if (defectiveQty > 0 && !defectReason.trim()) {
      toast.error('存在不良数量时，请填写不良原因');
      return;
    }
    setSubmitting(true);
    try {
      const raw = store.workOrders.find((w) => w.work_no === workOrder.work_no);
      if (!raw) throw new Error('工单不存在');
      const updatedOps = raw.operations.map((op) => {
        if (op.code !== operation.code) return op;
        return { ...op, status: 'completed' as const };
      });
      await store.updateWorkOrder({ ...raw, operations: updatedOps });

      // eslint-disable-next-line no-console
      console.log('[MobileScanInspectPage] submit success', { workNo: workOrder.work_no, qualifiedQty, defectiveQty });
      toast.success('质检提交成功');
      // 操作成功后刷新登录过期时间
      await refreshLoginExpiry();
      if (onComplete) {
        onComplete();
      } else {
        navigate('/mobile/scan', { replace: true });
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[MobileScanInspectPage] submit error', err);
      toast.error(err.message || '质检失败');
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
        <p className="text-muted-foreground">未找到待检工序</p>
        <Button className="mt-4 w-full max-w-sm" onClick={goBack}>
          返回
        </Button>
      </div>
    );
  }

  const remaining = operation.status === 'completed' || operation.status === 'closed' ? 0 : Math.max(0, operation.completed_qty);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center border-b border-border bg-card px-4">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-center text-lg font-semibold text-foreground">质检录入</h1>
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
            <InfoRow label="待检数量" value={String(remaining)} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="text-center">
            <label className="mb-3 block text-2xl font-bold text-foreground">本次合格数量</label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={remaining}
              value={qualified}
              onChange={(e) => setQualified(e.target.value)}
              className="h-20 w-full text-center text-4xl font-bold"
              placeholder="0"
            />
          </div>
          <div className="text-center">
            <label className="mb-3 block text-2xl font-bold text-foreground">本次不良数量</label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={remaining}
              value={defective}
              onChange={(e) => setDefective(e.target.value)}
              className="h-20 w-full text-center text-4xl font-bold"
              placeholder="0"
            />
          </div>
          {Number(defective) > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">不良原因</label>
              <Input
                value={defectReason}
                onChange={(e) => setDefectReason(e.target.value)}
                placeholder="请填写不良原因"
                className="h-12 w-full"
              />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 mt-4 bg-background pb-4 pt-2">
          <Button
            size="lg"
            className="h-14 w-full rounded-2xl text-lg font-semibold active:scale-[0.98]"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
            {submitting ? '提交中...' : '提交质检'}
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

function findPendingQcOperation(operations: Operation[]) {
  const sorted = [...operations].sort((a, b) => a.seq - b.seq);
  // 优先选正在进行质检的工序
  const qc = sorted.find((o) => o.status === 'qc');
  if (qc) return qc;
  // 次选还有剩余待检数量的生产工序
  const inProgress = sorted.find(
    (o) =>
      (o.status === 'running' || o.status === 'pending_start' || o.status === 'pending') &&
      o.completed_qty < o.plan_qty
  );
  if (inProgress) return inProgress;
  // 最后回退到最后一个工序
  return sorted[sorted.length - 1];
}

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Hammer,
  ClipboardCheck,
  Send,
  LayoutDashboard,
  FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/store';
import { toast } from 'sonner';
import { MobileUserMenu } from '@/components/common/MobileUserMenu';
import { fetchFactories, createShipment } from '@/services/outsourcing';
import type { OutsourceFactory } from '@/types';

interface OperationInfo {
  name: string;
  code: string;
  seq: number;
  status: string;
  completed_qty: number;
  plan_qty: number;
  category?: string;
  outsourcing_status?: string;
}

interface WorkOrderInfo {
  id: string;
  work_no: string;
  contract_no?: string;
  product_code: string;
  product_name: string;
  plan_quantity: number;
  operations: OperationInfo[];
}

type TestRole = 'worker' | 'quality' | 'outsourcing' | 'dashboard';

const roleTabs: { key: TestRole; label: string; icon: typeof Hammer }[] = [
  { key: 'worker', label: '工人报工', icon: Hammer },
  { key: 'quality', label: '质检录入', icon: ClipboardCheck },
  { key: 'outsourcing', label: '外协发起', icon: Send },
  { key: 'dashboard', label: '全局看板', icon: LayoutDashboard },
];

export default function MobileScanAdminPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workNo = searchParams.get('workNo') || '';
  const { profile } = useAuth();
  const store = useAppStore();
  const [loading, setLoading] = useState(true);
  const [workOrder, setWorkOrder] = useState<WorkOrderInfo | null>(null);
  const [testRole, setTestRole] = useState<TestRole>('dashboard');

  useEffect(() => {
    if (!workNo) {
      navigate('/mobile/scan', { replace: true });
      return;
    }
    // 等待 DataProvider 加载完成
    if (store.workOrders.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[MobileScanAdminPage] waiting workOrders load...', { workNo });
      return;
    }
    const raw = store.workOrders.find((w) => w.work_no === workNo);
    if (!raw) {
      // eslint-disable-next-line no-console
      console.warn('[MobileScanAdminPage] workOrder not found', { workNo, total: store.workOrders.length });
      toast.error('工单不存在');
      navigate('/mobile/scan', { replace: true });
      return;
    }
    // eslint-disable-next-line no-console
    console.log('[MobileScanAdminPage] workOrder found', { id: raw.id, work_no: raw.work_no });
    setWorkOrder({
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
        category: op.category || 'internal',
        outsourcing_status: op.outsourcing_status,
      })),
    });
    setLoading(false);
  }, [workNo, navigate, store.workOrders]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!workOrder) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="flex h-14 items-center px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/mobile/scan', { replace: true })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex-1 text-center text-lg font-semibold text-foreground">多角色测试台</h1>
          <MobileUserMenu />
        </div>
        <div className="grid grid-cols-4 gap-2 px-3 pb-3">
          {roleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTestRole(tab.key)}
              className={`flex flex-col items-center rounded-xl py-2 transition-colors ${
                testRole === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="mt-1 text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-2 bg-primary/10 px-4 py-2">
        <FlaskConical className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-foreground">
          测试模式 · 工单 {workOrder.work_no} · 仅管理员可见，不影响一线正式使用
        </p>
      </div>

      <main className="flex-1 overflow-y-auto p-4">
        {testRole === 'worker' && <WorkerView workOrder={workOrder} operatorRole={profile?.role || 'admin'} />}
        {testRole === 'quality' && <QualityView workOrder={workOrder} />}
        {testRole === 'outsourcing' && <OutsourcingView workOrder={workOrder} />}
        {testRole === 'dashboard' && <DashboardView workOrder={workOrder} />}
      </main>
    </div>
  );
}

/* ============ 工人报工 ============ */
function WorkerView({ workOrder, operatorRole }: { workOrder: WorkOrderInfo; operatorRole: string }) {
  const navigate = useNavigate();
  const store = useAppStore();
  const operation = findCurrentOperation(workOrder.operations);
  const [qty, setQty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const remaining = operation ? Math.max(0, operation.plan_qty - operation.completed_qty) : 0;

  const handleSubmit = async () => {
    if (!operation) return;
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
      const planQty = raw.plan_quantity || 0;
      const updatedOps = raw.operations.map((op) => {
        if (op.code !== operation.code) return op;
        const newCompleted = (op.completed_qty || 0) + completedQty;
        const isCompleted = newCompleted >= planQty;
        return { ...op, completed: isCompleted, completed_qty: newCompleted, status: isCompleted ? ('qc' as const) : ('running' as const) };
      });
      const activeOp = updatedOps.find((op) => !op.completed);
      const newCompletedQty = activeOp ? (activeOp.completed_qty || 0) : planQty;
      const progress = planQty > 0 ? Math.round((newCompletedQty / planQty) * 100) : 0;
      store.updateWorkOrder({ ...raw, status: progress >= 100 ? ('qc' as const) : ('producing' as const), completed_quantity: newCompletedQty, progress, operations: updatedOps });
      // eslint-disable-next-line no-console
      console.log('[MobileScanAdminPage] WorkerView submit success', { workNo: workOrder.work_no, completedQty, operatorRole });
      toast.success('报工成功');
      navigate('/mobile/scan', { replace: true });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[MobileScanAdminPage] WorkerView submit error', err);
      toast.error(err.message || '报工失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!operation) {
    return <EmptyHint text="暂无可报工工序" />;
  }

  return (
    <div className="flex flex-col">
      <OrderInfoCard workOrder={workOrder} operation={operation} />
      <div className="mt-6 flex flex-col items-center">
        <label className="mb-3 text-2xl font-bold text-foreground">本次完成数量</label>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={remaining}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-20 w-full text-center text-4xl font-bold"
          placeholder="0"
          autoFocus
        />
        <p className="mt-2 text-sm text-muted-foreground">剩余可报：{remaining} 件</p>
      </div>
      <SubmitButton submitting={submitting} onClick={handleSubmit} label="提交报工" />
    </div>
  );
}

/* ============ 质检录入 ============ */
function QualityView({ workOrder }: { workOrder: WorkOrderInfo }) {
  const navigate = useNavigate();
  const store = useAppStore();
  const operation = findPendingQcOperation(workOrder.operations);
  const [qualified, setQualified] = useState('');
  const [defective, setDefective] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const remaining = operation ? Math.max(0, operation.plan_qty - operation.completed_qty) : 0;

  useEffect(() => {
    if (operation) setQualified(String(Math.max(0, operation.plan_qty - operation.completed_qty)));
  }, [operation]);

  const handleSubmit = async () => {
    if (!operation) return;
    const qualifiedQty = Number(qualified) || 0;
    const defectiveQty = Number(defective) || 0;
    const total = qualifiedQty + defectiveQty;
    if (total <= 0) {
      toast.error('请输入质检数量');
      return;
    }
    if (total > remaining) {
      toast.error(`本次合格数量 + 本次不良数量不能超过剩余数量 ${remaining}`);
      return;
    }
    setSubmitting(true);
    try {
      const raw = store.workOrders.find((w) => w.work_no === workOrder.work_no);
      if (!raw) throw new Error('工单不存在');
      const updatedOps = raw.operations.map((op) => {
        if (op.code !== operation.code) return op;
        return { ...op, status: 'completed' as const, completed_qty: (op.completed_qty || 0) + qualifiedQty };
      });
      store.updateWorkOrder({ ...raw, operations: updatedOps });
      // eslint-disable-next-line no-console
      console.log('[MobileScanAdminPage] QualityView submit success', { workNo: workOrder.work_no, qualifiedQty, defectiveQty });
      toast.success('质检提交成功');
      navigate('/mobile/scan', { replace: true });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[MobileScanAdminPage] QualityView submit error', err);
      toast.error(err.message || '质检失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!operation) {
    return <EmptyHint text="暂无待检工序" />;
  }

  return (
    <div className="flex flex-col">
      <OrderInfoCard workOrder={workOrder} operation={operation} />
      <div className="mt-6 space-y-6">
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
      </div>
      <SubmitButton submitting={submitting} onClick={handleSubmit} label="提交质检" />
    </div>
  );
}

/* ============ 外协发起 ============ */
function OutsourcingView({ workOrder }: { workOrder: WorkOrderInfo }) {
  const navigate = useNavigate();
  const store = useAppStore();
  const operation = findOutsourcingOperation(workOrder.operations);
  const [factories, setFactories] = useState<OutsourceFactory[]>([]);
  const [factoryId, setFactoryId] = useState('');
  const [qty, setQty] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchFactories()
      .then((fs) => {
        const enabled = fs.filter((f) => f.status === 'enabled');
        setFactories(enabled);
      })
      .catch(() => setFactories([]));
  }, []);

  useEffect(() => {
    if (operation) setQty(String(operation.plan_qty));
  }, [operation]);

  const handleSubmit = async () => {
    if (!operation || !factoryId) return;
    const shipmentQty = Number(qty);
    if (!shipmentQty || shipmentQty <= 0) {
      toast.error('请输入发料数量');
      return;
    }
    if (shipmentQty > operation.plan_qty) {
      toast.error(`发料数量不能超过计划数量 ${operation.plan_qty}`);
      return;
    }
    setSubmitting(true);
    try {
      const factory = factories.find((f) => f.id === factoryId);
      if (!factory) throw new Error('请选择外协厂');
      const now = new Date().toISOString();
      const shipmentNo = `OS-${Date.now().toString().slice(-8)}`;
      const saved = await createShipment(
        {
          shipment_no: shipmentNo,
          contract_no: workOrder.contract_no || '',
          work_order_id: workOrder.id,
          work_order_no: workOrder.work_no,
          operation_code: operation.code,
          operation_name: operation.name,
          product_code: workOrder.product_code,
          product_name: workOrder.product_name,
          factory_id: factory.id,
          factory_name: factory.factory_name,
          shipment_date: now.split('T')[0],
          shipment_quantity: shipmentQty,
          status: 'pending',
        },
        [
          {
            id: '',
            shipment_id: '',
            material_code: workOrder.product_code || '',
            material_name: workOrder.product_name || '半成品',
            quantity: shipmentQty,
            unit: '件',
          },
        ],
      );
      store.addOutsourceShipment(saved);
      const raw = store.workOrders.find((w) => w.work_no === workOrder.work_no);
      if (raw) {
        await store.updateWorkOrder({
          ...raw,
          operations: raw.operations.map((op) =>
            op.code === operation.code ? { ...op, outsourcing_status: 'dispatched' } : op
          ),
        });
      }
      toast.success('外协发料单已生成');
      navigate('/mobile/scan', { replace: true });
    } catch (err: any) {
      toast.error(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!operation) {
    return <EmptyHint text="该工单无待开工的外协工序" />;
  }

  return (
    <div className="flex flex-col">
      <OrderInfoCard workOrder={workOrder} operation={operation} />
      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label>外协厂</Label>
          <Select value={factoryId} onValueChange={setFactoryId}>
            <SelectTrigger>
              <SelectValue placeholder="请选择外协厂" />
            </SelectTrigger>
            <SelectContent>
              {factories.length === 0 ? (
                <SelectItem value="__empty__" disabled>
                  暂无可用外协厂
                </SelectItem>
              ) : (
                factories.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.factory_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>发料数量</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={operation.plan_qty}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-14 text-center text-2xl font-bold"
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">最多可发 {operation.plan_qty} 件</p>
        </div>
      </div>
      <SubmitButton submitting={submitting} onClick={handleSubmit} label="提交外协" disabled={!factoryId} />
    </div>
  );
}

/* ============ 全局看板 ============ */
function DashboardView({ workOrder }: { workOrder: WorkOrderInfo }) {
  const sorted = [...workOrder.operations].sort((a, b) => a.seq - b.seq);
  // 与 PC 端保持一致：按工序完成比例的平均值计算总进度
  const overall =
    sorted.length > 0
      ? Math.round(
          (sorted.reduce((sum, o) => {
            const ratio = o.plan_qty > 0 ? o.completed_qty / o.plan_qty : 0;
            return sum + Math.min(ratio, 1);
          }, 0) /
            sorted.length) *
            100,
        )
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">工单进度</span>
            <span className="text-lg font-bold text-primary">{overall}%</span>
          </div>
          <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${overall}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="工单编号" value={workOrder.work_no} />
            <Stat label="产品款号" value={workOrder.product_code} />
            <Stat label="品名" value={workOrder.product_name} />
            <Stat label="计划数量" value={`${workOrder.plan_quantity} 件`} />
          </div>
        </CardContent>
      </Card>

      <p className="text-sm font-semibold text-foreground">工序进度</p>
      <div className="space-y-3">
        {sorted.map((op, idx) => {
          const progress = op.plan_qty > 0 ? Math.round((op.completed_qty / op.plan_qty) * 100) : 0;
          return (
            <Card key={idx}>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">#{op.seq}</span>
                    <span className="truncate font-medium text-foreground">{op.name}</span>
                  </div>
                  <StatusBadge status={op.status} />
                </div>
                <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{op.completed_qty} / {op.plan_qty} 件</span>
                  <span>{progress}%</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============ 共享组件 ============ */
function OrderInfoCard({ workOrder, operation }: { workOrder: WorkOrderInfo; operation: OperationInfo }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <InfoRow label="工单编号" value={workOrder.work_no} />
        <InfoRow label="产品款号" value={workOrder.product_code} />
        <InfoRow label="品名" value={workOrder.product_name} />
        <InfoRow label="工序" value={operation.name} />
        <InfoRow label="计划数量" value={String(operation.plan_qty)} />
        <InfoRow label="已完成数量" value={String(operation.completed_qty)} />
      </CardContent>
    </Card>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function SubmitButton({
  submitting,
  onClick,
  label,
  disabled,
}: {
  submitting: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="sticky bottom-0 mt-6 bg-background pb-4 pt-2">
      <Button
        size="lg"
        className="h-14 w-full rounded-2xl text-lg font-semibold active:scale-[0.98]"
        onClick={onClick}
        disabled={submitting || disabled}
      >
        {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
        {submitting ? '提交中...' : label}
      </Button>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: '已完成', cls: 'bg-emerald-500/15 text-emerald-600' },
    running: { label: '生产中', cls: 'bg-primary/15 text-primary' },
    pending_start: { label: '待开工', cls: 'bg-amber-500/15 text-amber-600' },
    pending: { label: '未开始', cls: 'bg-muted text-muted-foreground' },
    qc: { label: '待质检', cls: 'bg-blue-500/15 text-blue-600' },
    closed: { label: '已结案', cls: 'bg-muted text-muted-foreground' },
  };
  const item = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  return <Badge variant="secondary" className={item.cls}>{item.label}</Badge>;
}

/* ============ 工具函数 ============ */
function findCurrentOperation(operations: OperationInfo[]) {
  const sorted = [...operations].sort((a, b) => a.seq - b.seq);
  return sorted.find((o) => o.status !== 'completed' && o.status !== 'closed') || sorted[sorted.length - 1];
}

function findPendingQcOperation(operations: OperationInfo[]) {
  const sorted = [...operations].sort((a, b) => a.seq - b.seq);
  return sorted.find((o) => o.status === 'completed' || o.status === 'qc') || sorted[sorted.length - 1];
}

function findOutsourcingOperation(operations: OperationInfo[]) {
  const sorted = [...operations].sort((a, b) => a.seq - b.seq);
  return sorted.find(
    (o) =>
      o.category === 'outsourcing' &&
      (o.status === 'pending_start' || o.status === 'pending' || o.status === 'running')
  );
}

async function loadWorkOrder(_workNo: string): Promise<WorkOrderInfo> {
  throw new Error('未使用');
}
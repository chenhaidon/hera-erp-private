import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Send, Truck, FileText, Package, RotateCcw, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore, type AppState } from '@/store';
import { toast } from 'sonner';
import { MobileUserMenu } from '@/components/common/MobileUserMenu';
import { createShipment, fetchFactories, reconcileMissingShipments } from '@/services/outsourcing';
import type { OutsourceFactory, OutsourceShipment } from '@/types';

interface Operation {
  name: string;
  code: string;
  seq: number;
  status: string;
  completed_qty: number;
  plan_qty: number;
  category?: string;
  outsourcing_status?: string;
}

interface WorkOrder {
  id: string;
  work_no: string;
  contract_no?: string;
  product_code: string;
  product_name: string;
  plan_quantity: number;
  operations: Operation[];
}

interface MobileScanOutsourcingPageProps {
  workNo?: string;
  opCode?: string;
  onBack?: () => void;
  onComplete?: () => void;
}

export default function MobileScanOutsourcingPage({
  workNo: propWorkNo,
  opCode: propOpCode,
  onBack,
  onComplete,
}: MobileScanOutsourcingPageProps = {}) {
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
  const [factories, setFactories] = useState<OutsourceFactory[]>([]);
  const [factoryId, setFactoryId] = useState('');
  const [qty, setQty] = useState('');
  const [formExpanded, setFormExpanded] = useState(false);
  const [logisticsCompany, setLogisticsCompany] = useState('');
  const [logisticsNo, setLogisticsNo] = useState('');

  const existingShipment = useMemo(() => {
    if (!workOrder || !operation) return undefined;
    return store.outsourceShipments.find(
      (s) => s.work_order_id === workOrder.id && s.operation_code === operation.code
    );
  }, [workOrder, operation, store.outsourceShipments]);

  const isApplied = Boolean(
    existingShipment || operation?.outsourcing_status
  );

  useEffect(() => {
    if (!workNo) {
      navigate('/mobile/scan', { replace: true });
      return;
    }
    let cancelled = false;
    Promise.all([loadWorkOrderFromStore(workNo, store), fetchFactories()])
      .then(async ([wo, fs]) => {
        if (cancelled) return;
        // 对账：修复历史脏数据（工序已发料但无发料单记录）
        const allWorkOrders = store.workOrders;
        const shipments = await reconcileMissingShipments(allWorkOrders);
        store.setOutsourceShipments(shipments);
        setWorkOrder(wo);
        const op = opCode
          ? wo.operations.find((o) => o.code === opCode) || findOutsourcingOperation(wo.operations)
          : findOutsourcingOperation(wo.operations);
        setOperation(op || null);
        const enabledFactories = (fs.length ? fs : store.outsourceFactories).filter(
          (f) => f.status === 'enabled'
        );
        setFactories(enabledFactories);
        setQty(op ? String(op.plan_qty) : '');
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

  const handleSubmit = async () => {
    if (!workOrder || !operation) return;
    const shipmentQty = Number(qty);
    if (!shipmentQty || shipmentQty <= 0) {
      toast.error('请输入发料数量');
      return;
    }
    if (shipmentQty > operation.plan_qty) {
      toast.error(`发料数量不能超过计划数量 ${operation.plan_qty}`);
      return;
    }
    if (!factoryId) {
      toast.error('请选择外协加工厂');
      return;
    }
    if (!logisticsCompany.trim()) {
      toast.error('请填写物流公司');
      return;
    }
    if (!logisticsNo.trim()) {
      toast.error('请填写物流单号');
      return;
    }
    setSubmitting(true);
    try {
      const factory = factories.find((f) => f.id === factoryId);
      if (!factory) throw new Error('请选择外协厂');
      const raw = store.workOrders.find((w) => w.work_no === workOrder.work_no);
      if (!raw) throw new Error('工单不存在');
      if (existingShipment) {
        toast.error('该工序已存在外发申请，不能重复申请');
        return;
      }
      const now = new Date().toISOString();
      // 生成外协发料单并持久化到 Supabase
      const shipment: Omit<OutsourceShipment, 'id' | 'created_at' | 'updated_at' | 'items'> = {
        shipment_no: `OS-${Date.now().toString().slice(-8)}`,
        contract_no: raw.contract_no || '',
        work_order_id: raw.id,
        work_order_no: raw.work_no,
        operation_code: operation.code,
        operation_name: operation.name,
        product_code: raw.product_code,
        product_name: raw.product_name,
        factory_id: factoryId,
        factory_name: factory.factory_name,
        shipment_date: now.slice(0, 10),
        shipment_quantity: shipmentQty,
        logistics_company: logisticsCompany.trim(),
        logistics_no: logisticsNo.trim(),
        status: 'shipped',
      };
      const item = {
        id: crypto.randomUUID(),
        shipment_id: '',
        material_code: raw.product_code,
        material_name: raw.product_name || '半成品',
        quantity: shipmentQty,
        unit: '件',
      };
      const saved = await createShipment(shipment, [item]);
      store.addOutsourceShipment(saved);
      // 工序外协状态更新为已发料
      const updatedOps = raw.operations.map((op) =>
        op.code === operation.code ? { ...op, outsourcing_status: 'dispatched' as const } : op
      );
      store.updateWorkOrder({
        ...raw,
        operations: updatedOps,
      });
      toast.success('发料成功，请等待外协厂签收及回货。');
      // 操作成功后刷新登录过期时间
      await refreshLoginExpiry();
      if (onComplete) {
        onComplete();
      } else {
        navigate('/mobile/scan', { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || '提交失败');
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
        <p className="text-muted-foreground">未找到可外协的工序</p>
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
        <h1 className="flex-1 text-center text-lg font-semibold text-foreground">外协发起</h1>
        <MobileUserMenu />
      </header>

      <main className="flex flex-1 flex-col p-4">
        <Card className="mb-4">
          <CardContent className="space-y-2 p-4">
            <InfoRow label="工单编号" value={workOrder.work_no} />
            <InfoRow label="产品款号" value={workOrder.product_code} />
            <InfoRow label="品名" value={workOrder.product_name} />
            <InfoRow label="外协工序" value={operation.name} />
            <InfoRow label="计划数量" value={String(operation.plan_qty)} />
          </CardContent>
        </Card>

        <div className="flex flex-1 flex-col gap-4">
          {isApplied ? (
            <div className="w-full">
              <OutsourcingStatusFlow status={operation.outsourcing_status || existingShipment?.status || 'pending'} />
              <p className="mt-3 text-center text-sm text-muted-foreground">
                该工序已发起外协，不能重复申请
              </p>
            </div>
          ) : !formExpanded ? (
            <Button
              size="lg"
              className="h-16 w-full rounded-2xl text-lg font-semibold active:scale-[0.98]"
              onClick={() => setFormExpanded(true)}
            >
              <Send className="mr-2 h-6 w-6" />
              发起外发申请
            </Button>
          ) : (
            <Card className="w-full">
              <CardContent className="space-y-4 p-4">
                <h2 className="text-base font-semibold text-foreground">填写发料信息</h2>
                <div className="space-y-2">
                  <Label>
                    选择外协加工厂 <span className="text-destructive">*</span>
                  </Label>
                  <Select value={factoryId} onValueChange={setFactoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择外协加工厂" />
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
                  <Label>
                    本次发料数量 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={operation.plan_qty}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="h-12 text-center text-xl font-bold"
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">最多可发 {operation.plan_qty} 件</p>
                </div>
                <div className="space-y-2">
                  <Label>
                    物流公司 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={logisticsCompany}
                    onChange={(e) => setLogisticsCompany(e.target.value)}
                    placeholder="如：顺丰、德邦"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    物流单号 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={logisticsNo}
                    onChange={(e) => setLogisticsNo(e.target.value)}
                    placeholder="请输入物流单号"
                    className="h-12"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setFormExpanded(false)}>
                    取消
                  </Button>
                  <Button className="flex-1" onClick={handleSubmit} disabled={submitting || !factoryId}>
                    {submitting ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Truck className="mr-2 h-5 w-5" />
                    )}
                    {submitting ? '提交中...' : '确认发料'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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

function OutsourcingStatusFlow({ status }: { status: string }) {
  const steps = [
    { key: 'pending', label: '已申请', icon: FileText },
    { key: 'dispatched', label: '已发料', icon: Truck },
    { key: 'returning', label: '回货中', icon: Package },
    { key: 'returned', label: '已回货', icon: RotateCcw },
    { key: 'received', label: '已收货', icon: CheckCheck },
  ];
  // 兼容 shipment 状态：shipped 映射为 dispatched
  const normalized = status === 'shipped' ? 'dispatched' : status;
  const activeIndex = steps.findIndex((s) => s.key === normalized);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-4 text-center text-sm font-semibold text-foreground">外协加工进度</h3>
      <div className="relative flex items-start justify-between">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <div key={step.key} className="relative z-10 flex flex-1 flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted bg-background text-muted-foreground'
                } ${isCurrent ? 'ring-2 ring-primary/30' : ''}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={`mt-2 text-center text-xs ${
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
        {/* 进度线 */}
        <div className="absolute left-0 right-0 top-5 flex px-5">
          {steps.slice(0, -1).map((_, idx) => {
            const isActive = idx < currentIndex;
            return (
              <div
                key={idx}
                className={`h-0.5 flex-1 ${isActive ? 'bg-primary' : 'bg-muted'}`}
              />
            );
          })}
        </div>
      </div>
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
      outsourcing_status: op.outsourcing_status,
    })),
  });
}

function findOutsourcingOperation(operations: Operation[]) {
  const sorted = [...operations].sort((a, b) => a.seq - b.seq);
  return sorted.find(
    (o) =>
      o.category === 'outsourcing' &&
      (o.status === 'pending_start' || o.status === 'pending' || o.status === 'running')
  );
}

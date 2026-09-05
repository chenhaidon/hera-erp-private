import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore, type AppState } from '@/store';
import { toast } from 'sonner';

export interface ScanRouteResult {
  action: 'report' | 'inspect' | 'outsourcing' | 'block';
  reason?: 'prev_not_completed' | 'pending_qc' | 'not_outsourcing' | 'outsourcing_not_pending' | 'role_mismatch' | 'outsourcing_role_mismatch';
  workOrder: {
    id: string;
    work_no: string;
    product_code: string;
    product_name: string;
    plan_quantity: number;
    operations: {
      name: string;
      code: string;
      seq: number;
      status: string;
      completed_qty: number;
      plan_qty: number;
      category?: string;
      outsourcing_status?: string;
    }[];
    targetOperation?: OperationInfo;
  };
}

export interface OperationInfo {
  name: string;
  code: string;
  seq: number;
  status: string;
  completed_qty: number;
  plan_qty: number;
  category?: string;
  outsourcing_status?: string;
}

export default function MobileScanRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const workNo = searchParams.get('workNo') || '';
  const { profile, loading: authLoading } = useAuth();
  const currentRole = useAppStore((state) => state.currentRole);
  const store = useAppStore();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ScanRouteResult | null>(null);

  // 扫码分流页要求登录
  useEffect(() => {
    if (authLoading) return;
    if (!profile) {
      const from = `${location.pathname}${location.search}`;
      navigate(`/mobile/login?from=${encodeURIComponent(from)}`, { replace: true });
    }
  }, [authLoading, profile, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!profile) return;
    if (result !== null) return;
    if (!workNo) {
      navigate('/mobile/scan', { replace: true });
      return;
    }
    // 系统管理员：进入多角色测试台，可随时切换角色
    if ((profile?.role || currentRole) === 'admin') {
      navigate(`/mobile/scan/admin?workNo=${encodeURIComponent(workNo)}`, { replace: true });
      return;
    }
    // eslint-disable-next-line no-console
    console.log('[MobileScanRoute] start routeWorkOrder', { workNo, role: profile?.role || currentRole });
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        // eslint-disable-next-line no-console
        console.log('[MobileScanRoute] routeWorkOrder timeout');
        setLoading(false);
        toast.error('识别超时，请重试');
      }
    }, 10000);
    Promise.resolve(routeWorkOrder(workNo, (profile?.role || currentRole) as string, store))
      .then((res) => {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.log('[MobileScanRoute] routeWorkOrder success', res);
          setResult(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.log('[MobileScanRoute] routeWorkOrder error', err);
          toast.error(err instanceof Error ? err.message : '识别失败，请重试');
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.log('[MobileScanRoute] routeWorkOrder finally');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [workNo, profile?.role, currentRole, navigate, store]);

  useEffect(() => {
    if (!result) return;
    if (result.action === 'block') {
      return;
    }
    const params = new URLSearchParams({ workNo: result.workOrder.work_no });
    if (result.workOrder.targetOperation) {
      params.set('opCode', result.workOrder.targetOperation.code);
    }
    switch (result.action) {
      case 'report':
        navigate(`/mobile/scan/report?${params.toString()}`, { replace: true });
        break;
      case 'inspect':
        navigate(`/mobile/scan/inspect?${params.toString()}`, { replace: true });
        break;
      case 'outsourcing':
        navigate(`/mobile/scan/outsourcing?${params.toString()}`, { replace: true });
        break;
    }
  }, [result, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">正在识别工单...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <p className="text-muted-foreground">无法获取工单信息</p>
        <Button className="mt-4 w-full max-w-sm" onClick={() => navigate('/mobile/scan', { replace: true })}>
          返回扫码
        </Button>
      </div>
    );
  }

  if (result.action === 'block') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
        <Dialog open onOpenChange={() => navigate('/mobile/scan', { replace: true })}>
          <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl md:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                当前工序不可报工
              </DialogTitle>
              <DialogDescription>{reasonText(result.reason)}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button className="w-full" onClick={() => navigate('/mobile/scan', { replace: true })}>
                我知道了
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">正在跳转...</p>
    </div>
  );
}

export function routeWorkOrder(workNo: string, role: string, store: AppState): ScanRouteResult {
  // eslint-disable-next-line no-console
  console.log('[routeWorkOrder] query start', workNo);
  const data = store.workOrders.find((w) => w.work_no === workNo);
  // eslint-disable-next-line no-console
  console.log('[routeWorkOrder] query result', { data });
  if (!data) {
    toast.error('工单不存在');
    throw new Error('工单不存在');
  }

  const operations = (data.operations || []).map((op, idx) => ({
    name: op.name || '',
    code: op.code || String(idx + 1),
    seq: op.seq ?? idx + 1,
    status: op.status || 'pending',
    completed_qty: op.completed_qty ?? 0,
    plan_qty: op.plan_qty ?? data.plan_quantity ?? 0,
    category: op.category || 'internal',
    outsourcing_status: op.outsourcing_status,
  }));

  // 角色分流：生产人员、一线工人、生产主管均可报工
  if (role === 'worker' || role === 'production') {
    const target = findCurrentOperation(operations);
    if (!target) {
      return {
        action: 'block',
        reason: 'role_mismatch',
        workOrder: { ...data, operations },
      };
    }
    if (target.category === 'outsourcing') {
      return {
        action: 'block',
        reason: 'outsourcing_role_mismatch',
        workOrder: { ...data, operations, targetOperation: target },
      };
    }
    if (target.status === 'pending_qc' || target.status === 'qc') {
      return {
        action: 'block',
        reason: 'pending_qc',
        workOrder: { ...data, operations, targetOperation: target },
      };
    }
    if (target.status === 'pending_start' || target.status === 'pending') {
      // 检查前序
      const prev = operations.find((o: OperationInfo) => o.seq === target.seq - 1);
      if (prev && prev.status !== 'completed') {
        return {
          action: 'block',
          reason: 'prev_not_completed',
          workOrder: { ...data, operations, targetOperation: target },
        };
      }
    }
    return {
      action: 'report',
      workOrder: { ...data, operations, targetOperation: target },
    };
  }

  if (role === 'quality') {
    const target = operations.find((o: OperationInfo) => o.status === 'qc');
    if (!target) {
      return {
        action: 'block',
        reason: 'role_mismatch',
        workOrder: { ...data, operations },
      };
    }
    return {
      action: 'inspect',
      workOrder: { ...data, operations, targetOperation: target },
    };
  }

  // 内部外协员 / 生产 / 管理员
  const outsourcingOp = operations.find((o: OperationInfo) => o.category === 'outsourcing' && (o.status === 'pending_start' || o.status === 'pending'));
  if (!outsourcingOp) {
    return {
      action: 'block',
      reason: 'not_outsourcing',
      workOrder: { ...data, operations },
    };
  }
  return {
    action: 'outsourcing',
    workOrder: { ...data, operations, targetOperation: outsourcingOp },
  };
}

function findCurrentOperation(operations: ScanRouteResult['workOrder']['operations']) {
  const sorted = [...operations].sort((a, b) => a.seq - b.seq);
  return sorted.find((o) => o.status !== 'completed' && o.status !== 'closed') || sorted[sorted.length - 1];
}

function reasonText(reason?: ScanRouteResult['reason']) {
  switch (reason) {
    case 'prev_not_completed':
      return '当前工序不可报工（原因：前序未完成）';
    case 'pending_qc':
      return '当前工序不可报工（原因：待质检）';
    case 'not_outsourcing':
      return '该工单无外协工序或外协工序已开工';
    case 'outsourcing_not_pending':
      return '该工单外协工序已开工或已完成';
    case 'outsourcing_role_mismatch':
      return '当前工序为外协工序，请使用内部外协员角色扫码处理';
    case 'role_mismatch':
    default:
      return '当前角色暂无可执行的操作';
  }
}

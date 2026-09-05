import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, ClipboardList, Factory, PackageCheck, ScanLine, ShoppingCart, Truck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/store';

const shortcuts = [
  { key: 'production', label: '生产管理', icon: Factory },
  { key: 'quality', label: '质量管理', icon: ClipboardCheck },
  { key: 'inventory', label: '库存管理', icon: PackageCheck },
  { key: 'marketing', label: '营销管理', icon: ShoppingCart },
  { key: 'purchase', label: '采购管理', icon: Truck },
  { key: 'approvals', label: '审批中心', icon: ClipboardList },
];

export function MobileHome({ onScan, onNavigate }: { onScan?: () => void; onNavigate?: (tab: string) => void }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const displayName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '管理员';
  const store = useAppStore();

  const workOrders = store.workOrders.filter((w) => w.status === 'issued' || w.status === 'producing').length;
  const inspections =
    store.materialInspections.filter((i) => i.status === 'pending').length +
    store.processInspections.filter((i) => i.status === 'pending').length +
    store.finishedInspections.filter((i) => i.status === 'pending').length;
  // 待入库：与 PC 端“待到货采购订单”保持一致
  const pendingInbound = store.purchaseOrders
    .filter((o) => ['approved', 'partial'].includes(o.status))
    .reduce((sum, o) => sum + o.items.length, 0);
  const approvals = store.purchaseOrders.filter((p) => p.status === 'pending').length;

  const todayCompleted = store.workOrders.reduce((sum, w) => sum + w.completed_quantity, 0);
  const allInspections = [
    ...store.materialInspections,
    ...store.finishedInspections,
  ];
  const qualified = allInspections.filter((i) => i.result === 'qualified').reduce((s, i) => s + i.qualified_qty, 0);
  const totalInspected = allInspections.reduce((s, i) => s + i.qualified_qty + i.unqualified_qty, 0);
  const passRate = totalInspected > 0 ? `${Math.round((qualified / totalInspected) * 1000) / 10}%` : '-';
  const todayInbound = store.finishedGoodsInbounds.length;
  const todayShipped = store.shipments.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background p-4 pb-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-foreground">
            早上好，{displayName}
          </p>
          <p className="text-sm text-muted-foreground">今日工作一目了然</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative z-10 h-11 w-11 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 active:opacity-70"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          onClick={() => {
            onScan?.();
          }}
          aria-label="扫码"
        >
          <ScanLine className="pointer-events-none h-6 w-6" />
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <TodoCard label="待处理工单" value={workOrders} icon={Factory} color="bg-primary" onClick={() => onNavigate?.('production')} />
        <TodoCard label="待检验" value={inspections} icon={ClipboardCheck} color="bg-amber-500" onClick={() => onNavigate?.('quality')} />
        <TodoCard label="待入库" value={pendingInbound} icon={PackageCheck} color="bg-emerald-500" onClick={() => navigate('/mobile/warehouse')} />
        <TodoCard label="待审批" value={approvals} icon={ClipboardList} color="bg-violet-500" onClick={() => onNavigate?.('purchase')} />
      </div>

      <Card className="mb-6 p-4">
        <p className="mb-4 text-base font-semibold text-foreground">快捷入口</p>
        <div className="flex flex-wrap">
          {shortcuts.map((item) => (
            <button
              key={item.key}
              className="w-1/3 p-2 active:opacity-70"
              onClick={() => {
                if (item.key === 'inventory') {
                  navigate('/mobile/warehouse');
                } else {
                  onNavigate?.(item.key);
                }
              }}
            >
              <div className="items-center rounded-xl bg-muted/50 p-3 text-center">
                <item.icon className="mx-auto h-6 w-6 text-primary" />
                <p className="mt-2 text-xs text-foreground">{item.label}</p>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <p className="mb-4 text-base font-semibold text-foreground">数据概览</p>
        <div className="flex flex-wrap">
          <StatItem label="生产完成" value={String(todayCompleted)} unit="件" />
          <StatItem label="质检合格率" value={passRate} />
          <StatItem label="入库批次" value={String(todayInbound)} unit="批" />
          <StatItem label="发货批次" value={String(todayShipped)} unit="批" />
        </div>
      </Card>
    </div>
  );
}

function TodoCard({
  label,
  value,
  icon: Icon,
  color,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Factory;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button className="w-[47.5%] active:opacity-90" onClick={onClick} type="button">
      <Card className="flex flex-row items-center p-3">
        <div className={`${color} mr-3 rounded-xl p-2.5`}>
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </Card>
    </button>
  );
}

function StatItem({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="w-1/2 p-2">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex items-baseline">
        <p className="text-xl font-bold text-foreground">{value}</p>
        {unit ? <p className="ml-0.5 text-xs text-muted-foreground">{unit}</p> : null}
      </div>
    </div>
  );
}

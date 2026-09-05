import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Wrench,
  Clock,
  Factory,
  Settings,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarDays,
  ClipboardList,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { nanoid, validateEquipmentRecordTime } from '@/lib/utils';
import type { Equipment, EquipmentRecord, MaintenancePlan } from '@/types';
import { MobileUserMenu } from '@/components/common/MobileUserMenu';

interface MobileEquipmentPageProps {
  onBack?: () => void;
}

export default function MobileEquipmentPage({ onBack }: MobileEquipmentPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading: authLoading, refreshLoginExpiry } = useAuth();
  const store = useAppStore();
  const equipmentId = searchParams.get('equipmentId') || '';
  const [activeTab, setActiveTab] = useState<'info' | 'maintenance' | 'repair'>('info');
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<'maintenance' | 'repair' | null>(null);
  const [form, setForm] = useState({
    description: '',
    duration: '',
    loss_output: '',
    maintainer: '',
  });

  const equipment = useMemo(
    () => store.equipment.find((e) => e.id === equipmentId),
    [store.equipment, equipmentId]
  );

  const plans = useMemo(
    () => store.maintenancePlans.filter((p) => p.equipment_id === equipmentId),
    [store.maintenancePlans, equipmentId]
  );

  const records = useMemo(
    () => store.equipmentRecords.filter((r) => r.equipment_id === equipmentId),
    [store.equipmentRecords, equipmentId]
  );

  useEffect(() => {
    if (!equipmentId) {
      toast.error('未找到设备信息');
      if (onBack) onBack();
      else navigate('/mobile/scan', { replace: true });
    }
  }, [equipmentId, navigate, onBack]);

  // 未登录时重定向到登录页，并携带回跳地址
  useEffect(() => {
    if (authLoading) return;
    if (!profile) {
      const from = `${location.pathname}${location.search}`;
      navigate(`/mobile/login?from=${encodeURIComponent(from)}`, { replace: true });
    }
  }, [authLoading, profile, location.pathname, location.search, navigate]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">设备不存在或已被删除</p>
      </div>
    );
  }

  function statusBadge(status: string) {
    switch (status) {
      case 'normal':
      case '可用':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            可用
          </Badge>
        );
      case 'repair':
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            <AlertTriangle className="mr-1 h-3 w-3" />
            维修中
          </Badge>
        );
      case 'disabled':
        return (
          <Badge className="bg-muted text-muted-foreground hover:bg-muted">
            <XCircle className="mr-1 h-3 w-3" />
            停用
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function openAction(type: 'maintenance' | 'repair') {
    const systemUser = store.systemUsers.find((u) => u.account === profile?.username);
    const employee = store.employees.find((e) => e.id === systemUser?.employee_id);
    const maintainerName = employee?.name || profile?.full_name || systemUser?.name || '';
    setActionType(type);
    setForm({
      description: type === 'maintenance' ? '常规保养' : '',
      duration: '',
      loss_output: '',
      maintainer: maintainerName,
    });
    setActionOpen(true);
  }

  async function saveAction() {
    if (!form.description) {
      toast.error('请填写说明');
      return;
    }
    if (!equipment) return;
    const recordDate = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const timeCheck = validateEquipmentRecordTime(recordDate);
    if (!timeCheck.valid) {
      toast.error(timeCheck.message);
      return;
    }
    const record: EquipmentRecord = {
      id: nanoid(),
      equipment_id: equipment.id,
      type: actionType === 'maintenance' ? 'maintenance' : 'repair',
      record_date: recordDate,
      description: form.description,
      duration: Number(form.duration) || 0,
      loss_output: Number(form.loss_output) || 0,
      maintainer: form.maintainer || '黄超灵',
    };
    await store.addEquipmentRecord(record);

    if (actionType === 'maintenance') {
      const plan = plans.find((p) => p.equipment_id === equipment?.id);
      if (plan) {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + (plan.period_type === 'calendar' ? plan.period : 30));
        await store.updateMaintenancePlan({
          ...plan,
          last_date: new Date().toISOString().slice(0, 10),
          next_date: nextDate.toISOString().slice(0, 10),
          status: 'normal',
        });
      }
    }

    if (actionType === 'repair' && equipment) {
      await store.updateEquipment({ ...equipment, status: 'maintenance' });
    }

    toast.success(actionType === 'maintenance' ? '保养记录已保存' : '维修记录已保存');
    // 操作成功后刷新登录过期时间
    await refreshLoginExpiry();
    setActionOpen(false);
    setActionType(null);
    setActiveTab(actionType === 'maintenance' ? 'maintenance' : 'repair');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center border-b border-border bg-card px-4">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 -ml-2"
          onClick={() => {
            if (onBack) onBack();
            else navigate('/mobile/scan', { replace: true });
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-center text-lg font-semibold text-foreground">设备详情</h1>
        <MobileUserMenu />
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base font-semibold">{equipment.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{equipment.code}</p>
              </div>
              {statusBadge(equipment.status)}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoItem icon={Factory} label="车间" value={equipment.workshop || '-'} />
            <InfoItem icon={Settings} label="类别" value={equipment.category || '-'} />
            <InfoItem icon={Clock} label="运行时长" value={`${equipment.running_hours || 0}h`} />
            <InfoItem icon={CalendarDays} label="购置日期" value={equipment.purchase_date || '-'} />
            <InfoItem icon={ClipboardList} label="型号" value={equipment.model || '-'} />
          </CardContent>
        </Card>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card p-1">
          {[
            { key: 'info', label: '信息' },
            { key: 'maintenance', label: '保养' },
            { key: 'repair', label: '维修' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">保养计划</CardTitle>
              </CardHeader>
              <CardContent>
                {plans.length > 0 ? (
                  <ul className="space-y-2">
                    {plans.map((p) => (
                      <li key={p.id} className="rounded-lg bg-muted p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{p.content}</span>
                          <PlanStatusBadge status={p.status} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          周期 {p.period}
                          {p.period_type === 'hours' ? ' 小时' : ' 天'} · 下次 {p.next_date || '-'}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无保养计划</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <RecordList
            records={records.filter((r) => r.type === 'maintenance')}
            equipment={equipment}
            emptyText="暂无保养记录"
          />
        )}

        {activeTab === 'repair' && (
          <RecordList
            records={records.filter((r) => r.type === 'repair')}
            equipment={equipment}
            emptyText="暂无维修记录"
          />
        )}
      </main>

      <div className="shrink-0 border-t border-border bg-card p-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={() => openAction('maintenance')}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            添加保养
          </Button>
          <Button
            className="flex-1 h-12 rounded-xl"
            onClick={() => openAction('repair')}
          >
            <Wrench className="mr-2 h-4 w-4" />
            添加维修
          </Button>
        </div>
      </div>

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'maintenance' ? '添加保养记录' : '添加维修记录'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>说明</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="请输入保养/维修说明"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>执行人</Label>
              <Input
                value={form.maintainer}
                onChange={(e) => setForm({ ...form, maintainer: e.target.value })}
                placeholder="请输入执行人"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>时长（小时）</Label>
                <Input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>产量损失</Label>
                <Input
                  type="number"
                  value={form.loss_output}
                  onChange={(e) => setForm({ ...form, loss_output: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setActionOpen(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={saveAction}>
              <Plus className="mr-1 h-4 w-4" />
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Factory;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function PlanStatusBadge({ status }: { status?: MaintenancePlan['status'] }) {
  switch (status) {
    case 'normal':
      return <Badge variant="outline">正常</Badge>;
    case 'upcoming':
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">即将到期</Badge>
      );
    case 'overdue':
      return (
        <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">
          已逾期
        </Badge>
      );
    default:
      return <Badge variant="outline">-</Badge>;
  }
}

function RecordList({
  records,
  equipment,
  emptyText,
}: {
  records: EquipmentRecord[];
  equipment?: Equipment;
  emptyText: string;
}) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12">
        <ClipboardList className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records
        .slice()
        .sort((a, b) => b.record_date.localeCompare(a.record_date))
        .map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {equipment && (
                    <p className="text-xs text-muted-foreground">
                      {equipment.name} · {equipment.code} · {equipment.model || '-'}
                    </p>
                  )}
                  <p className="text-sm font-medium text-foreground">{r.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.record_date} · {r.maintainer || '-'}
                  </p>
                </div>
                <Badge variant={r.type === 'maintenance' ? 'outline' : 'default'}>
                  {r.type === 'maintenance' ? '保养' : '维修'}
                </Badge>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>时长：{r.duration || 0}h</span>
                <span>产量损失：{r.loss_output || 0}</span>
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

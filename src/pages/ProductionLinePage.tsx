import { useMemo, useState } from 'react';
import { useAppStore } from '@/store';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Settings, ArrowLeft, AlertTriangle } from 'lucide-react';
import type { ProductionLine, ProductionLineEquipment, EquipmentStatus } from '@/types';
import { hasPermission } from '@/lib/permissions';

import type { AppRole } from '@/lib/permissions';

const WORKSHOPS = ['车间一', '车间二', '车间三', '缝制车间', '裁剪车间'];
const ALLOWED_ROLES: AppRole[] = ['admin', 'production', 'planner'];
const STATUS_CHANGE_ROLES: AppRole[] = ['admin', 'production', 'planner', 'maintenance'];

const EQUIPMENT_STATUS_OPTIONS: { value: EquipmentStatus; label: string; color: string }[] = [
  { value: 'idle', label: '空闲', color: 'bg-emerald-500' },
  { value: 'using', label: '使用中', color: 'bg-blue-500' },
  { value: 'maintenance', label: '维修中/停机', color: 'bg-red-500' },
];

function getEquipmentStatusLabel(status?: EquipmentStatus) {
  return EQUIPMENT_STATUS_OPTIONS.find((s) => s.value === status)?.label || '空闲';
}

function getEquipmentStatusColor(status?: EquipmentStatus) {
  return EQUIPMENT_STATUS_OPTIONS.find((s) => s.value === status)?.color || 'bg-emerald-500';
}

function normalizeEquipmentStatus(status?: string): EquipmentStatus {
  if (status === 'using' || status === 'maintenance') return status;
  return 'idle';
}

export function ProductionLinePage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionLine | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  const canManage = hasPermission(store.currentRole, ALLOWED_ROLES);
  const canChangeStatus = hasPermission(store.currentRole, STATUS_CHANGE_ROLES);

  const equipmentCount = (lineId: string) =>
    store.productionLineEquipments.filter((e) => e.production_line_id === lineId).length;

  const lineEquipments = (lineId: string) => {
    const ids = new Set(
      store.productionLineEquipments
        .filter((e) => e.production_line_id === lineId)
        .map((e) => e.equipment_id),
    );
    return store.equipment.filter((e) => ids.has(e.id));
  };

  const statusSummary = (lineId: string) => {
    const eqs = lineEquipments(lineId);
    const idle = eqs.filter((e) => normalizeEquipmentStatus(e.status) === 'idle').length;
    const using = eqs.filter((e) => normalizeEquipmentStatus(e.status) === 'using').length;
    const maintenance = eqs.filter((e) => normalizeEquipmentStatus(e.status) === 'maintenance').length;
    return { idle, using, maintenance, total: eqs.length };
  };

  const anyUsing = useMemo(
    () => store.equipment.some((e) => normalizeEquipmentStatus(e.status) === 'using'),
    [store.equipment],
  );

  const filtered = useMemo(() => {
    return store.productionLines
      .filter((l) => !search || l.name.includes(search) || l.workshop.includes(search))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [store.productionLines, search]);

  function openAdd() {
    if (!canManage) {
      toast.error('当前角色无权限管理产线');
      return;
    }
    setEditing({ id: '', name: '', workshop: '', created_at: '', updated_at: '' });
    setEditOpen(true);
  }

  function openEdit(line: ProductionLine) {
    if (!canManage) {
      toast.error('当前角色无权限管理产线');
      return;
    }
    setEditing({ ...line });
    setEditOpen(true);
  }

  function openConfig(line: ProductionLine) {
    if (!canManage) {
      toast.error('当前角色无权限配置产线设备');
      return;
    }
    setEditing(line);
    setSelectedEquipment(
      store.productionLineEquipments
        .filter((e) => e.production_line_id === line.id)
        .map((e) => e.equipment_id),
    );
    setConfigOpen(true);
  }

  async function saveLine() {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error('请填写产线名称');
      return;
    }
    if (!editing.workshop) {
      toast.error('请选择所属车间');
      return;
    }
    const now = new Date().toISOString();
    if (editing.id) {
      await store.updateProductionLine({ ...editing, updated_at: now });
      toast.success('产线已更新');
    } else {
      const newLine: ProductionLine = {
        ...editing,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      };
      await store.addProductionLine(newLine);
      toast.success('产线已新增');
    }
    setEditOpen(false);
    setEditing(null);
  }

  async function saveConfig() {
    if (!editing) return;
    const existing = store.productionLineEquipments.filter(
      (e) => e.production_line_id === editing.id,
    );
    // 删除旧关联
    for (const e of existing) {
      if (!selectedEquipment.includes(e.equipment_id)) {
        await store.deleteProductionLineEquipment(e.id);
      }
    }
    const existingIds = existing.map((e) => e.equipment_id);
    // 新增关联
    for (const eqId of selectedEquipment) {
      if (!existingIds.includes(eqId)) {
        await store.addProductionLineEquipment({
          id: crypto.randomUUID(),
          production_line_id: editing.id,
          equipment_id: eqId,
          created_at: new Date().toISOString(),
        });
      }
    }
    toast.success('产线设备配置已保存');
    setConfigOpen(false);
  }

  async function changeEquipmentStatus(equipmentId: string, status: EquipmentStatus) {
    if (!canChangeStatus) {
      toast.error('当前角色无权限修改设备状态');
      return;
    }
    const eq = store.equipment.find((e) => e.id === equipmentId);
    if (!eq) return;
    await store.updateEquipment({ ...eq, status });
    toast.success(`${eq.name} 状态已更新为 ${getEquipmentStatusLabel(status)}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/planning')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回计划排程
        </Button>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold">产线管理</h1>
          <p className="text-sm text-muted-foreground">维护产线档案及设备配置</p>
        </div>
        {canManage && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />
            新增产线
          </Button>
        )}
      </div>

      {anyUsing && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>设备状态为手动维护，请确保已同步车间实物状态。</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">产线列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="搜索产线名称/所属车间"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">产线名称</TableHead>
                  <TableHead className="whitespace-nowrap">所属车间</TableHead>
                  <TableHead className="whitespace-nowrap">设备数量</TableHead>
                  <TableHead className="whitespace-nowrap">设备运行状态</TableHead>
                  <TableHead className="whitespace-nowrap">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((line) => {
                  const summary = statusSummary(line.id);
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="whitespace-nowrap font-medium">{line.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{line.workshop}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="secondary">{equipmentCount(line.id)}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {summary.idle}台空闲
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            {summary.using}台使用中
                          </span>
                          {summary.maintenance > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                              <span className="h-2 w-2 rounded-full bg-red-500" />
                              {summary.maintenance}台维修
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(line)}>
                            编辑
                          </Button>
                          {canManage && (
                            <Button variant="outline" size="sm" onClick={() => openConfig(line)}>
                              <Settings className="h-3 w-3 mr-1" />
                              配置设备
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      暂无产线数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 新增/编辑产线 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? '编辑产线' : '新增产线'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                产线名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                value={editing?.name || ''}
                onChange={(e) =>
                  setEditing((prev) => (prev ? { ...prev, name: e.target.value } : null))
                }
                placeholder="如 A线、B线"
              />
            </div>
            <div className="space-y-2">
              <Label>
                所属车间 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={editing?.workshop || ''}
                onValueChange={(v) =>
                  setEditing((prev) => (prev ? { ...prev, workshop: v } : null))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择车间" />
                </SelectTrigger>
                <SelectContent>
                  {WORKSHOPS.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button onClick={saveLine}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 配置设备 */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>配置设备 - {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <div className="overflow-y-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 whitespace-nowrap">选择</TableHead>
                    <TableHead className="whitespace-nowrap">设备名称</TableHead>
                    <TableHead className="whitespace-nowrap">设备类型</TableHead>
                    <TableHead className="whitespace-nowrap">当前状态</TableHead>
                    <TableHead className="whitespace-nowrap">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {store.equipment.map((eq) => (
                    <TableRow key={eq.id}>
                      <TableCell className="whitespace-nowrap">
                        <Checkbox
                          checked={selectedEquipment.includes(eq.id)}
                          onCheckedChange={(checked) => {
                            setSelectedEquipment((prev) =>
                              checked
                                ? [...prev, eq.id]
                                : prev.filter((id) => id !== eq.id),
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{eq.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{eq.category}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Select
                          value={normalizeEquipmentStatus(eq.status)}
                          onValueChange={(v) => changeEquipmentStatus(eq.id, v as EquipmentStatus)}
                          disabled={!canChangeStatus}
                        >
                          <SelectTrigger className="w-32">
                            <span className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${getEquipmentStatusColor(normalizeEquipmentStatus(eq.status))}`} />
                              {getEquipmentStatusLabel(normalizeEquipmentStatus(eq.status))}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {EQUIPMENT_STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                <span className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${s.color}`} />
                                  {s.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {selectedEquipment.includes(eq.id) ? (
                          <span className="text-xs text-muted-foreground">已关联</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">未关联</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {store.equipment.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        暂无设备数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              取消
            </Button>
            <Button onClick={saveConfig}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

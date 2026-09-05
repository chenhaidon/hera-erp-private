import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/common/Pagination';
import { usePagination } from '@/lib/pagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  checkOperationDependency,
  recalcWorkOrderFromOperations,
  getOutsourceReportLimit,
  createPendingFinishedInspection,
  isFinishedInspectionQualified,
  unlockNextOperation,
} from '@/lib/production';
import { nanoid } from '@/lib/utils';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Search, User, Calendar, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { WorkOrder, WorkOrderOperation, OperationReportRecord, QualityInspectionItem } from '@/types';

export function ReportManagementTab() {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [search, setSearch] = useState('');
  const [contractFilter, setContractFilter] = useState('全部');
  const [open, setOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<WorkOrderOperation | null>(null);
  const [operator, setOperator] = useState(currentUserName);
  const [qty, setQty] = useState(0);
  const [reportColor, setReportColor] = useState('');
  const [reportSpec, setReportSpec] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [needleDensity, setNeedleDensity] = useState('');
  const [pattern, setPattern] = useState('');
  const [pressure, setPressure] = useState('');
  const [threadType, setThreadType] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [limitAlert, setLimitAlert] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [dependencyConfirmOpen, setDependencyConfirmOpen] = useState(false);
  const [pendingPrevOperation, setPendingPrevOperation] = useState<WorkOrderOperation | null>(null);
  const [qcOpen, setQcOpen] = useState(false);
  const [qcForm, setQcForm] = useState<{
    work_no?: string;
    operation_name?: string;
    result?: 'qualified' | 'unqualified';
    inspector?: string;
    defect_reason?: string;
    items?: QualityInspectionItem[];
  }>({});

  useEffect(() => {
    if (currentUserName) {
      setOperator((prev) => prev || currentUserName);
      setQcForm((prev) => (prev.inspector ? prev : { ...prev, inspector: currentUserName }));
    }
  }, [currentUserName]);

  // 对工单按 work_no 去重，保留创建时间最新的记录，避免重复工单导致报工重复显示
  const dedupWorkOrders = useMemo(() => {
    const map = new Map<string, typeof store.workOrders[0]>();
    for (const wo of store.workOrders) {
      const existing = map.get(wo.work_no);
      if (!existing || (wo.created_at || '') > (existing.created_at || '')) {
        map.set(wo.work_no, wo);
      }
    }
    return Array.from(map.values());
  }, [store.workOrders]);

  const reports = useMemo(() => {
    const list: {
      id: string;
      workNo: string;
      contractNo: string;
      productName: string;
      productSpec: string;
      productColor: string;
      operationName: string;
      operationCode: string;
      operatorName: string;
      qty: number;
      unitPrice: number;
      amount: number;
      reportTime: string;
    }[] = [];
    for (const wo of dedupWorkOrders) {
      for (const op of wo.operations) {
        if (!op) continue;
        for (const r of op.reports || []) {
          list.push({
            id: r.id,
            workNo: r.work_no || wo.work_no,
            contractNo: wo.contract_no || '',
            productName: wo.product_name,
            productSpec: r.spec || wo.sku_summary || '',
            productColor: r.color || wo.color || '',
            operationName: r.operation_name || op.name,
            operationCode: r.operation_code || op.code,
            operatorName: r.operator_name || '',
            qty: r.qty ?? 0,
            unitPrice: r.unit_price ?? 0,
            amount: r.amount ?? 0,
            reportTime: r.report_time || wo.issued_at || new Date().toISOString(),
          });
        }
      }
    }
    return list.sort((a, b) => new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime());
  }, [dedupWorkOrders]);

  const contractOptions = useMemo(() => {
    const set = new Set<string>();
    for (const wo of dedupWorkOrders) {
      if (wo.contract_no) set.add(wo.contract_no);
    }
    return Array.from(set).sort();
  }, [dedupWorkOrders]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return reports.filter(
      (r) =>
        (contractFilter === '全部' || r.contractNo === contractFilter) &&
        (!keyword ||
          r.workNo.toLowerCase().includes(keyword) ||
          r.contractNo.toLowerCase().includes(keyword) ||
          r.operationName.toLowerCase().includes(keyword) ||
          r.operatorName.toLowerCase().includes(keyword) ||
          r.productName.toLowerCase().includes(keyword) ||
          r.productSpec.toLowerCase().includes(keyword) ||
          r.productColor.toLowerCase().includes(keyword))
    );
  }, [reports, search, contractFilter]);

  const {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    setPage,
    setPageSize,
  } = usePagination(filtered, { defaultPageSize: 20 });

  const reportableWorkOrders = useMemo(() => {
    return dedupWorkOrders
      .filter((wo) => wo.status !== 'pending' && wo.status !== 'closed' && wo.status !== 'completed')
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [dedupWorkOrders]);

  const reportableOperations = useMemo(() => {
    if (!selectedWorkOrder) return [];
    return selectedWorkOrder.operations.filter(
      (op) => op.status !== 'completed' && op.status !== 'closed' && op.category !== 'outsourcing'
    );
  }, [selectedWorkOrder]);

  function resetDialog() {
    setSelectedWorkOrder(null);
    setSelectedOperation(null);
    setOperator(currentUserName);
    setQty(0);
    setReportColor('');
    setReportSpec('');
    setDeviceCode('');
    setNeedleDensity('');
    setPattern('');
    setPressure('');
    setThreadType('');
    setConfirmOpen(false);
    setLimitAlert({ open: false, message: '' });
  }

  function handleOpen() {
    resetDialog();
    setOpen(true);
  }

  function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00.000Z`;
  }

  async function saveQc() {
    if (!qcForm.work_no || !qcForm.operation_name) return;
    const wo = store.workOrders.find((w) => w.work_no === qcForm.work_no);
    const op = wo?.operations.find((o) => o.name === qcForm.operation_name);
    const standard = store.processInspectionStandards.find(
      (s) => s.process_name === qcForm.operation_name && s.status === 'active'
    );
    const items =
      qcForm.items?.length && qcForm.items.some((i) => i.name)
        ? qcForm.items
        : (standard?.items || []).map((i) => ({
            ...i,
            actual: undefined,
            result: 'pending' as const,
          }));
    const existing = store.processInspections.find(
      (p) =>
        p.work_no === qcForm.work_no &&
        (p.operation_code === op?.code || p.operation_name === qcForm.operation_name)
    );
    const record = {
      id: existing?.id || nanoid(),
      code: existing?.code || `PI-${Date.now().toString().slice(-6)}`,
      work_id: wo?.id || existing?.work_id || '',
      work_no: qcForm.work_no,
      operation_name: qcForm.operation_name,
      operation_code: op?.code || '',
      result: qcForm.result || 'qualified',
      status: 'inspected' as const,
      inspector: qcForm.inspector || currentUserName || '质检员',
      created_at: existing?.created_at || new Date().toISOString(),
      items,
      defect_reason: qcForm.defect_reason || '',
    };
    if (existing) {
      await store.updateProcessInspection(record);
    } else {
      await store.addProcessInspection(record);
    }
    if (record.result === 'qualified' && op && wo) {
      const completedOp = {
        ...op,
        status: 'completed' as const,
        completed: true,
        pqc_inspection_id: record.id,
      };
      const nextOps = unlockNextOperation(
        {
          ...wo,
          operations: wo.operations.map((o) => (o.code === op.code ? completedOp : o)),
        },
        completedOp
      );
      const updated = { ...wo, operations: nextOps };
      const recalc = recalcWorkOrderFromOperations(updated);
      const finalWo = { ...updated, ...recalc };
      await store.updateWorkOrder(finalWo);
      if (recalc.status === 'qc' && !isFinishedInspectionQualified(store, finalWo)) {
        await createPendingFinishedInspection(store, finalWo);
      }
    } else if (record.result === 'unqualified' && wo) {
      store.addProductionException({
        id: nanoid(),
        code: `EX-${Date.now().toString().slice(-6)}`,
        work_id: record.work_id,
        work_no: record.work_no,
        operation_name: record.operation_name,
        type: '质量问题',
        description: `过程巡检不合格：${record.operation_name}，${record.defect_reason || ''}`,
        submitter: record.inspector,
        created_at: new Date().toISOString(),
        status: 'pending',
      });
    }
    setQcOpen(false);
    toast.success('过程巡检已保存');
  }

  async function doSubmitReport(force = false) {
    if (!selectedWorkOrder || !selectedOperation || !operator) return;
    const wo = selectedWorkOrder;
    const op = selectedOperation;
    if (wo.picking_status === 'pending') {
      toast.error('请先完成领料');
      return;
    }
    const remaining = op.plan_qty - op.completed_qty;
    const limit = getOutsourceReportLimit(wo, op, store.outsourceReturns);
    if (limit !== null && qty > limit) {
      setLimitAlert({
        open: true,
        message: `该外协工序回货合格数量不足，可报工上限为 ${limit} 件。`,
      });
      return;
    }
    if (qty > remaining && !force) {
      setConfirmOpen(true);
      return;
    }

    const product = store.products.find((p) => p.id === wo.product_id);
    const productStep = product?.process_steps?.find((s) => s.code === op.code);
    const route = store.processRoutes.find((r) => r.category === wo.product_category);
    const step = route?.steps.find((s) => s.code === op.code);
    const fallbackPrice: Record<string, number> = {
      'G-001': 0.5,
      'G-002': 0.3,
      'G-003': 0.6,
      'G-007': 0.3,
      'G-008': 2.0,
      'G-010': 1.0,
      'G-011': 0.4,
    };
    const unitPrice =
      productStep?.piece_price ??
      productStep?.price ??
      step?.piece_price ??
      step?.price ??
      fallbackPrice[op.code] ??
      0;
    const emp = store.employees.find((e) => e.name === operator);
    const report: OperationReportRecord = {
      id: nanoid(),
      operator_id: emp?.id,
      operator_name: operator,
      qty,
      unit_price: unitPrice,
      amount: Number((qty * unitPrice).toFixed(2)),
      report_time: getTodayDateString(),
      work_no: wo.work_no,
      operation_name: op.name,
      operation_code: op.code,
      color: reportColor,
      spec: reportSpec,
    };
    const newCompleted = Math.min(op.completed_qty + qty, op.plan_qty);
    const completedAll = newCompleted >= op.plan_qty;
    const newOp: WorkOrderOperation = {
      ...op,
      completed_qty: newCompleted,
      status: completedAll ? 'qc' : 'running',
      completed: completedAll,
      device_code: deviceCode,
      params:
        op.name === '绗缝'
          ? {
              needle_density: needleDensity,
              pattern,
              pressure,
              thread_type: threadType,
            }
          : undefined,
      reports: [...(op.reports || []), report],
    };
    const ops = wo.operations.map((o) => (o.code === op.code ? newOp : o));
    const updated = { ...wo, operations: ops };
    const recalc = recalcWorkOrderFromOperations(updated);
    const finalWo = { ...updated, ...recalc };
    await store.updateWorkOrder(finalWo);

    if (completedAll) {
      const existing = store.processInspections.find(
        (p) =>
          p.work_id === wo.id &&
          (p.operation_code === op.code || p.operation_name === op.name) &&
          p.status === 'pending'
      );
      if (!existing) {
        const standard = store.processInspectionStandards.find(
          (s) => s.process_name === op.name && s.status === 'active'
        );
        const items = standard
          ? standard.items.map((i) => ({
              ...i,
              result: 'pending' as const,
              actual: undefined,
            }))
          : [
              {
                name: '过程巡检',
                standard: 1,
                upper: 1,
                lower: 1,
                unit: '级',
                result: 'pending' as const,
              },
            ];
        const pendingInspection = {
          id: nanoid(),
          code: `PI-${Date.now().toString().slice(-6)}`,
          work_id: wo.id,
          work_no: wo.work_no,
          operation_name: op.name,
          operation_code: op.code,
          result: 'pending' as const,
          status: 'pending' as const,
          inspector: '',
          created_at: new Date().toISOString(),
          items,
          defect_reason: '',
        };
        await store.addProcessInspection(pendingInspection);
      }
    }

    const allOperationsDone = ops.every(
      (o) => o.status === 'completed' || o.status === 'closed' || o.status === 'qc'
    );
    if (allOperationsDone && !isFinishedInspectionQualified(store, finalWo)) {
      await createPendingFinishedInspection(store, finalWo);
    }
    const cost = store.workOrderCosts.find((c) => c.work_id === wo.id);
    if (cost && (step || productStep)) {
      const laborPrice =
        productStep?.piece_price ??
        productStep?.price ??
        step?.piece_price ??
        step?.price ??
        0;
      store.setWorkOrderCosts(
        store.workOrderCosts.map((c) =>
          c.work_id === wo.id ? { ...c, labor: c.labor + qty * laborPrice } : c
        )
      );
    }
    setOpen(false);
    setConfirmOpen(false);
    setDependencyConfirmOpen(false);
    toast.success(completedAll ? '本工序已报工完成，等待 PQC 质检' : '报工成功');

    if (pendingPrevOperation) {
      const standard = store.processInspectionStandards.find(
        (s) => s.process_name === pendingPrevOperation.name && s.status === 'active'
      );
      setQcForm({
        work_no: wo.work_no,
        operation_name: pendingPrevOperation.name,
        result: 'qualified',
        inspector: currentUserName,
        defect_reason: '',
        items: (standard?.items || []).map((i) => ({
          ...i,
          actual: undefined,
          result: 'pending' as const,
        })),
      });
      setQcOpen(true);
      setPendingPrevOperation(null);
    }
  }

  async function submitReport(force = false) {
    if (!selectedWorkOrder || !selectedOperation || !operator) return;
    const wo = selectedWorkOrder;
    const op = selectedOperation;

    if (!checkOperationDependency(wo, op, store.processInspections)) {
      const prev = wo.operations.find((o) => o.seq === op.seq - 1) || null;
      setPendingPrevOperation(prev);
      setDependencyConfirmOpen(true);
      return;
    }

    await doSubmitReport(force);
  }

  async function confirmDependencyAndSubmit() {
    await doSubmitReport(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">报工记录列表</CardTitle>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Button size="sm" onClick={handleOpen}>
              <Plus className="mr-1 h-4 w-4" />
              新增报工
            </Button>
            <Select value={contractFilter} onValueChange={setContractFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="合同编号" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部合同</SelectItem>
                {contractOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索工单号、工序、报工人、产品"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">工单号</TableHead>
                  <TableHead className="whitespace-nowrap">合同编号</TableHead>
                  <TableHead className="whitespace-nowrap">产品</TableHead>
                  <TableHead className="whitespace-nowrap">规格</TableHead>
                  <TableHead className="whitespace-nowrap">颜色</TableHead>
                  <TableHead className="whitespace-nowrap">工序</TableHead>
                  <TableHead className="whitespace-nowrap">报工人</TableHead>
                  <TableHead className="whitespace-nowrap text-right">数量</TableHead>
                  <TableHead className="whitespace-nowrap text-right">工价</TableHead>
                  <TableHead className="whitespace-nowrap text-right">金额</TableHead>
                  <TableHead className="whitespace-nowrap">报工时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                      暂无报工记录
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-medium">{r.workNo}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.contractNo || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.productName}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.productSpec}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.productColor}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline">{r.operationName}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.operatorName}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">{r.qty}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">¥{(Number(r.unitPrice) || 0).toFixed(2)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">¥{(Number(r.amount) || 0).toFixed(2)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(r.reportTime).toLocaleDateString('zh-CN')}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            className="border-t-0 rounded-t-none"
          />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增报工</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>工单</Label>
              <Select
                value={selectedWorkOrder?.id || ''}
                onValueChange={(id) => {
                  const wo = store.workOrders.find((w) => w.id === id) || null;
                  setSelectedWorkOrder(wo);
                  setSelectedOperation(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择工单" />
                </SelectTrigger>
                <SelectContent>
                  {reportableWorkOrders.map((wo) => (
                    <SelectItem key={wo.id} value={wo.id}>
                      {wo.work_no} · {wo.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>工序</Label>
                <Select
                  value={selectedOperation?.code || ''}
                  onValueChange={(code) => {
                    const op = selectedWorkOrder?.operations.find((o) => o.code === code) || null;
                    setSelectedOperation(op);
                  }}
                  disabled={!selectedWorkOrder || reportableOperations.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedWorkOrder ? '选择工序' : '请先选择工单'} />
                  </SelectTrigger>
                  <SelectContent>
                    {reportableOperations.map((op) => (
                      <SelectItem key={op.code} value={op.code}>
                        {op.name}（剩余 {op.plan_qty - op.completed_qty}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>完成数量</Label>
                <Input
                  type="number"
                  min={0}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  disabled={!selectedOperation}
                />
              </div>
              <div className="space-y-2">
                <Label>颜色</Label>
                <Input
                  value={reportColor}
                  onChange={(e) => setReportColor(e.target.value)}
                  placeholder="选填"
                  disabled={!selectedOperation}
                />
              </div>
              <div className="space-y-2">
                <Label>规格</Label>
                <Input
                  value={reportSpec}
                  onChange={(e) => setReportSpec(e.target.value)}
                  placeholder="选填"
                  disabled={!selectedOperation}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>报工人</Label>
                <Select value={operator} onValueChange={setOperator}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择员工" />
                  </SelectTrigger>
                  <SelectContent>
                    {store.employees
                      .filter((e) => e.status === 'active' && e.department === '生产部')
                      .map((e) => (
                        <SelectItem key={e.id} value={e.name}>
                          {e.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>剩余数量</Label>
                <Input value={selectedOperation ? selectedOperation.plan_qty - selectedOperation.completed_qty : 0} disabled />
              </div>
            </div>
            {selectedOperation?.name === '绗缝' && (
              <div className="space-y-3 rounded border p-3">
                <div className="text-sm font-medium">绗缝运行参数</div>
                <div className="space-y-2">
                  <Label>关联设备</Label>
                  <Select
                    value={deviceCode || 'none'}
                    onValueChange={(v) => setDeviceCode(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择设备" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不关联</SelectItem>
                      {store.equipment.map((e) => (
                        <SelectItem key={e.id} value={e.code}>
                          {e.name} · {e.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>针距密度</Label>
                    <Input value={needleDensity} onChange={(e) => setNeedleDensity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>花型</Label>
                    <Input value={pattern} onChange={(e) => setPattern(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>压脚压力</Label>
                    <Input value={pressure} onChange={(e) => setPressure(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>线型</Label>
                    <Input value={threadType} onChange={(e) => setThreadType(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={() => submitReport()}>
                <CheckCircle2 className="mr-1 h-4 w-4" />
                提交报工
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle>超产确认</DialogTitle>
          </DialogHeader>
          <p className="text-sm">完成数量超过工序计划量，是否继续？</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button onClick={() => submitReport(true)}>确认</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={limitAlert.open} onOpenChange={(o) => setLimitAlert({ ...limitAlert, open: o })}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              报工数量超限
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">{limitAlert.message}</p>
          <div className="flex justify-end">
            <Button onClick={() => setLimitAlert({ ...limitAlert, open: false })}>知道了</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dependencyConfirmOpen} onOpenChange={setDependencyConfirmOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              前序工序未通过质检
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            前序工序「{pendingPrevOperation?.name || ''}」未完成或未通过过程质检，是否继续报工并自动打开新增质检窗口？
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDependencyConfirmOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmDependencyAndSubmit}>确认继续</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={qcOpen} onOpenChange={setQcOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>新增过程巡检</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>工单编号</Label>
              <Input value={qcForm.work_no || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>巡检工序</Label>
              <Input value={qcForm.operation_name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>巡检结果</Label>
              <Select
                value={qcForm.result || 'qualified'}
                onValueChange={(v) =>
                  setQcForm((f) => ({ ...f, result: v as 'qualified' | 'unqualified' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualified">合格</SelectItem>
                  <SelectItem value="unqualified">不合格</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {qcForm.result === 'unqualified' && (
              <div className="space-y-2">
                <Label>不合格原因</Label>
                <Textarea
                  value={qcForm.defect_reason || ''}
                  onChange={(e) => setQcForm((f) => ({ ...f, defect_reason: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>巡检人</Label>
              <Input
                value={qcForm.inspector || ''}
                onChange={(e) => setQcForm((f) => ({ ...f, inspector: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setQcOpen(false)}>
              取消
            </Button>
            <Button onClick={saveQc}>提交</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

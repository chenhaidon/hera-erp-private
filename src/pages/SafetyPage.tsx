import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppStore } from "@/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SAFETY_RECORD_TYPES } from "@/lib/data";
import {
  Plus,
  HardHat,
  AlertTriangle,
  ShieldCheck,
  Flame,
  Users,
  TrendingUp,
  CheckCircle2,
  ClipboardList,
  CalendarDays,
  FileText,
} from "lucide-react";
import type { SafetyRecord, SafetyPatrolPlan, SafetyPatrolTask } from "@/types";
import { nanoid } from "@/lib/utils";
import { toast } from "sonner";

function statusBadge(status?: string) {
  if (!status) return <span className="text-muted-foreground">-</span>;
  if (status === "已完成" || status === "正常" || status === "已处理")
    return (
      <Badge variant="default" className="bg-green-500">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        {status}
      </Badge>
    );
  if (status === "整改中") return <Badge variant="secondary">{status}</Badge>;
  if (status === "待整改")
    return (
      <Badge variant="destructive">
        <AlertTriangle className="mr-1 h-3 w-3" />
        {status}
      </Badge>
    );
  return <Badge variant="outline">{status}</Badge>;
}

function getOperationLogs(item: SafetyRecord | null) {
  if (!item) return [];
  if (item.operation_logs && item.operation_logs.length > 0) {
    return item.operation_logs;
  }
  const base: { id: string; time: string; action: string; operator?: string }[] = [
    {
      id: nanoid(),
      time: item.record_date,
      action: `创建${
        SAFETY_RECORD_TYPES.find((t) => t.value === item.type)?.label ||
        item.type
      }记录：${item.area || item.topic || '-'}`,
    },
  ];
  if (item.rectification_status && item.rectification_status !== '待整改') {
    base.push({
      id: nanoid(),
      time: item.completion_date || item.record_date,
      action: `更新整改状态为：${item.rectification_status}`,
    });
  }
  if (item.completion_date) {
    base.push({
      id: nanoid(),
      time: item.completion_date,
      action: '完成整改',
    });
  }
  return base;
}

function RecordDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: SafetyRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item
              ? `${
                  SAFETY_RECORD_TYPES.find((t) => t.value === item.type)
                    ?.label || item.type
                }详情`
              : '详情'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">日期</span>
              <div>{item?.record_date || '-'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">区域/主题</span>
              <div>{item?.area || item?.topic || '-'}</div>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">描述</span>
              <div>{item?.description || '-'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">状态</span>
              <div>{statusBadge(item?.rectification_status)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">完成日期</span>
              <div>{item?.completion_date || '-'}</div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">操作日志</h4>
            <div className="max-h-[240px] overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <tbody>
                  {getOperationLogs(item).map((log) => (
                    <tr key={log.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {log.time}
                      </td>
                      <td className="px-3 py-2">{log.action}</td>
                      {log.operator && (
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          操作人：{log.operator}
                        </td>
                      )}
                    </tr>
                  ))}
                  {getOperationLogs(item).length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-2 text-center text-muted-foreground"
                      >
                        暂无操作日志
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SafetyPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="安全生产"
        description="隐患排查、事故上报、培训与消防检查"
      />
      <ControlledTabs modulePath="/safety" defaultTab="dashboard">
        <TabsList className="bg-muted">
          <TabsTrigger value="dashboard">安全看板</TabsTrigger>
          {SAFETY_RECORD_TYPES.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="patrol">巡检计划</TabsTrigger>
          <TabsTrigger value="patrol-tasks">巡检记录</TabsTrigger>
        </TabsList>
        <DashboardTab />
        {SAFETY_RECORD_TYPES.map((t) => (
          <TabsContent key={t.value} value={t.value} className="space-y-4">
            <RecordTab type={t.value as SafetyRecord["type"]} label={t.label} />
          </TabsContent>
        ))}
        <PatrolPlanTab />
        <PatrolTaskTab />
      </ControlledTabs>
    </div>
  );
}

/* ─── 安全看板 ───────────────────────────────────────────── */

function DashboardTab() {
  const store = useAppStore();
  const records = store.safetyRecords;
  const today = new Date().toISOString().split("T")[0]; // 当前日期
  const currentYear = new Date().getFullYear(); // 当前年份
  const defaultStartDate = `${currentYear}-01-01`; // 本年度1月1号

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(today);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<SafetyRecord | null>(null);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const d = r.record_date;
      return d >= startDate && d <= endDate;
    });
  }, [records, startDate, endDate]);

  const hazardTotal = filteredRecords.filter((r) => r.type === "hazard").length;
  const hazardPending = filteredRecords.filter(
    (r) =>
      r.type === "hazard" &&
      r.rectification_status &&
      r.rectification_status !== "已完成" &&
      r.rectification_status !== "正常",
  ).length;
  const accidentMonth = filteredRecords.filter((r) => r.type === "accident")
    .length;
  const trainingCount = filteredRecords.filter((r) => r.type === "training")
    .length;

  const stats = [
    {
      label: "隐患总数",
      value: hazardTotal,
      icon: AlertTriangle,
      color: "text-orange-500",
    },
    {
      label: "待整改",
      value: hazardPending,
      icon: ShieldCheck,
      color: "text-destructive",
    },
    {
      label: "本月事故",
      value: accidentMonth,
      icon: AlertTriangle,
      color: "text-red-500",
    },
    {
      label: "培训次数",
      value: trainingCount,
      icon: Users,
      color: "text-blue-500",
    },
  ];

  return (
    <TabsContent value="dashboard" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-md bg-muted ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            安全动态
          </CardTitle>
          <div className="flex flex-col gap-2 pt-2 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                开始日期
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-auto text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                结束日期
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-auto text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">日期</TableHead>
                <TableHead className="whitespace-nowrap">类型</TableHead>
                <TableHead className="whitespace-nowrap">区域/主题</TableHead>
                <TableHead className="whitespace-nowrap">描述</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords
                .slice()
                .sort((a, b) => b.record_date.localeCompare(a.record_date))
                .map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      {r.record_date}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        variant={
                          r.type === "accident"
                            ? "destructive"
                            : r.type === "hazard"
                              ? "secondary"
                              : "default"
                        }
                      >
                        {SAFETY_RECORD_TYPES.find((t) => t.value === r.type)
                          ?.label || r.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.area || r.topic || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.description || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="default">已完成</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDetailItem(r);
                          setDetailOpen(true);
                        }}
                      >
                        <FileText className="mr-1 h-4 w-4" />
                        详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              {filteredRecords.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <RecordDetailDialog
          item={detailItem}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </Card>
    </TabsContent>
  );
}

/* ─── 记录Tab ─────────────────────────────────────────────── */

function RecordTab({
  type,
  label,
}: {
  type: SafetyRecord["type"];
  label: string;
}) {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<SafetyRecord | null>(null);
  const [editing, setEditing] = useState<Partial<SafetyRecord> | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const records = useMemo(() => {
    let list = store.safetyRecords.filter((r) => r.type === type);
    if (statusFilter !== "all") {
      if (type === "hazard")
        list = list.filter((r) => r.rectification_status === statusFilter);
    }
    return list.sort((a, b) => b.record_date.localeCompare(a.record_date));
  }, [store.safetyRecords, type, statusFilter]);

  const hazardStatuses = ["待整改", "整改中", "已完成"];

  function openAdd() {
    const base: Partial<SafetyRecord> = {
      type,
      record_date: new Date().toISOString().split("T")[0],
    };
    if (type === "hazard") base.rectification_status = "待整改";
    setEditing(base);
    setOpen(true);
  }

  function openEdit(item: SafetyRecord) {
    setEditing({ ...item });
    setOpen(true);
  }

  function openDetail(item: SafetyRecord) {
    setDetailItem(item);
    setDetailOpen(true);
  }

  function save() {
    if (!editing) return;
    const isNew = !editing.id;
    const payload = isNew
      ? ({ ...editing, id: nanoid() } as SafetyRecord)
      : (editing as SafetyRecord);

    if (type === 'hazard' && !isNew) {
      const original = store.safetyRecords.find((r) => r.id === payload.id);
      const originalStatus = original?.rectification_status;
      const newStatus = payload.rectification_status;
      if (originalStatus !== newStatus) {
        const logs = payload.operation_logs || original?.operation_logs || [];
        const now = new Date().toISOString().split('T')[0];
        payload.operation_logs = [
          ...logs,
          {
            id: nanoid(),
            time: now,
            action: `整改状态由 ${originalStatus || '待整改'} 变更为 ${newStatus || '-'}`,
          },
        ];
      }
    }

    if (isNew) store.addSafetyRecord(payload);
    else store.updateSafetyRecord(payload);
    setOpen(false);
    setEditing(null);
  }

  const {
    paginatedItems: recordsPaginated,
    currentPage: recordsCurrentPage,
    pageSize: recordsPageSize,
    totalPages: recordsTotalPages,
    totalItems: recordsTotalItems,
    setPage: setRecordsPage,
    setPageSize: setRecordsPageSize,
  } = usePagination(records);

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {type === "hazard" && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {hazardStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          新增{label}
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">日期</TableHead>
                <TableHead className="whitespace-nowrap">区域/主题</TableHead>
                <TableHead className="whitespace-nowrap">描述</TableHead>
                <TableHead className="whitespace-nowrap">状态/结果</TableHead>
                <TableHead className="whitespace-nowrap">完成日期</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsPaginated.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {r.record_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.area || r.topic || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap max-w-[200px] truncate">
                    {r.description || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {statusBadge(r.rectification_status || r.outcome)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.completion_date || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetail(r)}
                      >
                        <FileText className="mr-1 h-4 w-4" />
                        详情
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(r)}
                      >
                        编辑
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={recordsCurrentPage}
            totalPages={recordsTotalPages}
            pageSize={recordsPageSize}
            totalItems={recordsTotalItems}
            onPageChange={setRecordsPage}
            onPageSizeChange={setRecordsPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? `编辑${label}` : `新增${label}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>日期</Label>
              <Input
                type="date"
                value={editing?.record_date || ""}
                onChange={(e) =>
                  setEditing((s) => ({ ...s!, record_date: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>{type === "training" ? "培训主题" : "区域"}</Label>
              <Input
                value={editing?.area || editing?.topic || ""}
                onChange={(e) =>
                  setEditing((s) => ({
                    ...s!,
                    [type === "training" ? "topic" : "area"]: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>责任人</Label>
              <Select
                value={editing?.responsible_person_id || "none"}
                onValueChange={(v) => {
                  const e = store.employees.find((x) => x.id === v);
                  setEditing((s) => ({
                    ...s!,
                    responsible_person_id: e?.id || "",
                    responsible_person: e?.name || "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择责任人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  {store.employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>描述</Label>
              <Textarea
                value={editing?.description || ""}
                onChange={(e) =>
                  setEditing((s) => ({ ...s!, description: e.target.value }))
                }
              />
            </div>
            {type === "hazard" && (
              <div className="grid gap-2">
                <Label>整改状态</Label>
                <Select
                  value={editing?.rectification_status || "待整改"}
                  onValueChange={(v) =>
                    setEditing((s) => ({ ...s!, rectification_status: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hazardStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(type === "hazard" || type === "accident" || type === "training" || type === "fire") && (
              <div className="grid gap-2">
                <Label>完成日期</Label>
                <Input
                  type="date"
                  value={editing?.completion_date || ""}
                  onChange={(e) =>
                    setEditing((s) => ({
                      ...s!,
                      completion_date: e.target.value,
                    }))
                  }
                />
              </div>
            )}
            {type === "training" && (
              <div className="grid gap-2">
                <Label>培训结果</Label>
                <Textarea
                  value={editing?.outcome || ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s!, outcome: e.target.value }))
                  }
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>
              <HardHat className="mr-2 h-4 w-4" />
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <RecordDetailDialog
        item={detailItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}

/* ─── 巡检计划 ───────────────────────────────────────────── */

function PatrolPlanTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<SafetyPatrolPlan>>({
    cycle: "daily",
    status: "active",
    check_items: [],
  });

  const plans = useMemo(
    () =>
      store.safetyPatrolPlans
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code)),
    [store.safetyPatrolPlans],
  );

  function openAdd() {
    setEditing({
      cycle: "daily",
      status: "active",
      check_items: [],
      next_patrol_date: new Date().toISOString().split("T")[0],
    });
    setOpen(true);
  }

  function openEdit(plan: SafetyPatrolPlan) {
    setEditing({ ...plan });
    setOpen(true);
  }

  function save() {
    if (!editing.name || !editing.area || !editing.cycle) return;
    const payload = editing.id
      ? ({ ...editing } as SafetyPatrolPlan)
      : ({
          ...editing,
          id: nanoid(),
          code: `SPP-${Date.now().toString().slice(-6)}`,
        } as SafetyPatrolPlan);
    if (editing.id) store.updateSafetyPatrolPlan(payload);
    else store.addSafetyPatrolPlan(payload);
    setOpen(false);
    setEditing({ cycle: "daily", status: "active", check_items: [] });
  }

  function addDays(dateStr: string, days: number) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  function addMonths(dateStr: string, months: number) {
    const d = new Date(dateStr + "T00:00:00");
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
  }

  function nextPatrolDate(plan: SafetyPatrolPlan) {
    if (plan.cycle === "daily") return addDays(plan.next_patrol_date, 1);
    if (plan.cycle === "weekly") return addDays(plan.next_patrol_date, 7);
    if (plan.cycle === "monthly") return addMonths(plan.next_patrol_date, 1);
    return plan.next_patrol_date;
  }

  async function generateTasks() {
    const today = new Date().toISOString().split("T")[0];
    let created = 0;
    for (const plan of store.safetyPatrolPlans) {
      if (plan.status !== "active") continue;
      // 当计划下次巡检日期 >= 今天时生成待完成记录
      if (plan.next_patrol_date < today) continue;
      const exists = store.safetyPatrolTasks.some(
        (t) =>
          t.plan_id === plan.id &&
          t.scheduled_date === plan.next_patrol_date &&
          t.status !== "completed",
      );
      if (!exists) {
        const task: SafetyPatrolTask = {
          id: nanoid(),
          code: `SPT-${Date.now().toString().slice(-6)}-${plan.code.slice(-3)}`,
          plan_id: plan.id,
          plan_name: plan.name,
          area: plan.area,
          check_items: plan.check_items,
          scheduled_date: plan.next_patrol_date,
          responsible_person: plan.responsible_person,
          status: "pending",
        };
        await store.addSafetyPatrolTask(task);
        await store.updateSafetyPatrolPlan({
          ...plan,
          next_patrol_date: nextPatrolDate(plan),
        });
        created += 1;
      }
    }
    if (created === 0) {
      toast.info("暂无到期的巡检计划，无需生成任务");
    } else {
      toast.success(`已生成 ${created} 条待完成巡检记录`);
    }
  }

  const {
    paginatedItems: plansPaginated,
    currentPage: plansCurrentPage,
    pageSize: plansPageSize,
    totalPages: plansTotalPages,
    totalItems: plansTotalItems,
    setPage: setPlansPage,
    setPageSize: setPlansPageSize,
  } = usePagination(plans);

  return (
    <TabsContent value="patrol" className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={generateTasks}>
          <CalendarDays className="mr-2 h-4 w-4" />
          自动生成下次任务
        </Button>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          新增计划
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">计划编号</TableHead>
                <TableHead className="whitespace-nowrap">计划名称</TableHead>
                <TableHead className="whitespace-nowrap">巡检区域</TableHead>
                <TableHead className="whitespace-nowrap">周期</TableHead>
                <TableHead className="whitespace-nowrap">负责人</TableHead>
                <TableHead className="whitespace-nowrap">下次巡检</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plansPaginated.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {p.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{p.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.area}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.cycle === "daily"
                      ? "每日"
                      : p.cycle === "weekly"
                        ? "每周"
                        : "每月"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.responsible_person}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.next_patrol_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={p.status === "active" ? "default" : "secondary"}
                    >
                      {p.status === "active" ? "启用" : "暂停"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(p)}
                    >
                      编辑
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {plans.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无巡检计划
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={plansCurrentPage}
            totalPages={plansTotalPages}
            pageSize={plansPageSize}
            totalItems={plansTotalItems}
            onPageChange={setPlansPage}
            onPageSizeChange={setPlansPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v)
            setEditing({ cycle: "daily", status: "active", check_items: [] });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "编辑巡检计划" : "新增巡检计划"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>计划名称</Label>
              <Input
                value={editing.name || ""}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>巡检区域</Label>
              <Input
                value={editing.area || ""}
                onChange={(e) =>
                  setEditing({ ...editing, area: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>巡检周期</Label>
              <Select
                value={editing.cycle}
                onValueChange={(v) =>
                  setEditing({
                    ...editing,
                    cycle: v as "daily" | "weekly" | "monthly",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">每日</SelectItem>
                  <SelectItem value="weekly">每周</SelectItem>
                  <SelectItem value="monthly">每月</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>负责人</Label>
              <Input
                value={editing.responsible_person || ""}
                onChange={(e) =>
                  setEditing({ ...editing, responsible_person: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>检查项（用逗号分隔）</Label>
              <Input
                value={editing.check_items?.join(",") || ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    check_items: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>下次巡检日期</Label>
              <Input
                type="date"
                value={editing.next_patrol_date || ""}
                onChange={(e) =>
                  setEditing({ ...editing, next_patrol_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select
                value={editing.status}
                onValueChange={(v) =>
                  setEditing({ ...editing, status: v as "active" | "paused" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="paused">暂停</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>
              <ClipboardList className="mr-2 h-4 w-4" />
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 巡检任务 ───────────────────────────────────────────── */

function PatrolTaskTab() {
  const store = useAppStore();
  const [editing, setEditing] = useState<SafetyPatrolTask | null>(null);
  const [detail, setDetail] = useState<SafetyPatrolTask | null>(null);

  const tasks = useMemo(
    () =>
      store.safetyPatrolTasks
        .slice()
        .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date)),
    [store.safetyPatrolTasks],
  );

  function statusBadge(status: string) {
    if (status === "completed")
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          已完成
        </Badge>
      );
    if (status === "processing")
      return <Badge variant="secondary">进行中</Badge>;
    return <Badge variant="outline">待巡检</Badge>;
  }

  function startTask(task: SafetyPatrolTask) {
    store.updateSafetyPatrolTask({ ...task, status: "processing" });
  }

  function completeTask() {
    if (!editing) return;
    store.updateSafetyPatrolTask({
      ...editing,
      status: "completed",
      completed_at: new Date().toISOString().split("T")[0],
    });
    setEditing(null);
  }

  const {
    paginatedItems: tasksPaginated,
    currentPage: tasksCurrentPage,
    pageSize: tasksPageSize,
    totalPages: tasksTotalPages,
    totalItems: tasksTotalItems,
    setPage: setTasksPage,
    setPageSize: setTasksPageSize,
  } = usePagination(tasks);

  return (
    <TabsContent value="patrol-tasks" className="space-y-4">
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">任务编号</TableHead>
                <TableHead className="whitespace-nowrap">计划名称</TableHead>
                <TableHead className="whitespace-nowrap">区域</TableHead>
                <TableHead className="whitespace-nowrap">巡检日期</TableHead>
                <TableHead className="whitespace-nowrap">负责人</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasksPaginated.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {t.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.plan_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{t.area}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.scheduled_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.responsible_person}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {statusBadge(t.status)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {t.status === "pending" && (
                        <Button size="sm" onClick={() => startTask(t)}>
                          开始
                        </Button>
                      )}
                      {t.status === "processing" && (
                        <Button size="sm" onClick={() => setEditing(t)}>
                          完成
                        </Button>
                      )}
                      {t.status === "completed" && (
                        <span className="text-xs text-muted-foreground">
                          {t.completed_at}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetail(t)}
                      >
                        详情
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无巡检记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={tasksCurrentPage}
            totalPages={tasksTotalPages}
            pageSize={tasksPageSize}
            totalItems={tasksTotalItems}
            onPageChange={setTasksPage}
            onPageSizeChange={setTasksPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>完成巡检任务</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>检查结果</Label>
              <Select
                value={editing?.result || "normal"}
                onValueChange={(v) =>
                  setEditing((s) => (s ? { ...s, result: v } : null))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">正常</SelectItem>
                  <SelectItem value="abnormal">异常</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>发现项</Label>
              <Textarea
                value={editing?.findings || ""}
                onChange={(e) =>
                  setEditing((s) =>
                    s ? { ...s, findings: e.target.value } : null,
                  )
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button onClick={completeTask}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              确认完成
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>巡检记录详情</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">任务编号</span>
              <span className="col-span-2 font-medium">{detail?.code}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">计划名称</span>
              <span className="col-span-2">{detail?.plan_name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">区域</span>
              <span className="col-span-2">{detail?.area}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">巡检日期</span>
              <span className="col-span-2">{detail?.scheduled_date}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">负责人</span>
              <span className="col-span-2">{detail?.responsible_person}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">检查项</span>
              <span className="col-span-2">
                {detail?.check_items?.join("、")}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">检查结果</span>
              <span className="col-span-2">
                {detail?.result === "abnormal" ? "异常" : "正常"}
              </span>
            </div>
            {(detail?.findings || detail?.remarks) && (
              <div className="grid gap-2">
                <span className="text-muted-foreground">备注 / 发现项</span>
                <div className="rounded-md border p-3 bg-muted/50">
                  {detail?.remarks || detail?.findings}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDetail(null)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nanoid, validateEquipmentRecordTime } from "@/lib/utils";
import {
  Wrench,
  Activity,
  ClipboardList,
  CalendarCheck,
  PenTool,
  Plus,
  Trash2,
  QrCode,
  Download,
  Archive,
  Eye,
} from "lucide-react";
import QRCodeDataUrl from "@/components/ui/qrcodedataurl";
import QRCode from "qrcode";
import { Checkbox } from "@/components/ui/checkbox";
import JSZip from "jszip";
import { toast } from "sonner";
import type { Equipment, MaintenancePlan, EquipmentRecord, EquipmentStatus } from "@/types";
import { hasPermission, type AppRole } from "@/lib/permissions";

// 设备保养/维修操作权限：仅设备运维(maintenance)与管理员(admin)可操作，其余角色只读
function canManageEquipment(role?: string): boolean {
  return role === "maintenance" || role === "admin";
}

const EQUIPMENT_STATUS_OPTIONS: { value: EquipmentStatus; label: string; color: string }[] = [
  { value: "idle", label: "空闲", color: "bg-emerald-500" },
  { value: "using", label: "使用中", color: "bg-blue-500" },
  { value: "maintenance", label: "维修中/停机", color: "bg-red-500" },
];

function getEquipmentStatusLabel(status?: EquipmentStatus) {
  return EQUIPMENT_STATUS_OPTIONS.find((s) => s.value === status)?.label || "空闲";
}

function getEquipmentStatusColor(status?: EquipmentStatus) {
  return EQUIPMENT_STATUS_OPTIONS.find((s) => s.value === status)?.color || "bg-emerald-500";
}

function normalizeEquipmentStatus(status?: string): EquipmentStatus {
  if (status === "using" || status === "maintenance") return status;
  return "idle";
}

function canChangeEquipmentStatus(role?: string): boolean {
  const r = role as AppRole | undefined;
  if (!r) return false;
  return hasPermission(r, ["admin", "production", "planner", "maintenance"]);
}

const TABS = [
  { value: "ledger", label: "设备台账", icon: ClipboardList },
  { value: "plan", label: "保养计划", icon: CalendarCheck },
  { value: "maintain", label: "保养记录", icon: Wrench },
  { value: "repair", label: "维修记录", icon: PenTool },
  { value: "oee", label: "OEE统计", icon: Activity },
];

export function EquipmentPage() {
  return (
    <div className="space-y-4 p-6">
      <PageHeader title="设备管理" description="设备台账、保养维修与OEE统计" />
      <SummaryCards />
      <ControlledTabs modulePath="/equipment" defaultTab="ledger">
        <TabsList className="w-full flex-wrap justify-start md:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              <t.icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="ledger">
          <LedgerTab />
        </TabsContent>
        <TabsContent value="plan">
          <PlanTab />
        </TabsContent>
        <TabsContent value="maintain">
          <MaintainTab />
        </TabsContent>
        <TabsContent value="repair">
          <RepairTab />
        </TabsContent>
        <TabsContent value="oee">
          <OeeTab />
        </TabsContent>
      </ControlledTabs>
    </div>
  );
}

function SummaryCards() {
  const store = useAppStore();
  const total = store.equipment.length;
  const normalCount = store.equipment.filter((e) => e.status !== "maintenance").length;
  const maintenanceCount = store.equipment.filter((e) => e.status === "maintenance").length;
  const upcoming = store.maintenancePlans.filter(
    (p) => p.status === "upcoming" || p.status === "overdue",
  ).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">设备总数</p>
          <p className="text-2xl font-bold">{total}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">正常运行</p>
          <p className="text-2xl font-bold">{normalCount}</p>
          <p className="text-xs text-muted-foreground">
            占比 {total ? Math.round((normalCount / total) * 100) : 0}%
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">保养提醒</p>
          <p className="text-2xl font-bold">{upcoming}</p>
          <p className="text-xs text-muted-foreground">到期/逾期计划</p>
        </CardContent>
      </Card>
    </div>
  );
}

function LedgerTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState<Partial<Equipment>>({
    status: "idle",
    running_hours: 0,
  });
  const [filterCategory, setFilterCategory] = useState("全部");
  const [filterStatus, setFilterStatus] = useState("全部");
  const [search, setSearch] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrEquipment, setQrEquipment] = useState<Equipment | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEquipment, setDetailEquipment] = useState<Equipment | null>(null);

  function equipmentUrl(e: Equipment) {
    return `${window.location.origin}/#/mobile/equipment?equipmentId=${e.id}`;
  }

  async function generateEquipmentQrPng(e: Equipment): Promise<string> {
    const url = await QRCode.toDataURL(equipmentUrl(e), {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    const qrImg = new Image();
    qrImg.src = url;
    await new Promise<void>((resolve) => {
      qrImg.onload = () => resolve();
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return url;

    const width = 320;
    const padding = 24;
    const qrSize = 200;
    const lineHeight = 28;
    const textRows = 4;
    const height = padding * 2 + lineHeight * textRows + qrSize + 16;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('设备二维码', width / 2, padding + 18);

    ctx.font = '16px sans-serif';
    ctx.fillText(e.name, width / 2, padding + 18 + lineHeight);

    ctx.font = '14px sans-serif';
    ctx.fillText(e.code, width / 2, padding + 18 + lineHeight * 2);

    if (e.model) {
      ctx.fillText(`型号：${e.model}`, width / 2, padding + 18 + lineHeight * 3);
    }

    const qrY = padding + lineHeight * textRows + 8;
    ctx.drawImage(qrImg, (width - qrSize) / 2, qrY, qrSize, qrSize);

    return canvas.toDataURL('image/png');
  }

  async function downloadQr() {
    if (!qrEquipment) return;
    const dataUrl = await generateEquipmentQrPng(qrEquipment);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `设备二维码-${qrEquipment.code || 'unknown'}.png`;
    link.click();
  }

  async function batchDownloadQr() {
    const selected = store.equipment.filter((e) => selectedIds.has(e.id));
    if (selected.length === 0) {
      toast.error('请先选择要下载的设备');
      return;
    }
    if (selected.length === 1) {
      const dataUrl = await generateEquipmentQrPng(selected[0]);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `设备二维码-${selected[0].code || 'unknown'}.png`;
      link.click();
      return;
    }
    const zip = new JSZip();
    await Promise.all(
      selected.map(async (e) => {
        const dataUrl = await generateEquipmentQrPng(e);
        const base64 = dataUrl.split(',')[1];
        const safeName = (e.code || e.id).replace(/[\\/:*?"<>|]/g, '_');
        zip.file(`设备二维码-${safeName}.png`, base64, { base64: true });
      })
    );
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `设备二维码批量下载-${selected.length}个.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const filtered = store.equipment.filter((e) => {
    const matchSearch =
      !search || e.code.includes(search) || e.name.includes(search);
    const matchCategory =
      filterCategory === "全部" || e.category === filterCategory;
    const matchStatus = filterStatus === "全部" || e.status === filterStatus;
    return matchSearch && matchCategory && matchStatus;
  });

  async function save() {
    if (!form.code || !form.name) return;
    const item: Equipment = {
      id: editing?.id || nanoid(),
      code: form.code,
      name: form.name,
      model: form.model || "",
      purchase_date: form.purchase_date || "",
      status: normalizeEquipmentStatus(form.status),
      workshop: form.workshop || "",
      category: form.category || "绗缝设备",
      running_hours: Number(form.running_hours) || 0,
      remarks: form.remarks || "",
    };
    if (editing) await store.updateEquipment(item);
    else await store.addEquipment(item);
    setOpen(false);
  }

  async function changeStatus(e: Equipment, status: EquipmentStatus) {
    if (!canChangeEquipmentStatus(store.currentRole)) {
      toast.error("当前角色无权限修改设备状态");
      return;
    }
    await store.updateEquipment({ ...e, status });
    toast.success(`${e.name} 状态已更新为 ${getEquipmentStatusLabel(status)}`);
  }

  async function remove(e: Equipment) {
    await store.deleteEquipment(e.id);
  }

  const {
    paginatedItems: filteredPaginated,
    currentPage: filteredCurrentPage,
    pageSize: filteredPageSize,
    totalPages: filteredTotalPages,
    totalItems: filteredTotalItems,
    setPage: setFilteredPage,
    setPageSize: setFilteredPageSize,
  } = usePagination(filtered);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            placeholder="搜索设备编号/名称"
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
            className="w-full md:w-56"
          />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full md:w-32">
              <SelectValue placeholder="类别" />
            </SelectTrigger>
            <SelectContent>
              {[
                "全部",
                "裁剪设备",
                "绗缝设备",
                "水洗设备",
                "整烫设备",
                "检验设备",
                "包装设备",
              ].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-28">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="全部">全部</SelectItem>
              {EQUIPMENT_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <Button size="sm" variant="outline" onClick={batchDownloadQr}>
              <Archive className="mr-1 h-4 w-4" />
              下载选中二维码（{selectedIds.size}）
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setForm({
                status: "idle",
                running_hours: 0,
              });
              setOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            新建设备
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 whitespace-nowrap">
                  <Checkbox
                    checked={
                      filteredPaginated.length > 0 &&
                      filteredPaginated.every((e) => selectedIds.has(e.id))
                    }
                    onCheckedChange={(checked) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        filteredPaginated.forEach((e) => {
                          if (checked) next.add(e.id);
                          else next.delete(e.id);
                        });
                        return next;
                      });
                    }}
                    aria-label="全选本页"
                  />
                </TableHead>
                <TableHead className="whitespace-nowrap">编号</TableHead>
                <TableHead className="whitespace-nowrap">设备名称</TableHead>
                <TableHead className="whitespace-nowrap">型号</TableHead>
                <TableHead className="whitespace-nowrap">类别</TableHead>
                <TableHead className="whitespace-nowrap">车间</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPaginated.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="w-10 whitespace-nowrap">
                    <Checkbox
                      checked={selectedIds.has(e.id)}
                      onCheckedChange={(checked) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(e.id);
                          else next.delete(e.id);
                          return next;
                        });
                      }}
                      aria-label={`选择 ${e.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {e.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{e.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{e.model}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.category}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.workshop}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Select
                      value={normalizeEquipmentStatus(e.status)}
                      onValueChange={(v) => changeStatus(e, v as EquipmentStatus)}
                      disabled={!canChangeEquipmentStatus(store.currentRole)}
                    >
                      <SelectTrigger className="w-28">
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${getEquipmentStatusColor(normalizeEquipmentStatus(e.status))}`} />
                          {getEquipmentStatusLabel(normalizeEquipmentStatus(e.status))}
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
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDetailEquipment(e);
                          setDetailOpen(true);
                        }}
                        title="详情"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(e);
                          setForm({ ...e });
                          setOpen(true);
                        }}
                      >
                        <PenTool className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setQrEquipment(e);
                          setQrOpen(true);
                        }}
                        title="查看二维码"
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            currentPage={filteredCurrentPage}
            totalPages={filteredTotalPages}
            pageSize={filteredPageSize}
            totalItems={filteredTotalItems}
            onPageChange={setFilteredPage}
            onPageSizeChange={setFilteredPageSize}
          />
        </CardContent>
      </Card>
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle>设备二维码</DialogTitle>
          </DialogHeader>
          {qrEquipment && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-center">
                <p className="font-semibold">{qrEquipment.name}</p>
                <p className="text-sm text-muted-foreground">{qrEquipment.code}</p>
                {qrEquipment.model && (
                  <p className="text-sm text-muted-foreground">型号：{qrEquipment.model}</p>
                )}
              </div>
              <div data-equipment-qr-download>
                <QRCodeDataUrl
                  text={equipmentUrl(qrEquipment)}
                  width={200}
                  errorCorrectionLevel="M"
                />
              </div>
              <p className="text-xs text-center break-all max-w-[240px] text-muted-foreground">
                {equipmentUrl(qrEquipment)}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setQrOpen(false)}>
              关闭
            </Button>
            <Button onClick={downloadQr} disabled={!qrEquipment}>
              <Download className="mr-1 h-4 w-4" />
              下载
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>设备详情</DialogTitle>
            <DialogDescription>
              {detailEquipment?.code} {detailEquipment?.name}
            </DialogDescription>
          </DialogHeader>
          {detailEquipment && (
            <div className="grid gap-4 py-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">设备编号</span>
                <span className="col-span-2 font-medium">{detailEquipment.code}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">设备名称</span>
                <span className="col-span-2 font-medium">{detailEquipment.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">型号</span>
                <span className="col-span-2 font-medium">{detailEquipment.model || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">类别</span>
                <span className="col-span-2 font-medium">{detailEquipment.category}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">车间</span>
                <span className="col-span-2 font-medium">{detailEquipment.workshop || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">状态</span>
                <span className="col-span-2 font-medium">
                  <Badge variant="outline" className="gap-1">
                    <span className={`h-2 w-2 rounded-full ${getEquipmentStatusColor(normalizeEquipmentStatus(detailEquipment.status))}`} />
                    {getEquipmentStatusLabel(normalizeEquipmentStatus(detailEquipment.status))}
                  </Badge>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">购置日期</span>
                <span className="col-span-2 font-medium">{detailEquipment.purchase_date || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">备注</span>
                <span className="col-span-2 font-medium whitespace-pre-wrap">
                  {detailEquipment.remarks || "-"}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑设备" : "新建设备"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>设备编号</Label>
                <Input
                  value={form.code || ""}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, code: ev.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>设备名称</Label>
                <Input
                  value={form.name || ""}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, name: ev.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>型号</Label>
                <Input
                  value={form.model || ""}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, model: ev.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>购置日期</Label>
                <Input
                  type="date"
                  value={form.purchase_date || ""}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, purchase_date: ev.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>所属车间</Label>
                <Input
                  value={form.workshop || ""}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, workshop: ev.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>设备类别</Label>
                <Select
                  value={form.category || "绗缝设备"}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "裁剪设备",
                      "绗缝设备",
                      "水洗设备",
                      "整烫设备",
                      "检验设备",
                      "包装设备",
                    ].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <Select
                  value={normalizeEquipmentStatus(form.status)}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as Equipment["status"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
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
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>累计运行时长(h)</Label>
                <Input
                  type="number"
                  value={form.running_hours || 0}
                  onChange={(ev) =>
                    setForm((f) => ({
                      ...f,
                      running_hours: Number(ev.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                placeholder="用途、保养注意事项等"
                value={form.remarks || ""}
                onChange={(ev) =>
                  setForm((f) => ({ ...f, remarks: ev.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanTab() {
  const store = useAppStore();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenancePlan | null>(null);
  const [form, setForm] = useState<Partial<MaintenancePlan>>({
    period_type: "hours",
    period: 500,
    next_date: "",
    content: "",
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPlan, setDetailPlan] = useState<MaintenancePlan | null>(null);
  const [maintainOpen, setMaintainOpen] = useState(false);
  const [maintainPlan, setMaintainPlan] = useState<MaintenancePlan | null>(null);
  const [maintainContent, setMaintainContent] = useState("");

  const plans = store.maintenancePlans;

  const canManage = canManageEquipment(profile?.role);

  async function save() {
    if (!form.equipment_id || !form.period || !form.next_date) return;
    const equipment = store.equipment.find((e) => e.id === form.equipment_id);
    const item: MaintenancePlan = {
      id: editing?.id || nanoid(),
      code: editing?.code || `MP-${Date.now().toString().slice(-6)}`,
      equipment_id: form.equipment_id,
      equipment_name: equipment?.name || "",
      period_type:
        (form.period_type as MaintenancePlan["period_type"]) || "hours",
      period: Number(form.period) || 0,
      last_date: form.last_date,
      next_date: form.next_date,
      content: form.content || "",
      status: (form.status as MaintenancePlan["status"]) || "normal",
      remarks: form.remarks || "",
    };
    if (editing) await store.updateMaintenancePlan(item);
    else await store.addMaintenancePlan(item);
    setOpen(false);
  }

  function openMaintainDialog(p: MaintenancePlan) {
    setMaintainPlan(p);
    setMaintainContent(p.remarks || p.content || "");
    setMaintainOpen(true);
  }

  async function submitMaintain() {
    if (!maintainPlan) return;
    const p = maintainPlan;
    const recordDate = new Date().toISOString().slice(0, 16).replace("T", " ");
    const timeCheck = validateEquipmentRecordTime(recordDate);
    if (!timeCheck.valid) {
      toast.error(timeCheck.message);
      return;
    }
    const nextDate = new Date();
    nextDate.setDate(
      nextDate.getDate() + (p.period_type === "calendar" ? p.period : 30),
    );
    await store.updateMaintenancePlan({
      ...p,
      last_date: new Date().toISOString().slice(0, 10),
      next_date: nextDate.toISOString().slice(0, 10),
      status: "normal",
    });
    const systemUser = store.systemUsers.find((u) => u.account === profile?.username);
    const employee = store.employees.find((e) => e.id === systemUser?.employee_id);
    const maintainerName = employee?.name || profile?.full_name || systemUser?.name || "黄超灵";
    const record: EquipmentRecord = {
      id: nanoid(),
      equipment_id: p.equipment_id,
      type: "maintenance",
      record_date: recordDate,
      description: maintainContent.trim() || p.remarks || p.content,
      duration: 2,
      loss_output: 0,
      maintainer: maintainerName,
    };
    await store.addEquipmentRecord(record);
    setMaintainOpen(false);
    setMaintainPlan(null);
    setMaintainContent("");
    toast.success("保养记录已保存");
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setForm({
                period_type: "hours",
                period: 500,
                next_date: "",
                content: "",
              });
              setOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            新建计划
          </Button>
        )}
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">计划编号</TableHead>
                <TableHead className="whitespace-nowrap">设备</TableHead>
                <TableHead className="whitespace-nowrap">周期类型</TableHead>
                <TableHead className="whitespace-nowrap">周期</TableHead>
                <TableHead className="whitespace-nowrap">上次保养</TableHead>
                <TableHead className="whitespace-nowrap">下次保养</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plansPaginated.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {p.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.equipment_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.period_type === "hours" ? "运行小时" : "日历周期"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.period}
                    {p.period_type === "hours" ? "h" : "天"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.last_date || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.next_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        p.status === "overdue"
                          ? "destructive"
                          : p.status === "upcoming"
                            ? "secondary"
                            : "default"
                      }
                    >
                      {p.status === "normal"
                        ? "正常"
                        : p.status === "upcoming"
                          ? "即将到期"
                          : "已逾期"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDetailPlan(p);
                          setDetailOpen(true);
                        }}
                        title="详情"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(p);
                            setForm({ ...p });
                            setOpen(true);
                          }}
                        >
                          <PenTool className="h-4 w-4" />
                        </Button>
                      )}
                      {canManage && (
                        <Button size="sm" onClick={() => openMaintainDialog(p)}>
                          保养
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "编辑保养计划" : "新建保养计划"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>设备</Label>
              <Select
                value={form.equipment_id || ""}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, equipment_id: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择设备" />
                </SelectTrigger>
                <SelectContent>
                  {store.equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>周期类型</Label>
                <Select
                  value={form.period_type || "hours"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      period_type: v as MaintenancePlan["period_type"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">运行小时</SelectItem>
                    <SelectItem value="calendar">日历周期</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>周期</Label>
                <Input
                  type="number"
                  value={form.period || 0}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, period: Number(ev.target.value) }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>上次保养日期</Label>
                <Input
                  type="date"
                  value={form.last_date || ""}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, last_date: ev.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>下次保养日期</Label>
                <Input
                  type="date"
                  value={form.next_date || ""}
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, next_date: ev.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>保养内容</Label>
              <Textarea
                value={form.content || ""}
                onChange={(ev) =>
                  setForm((f) => ({ ...f, content: ev.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                placeholder="保养步骤、注意事项等"
                value={form.remarks || ""}
                onChange={(ev) =>
                  setForm((f) => ({ ...f, remarks: ev.target.value }))
                }
                rows={4}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={maintainOpen} onOpenChange={setMaintainOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>执行保养</DialogTitle>
            <DialogDescription>
              {maintainPlan?.code} {maintainPlan?.equipment_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>本次保养事项</Label>
              <Textarea
                placeholder="请输入本次实际保养内容与注意事项"
                value={maintainContent}
                onChange={(ev) => setMaintainContent(ev.target.value)}
                rows={6}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              提示：默认已带入保养计划备注，可根据本次实际保养情况进行修改。
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMaintainOpen(false);
                setMaintainPlan(null);
                setMaintainContent("");
              }}
            >
              取消
            </Button>
            <Button onClick={submitMaintain}>提交</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>保养计划详情</DialogTitle>
            <DialogDescription>
              {detailPlan?.code} {detailPlan?.equipment_name}
            </DialogDescription>
          </DialogHeader>
          {detailPlan && (
            <div className="grid gap-4 py-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">计划编号</span>
                <span className="col-span-2 font-medium">{detailPlan.code}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">设备</span>
                <span className="col-span-2 font-medium">{detailPlan.equipment_name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">周期类型</span>
                <span className="col-span-2 font-medium">
                  {detailPlan.period_type === "hours" ? "运行小时" : "日历周期"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">周期</span>
                <span className="col-span-2 font-medium">
                  {detailPlan.period}
                  {detailPlan.period_type === "hours" ? "h" : "天"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">上次保养</span>
                <span className="col-span-2 font-medium">{detailPlan.last_date || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">下次保养</span>
                <span className="col-span-2 font-medium">{detailPlan.next_date}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">状态</span>
                <span className="col-span-2 font-medium">
                  <Badge
                    variant={
                      detailPlan.status === "overdue"
                        ? "destructive"
                        : detailPlan.status === "upcoming"
                          ? "secondary"
                          : "default"
                    }
                  >
                    {detailPlan.status === "normal"
                      ? "正常"
                      : detailPlan.status === "upcoming"
                        ? "即将到期"
                        : "已逾期"}
                  </Badge>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">保养内容</span>
                <span className="col-span-2 font-medium whitespace-pre-wrap">{detailPlan.content || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">备注</span>
                <span className="col-span-2 font-medium whitespace-pre-wrap">
                  {detailPlan.remarks || "-"}
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MaintainTab() {
  const store = useAppStore();
  const records = store.equipmentRecords.filter(
    (r) => r.type === "maintenance",
  );
  const [maintainDetailRecord, setMaintainDetailRecord] = useState<EquipmentRecord | null>(null);
  const [maintainDetailOpen, setMaintainDetailOpen] = useState(false);

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          保养记录
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">记录编号</TableHead>
              <TableHead className="whitespace-nowrap">设备名称</TableHead>
              <TableHead className="whitespace-nowrap">设备编号</TableHead>
              <TableHead className="whitespace-nowrap">设备型号</TableHead>
              <TableHead className="whitespace-nowrap">车间</TableHead>
              <TableHead className="whitespace-nowrap">保养内容</TableHead>
              <TableHead className="whitespace-nowrap">保养人</TableHead>
              <TableHead className="whitespace-nowrap">保养时间</TableHead>
              <TableHead className="whitespace-nowrap text-right">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recordsPaginated.map((r) => {
              const eq = store.equipment.find((e) => e.id === r.equipment_id);
              const preview =
                r.description && r.description.length > 20
                  ? `${r.description.slice(0, 20)}…`
                  : r.description;
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {r.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {eq?.name || r.equipment_id}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {eq?.code || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {eq?.model || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {eq?.workshop || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {preview}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.maintainer}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.record_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMaintainDetailRecord(r);
                        setMaintainDetailOpen(true);
                      }}
                      title="查看详情"
                    >
                      详情
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
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

      <Dialog open={maintainDetailOpen} onOpenChange={setMaintainDetailOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>保养详情信息</DialogTitle>
            <DialogDescription>
              {maintainDetailRecord?.id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>
          {maintainDetailRecord && (() => {
            const eq = store.equipment.find((e) => e.id === maintainDetailRecord.equipment_id);
            return (
              <div className="space-y-4 py-2 text-sm">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div><span className="text-muted-foreground">设备名称：</span>{eq?.name || "-"}</div>
                  <div><span className="text-muted-foreground">设备编号：</span>{eq?.code || "-"}</div>
                  <div><span className="text-muted-foreground">设备型号：</span>{eq?.model || "-"}</div>
                  <div><span className="text-muted-foreground">所在车间：</span>{eq?.workshop || "-"}</div>
                  <div><span className="text-muted-foreground">保养人：</span>{maintainDetailRecord.maintainer || "-"}</div>
                  <div><span className="text-muted-foreground">保养时间：</span>{maintainDetailRecord.record_date}</div>
                </div>
                <div className="border-t" />
                <div>
                  <p className="font-semibold text-muted-foreground mb-2">保养内容</p>
                  <p className="whitespace-pre-wrap">{maintainDetailRecord.description || "-"}</p>
                </div>
              </div>
            );
          })()}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setMaintainDetailOpen(false)}>关闭</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RepairTab() {
  const store = useAppStore();
  const { profile } = useAuth();
  const canManage = canManageEquipment(profile?.role);

  // 新增/编辑故障记录 dialog
  const [faultOpen, setFaultOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EquipmentRecord | null>(null);
  const [faultForm, setFaultForm] = useState<Partial<EquipmentRecord>>({
    equipment_id: "",
    description: "",
    maintainer: "",
    duration: 0,
  });

  // 维修处理 dialog
  const [repairOpen, setRepairOpen] = useState(false);
  const [repairingRecord, setRepairingRecord] = useState<EquipmentRecord | null>(null);
  const [repairForm, setRepairForm] = useState({
    repair_status: "completed" as "pending" | "in_progress" | "completed",
    repair_date: new Date().toISOString().slice(0, 10),
    repair_technician: "",
    repair_cost: 0,
    repair_detail: "",
  });

  // 详情 dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<EquipmentRecord | null>(null);

  function openDetail(r: EquipmentRecord) {
    setDetailRecord(r);
    setDetailOpen(true);
  }

  function openNew() {
    setEditingRecord(null);
    setFaultForm({ equipment_id: "", description: "", maintainer: "", duration: 0 });
    setFaultOpen(true);
  }

  function openEdit(r: EquipmentRecord) {
    setEditingRecord(r);
    setFaultForm({
      equipment_id: r.equipment_id,
      description: r.description,
      maintainer: r.maintainer,
      maintainer_id: r.maintainer_id,
      duration: r.duration,
    });
    setFaultOpen(true);
  }

  function openRepair(r: EquipmentRecord) {
    setRepairingRecord(r);
    setRepairForm({
      repair_status: r.repair_status || "completed",
      repair_date: r.repair_date || new Date().toISOString().slice(0, 10),
      repair_technician: r.repair_technician || "",
      repair_cost: r.repair_cost || 0,
      repair_detail: r.repair_detail || "",
    });
    setRepairOpen(true);
  }

  async function saveFault() {
    if (!faultForm.equipment_id || !faultForm.description) return;
    const recordDate = new Date().toISOString().slice(0, 16).replace("T", " ");
    if (editingRecord) {
      await store.updateEquipmentRecord({
        ...editingRecord,
        equipment_id: faultForm.equipment_id!,
        description: faultForm.description!,
        maintainer: faultForm.maintainer || "",
        maintainer_id: faultForm.maintainer_id,
        duration: Number(faultForm.duration) || 0,
      });
    } else {
      const record: EquipmentRecord = {
        id: nanoid(),
        equipment_id: faultForm.equipment_id!,
        type: "repair",
        record_date: recordDate,
        description: faultForm.description!,
        duration: Number(faultForm.duration) || 0,
        loss_output: 0,
        maintainer: faultForm.maintainer || "",
        maintainer_id: faultForm.maintainer_id,
        repair_status: "pending",
      };
      await store.addEquipmentRecord(record);
      const target = store.equipment.find((e) => e.id === faultForm.equipment_id);
      if (target) {
        await store.updateEquipment({ ...target, status: "maintenance" });
      }
    }
    setFaultOpen(false);
  }

  async function saveRepair() {
    if (!repairingRecord) return;
    const updated: EquipmentRecord = {
      ...repairingRecord,
      repair_status: repairForm.repair_status,
      repair_date: repairForm.repair_date,
      repair_technician: repairForm.repair_technician,
      repair_cost: Number(repairForm.repair_cost) || 0,
      repair_detail: repairForm.repair_detail,
      duration: repairForm.repair_status === "completed"
        ? (repairingRecord.duration || 0)
        : repairingRecord.duration,
    };
    await store.updateEquipmentRecord(updated);
    // 维修完成后更新设备状态为正常
    if (repairForm.repair_status === "completed") {
      const target = store.equipment.find((e) => e.id === repairingRecord.equipment_id);
      if (target) {
        await store.updateEquipment({ ...target, status: "idle" });
      }
    }
    setRepairOpen(false);
  }

  async function deleteRecord(id: string) {
    await store.deleteEquipmentRecord(id);
  }

  const records = store.equipmentRecords.filter((r) => r.type === "repair");
  const {
    paginatedItems: recordsPaginated,
    currentPage: recordsCurrentPage,
    pageSize: recordsPageSize,
    totalPages: recordsTotalPages,
    totalItems: recordsTotalItems,
    setPage: setRecordsPage,
    setPageSize: setRecordsPageSize,
  } = usePagination(records);

  const repairStatusLabel = (s?: string) => {
    if (s === "completed") return <span className="text-green-600 font-medium">已完成</span>;
    if (s === "in_progress") return <span className="text-yellow-600 font-medium">维修中</span>;
    return <span className="text-muted-foreground">待维修</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage && (
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" />
            新增故障记录
          </Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PenTool className="h-4 w-4 text-primary" />
            维修记录
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">设备名称</TableHead>
                <TableHead className="whitespace-nowrap">设备编号</TableHead>
                <TableHead className="whitespace-nowrap">设备型号</TableHead>
                <TableHead className="whitespace-nowrap">车间</TableHead>
                <TableHead className="whitespace-nowrap">故障描述</TableHead>
                <TableHead className="whitespace-nowrap">报修人</TableHead>
                <TableHead className="whitespace-nowrap">上报时间</TableHead>
                <TableHead className="whitespace-nowrap">维修状态</TableHead>
                <TableHead className="whitespace-nowrap">维修技术员</TableHead>
                <TableHead className="whitespace-nowrap">维修完成日期</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsPaginated.map((r) => {
                const eq = store.equipment.find((e) => e.id === r.equipment_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{eq?.name || r.equipment_id}</TableCell>
                    <TableCell className="whitespace-nowrap">{eq?.code || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{eq?.model || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{eq?.workshop || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap max-w-[200px] truncate">{r.description}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.maintainer || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.record_date}</TableCell>
                    <TableCell className="whitespace-nowrap">{repairStatusLabel(r.repair_status)}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.repair_technician || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.repair_date || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openDetail(r)}>
                          详情
                        </Button>
                        {canManage && (
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                            编辑
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-primary"
                            onClick={() => openRepair(r)}
                          >
                            维修
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteRecord(r.id)}
                          >
                            删除
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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

      {/* 新增/编辑故障记录 */}
      <Dialog open={faultOpen} onOpenChange={setFaultOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "编辑故障记录" : "新增故障记录"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>设备</Label>
              <Select
                value={faultForm.equipment_id || ""}
                onValueChange={(v) => setFaultForm((f) => ({ ...f, equipment_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择设备" />
                </SelectTrigger>
                <SelectContent>
                  {store.equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>故障描述</Label>
              <Textarea
                value={faultForm.description || ""}
                onChange={(ev) => setFaultForm((f) => ({ ...f, description: ev.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>报修人</Label>
              <Select
                value={faultForm.maintainer_id || "none"}
                onValueChange={(v) => {
                  const e = store.employees.find((x) => x.id === v);
                  setFaultForm((f) => ({
                    ...f,
                    maintainer_id: e?.id || "",
                    maintainer: e?.name || "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择报修人" />
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
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFaultOpen(false)}>取消</Button>
            <Button onClick={saveFault}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 维修处理 dialog */}
      <Dialog open={repairOpen} onOpenChange={setRepairOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>维修处理</DialogTitle>
            <DialogDescription>记录设备维修完成信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>维修状态 *</Label>
              <Select
                value={repairForm.repair_status}
                onValueChange={(v) =>
                  setRepairForm((f) => ({ ...f, repair_status: v as "pending" | "in_progress" | "completed" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">维修中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>维修完成日期 *</Label>
              <Input
                type="date"
                value={repairForm.repair_date}
                onChange={(ev) => setRepairForm((f) => ({ ...f, repair_date: ev.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>维修技术员 *</Label>
              <Select
                value={repairForm.repair_technician || "none"}
                onValueChange={(v) => {
                  const e = store.employees.find((x) => x.id === v);
                  setRepairForm((f) => ({ ...f, repair_technician: e?.name || "" }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择技术员" />
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
            <div className="space-y-2">
              <Label>维修费用</Label>
              <Input
                type="number"
                value={repairForm.repair_cost}
                onChange={(ev) => setRepairForm((f) => ({ ...f, repair_cost: Number(ev.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>维修内容详细描述 *</Label>
              <Textarea
                rows={4}
                value={repairForm.repair_detail}
                onChange={(ev) => setRepairForm((f) => ({ ...f, repair_detail: ev.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRepairOpen(false)}>取消</Button>
            <Button onClick={saveRepair}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 详情弹窗 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>维修记录详情</DialogTitle>
            <DialogDescription>故障上报与维修处理完整信息</DialogDescription>
          </DialogHeader>
          {detailRecord && (() => {
            const eq = store.equipment.find((e) => e.id === detailRecord.equipment_id);
            return (
              <div className="space-y-5 py-2">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3">故障信息</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div><span className="text-muted-foreground">设备名称：</span>{eq?.name || "-"}</div>
                    <div><span className="text-muted-foreground">设备编号：</span>{eq?.code || "-"}</div>
                    <div><span className="text-muted-foreground">设备型号：</span>{eq?.model || "-"}</div>
                    <div><span className="text-muted-foreground">所在车间：</span>{eq?.workshop || "-"}</div>
                    <div><span className="text-muted-foreground">报修人：</span>{detailRecord.maintainer || "-"}</div>
                    <div><span className="text-muted-foreground">上报时间：</span>{detailRecord.record_date}</div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">故障描述：</span>
                      <span className="whitespace-pre-wrap">{detailRecord.description}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t" />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3">维修信息</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">维修状态：</span>
                      {repairStatusLabel(detailRecord.repair_status)}
                    </div>
                    <div><span className="text-muted-foreground">维修技术员：</span>{detailRecord.repair_technician || "-"}</div>
                    <div><span className="text-muted-foreground">维修完成日期：</span>{detailRecord.repair_date || "-"}</div>
                    <div><span className="text-muted-foreground">维修费用：</span>{detailRecord.repair_cost != null ? `¥${detailRecord.repair_cost}` : "-"}</div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">维修内容描述：</span>
                      <span className="whitespace-pre-wrap">{detailRecord.repair_detail || "-"}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDetailOpen(false)}>关闭</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OeeTab() {
  const store = useAppStore();
  const stats = useMemo(() => {
    return store.equipment.map((e) => {
      const repair = store.equipmentRecords.filter(
        (r) => r.equipment_id === e.id && r.type === "repair",
      );
      const downtime = repair.reduce((sum, r) => sum + r.duration, 0);
      const planned = e.running_hours + downtime || 1;
      const availability = ((planned - downtime) / planned) * 100;
      const performance = Math.min(100, (e.running_hours / planned) * 100 + 10);
      const quality = 98 - repair.length * 0.5;
      const oee =
        (availability / 100) * (performance / 100) * (quality / 100) * 100;
      return { ...e, availability, performance, quality, oee };
    });
  }, [store.equipment, store.equipmentRecords]);

  const {
    paginatedItems: statsPaginated,
    currentPage: statsCurrentPage,
    pageSize: statsPageSize,
    totalPages: statsTotalPages,
    totalItems: statsTotalItems,
    setPage: setStatsPage,
    setPageSize: setStatsPageSize,
  } = usePagination(stats);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          设备OEE统计（绗缝设备单独展示）
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">设备编号</TableHead>
              <TableHead className="whitespace-nowrap">设备名称</TableHead>
              <TableHead className="whitespace-nowrap">类别</TableHead>
              <TableHead className="whitespace-nowrap">计划运行(h)</TableHead>
              <TableHead className="whitespace-nowrap">停机(h)</TableHead>
              <TableHead className="whitespace-nowrap">时间开动率</TableHead>
              <TableHead className="whitespace-nowrap">性能开动率</TableHead>
              <TableHead className="whitespace-nowrap">合格品率</TableHead>
              <TableHead className="whitespace-nowrap">OEE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statsPaginated.map((s) => (
              <TableRow
                key={s.id}
                className={s.category === "绗缝设备" ? "bg-primary/5" : ""}
              >
                <TableCell className="font-medium whitespace-nowrap">
                  {s.code}
                </TableCell>
                <TableCell className="whitespace-nowrap">{s.name}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.category}
                  {s.category === "绗缝设备" ? (
                    <span className="ml-1 text-xs text-destructive">
                      (瓶颈)
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.running_hours.toFixed(0)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {store.equipmentRecords
                    .filter(
                      (r) => r.equipment_id === s.id && r.type === "repair",
                    )
                    .reduce((sum, r) => sum + r.duration, 0)
                    .toFixed(1)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.availability.toFixed(1)}%
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.performance.toFixed(1)}%
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.quality.toFixed(1)}%
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Progress value={s.oee} className="h-2 w-16" />
                    <span className="text-xs font-medium">
                      {s.oee.toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          currentPage={statsCurrentPage}
          totalPages={statsTotalPages}
          pageSize={statsPageSize}
          totalItems={statsTotalItems}
          onPageChange={setStatsPage}
          onPageSizeChange={setStatsPageSize}
        />
      </CardContent>
    </Card>
  );
}

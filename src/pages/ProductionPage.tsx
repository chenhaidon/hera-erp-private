import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { lazy, Suspense, useEffect, useMemo, useState, Fragment } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { useAppStore, type AppState } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { useDirectShip } from "@/hooks/useDirectShip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import QRCodeDataUrl from "@/components/ui/qrcodedataurl";
import { nanoid, getProductBomsBySku, extractSkuColor, resolveColorMaterial } from "@/lib/utils";
import { toast } from "sonner";
import {
  ClipboardList,
  QrCode,
  Play,
  Pause,
  CheckCircle2,
  Plus,
  Printer,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Eye,
  Package,
  Pencil,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Truck,
} from "lucide-react";
import type {
  WorkOrder,
  WorkOrderOperation,
  ProductionException,
  WorkOrderCost,
  OperationReportRecord,
  ProcessInspection,
  QualityInspectionItem,
  FinishedInspection,
  FinishedGoodsInbound,
  MaterialRequisition,
  StockRecord,
} from "@/types";
import {
  checkOperationDependency,
  unlockNextOperation,
  recalcWorkOrderFromOperations,
  getOutsourceReportLimit,
  syncSalesOrderStatusFromProduction,
  isFinishedInspectionQualified,
  createPendingFinishedInspection,
  createFinishedGoodsInbound,
} from "@/lib/production";
const MaterialRequisitionsTab = lazy(() =>
  import("@/components/production").then((m) => ({
    default: m.MaterialRequisitionsTab,
  })),
);
const ReportManagementTab = lazy(() =>
  import("@/components/production").then((m) => ({
    default: m.ReportManagementTab,
  })),
);

const TABS = [
  { value: "orders", label: "生产工单", icon: ClipboardList },
  { value: "requisitions", label: "生产领料", icon: Package },
  { value: "progress", label: "进度跟踪", icon: TrendingUp },
  { value: "costs", label: "工单成本", icon: Eye },
  { value: "exceptions", label: "异常反馈", icon: AlertTriangle },
  { value: "reports", label: "报工管理", icon: CheckCircle2 },
];

export function ProductionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "orders";
  const expandWorkOrder = searchParams.get("expand");
  const highlightWorkOrder = searchParams.get("highlight");
  const highlightRequisition = searchParams.get("highlightRequisition");
  const scanWorkNo = searchParams.get("workNo");
  const scanMode = searchParams.get("mode");

  function handleTabChange(value: string) {
    setSearchParams((prev) => {
      prev.set("tab", value);
      if (value !== "orders") {
        prev.delete("expand");
        prev.delete("highlight");
      }
      return prev;
    });
  }

  function handleScanHandled() {
    setSearchParams((prev) => {
      prev.delete("workNo");
      prev.delete("mode");
      return prev;
    });
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="生产管理"
        description="工单管理、工序报工、进度跟踪、成本与异常"
      />
      <ControlledTabs
        modulePath="/production"
        defaultTab="orders"
        activeTab={activeTab}
        onActiveTabChange={handleTabChange}
      >
        <TabsList className="w-full flex-wrap justify-start md:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              <t.icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="orders">
          <OrdersTab
            initialExpandWorkOrder={expandWorkOrder}
            highlightWorkOrder={highlightWorkOrder}
            scanWorkNo={scanWorkNo}
            scanMode={scanMode}
            onScanHandled={handleScanHandled}
          />
        </TabsContent>
        <TabsContent value="requisitions">
          <Suspense
            fallback={
              <div className="p-8 text-center text-muted-foreground">
                加载中...
              </div>
            }
          >
            <MaterialRequisitionsTab
              highlightRequisition={highlightRequisition}
            />
          </Suspense>
        </TabsContent>
        <TabsContent value="progress">
          <ProgressTab />
        </TabsContent>
        <TabsContent value="costs">
          <CostsTab />
        </TabsContent>
        <TabsContent value="exceptions">
          <ExceptionsTab />
        </TabsContent>
        <TabsContent value="reports">
          <Suspense
            fallback={
              <div className="p-8 text-center text-muted-foreground">
                加载中...
              </div>
            }
          >
            <ReportManagementTab />
          </Suspense>
        </TabsContent>
      </ControlledTabs>
    </div>
  );
}

function statusLabel(status: WorkOrder["status"]) {
  const map: Record<string, string> = {
    pending: "待排产",
    issued: "已下发",
    producing: "生产中",
    paused: "已暂停",
    qc: "待质检",
    pending_inbound: "待入库",
    inbound: "已入库",
    completed: "已完成",
    closed: "已结案",
  };
  return map[status] || status;
}

function statusBadgeVariant(status: WorkOrder["status"]) {
  switch (status) {
    case "inbound":
    case "completed":
    case "closed":
      return "default";
    case "producing":
    case "pending_inbound":
      return "secondary";
    case "paused":
    case "qc":
      return "destructive";
    default:
      return "outline";
  }
}

function opStatusLabel(status: WorkOrderOperation["status"]) {
  const map: Record<string, string> = {
    pending: "未开始",
    pending_start: "待开工",
    running: "生产中",
    qc: "待质检",
    completed: "已完工",
    closed: "已结案",
  };
  return map[status] || status;
}

function opStatusBadgeVariant(status: WorkOrderOperation["status"]) {
  switch (status) {
    case "completed":
    case "closed":
      return "default";
    case "running":
    case "pending_start":
      return "secondary";
    case "qc":
      return "destructive";
    default:
      return "outline";
  }
}

function sourceLabel(source: WorkOrder["source"]) {
  return source === "plan" ? "计划排程" : "手动新建";
}

function priorityLabel(priority: WorkOrder["priority"]) {
  const map = { urgent: "紧急", high: "高", medium: "中", low: "低" };
  return map[priority] || priority;
}

function priorityVariant(priority: WorkOrder["priority"]) {
  if (priority === "urgent") return "destructive";
  if (priority === "high") return "default";
  return "secondary";
}

function pickingStatusLabel(status: WorkOrder["picking_status"]) {
  const map: Record<string, string> = {
    pending: "待领料",
    picked: "已领料",
    not_required: "无需领料",
  };
  return map[status] || status;
}

function pickingStatusVariant(status: WorkOrder["picking_status"]) {
  if (status === "pending") return "destructive";
  if (status === "picked") return "default";
  return "secondary";
}

function OrdersTab({
  initialExpandWorkOrder,
  highlightWorkOrder,
  scanWorkNo,
  scanMode,
  onScanHandled,
}: {
  initialExpandWorkOrder?: string | null;
  highlightWorkOrder?: string | null;
  scanWorkNo?: string | null;
  scanMode?: string | null;
  onScanHandled?: () => void;
}) {
  const store = useAppStore();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "全部");
  const [pickingFilter, setPickingFilter] = useState("全部");
  const [sourceFilter, setSourceFilter] = useState("全部");
  const [open, setOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickWorkOrder, setPickWorkOrder] = useState<WorkOrder | null>(null);
  const [missingMaterialBlock, setMissingMaterialBlock] = useState<{ open: boolean; materialName: string }>({ open: false, materialName: "" });
  const [existingRequisition, setExistingRequisition] = useState<MaterialRequisition | null>(null);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [createMode, setCreateMode] = useState<"select" | "plan" | "manual">(
    "select",
  );
  const [planId, setPlanId] = useState("");
  const [planRouteId, setPlanRouteId] = useState("");
  const [productId, setProductId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [manualQty, setManualQty] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState<WorkOrder["priority"]>("medium");
  const [manualRemark, setManualRemark] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editPriority, setEditPriority] =
    useState<WorkOrder["priority"]>("medium");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editRemark, setEditRemark] = useState("");
  const { directShip, setDirectShip, handleDirectShip, confirmDirectShip } =
    useDirectShip();
  const [confirmInbound, setConfirmInbound] = useState<WorkOrder | null>(null);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const isWorkNoQuery = keyword.startsWith("wo-");
    return store.workOrders
      .filter((wo) => {
        const matchSearch =
          !keyword ||
          (isWorkNoQuery
            ? wo.work_no.toLowerCase() === keyword
            : wo.work_no.toLowerCase().includes(keyword) ||
              wo.product_name.toLowerCase().includes(keyword) ||
              wo.product_code.toLowerCase().includes(keyword) ||
              (wo.contract_no || "").toLowerCase() === keyword ||
              (wo.color || "").toLowerCase().includes(keyword));
        const matchStatus =
          statusFilter === "全部" || wo.status === statusFilter;
        const matchPicking =
          pickingFilter === "全部" || wo.picking_status === pickingFilter;
        const matchSource =
          sourceFilter === "全部" || wo.source === sourceFilter;
        return matchSearch && matchStatus && matchPicking && matchSource;
      })
      .sort((a, b) => {
        // 未完成排在前面，已完成排在后面
        const aDone = a.status === "completed" || a.status === "inbound";
        const bDone = b.status === "completed" || b.status === "inbound";
        if (aDone !== bDone) return aDone ? 1 : -1;
        // 同组内按计划开始日期降序
        return (
          new Date(b.start_date || 0).getTime() -
          new Date(a.start_date || 0).getTime()
        );
      });
  }, [store.workOrders, search, statusFilter, pickingFilter, sourceFilter]);

  function resetCreateForm() {
    setCreateMode("select");
    setPlanId("");
    setPlanRouteId("");
    setProductId("");
    setRouteId("");
    setManualQty("");
    setStartDate("");
    setEndDate("");
    setPriority("medium");
    setManualRemark("");
  }

  function buildOperations(
    qty: number,
    routeIdArg: string,
  ): WorkOrderOperation[] {
    const route = store.processRoutes.find((r) => r.id === routeIdArg);
    const steps = route?.steps || [];
    return steps.map((s, idx) => {
      const process = store.processes.find(
        (p) => p.name === s.name || p.code === s.code,
      );
      const category = s.category || process?.category || "internal";
      const outsourcing_price =
        s.outsourcing_price ||
        (category === "outsourcing" ? process?.outsourcing_price : undefined);
      return {
        seq: s.seq,
        code: s.code,
        name: s.name,
        plan_qty: qty,
        completed_qty: 0,
        status: idx === 0 ? "pending_start" : "pending",
        completed: false,
        is_bottleneck: s.is_bottleneck,
        device: s.device,
        skill: s.skill,
        process_id: s.process_id || process?.id,
        category,
        outsourcing_price,
        outsourcing_status: undefined,
      };
    });
  }

  function generateNextWorkNo(suffix = 1): string {
    const existing = store.workOrders
      .map((w) => w.work_no)
      .filter((n) => n && /^WO-\d{4}-\d+-\d+$/.test(n));
    let maxSeq = 0;
    for (const n of existing) {
      const match = n.match(/^WO-(\d{4})-(\d+)-\d+$/);
      if (match) {
        const seq = parseInt(match[2], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }
    const nextSeq = maxSeq + 1;
    return `WO-${new Date().getFullYear()}-${String(nextSeq).padStart(4, "0")}-${suffix}`;
  }

  function createFromPlan() {
    const plan = store.productionPlans.find((p) => p.id === planId);
    const product = store.products.find((p) => p.id === plan?.product_id);
    const route = store.processRoutes.find((r) => r.id === planRouteId);
    if (!plan || !product || !route) return;
    const qty = plan.plan_quantity;
    const ops = buildOperations(qty, route.id);
    const wo: WorkOrder = {
      id: nanoid(),
      work_no: generateNextWorkNo(1),
      plan_id: plan.id,
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      product_category: product.category,
      product_images: product.images,
      plan_quantity: qty,
      completed_quantity: 0,
      progress: 0,
      status: "pending",
      picking_status: "pending",
      source: "plan",
      priority: "medium",
      created_at: now(),
      operations: ops,
    };
    store.addWorkOrder(wo);
    store.setWorkOrderCosts([
      ...store.workOrderCosts,
      {
        work_id: wo.id,
        fabric: qty * 12,
        lining: qty * 3.5,
        filling: qty * 8,
        accessory: qty * 1.2,
        labor: 0,
        overhead: qty * 2.1,
        planned: qty * 26.8,
      },
    ]);
    setOpen(false);
    resetCreateForm();
  }

  function createManual() {
    const product = store.products.find((p) => p.id === productId);
    const route = store.processRoutes.find((r) => r.id === routeId);
    if (!product || !route) return;
    const qty = Number(manualQty);
    if (!qty || qty <= 0) return;
    const ops = buildOperations(qty, route.id);
    const wo: WorkOrder = {
      id: nanoid(),
      work_no: generateNextWorkNo(1),
      plan_id: "",
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      product_category: product.category,
      product_images: product.images,
      plan_quantity: qty,
      completed_quantity: 0,
      progress: 0,
      status: "pending",
      picking_status: "not_required",
      source: "manual",
      priority,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      remark: manualRemark || "AI Agent 创建",
      created_at: now(),
      operations: ops,
    };
    store.addWorkOrder(wo);
    store.setWorkOrderCosts([
      ...store.workOrderCosts,
      {
        work_id: wo.id,
        fabric: qty * 12,
        lining: qty * 3.5,
        filling: qty * 8,
        accessory: qty * 1.2,
        labor: 0,
        overhead: qty * 2.1,
        planned: qty * 26.8,
      },
    ]);
    setOpen(false);
    resetCreateForm();
  }

  function updateStatus(wo: WorkOrder, status: WorkOrder["status"]) {
    if (status === "completed") {
      createFinishedGoodsInbound(store, wo);
      return;
    }
    const updates: Partial<WorkOrder> = { status };
    if (status === "issued") updates.issued_at = now();
    store.updateWorkOrder({ ...wo, ...updates });
    syncSalesOrderStatusFromProduction(store);
  }

  function removeOrder(wo: WorkOrder) {
    if (wo.status !== "pending") return;
    store.setWorkOrders(store.workOrders.filter((w) => w.id !== wo.id));
  }

  function openPickConfirm(wo: WorkOrder) {
    setPickWorkOrder(wo);
    setPickOpen(true);
  }

  function resolvePickingItems(wo: WorkOrder) {
    const product = store.products.find((p) => p.id === wo.product_id);
    const effectiveSkuId = wo.sku_id || product?.skus?.[0]?.id || "";
    const sku = product?.skus?.find((s) => s.id === effectiveSkuId);
    const boms = effectiveSkuId
      ? getProductBomsBySku(product, effectiveSkuId)
      : [];
    const color = extractSkuColor(sku);
    const missing: string[] = [];
    const rawItems = boms
      .map((bom) => {
        const baseName = bom.material_name;
        if (!baseName) {
          missing.push("未命名物料");
          return null;
        }
        const { material, missingName } = resolveColorMaterial(
          baseName,
          color,
          store.materials,
          bom.material_code,
        );
        if (missingName) {
          missing.push(missingName);
          return null;
        }
        const resolved = material || {
          id: bom.material_id,
          code: bom.material_code,
          name: bom.material_name,
        };
        return {
          material_id: resolved.id,
          material_code: resolved.code,
          material_name: resolved.name,
          specification: bom.specification || "",
          unit: bom.unit,
          color,
          required_qty: Math.ceil(bom.dosage * wo.plan_quantity),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    // 相同物料按 material_id + 规格合并，避免同一物料出现多行
    const merged = new Map<string, typeof rawItems[0]>();
    for (const item of rawItems) {
      const key = `${item.material_id}:${item.specification}`;
      const existing = merged.get(key);
      if (existing) {
        existing.required_qty += item.required_qty;
      } else {
        merged.set(key, { ...item });
      }
    }
    const items = Array.from(merged.values());
    return { items, missing, product, sku };
  }

  function handleCreatePicking(wo: WorkOrder) {
    const existing = store.materialRequisitions.find(
      (r) => r.related_work_order_no === wo.work_no && r.status !== "draft",
    );
    if (existing) {
      setExistingRequisition(existing);
      return;
    }
    const { items, missing } = resolvePickingItems(wo);
    if (missing.length > 0) {
      setMissingMaterialBlock({
        open: true,
        materialName: missing[0],
      });
      return;
    }
    if (items.length === 0) {
      toast.error("该工单对应成品未配置 BOM，无法生成领料单");
      return;
    }
    const req: MaterialRequisition = {
      id: nanoid(),
      code: `MR-${new Date().getFullYear()}-${String(store.materialRequisitions.length + 1).padStart(4, "0")}`,
      applicant: "车间主任",
      department: "生产部",
      created_at: new Date().toISOString().split("T")[0],
      required_date: new Date(Date.now() + 3 * 86400000)
        .toISOString()
        .split("T")[0],
      status: "pending",
      items,
      related_plan_no: store.productionPlans.find((p) => p.id === wo.plan_id)
        ?.plan_no,
      related_work_order_no: wo.work_no,
    };
    store.addMaterialRequisition(req);
    toast.success(`已生成领料单 ${req.code}，请前往生产领料页审核`);
    window.location.href = `/production?tab=requisitions&draftWorkOrder=${wo.work_no}`;
  }

  function confirmPick() {
    if (!pickWorkOrder) return;
    const { items, missing } = resolvePickingItems(pickWorkOrder);
    if (missing.length > 0) {
      setMissingMaterialBlock({
        open: true,
        materialName: missing[0],
      });
      setPickOpen(false);
      return;
    }
    items.forEach((item) => {
      const need = item.required_qty;
      const inv = store.inventory.find(
        (i) => i.material_id === item.material_id,
      );
      if (inv) {
        store.setInventory(
          store.inventory.map((i) =>
            i.material_id === item.material_id
              ? { ...i, quantity: Math.max(0, i.quantity - need) }
              : i,
          ),
        );
      }
      store.addStockRecord({
        id: nanoid(),
        record_no: `MO-${Date.now().toString().slice(-6)}-${item.material_code}`,
        type: "out",
        subtype: "生产领料",
        material_id: item.material_id,
        quantity: need,
        warehouse: inv?.warehouse || "原料仓",
        related_order: pickWorkOrder.work_no,
        related_order_id: pickWorkOrder.id,
        handler: "车间主任",
        record_date: now(),
      });
    });
    const unlockedOps = pickWorkOrder.operations.map((o, idx) =>
      idx === 0 && o.status === "pending"
        ? { ...o, status: "pending_start" as const }
        : o,
    );
    store.updateWorkOrder({
      ...pickWorkOrder,
      picking_status: "picked",
      operations: unlockedOps,
    });
    toast.success(`工单 ${pickWorkOrder.work_no} 已领料`);
    setPickOpen(false);
    setPickWorkOrder(null);
  }

  function printOrder() {
    const printNode = document.querySelector(".print-card") as HTMLElement | null;
    if (!printNode) {
      window.print();
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((el) => {
        if (el.tagName === "STYLE") {
          return `<style>${el.textContent}</style>`;
        }
        return `<link rel="stylesheet" href="${(el as HTMLLinkElement).href}">`;
      })
      .join("");

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>生产流转卡</title>
          ${styles}
        </head>
        <body>
          <div class="print-card" style="position:fixed;left:0;top:0;">
            ${printNode.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    // 等待二维码图片加载完成后再打印
    const images = doc.querySelectorAll("img");
    let loaded = 0;
    const total = images.length;

    function doPrint() {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }

    if (total === 0) {
      setTimeout(doPrint, 100);
    } else {
      images.forEach((img) => {
        if (img.complete) {
          loaded++;
        } else {
          img.onload = () => {
            loaded++;
            if (loaded === total) doPrint();
          };
          img.onerror = () => {
            loaded++;
            if (loaded === total) doPrint();
          };
        }
        if (loaded === total) doPrint();
      });
    }
  }

  function openEdit(wo: WorkOrder) {
    setSelected(wo);
    setEditQty(String(wo.plan_quantity));
    setEditPriority(wo.priority);
    setEditStartDate(wo.start_date || "");
    setEditEndDate(wo.end_date || "");
    setEditRemark(wo.remark || "");
    setEditOpen(true);
  }

  function saveEdit() {
    if (!selected) return;
    const qty = Number(editQty);
    if (!qty || qty <= 0) return;
    const updated: WorkOrder = {
      ...selected,
      plan_quantity: qty,
      priority: editPriority,
      start_date: editStartDate || undefined,
      end_date: editEndDate || undefined,
      remark: editRemark || undefined,
    };
    store.updateWorkOrder(updated);
    setEditOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            placeholder="搜索工单/产品/款号/合同编号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              {[
                "全部",
                "pending",
                "issued",
                "producing",
                "paused",
                "qc",
                "pending_inbound",
                "inbound",
                "completed",
                "closed",
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "全部"
                    ? "全部"
                    : statusLabel(s as WorkOrder["status"])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pickingFilter} onValueChange={setPickingFilter}>
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="领料状态" />
            </SelectTrigger>
            <SelectContent>
              {["全部", "pending", "picked", "not_required"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "全部"
                    ? "全部"
                    : pickingStatusLabel(s as WorkOrder["picking_status"])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="来源" />
            </SelectTrigger>
            <SelectContent>
              {["全部", "plan", "manual"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "全部"
                    ? "全部"
                    : sourceLabel(s as WorkOrder["source"])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <OperationsTab
        workOrders={filtered}
        initialExpandWorkOrder={initialExpandWorkOrder}
        highlightWorkOrder={highlightWorkOrder}
        scanWorkNo={scanWorkNo}
        scanMode={scanMode}
        onScanHandled={onScanHandled}
        onCreate={() => {
          resetCreateForm();
          setOpen(true);
        }}
        onDetail={(wo) => {
          setSelected(wo);
          setDetailOpen(true);
        }}
        onPicking={(wo) => handleCreatePicking(wo)}
        onPrint={(wo) => {
          setSelected(wo);
          setPrintOpen(true);
        }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>新建工单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {createMode === "select" && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCreateMode("plan")}
                  className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition"
                >
                  <ClipboardList className="h-6 w-6" />
                  <span className="font-medium">从计划生成</span>
                  <span className="text-xs text-muted-foreground">
                    选择主生产计划
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("manual")}
                  className="flex flex-col items-center gap-2 rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition"
                >
                  <Pencil className="h-6 w-6" />
                  <span className="font-medium">手动新建</span>
                  <span className="text-xs text-muted-foreground">
                    选择产品与工艺路线
                  </span>
                </button>
              </div>
            )}
            {createMode === "plan" && (
              <>
                <div className="space-y-2">
                  <Label>选择主生产计划</Label>
                  <Select
                    value={planId}
                    onValueChange={(v) => {
                      setPlanId(v);
                      const plan = store.productionPlans.find(
                        (p) => p.id === v,
                      );
                      const product = plan
                        ? store.products.find((p) => p.id === plan.product_id)
                        : undefined;
                      const defaultRoute =
                        store.processRoutes.find(
                          (r) => r.id === plan?.route_id,
                        ) ||
                        store.processRoutes.find(
                          (r) => r.category === product?.category,
                        );
                      setPlanRouteId(defaultRoute?.id || "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择计划" />
                    </SelectTrigger>
                    <SelectContent>
                      {store.productionPlans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.plan_no} · {p.product_name} · {p.plan_quantity}件
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>关联工艺路线</Label>
                  <Select value={planRouteId} onValueChange={setPlanRouteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择工艺路线" />
                    </SelectTrigger>
                    <SelectContent>
                      {store.processRoutes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} · {r.category} · {r.steps.length}道工序
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    选择计划后会自动带出默认工艺路线，可手动调整
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCreateMode("select")}
                  >
                    返回
                  </Button>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    取消
                  </Button>
                  <Button
                    onClick={createFromPlan}
                    disabled={!planId || !planRouteId}
                  >
                    确定
                  </Button>
                </div>
              </>
            )}
            {createMode === "manual" && (
              <>
                <div className="space-y-2">
                  <Label>选择产品</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择产品" />
                    </SelectTrigger>
                    <SelectContent>
                      {store.products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>选择工艺路线</Label>
                  <Select value={routeId} onValueChange={setRouteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择工艺路线" />
                    </SelectTrigger>
                    <SelectContent>
                      {store.processRoutes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} · {r.category} · {r.steps.length}道工序
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>计划产量</Label>
                  <Input
                    type="number"
                    min={1}
                    value={manualQty}
                    onChange={(e) => setManualQty(e.target.value)}
                    placeholder="输入计划产量"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>计划开始日期</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>计划完成日期</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>优先级</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) =>
                      setPriority(v as WorkOrder["priority"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择优先级" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">紧急</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>备注</Label>
                  <Textarea
                    value={manualRemark}
                    onChange={(e) => setManualRemark(e.target.value)}
                    placeholder="输入备注信息"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCreateMode("select")}
                  >
                    返回
                  </Button>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    取消
                  </Button>
                  <Button
                    onClick={createManual}
                    disabled={
                      !productId ||
                      !routeId ||
                      !manualQty ||
                      Number(manualQty) <= 0 ||
                      (!!startDate && !!endDate && startDate > endDate)
                    }
                  >
                    确定
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {selected && (
        <>
          <Dialog open={scanOpen} onOpenChange={setScanOpen}>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
              <DialogHeader>
                <DialogTitle>工单二维码</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                <QRCodeDataUrl text={selected.work_no} width={180} />
                <p className="text-sm text-muted-foreground">
                  {selected.work_no} · {selected.product_name}
                </p>
                <Button variant="outline" size="sm" onClick={printOrder}>
                  <Printer className="mr-1 h-4 w-4" />
                  打印工单
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>工单详情</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">工单编号</div>
                    <div className="font-medium">{selected.work_no}</div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">合同编号</div>
                    <div className="font-medium">{selected.contract_no || "-"}</div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">产品</div>
                    <div className="font-medium">
                      {selected.product_name} · {selected.product_code}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">颜色</div>
                    <div className="font-medium">{selected.color || "-"}</div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">计划产量</div>
                    <div className="font-medium">{selected.plan_quantity}</div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">状态</div>
                    <div className="font-medium">
                      {statusLabel(selected.status)}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">工单来源</div>
                    <div className="font-medium">
                      {sourceLabel(selected.source)}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">优先级</div>
                    <div className="font-medium">
                      {priorityLabel(selected.priority)}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">关联计划</div>
                    <div className="font-medium">
                      {selected.source === "plan"
                        ? store.productionPlans.find(
                            (p) => p.id === selected.plan_id,
                          )?.plan_no || selected.plan_id
                        : "-"}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">计划日期</div>
                    <div className="font-medium">
                      {selected.start_date || "-"} ~ {selected.end_date || "-"}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm md:col-span-2">
                    <div className="text-muted-foreground">备注</div>
                    <div className="font-medium">{selected.remark || "-"}</div>
                  </div>
                </div>
                <Separator />
                <div className="text-sm font-medium">工序流转进度</div>
                <div className="space-y-2">
                  {selected.operations.map((op) => (
                    <div
                      key={op.code}
                      className={`flex items-center justify-between rounded border p-3 ${op.is_bottleneck ? "border-primary bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={opStatusBadgeVariant(op.status)}>
                          {opStatusLabel(op.status)}
                        </Badge>
                        <span className="font-medium">
                          {op.seq}. {op.name} {op.is_bottleneck ? "(瓶颈)" : ""}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {op.completed_qty}/{op.plan_qty}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailOpen(false);
                      setScanOpen(true);
                    }}
                  >
                    <QrCode className="mr-1 h-4 w-4" />
                    二维码
                  </Button>
                  <Button variant="outline" size="sm" onClick={printOrder}>
                    <Printer className="mr-1 h-4 w-4" />
                    打印工单
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(selected)}>
                    <Pencil className="mr-1 h-4 w-4" />
                    编辑
                  </Button>
                  {selected.status === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(selected, "issued")}
                    >
                      <Play className="mr-1 h-4 w-4" />
                      下发
                    </Button>
                  )}
                  {selected.status === "issued" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(selected, "producing")}
                    >
                      <Play className="mr-1 h-4 w-4" />
                      开始生产
                    </Button>
                  )}
                  {selected.status === "producing" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(selected, "paused")}
                    >
                      <Pause className="mr-1 h-4 w-4" />
                      暂停
                    </Button>
                  )}
                  {selected.status === "paused" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(selected, "producing")}
                    >
                      <Play className="mr-1 h-4 w-4" />
                      恢复
                    </Button>
                  )}
                  {selected.status === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOrder(selected)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      删除
                    </Button>
                  )}
                  {selected.picking_status === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreatePicking(selected)}
                    >
                      <Package className="mr-1 h-4 w-4" />
                      领料
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={printOpen} onOpenChange={setPrintOpen}>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>生产流转卡</DialogTitle>
              </DialogHeader>
              {selected && (
                <div className="space-y-4 py-2">
                  <div className="flex flex-col items-center">
                    <p className="mb-2 text-xs text-muted-foreground">
                      实际尺寸：100mm × 100mm
                    </p>
                    <div className="rounded p-0 print-card print-card-preview">
                      <div className="text-center font-bold text-base py-2 print:py-1">
                        生产流转卡
                      </div>
                      <div
                        className="grid grid-cols-[100px_1fr_140px] grid-rows-[repeat(10,minmax(0,1fr))] border border-border"
                      >
                        <div className="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">工单编号</span>
                        </div>
                        <div className="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">{selected.work_no}</span>
                        </div>
                        <div className="row-span-8 flex flex-col items-center justify-center gap-2 px-3 border-b overflow-hidden">
                          <QRCodeDataUrl
                            text={`${typeof window !== "undefined" ? window.location.origin : ""}/#/mobile/scan?workNo=${selected.work_no}`}
                            width={120}
                            errorCorrectionLevel="L"
                          />
                          <div className="flex flex-col items-center gap-0.5 w-full">
                            <span className="text-xs text-muted-foreground">
                              二维码
                            </span>
                          </div>
                        </div>

                        <div className="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">合同编号</span>
                        </div>
                        <div className="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">
                            {selected.contract_no || "-"}
                          </span>
                        </div>

                        <div className="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">产品名称</span>
                        </div>
                        <div className="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">{selected.product_name}</span>
                        </div>

                        <div className="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">规格</span>
                        </div>
                        <div className="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">
                            {(() => {
                              const product = store.products.find(
                                (p) => p.id === selected.product_id,
                              );
                              const sku = product?.skus?.find(
                                (s) => s.id === selected.sku_id,
                              );
                              return (
                                selected.sku_summary ||
                                sku?.size ||
                                sku?.specification ||
                                "-"
                              );
                            })()}
                          </span>
                        </div>

                        <div className="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">颜色</span>
                        </div>
                        <div className="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">
                            {selected.color ||
                              (() => {
                                const product = store.products.find(
                                  (p) => p.id === selected.product_id,
                                );
                                const sku = product?.skus?.find(
                                  (s) => s.id === selected.sku_id,
                                );
                                const color = extractSkuColor(sku);
                                return color || selected.sku_summary || "-";
                              })()}
                          </span>
                        </div>

                        <div className="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">计划数量</span>
                        </div>
                        <div className="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">{selected.plan_quantity}</span>
                        </div>

                        <div className="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">计划开始</span>
                        </div>
                        <div className="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">
                            {selected.start_date ||
                              selected.issued_at ||
                              selected.created_at?.slice(0, 10) ||
                              "-"}
                          </span>
                        </div>

                        <div className="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">计划完成</span>
                        </div>
                        <div className="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">
                            {selected.end_date ||
                              selected.completed_at?.slice(0, 10) ||
                              "-"}
                          </span>
                        </div>

                        <div className="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">工艺路线</span>
                        </div>
                        <div className="border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden col-span-2">
                          <span className="truncate">
                            {(() => {
                              const ops = selected.operations?.map((o) => o.name);
                              const route = store.processRoutes.find(
                                (r) => r.category === selected.product_category,
                              );
                              return (
                                ops?.join("、") ||
                                route?.steps?.map((s) => s.name).join("、") ||
                                route?.name ||
                                "-"
                              );
                            })()}
                          </span>
                        </div>

                        <div className="border-r px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden">
                          <span className="truncate">备注</span>
                        </div>
                        <div className="px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden col-span-2">
                          <span className="truncate">{selected.remark || "-"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 print:hidden">
                    <Button
                      variant="outline"
                      onClick={() => setPrintOpen(false)}
                    >
                      关闭
                    </Button>
                    <Button onClick={printOrder}>
                      <Printer className="mr-1 h-4 w-4" />
                      打印
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
              <DialogHeader>
                <DialogTitle>编辑工单</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>产品</Label>
                  <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    {selected.product_name} · {selected.product_code}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>计划产量</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    placeholder="输入计划产量"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>计划开始日期</Label>
                    <Input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>计划完成日期</Label>
                    <Input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>优先级</Label>
                  <Select
                    value={editPriority}
                    onValueChange={(v) =>
                      setEditPriority(v as WorkOrder["priority"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择优先级" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">紧急</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>备注</Label>
                  <Textarea
                    value={editRemark}
                    onChange={(e) => setEditRemark(e.target.value)}
                    placeholder="输入备注信息"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditOpen(false)}>
                    取消
                  </Button>
                  <Button
                    onClick={saveEdit}
                    disabled={
                      !editQty ||
                      Number(editQty) <= 0 ||
                      (!!editStartDate &&
                        !!editEndDate &&
                        editStartDate > editEndDate)
                    }
                  >
                    保存
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>确认领料</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              确认完成工单{" "}
              <span className="font-medium text-foreground">
                {pickWorkOrder?.work_no}
              </span>{" "}
              的领料吗？领料后系统将自动扣减对应物料库存，并允许工人进行报工。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPickOpen(false)}>
                取消
              </Button>
              <Button onClick={confirmPick}>确认领料</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={missingMaterialBlock.open}
        onOpenChange={(open) =>
          setMissingMaterialBlock((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>物料档案缺失</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              该工单颜色对应的物料档案不存在，请先在物料档案中建立{" "}
              <span className="font-medium text-foreground">
                {missingMaterialBlock.materialName}
              </span>
              。
            </p>
            <div className="flex justify-end">
              <Button
                onClick={() =>
                  setMissingMaterialBlock({ open: false, materialName: "" })
                }
              >
                知道了
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={directShip.open}
        onOpenChange={(open) => setDirectShip((s) => ({ ...s, open }))}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>确认直发出库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground whitespace-nowrap">
                  关联销售订单号
                </span>
                <span className="font-medium text-right">
                  {directShip.salesOrderNo || "-"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground whitespace-nowrap">
                  工单号
                </span>
                <span className="font-medium text-right">
                  {directShip.wo?.work_no || "-"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground whitespace-nowrap">
                  产品
                </span>
                <span className="font-medium text-right">
                  {directShip.wo?.product_name || "-"}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              确认后，工单将直接结案，并自动生成一条销售出库记录。请确保已完成成品检验且质量合格。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDirectShip((s) => ({ ...s, open: false }))}
              >
                取消
              </Button>
              <Button onClick={confirmDirectShip}>确认直发</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={!!confirmInbound}
        onOpenChange={(v) => !v && setConfirmInbound(null)}
        title="完工入库"
        description="请确认是否对该工单执行完工入库。系统将生成待入库成品入库单，并更新工单状态为待入库。"
        items={
          confirmInbound
            ? [
                { label: "工单号", value: confirmInbound.work_no },
                { label: "产品", value: confirmInbound.product_name },
                { label: "数量", value: confirmInbound.completed_quantity },
                { label: "状态", value: statusLabel(confirmInbound.status) },
              ]
            : []
        }
        confirmText="确认入库"
        onConfirm={() => {
          if (confirmInbound) createFinishedGoodsInbound(store, confirmInbound);
          setConfirmInbound(null);
        }}
      />
      <Dialog
        open={!!existingRequisition}
        onOpenChange={(v) => !v && setExistingRequisition(null)}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>已存在领料单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">
              该工单已存在领料单
              <span className="font-medium mx-1">
                {existingRequisition?.code}
              </span>
              ，请勿重复生成。是否跳转到生产领料页查看？
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setExistingRequisition(null)}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                if (existingRequisition) {
                  window.location.href = `/production?tab=requisitions&highlightRequisition=${existingRequisition.code}`;
                }
                setExistingRequisition(null);
              }}
            >
              跳转查看
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OperationsTab({
  initialExpandWorkOrder,
  highlightWorkOrder,
  workOrders: workOrdersProp,
  scanWorkNo,
  scanMode,
  onScanHandled,
  onDetail,
  onCreate,
  onPicking,
  onPrint,
}: {
  initialExpandWorkOrder?: string | null;
  highlightWorkOrder?: string | null;
  workOrders?: WorkOrder[];
  scanWorkNo?: string | null;
  scanMode?: string | null;
  onScanHandled?: () => void;
  onDetail?: (wo: WorkOrder) => void;
  onCreate?: () => void;
  onPicking?: (wo: WorkOrder) => void;
  onPrint?: (wo: WorkOrder) => void;
}) {
  const store = useAppStore();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const currentRole = store.currentRole;
  const isWorker = currentRole === 'worker';
  const canInspect = currentRole === 'admin' || currentRole === 'quality';
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [limitAlert, setLimitAlert] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: "" });
  const { directShip, setDirectShip, handleDirectShip, confirmDirectShip } =
    useDirectShip();
  const [selected, setSelected] = useState<{
    wo: WorkOrder;
    op: WorkOrderOperation;
  } | null>(null);
  const [qty, setQty] = useState(0);
  const [operator, setOperator] = useState(currentUserName);
  const [deviceCode, setDeviceCode] = useState("");
  const [needleDensity, setNeedleDensity] = useState("");
  const [pattern, setPattern] = useState("");
  const [pressure, setPressure] = useState("");
  const [threadType, setThreadType] = useState("");
  const [qcOpen, setQcOpen] = useState(false);
  const [qcSelected, setQcSelected] = useState<{
    wo: WorkOrder;
    op: WorkOrderOperation;
  } | null>(null);
  const [qcResult, setQcResult] = useState<"qualified" | "unqualified">(
    "qualified",
  );
  const [qcInspector, setQcInspector] = useState(currentUserName);
  const [qcReason, setQcReason] = useState("");
  const [qcItems, setQcItems] = useState<QualityInspectionItem[]>([]);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (initialExpandWorkOrder) initial.add(initialExpandWorkOrder);
    return initial;
  });

  // 自动修复：已领料/无需领料但首道工序仍为未开始的数据，将其解锁为待开工
  useEffect(() => {
    let changed = false;
    const updated = store.workOrders.map((wo) => {
      const first = wo.operations[0];
      if (wo.picking_status !== "pending" && first?.status === "pending") {
        changed = true;
        const ops = wo.operations.map((o, idx) =>
          idx === 0 ? { ...o, status: "pending_start" as const } : o,
        );
        const recalc = recalcWorkOrderFromOperations({
          ...wo,
          operations: ops,
        });
        return { ...wo, operations: ops, ...recalc };
      }
      return wo;
    });
    if (changed) store.setWorkOrders(updated);
  }, [store.workOrders, store.setWorkOrders]);

  // 自动修复：工序名称/编码与工艺库外协工序匹配，但当前被误标为内部的数据，修正为外协；同时清理内部工序上不应存在的外协状态
  useEffect(() => {
    let changed = false;
    const updated = store.workOrders.map((wo) => {
      const ops = wo.operations.map((op) => {
        if (!op) return op;
        const process = store.processes.find(
          (p) =>
            p.category === "outsourcing" &&
            (p.name === op.name || p.code === op.code),
        );
        const shouldBeOutsourcing = process || op.category === "outsourcing";
        if (!shouldBeOutsourcing) {
          if (op.outsourcing_status) {
            const next = { ...op };
            delete (next as Partial<WorkOrderOperation>).outsourcing_status;
            changed = true;
            return next;
          }
          return op;
        }
        // 同步外协标识与单价
        const next: WorkOrderOperation = {
          ...op,
          category: "outsourcing" as const,
          outsourcing_price: op.outsourcing_price ?? process?.outsourcing_price,
          process_id: op.process_id || process?.id,
        };
        // 清理没有实际待发料单的外协状态
        if (
          next.outsourcing_status === "pending" &&
          !store.outsourceShipments.some(
            (s) =>
              s.work_order_id === wo.id &&
              s.operation_code === op.code &&
              s.status === "pending",
          )
        ) {
          delete (next as Partial<WorkOrderOperation>).outsourcing_status;
        }
        if (
          op.category !== next.category ||
          op.outsourcing_status !== next.outsourcing_status ||
          op.outsourcing_price !== next.outsourcing_price ||
          op.process_id !== next.process_id
        ) {
          return next;
        }
        return op;
      });
      if (ops.some((o, idx) => o !== wo.operations[idx])) {
        changed = true;
        const recalc = recalcWorkOrderFromOperations({
          ...wo,
          operations: ops,
        });
        return { ...wo, operations: ops, ...recalc };
      }
      return wo;
    });
    if (changed) store.setWorkOrders(updated);
  }, [
    store.workOrders,
    store.processes,
    store.outsourceShipments,
    store.setWorkOrders,
  ]);

  // 自动同步：当工单工序与产品当前工艺路线不一致时，按产品路线更新
  useEffect(() => {
    let changed = false;
    const updated = store.workOrders.map((wo) => {
      const product = store.products.find((p) => p.id === wo.product_id);
      if (!product) return wo;
      const steps =
        product.process_steps?.length && product.process_steps.length > 0
          ? product.process_steps
          : store.processRoutes.find(
                (r) => r.id === product.route_binding?.route_id,
              )?.steps ||
            store.processRoutes.find(
              (r) => r.category === product.category && r.status === 'active',
            )?.steps;
      if (!steps || steps.length === 0) return wo;
      // 判断工艺路线工序是否已按顺序存在于工单工序中（允许存在额外工序，避免无限循环）
      let routeIdx = 0;
      for (const op of wo.operations) {
        if (routeIdx < steps.length && op.code === steps[routeIdx].code) {
          routeIdx++;
        }
      }
      if (routeIdx === steps.length) return wo;
      const newOps: WorkOrderOperation[] = steps.map((s) => {
        const old = wo.operations.find((o) => o.code === s.code);
        return {
          seq: s.seq,
          code: s.code,
          name: s.name,
          plan_qty: wo.plan_quantity,
          completed_qty: old?.completed_qty ?? 0,
          status: old?.status ?? 'pending',
          completed: old?.completed ?? false,
          is_bottleneck: !!s.is_bottleneck,
          device: s.device,
          skill: s.skill,
          device_code: old?.device_code,
          category: s.category,
          outsourcing_price:
            s.category === 'outsourcing' ? s.outsourcing_price ?? s.price : undefined,
          process_id: s.process_id || old?.process_id,
          outsourcing_status: old?.outsourcing_status,
          outsourcing_supplier: old?.outsourcing_supplier,
          params: old?.params,
          reports: old?.reports,
          pqc_inspection_id: old?.pqc_inspection_id,
          dispatch_id: old?.dispatch_id,
          return_qc_id: old?.return_qc_id,
        };
      });
      // 保留工艺路线中不存在的额外工序（例如手动插入的检验工序），避免被同步逻辑误删
      const routeCodes = new Set(steps.map((s) => s.code));
      const extraOps = wo.operations.filter(
        (o) => !routeCodes.has(o.code),
      );
      if (extraOps.length > 0) {
        newOps.push(...extraOps);
        newOps.sort((a, b) => a.seq - b.seq);
      }
      changed = true;
      const recalc = recalcWorkOrderFromOperations({
        ...wo,
        operations: newOps,
      });
      return { ...wo, operations: newOps, ...recalc };
    });
    if (changed) store.setWorkOrders(updated);
  }, [
    store.workOrders,
    store.products,
    store.processRoutes,
    store.setWorkOrders,
  ]);


  const groups = useMemo(() => {
    const list = workOrdersProp || [];
    return list.map((wo) => ({ wo, operations: wo.operations || [] }));
  }, [workOrdersProp]);

  // 处理扫码进入报工/质检页面
  useEffect(() => {
    if (!scanWorkNo || groups.length === 0) return;
    if (scanMode !== "report" && scanMode !== "inspect") return;

    const found = groups.find((g) => g.wo.work_no === scanWorkNo);
    if (!found) return;

    const op = found.operations.find(
      (o) =>
        o.status === "running" ||
        o.status === "pending_start" ||
        o.status === "qc",
    );
    if (!op) return;

    if (scanMode === "report") {
      openReport(found.wo, op);
    } else {
      openQc(found.wo, op);
    }

    onScanHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanWorkNo, scanMode, groups]);

  function toggleExpand(workNo: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(workNo)) next.delete(workNo);
      else next.add(workNo);
      return next;
    });
  }

  function openReport(wo: WorkOrder, op: WorkOrderOperation) {
    if (op.category === "outsourcing") return;
    if (!checkOperationDependency(wo, op, store.processInspections)) {
      toast.error("前序工序未完成或未通过过程质检，禁止报工！");
      return;
    }
    setSelected({ wo, op });
    const maxFromPlan = op.plan_qty - op.completed_qty;
    const limit = getOutsourceReportLimit(wo, op, store.outsourceReturns);
    setQty(limit !== null ? Math.min(maxFromPlan, limit) : maxFromPlan);
    setOperator(currentUserName);
    setDeviceCode(op.device_code || "");
    const qp = op.params || {};
    setNeedleDensity(qp.needle_density || "");
    setPattern(qp.pattern || "");
    setPressure(qp.pressure || "");
    setThreadType(qp.thread_type || "");
    setReportOpen(true);
  }

  function goOutsourcingDispatch(wo: WorkOrder, op: WorkOrderOperation) {
    const params = new URLSearchParams();
    params.set("new", "1");
    params.set("work_id", wo.id);
    params.set("work_no", wo.work_no);
    params.set("product_id", wo.product_id);
    params.set("product_code", wo.product_code);
    params.set("product_name", wo.product_name);
    params.set("operation_code", op.code);
    params.set("operation_name", op.name);
    params.set("qty", String(op.plan_qty - op.completed_qty));
    navigate(`/outsourcing?${params.toString()}`);
  }

  function buildQcItems(wo: WorkOrder, op: WorkOrderOperation): QualityInspectionItem[] {
    const pending = store.processInspections.find(
      (p) =>
        p.work_id === wo.id &&
        (p.operation_code === op.code || p.operation_name === op.name) &&
        p.status === "pending",
    );
    if (pending && pending.items.length > 0) {
      return pending.items;
    }
    const standard = store.processInspectionStandards.find(
      (s) => s.process_name === op.name && s.status === "active",
    );
    if (standard && standard.items.length > 0) {
      return standard.items.map((i) => ({
        ...i,
        actual: undefined,
        result: "pending" as const,
      }));
    }
    return [
      {
        name: "过程巡检",
        standard: 1,
        upper: 1,
        lower: 1,
        unit: "级",
        result: "pending" as const,
      },
    ];
  }

  function evaluateQcItem(item: QualityInspectionItem, actual?: number): QualityInspectionItem {
    if (actual === undefined || Number.isNaN(actual)) {
      return { ...item, actual: undefined, result: "pending" as const };
    }
    const qualified = actual >= item.lower && actual <= item.upper;
    return {
      ...item,
      actual,
      result: qualified ? "qualified" : ("unqualified" as const),
    };
  }

  function computeOverallResult(items: QualityInspectionItem[]): "qualified" | "unqualified" {
    return items.every((i) => i.result === "qualified") ? "qualified" : "unqualified";
  }

  function openQc(wo: WorkOrder, op: WorkOrderOperation) {
    setQcSelected({ wo, op });
    const items = buildQcItems(wo, op);
    setQcItems(items);
    setQcResult(computeOverallResult(items));
    setQcInspector(currentUserName);
    setQcReason("");
    setQcOpen(true);
  }

  async function submitQc() {
    if (!qcSelected) return;
    if (!qcInspector) {
      toast.error("请选择质检员");
      return;
    }
    const { wo, op } = qcSelected;

    const unfinished = qcItems.some(
      (i) => i.actual === undefined || Number.isNaN(i.actual),
    );
    if (unfinished) {
      toast.error("请填写所有检验项的实测值");
      return;
    }

    const finalResult = computeOverallResult(qcItems);

    const pending = store.processInspections.find(
      (p) =>
        p.work_id === wo.id &&
        (p.operation_code === op.code || p.operation_name === op.name) &&
        p.status === "pending",
    );

    const pqc: ProcessInspection = pending
      ? {
          ...pending,
          result: finalResult,
          status: "inspected",
          inspector: qcInspector,
          items: qcItems,
          defect_reason: qcReason,
        }
      : {
          id: nanoid(),
          code: `PI-${Date.now().toString().slice(-6)}`,
          work_id: wo.id,
          work_no: wo.work_no,
          operation_name: op.name,
          operation_code: op.code,
          result: finalResult,
          status: "inspected",
          inspector: qcInspector,
          created_at: new Date().toISOString(),
          items: qcItems,
          defect_reason: qcReason,
        };

    if (pending) {
      store.updateProcessInspection(pqc);
    } else {
      store.addProcessInspection(pqc);
    }

    let nextOps = wo.operations;
    if (finalResult === "qualified") {
      const completedOp: WorkOrderOperation = {
        ...op,
        status: "completed",
        completed: true,
        pqc_inspection_id: pqc.id,
      };
      nextOps = unlockNextOperation(
        {
          ...wo,
          operations: wo.operations.map((o) =>
            o.code === op.code ? completedOp : o,
          ),
        },
        completedOp,
      );
    } else {
      store.addProductionException({
        id: nanoid(),
        code: `EX-${Date.now().toString().slice(-6)}`,
        work_id: wo.id,
        work_no: wo.work_no,
        operation_name: op.name,
        type: "质量问题",
        description: qcReason || "过程巡检不合格",
        submitter: qcInspector,
        created_at: new Date().toISOString(),
        status: "pending",
      });
    }
    const updated = { ...wo, operations: nextOps };
    const recalc = recalcWorkOrderFromOperations(updated);
    const finalWo = { ...updated, ...recalc };
    await store.updateWorkOrder(finalWo);
    if (recalc.status === "qc" && !isFinishedInspectionQualified(store, finalWo)) {
      await createPendingFinishedInspection(store, finalWo);
    }
    setQcOpen(false);
    setQcSelected(null);
    toast.success(
      finalResult === "qualified"
        ? "PQC 质检通过，工序已完工并解锁下道"
        : "PQC 质检不合格，已生成异常记录",
    );
  }

  async function submitReport(force = false) {
    if (!selected) return;
    if (!operator) {
      toast.error("请选择报工人");
      return;
    }
    const { wo, op } = selected;
    if (!checkOperationDependency(wo, op, store.processInspections)) {
      toast.error("前序工序未完成或未通过过程质检，禁止报工！");
      return;
    }
    if (wo.picking_status === "pending") {
      toast.error("请先完成领料");
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
    const route = store.processRoutes.find(
      (r) => r.category === wo.product_category,
    );
    const step = route?.steps.find((s) => s.code === op.code);
    const processItem = store.processes.find((p) => p.id === op.process_id);
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
      processItem?.piece_price ??
      processItem?.price ??
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
      report_time: new Date().toISOString(),
      work_no: wo.work_no,
      operation_name: op.name,
      operation_code: op.code,
    };
    const newCompleted = Math.min(op.completed_qty + qty, op.plan_qty);
    const completedAll = newCompleted >= op.plan_qty;
    const newOp: WorkOrderOperation = {
      ...op,
      completed_qty: newCompleted,
      status: completedAll ? "qc" : "running",
      completed: completedAll,
      device_code: deviceCode,
      params:
        op.name === "绗缝"
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
          p.status === "pending",
      );
      if (!existing) {
        const standard = store.processInspectionStandards.find(
          (s) => s.process_name === op.name && s.status === "active",
        );
        const items = standard
          ? standard.items.map((i) => ({
              ...i,
              result: "pending" as const,
              actual: undefined,
            }))
          : [
              {
                name: "过程巡检",
                standard: 1,
                upper: 1,
                lower: 1,
                unit: "级",
                result: "pending" as const,
              },
            ];
        const pendingInspection: ProcessInspection = {
          id: nanoid(),
          code: `PI-${Date.now().toString().slice(-6)}`,
          work_id: wo.id,
          work_no: wo.work_no,
          operation_name: op.name,
          operation_code: op.code,
          result: "pending",
          status: "pending",
          inspector: "",
          created_at: new Date().toISOString(),
          items,
          defect_reason: "",
        };
        await store.addProcessInspection(pendingInspection);
      }
    }

    const allOperationsDone = ops.every(
      (o) =>
        o.status === "completed" || o.status === "closed" || o.status === "qc"
    );
    if (allOperationsDone && !isFinishedInspectionQualified(store, finalWo)) {
      await createPendingFinishedInspection(store, finalWo);
    }
    const cost = store.workOrderCosts.find((c) => c.work_id === wo.id);
    if (cost && step) {
      store.setWorkOrderCosts(
        store.workOrderCosts.map((c) =>
          c.work_id === wo.id
            ? {
                ...c,
                labor:
                  c.labor +
                  qty *
                    (productStep?.piece_price ??
                      productStep?.price ??
                      step?.piece_price ??
                      step?.price ??
                      0),
              }
            : c,
        ),
      );
    }
    setReportOpen(false);
    setConfirmOpen(false);
    toast.success(
      completedAll ? "本工序已报工完成，等待 PQC 质检" : "报工成功",
    );
  }

  function finishAndStore(wo: WorkOrder) {
    createFinishedGoodsInbound(store, wo);
  }

  const {
    paginatedItems: groupsPaginated,
    currentPage: groupsCurrentPage,
    pageSize: groupsPageSize,
    totalPages: groupsTotalPages,
    totalItems: groupsTotalItems,
    setPage: setGroupsPage,
    setPageSize: setGroupsPageSize,
  } = usePagination(groups);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">生产工单</CardTitle>
            {onCreate && !isWorker && (
              <Button size="sm" onClick={onCreate}>
                <Plus className="mr-1 h-4 w-4" />
                新建工单
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 whitespace-nowrap"></TableHead>
                <TableHead className="whitespace-nowrap">工单</TableHead>
                <TableHead className="whitespace-nowrap">计划开始日期</TableHead>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">产品</TableHead>
                <TableHead className="whitespace-nowrap">颜色</TableHead>
                <TableHead className="whitespace-nowrap">规格/SKU</TableHead>
                <TableHead className="whitespace-nowrap">总进度</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupsPaginated.map(({ wo, operations }) => {
                const opProgress =
                  operations.length > 0
                    ? operations.reduce((sum, o) => {
                        const ratio =
                          o.plan_qty > 0 ? o.completed_qty / o.plan_qty : 0;
                        return sum + Math.min(ratio, 1);
                      }, 0) / operations.length
                    : 0;
                const progress = Math.round(opProgress * 100);
                const completedCount = operations.filter(
                  (o) => o.status === "completed" || o.status === "closed",
                ).length;
                const pendingCount = operations.filter(
                  (o) => o.status === "pending",
                ).length;
                const parentStatus: "pending" | "running" | "completed" =
                  completedCount === operations.length
                    ? "completed"
                    : pendingCount === operations.length
                      ? "pending"
                      : "running";
                const allOperationsCompleted = operations.every(
                  (o) => o.status === "completed",
                );
                const isExpanded = expanded.has(wo.work_no);

                const isHighlighted = highlightWorkOrder === wo.work_no;

                return (
                  <Fragment key={wo.id}>
                    <TableRow
                      className={`cursor-pointer hover:bg-muted/50 ${isHighlighted ? "bg-primary/10" : ""}`}
                      onClick={() => toggleExpand(wo.work_no)}
                    >
                      <TableCell className="whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(wo.work_no);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {wo.work_no}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {wo.start_date || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {wo.contract_no || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {wo.product_name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {wo.color || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {wo.sku_summary || wo.sku_id || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-2 w-24" />
                          <span className="text-xs text-muted-foreground w-9">
                            {progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={opStatusBadgeVariant(parentStatus)}>
                          {opStatusLabel(parentStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(wo.work_no);
                          }}
                        >
                          {isExpanded ? "收起" : "展开"}
                        </Button>
                        {onPrint && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-1"
                            title="打印流转卡"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPrint(wo);
                            }}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
                        {!isWorker && (
                          <>
                            {onDetail && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDetail(wo);
                                }}
                                title="详情"
                                className="ml-1"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {onPicking && wo.picking_status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPicking(wo);
                                }}
                                className="ml-2"
                              >
                                <Package className="mr-1 h-4 w-4" />
                                领料
                              </Button>
                            )}
                            {(wo.status === "qc" || wo.status === "pending_inbound") && (
                              <Button
                                variant={
                                  wo.status === "pending_inbound" || allOperationsCompleted
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                disabled={wo.status === "qc" && !allOperationsCompleted}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (wo.status === "pending_inbound") {
                                    navigate("/inventory?tab=finished_inbound");
                                  } else {
                                    finishAndStore(wo);
                                  }
                                }}
                                className="ml-2"
                              >
                                {wo.status === "pending_inbound" ? "去入库" : "完工入库"}
                              </Button>
                            )}

                          </>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={9} className="p-0">
                          <div className="pl-8 pr-2 py-2">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="whitespace-nowrap">
                                    工序
                                  </TableHead>
                                  <TableHead className="whitespace-nowrap">
                                    计划/已完成
                                  </TableHead>
                                  <TableHead className="whitespace-nowrap">
                                    设备
                                  </TableHead>
                                  <TableHead className="whitespace-nowrap">
                                    状态
                                  </TableHead>
                                  <TableHead className="text-right whitespace-nowrap">
                                    操作
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {operations.filter(Boolean).length === 0 ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={5}
                                      className="py-6 text-center text-sm text-muted-foreground"
                                    >
                                      暂无工序数据
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  operations.filter(Boolean).map((op, idx) => (
                                  <TableRow
                                    key={`${wo.id}-${op.code || idx}`}
                                    className={
                                      op.is_bottleneck ? "bg-primary/5" : ""
                                    }
                                  >
                                    <TableCell className="whitespace-nowrap">
                                      {op.seq}. {op.name}{" "}
                                      {op.is_bottleneck ? (
                                        <span className="text-xs text-destructive">
                                          (瓶颈)
                                        </span>
                                      ) : null}
                                      {op.category === "outsourcing" ? (
                                        <Badge
                                          variant="outline"
                                          className="ml-2"
                                        >
                                          外协
                                        </Badge>
                                      ) : null}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      {op.completed_qty}/{op.plan_qty}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      {op.device || "-"}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      <Badge
                                        variant={opStatusBadgeVariant(
                                          op.status,
                                        )}
                                      >
                                        {opStatusLabel(op.status)}
                                      </Badge>{" "}
                                      {op.category === "outsourcing" &&
                                      op.outsourcing_status ? (
                                        <Badge
                                          variant="secondary"
                                          className="ml-1"
                                        >
                                          {op.outsourcing_status === "pending"
                                            ? "待发料"
                                            : op.outsourcing_status ===
                                                "dispatched"
                                              ? "已发料"
                                              : op.outsourcing_status ===
                                                  "returning"
                                                ? "回货中"
                                                : "已回货"}
                                        </Badge>
                                      ) : null}
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                      {op.category === "outsourcing" ? (
                                        <>
                                          {op.status === "pending_start" && (
                                            <Button
                                              size="sm"
                                              variant="secondary"
                                              onClick={() =>
                                                goOutsourcingDispatch(wo, op)
                                              }
                                            >
                                              <Package className="mr-1 h-4 w-4" />
                                              外发
                                            </Button>
                                          )}
                                          {op.status === "qc" && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                goOutsourcingDispatch(wo, op)
                                              }
                                            >
                                              <ShieldCheck className="mr-1 h-4 w-4" />
                                              回货质检
                                            </Button>
                                          )}
                                          {op.status === "running" && (
                                            <span className="text-xs text-muted-foreground">
                                              外协中
                                            </span>
                                          )}
                                          {op.status === "completed" && (
                                            <span className="text-xs text-muted-foreground">
                                              已完工
                                            </span>
                                          )}
                                          {(op.status === "pending" ||
                                            op.status === "closed") && (
                                            <span className="text-xs text-muted-foreground">
                                              -
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          {(op.status === "pending_start" ||
                                            op.status === "running") && (
                                            <Button
                                              size="sm"
                                              disabled={
                                                wo.status === "paused" ||
                                                wo.picking_status === "pending"
                                              }
                                              onClick={() => openReport(wo, op)}
                                              title={
                                                wo.picking_status === "pending"
                                                  ? "请先完成领料"
                                                  : "报工"
                                              }
                                            >
                                              <Play className="mr-1 h-4 w-4" />
                                              报工
                                            </Button>
                                          )}
                                          {op.status === "qc" && canInspect && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => openQc(wo, op)}
                                            >
                                              <ShieldCheck className="mr-1 h-4 w-4" />
                                              质检
                                            </Button>
                                          )}
                                          {op.status === "pending" && (
                                            <span className="text-xs text-muted-foreground">
                                              -
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          <Pagination
            currentPage={groupsCurrentPage}
            totalPages={groupsTotalPages}
            pageSize={groupsPageSize}
            totalItems={groupsTotalItems}
            onPageChange={setGroupsPage}
            onPageSizeChange={setGroupsPageSize}
          />
        </CardContent>
      </Card>
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>工序扫码报工</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-4">
              <div className="text-sm font-medium">
                {selected.wo.work_no} · {selected.wo.product_name}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>工序</Label>
                  <Input value={selected.op.name} disabled />
                </div>
                <div className="space-y-2">
                  <Label>剩余数量</Label>
                  <Input
                    value={selected.op.plan_qty - selected.op.completed_qty}
                    disabled
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>完成数量</Label>
                  <Input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    报工人 <span className="text-destructive">*</span>
                  </Label>
                  <Select value={operator} onValueChange={setOperator}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择员工" />
                    </SelectTrigger>
                    <SelectContent>
                      {store.employees
                        .filter((e) => e.status === "active" && e.department === "生产部")
                        .map((e) => (
                          <SelectItem key={e.id} value={e.name}>
                            {e.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selected.op.name === "绗缝" && (
                <div className="space-y-3 rounded border p-3">
                  <div className="text-sm font-medium">绗缝运行参数</div>
                  <div className="space-y-2">
                    <Label>关联设备</Label>
                    <Select
                      value={deviceCode || "none"}
                      onValueChange={(v) =>
                        setDeviceCode(v === "none" ? "" : v)
                      }
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
                      <Input
                        value={needleDensity}
                        onChange={(e) => setNeedleDensity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>花型</Label>
                      <Input
                        value={pattern}
                        onChange={(e) => setPattern(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>压脚压力</Label>
                      <Input
                        value={pressure}
                        onChange={(e) => setPressure(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>线型</Label>
                      <Input
                        value={threadType}
                        onChange={(e) => setThreadType(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReportOpen(false)}>
                  取消
                </Button>
                <Button onClick={() => submitReport()}>
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  提交报工
                </Button>
              </div>
            </div>
          )}
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
      <Dialog
        open={limitAlert.open}
        onOpenChange={(open) => setLimitAlert({ ...limitAlert, open })}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
          <DialogHeader>
            <DialogTitle>报工数量超限</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{limitAlert.message}</p>
          <div className="flex justify-end">
            <Button
              onClick={() => setLimitAlert({ ...limitAlert, open: false })}
            >
              知道了
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={qcOpen} onOpenChange={setQcOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>过程巡检（PQC）</DialogTitle>
          </DialogHeader>
          {qcSelected && (
            <div className="space-y-4 py-4">
              <div className="text-sm font-medium">
                {qcSelected.wo.work_no} · {qcSelected.op.name}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>质检结果</Label>
                  <Badge
                    variant={
                      qcResult === "qualified" ? "default" : "destructive"
                    }
                    className="h-9 px-3 text-sm"
                  >
                    {qcResult === "qualified" ? "合格" : "不合格"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label>
                    质检员 <span className="text-destructive">*</span>
                  </Label>
                  <Select value={qcInspector} onValueChange={setQcInspector}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择质检员" />
                    </SelectTrigger>
                    <SelectContent>
                      {store.employees
                        .filter((e) => e.status === "active")
                        .map((e) => (
                          <SelectItem key={e.id} value={e.name}>
                            {e.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>检验项（根据工序检验标准自动生成）</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">项目</TableHead>
                        <TableHead className="whitespace-nowrap">标准</TableHead>
                        <TableHead className="whitespace-nowrap">上限</TableHead>
                        <TableHead className="whitespace-nowrap">下限</TableHead>
                        <TableHead className="whitespace-nowrap">实测值</TableHead>
                        <TableHead className="whitespace-nowrap">结果</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qcItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap">
                            {item.name}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({item.unit})
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {item.standard}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {item.upper}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {item.lower}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Input
                              type="number"
                              step="any"
                              value={item.actual ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const actual = raw === "" ? undefined : Number(raw);
                                const evaluated = evaluateQcItem(item, actual);
                                const next = qcItems.map((i, i2) =>
                                  i2 === idx ? evaluated : i,
                                );
                                setQcItems(next);
                                setQcResult(computeOverallResult(next));
                              }}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant={
                                item.result === "qualified"
                                  ? "default"
                                  : item.result === "unqualified"
                                    ? "destructive"
                                    : "outline"
                              }
                            >
                              {item.result === "qualified"
                                ? "合格"
                                : item.result === "unqualified"
                                  ? "不合格"
                                  : "待填"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="space-y-2">
                <Label>备注/缺陷原因</Label>
                <Textarea
                  value={qcReason}
                  onChange={(e) => setQcReason(e.target.value)}
                  placeholder="填写质检备注或不合格原因"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setQcOpen(false)}>
                  取消
                </Button>
                <Button onClick={submitQc} disabled={!qcInspector}>
                  提交质检
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={directShip.open}
        onOpenChange={(open) => setDirectShip((s) => ({ ...s, open }))}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>确认直发出库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground whitespace-nowrap">
                  关联销售订单号
                </span>
                <span className="font-medium text-right">
                  {directShip.salesOrderNo || "-"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground whitespace-nowrap">
                  工单号
                </span>
                <span className="font-medium text-right">
                  {directShip.wo?.work_no || "-"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground whitespace-nowrap">
                  产品
                </span>
                <span className="font-medium text-right">
                  {directShip.wo?.product_name || "-"}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              确认后，工单将直接结案，并自动生成一条销售出库记录。请确保已完成成品检验且质量合格。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDirectShip((s) => ({ ...s, open: false }))}
              >
                取消
              </Button>
              <Button onClick={confirmDirectShip}>确认直发</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProgressTab() {
  const store = useAppStore();
  const wip = useMemo(() => {
    const map: Record<string, number> = {};
    store.workOrders.forEach((wo) => {
      wo.operations.forEach((op) => {
        if (!op) return;
        if (
          op.status === "running" ||
          (op.status === "completed" && op.completed_qty > 0)
        ) {
          map[op.name] = (map[op.name] || 0) + op.completed_qty;
        }
      });
    });
    return Object.entries(map)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);
  }, [store.workOrders]);

  const {
    paginatedItems: wipPaginated,
    currentPage: wipCurrentPage,
    pageSize: wipPageSize,
    totalPages: wipTotalPages,
    totalItems: wipTotalItems,
    setPage: setWipPage,
    setPageSize: setWipPageSize,
  } = usePagination(wip);

  const {
    paginatedItems: store_workOrdersPaginated,
    currentPage: store_workOrdersCurrentPage,
    pageSize: store_workOrdersPageSize,
    totalPages: store_workOrdersTotalPages,
    totalItems: store_workOrdersTotalItems,
    setPage: setStore_workOrdersPage,
    setPageSize: setStore_workOrdersPageSize,
  } = usePagination(store.workOrders);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">工单进度看板</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">工单编号</TableHead>
                <TableHead className="whitespace-nowrap">产品</TableHead>
                <TableHead className="whitespace-nowrap">当前工序</TableHead>
                <TableHead className="whitespace-nowrap">计划产量</TableHead>
                <TableHead className="whitespace-nowrap">已完成</TableHead>
                <TableHead className="whitespace-nowrap">进度</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store_workOrdersPaginated.map((wo) => {
                const current =
                  wo.operations.find((o) => o && o.status === "running") ||
                  wo.operations.find((o) => o && o.status === "pending") ||
                  wo.operations.find((o) => !!o);
                return (
                  <TableRow key={wo.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {wo.work_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {wo.product_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {current ? `${current.seq}. ${current.name}` : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {wo.plan_quantity}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {wo.completed_quantity}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Progress value={wo.progress} className="h-2 w-24" />
                        <span className="text-xs">{wo.progress}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination
            currentPage={store_workOrdersCurrentPage}
            totalPages={store_workOrdersTotalPages}
            pageSize={store_workOrdersPageSize}
            totalItems={store_workOrdersTotalItems}
            onPageChange={setStore_workOrdersPage}
            onPageSizeChange={setStore_workOrdersPageSize}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">在制品统计（按工序）</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">工序</TableHead>
                <TableHead className="whitespace-nowrap">在制品数量</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wipPaginated.map((row) => (
                <TableRow
                  key={row.name}
                  className={row.name === "绗缝" ? "bg-primary/5" : ""}
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    {row.name}
                    {row.name === "绗缝" ? (
                      <span className="ml-1 text-xs text-destructive">
                        (瓶颈)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{row.qty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            currentPage={wipCurrentPage}
            totalPages={wipTotalPages}
            pageSize={wipPageSize}
            totalItems={wipTotalItems}
            onPageChange={setWipPage}
            onPageSizeChange={setWipPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function CostsTab() {
  const store = useAppStore();

  function sumMaterialQtyByCategory(wo: WorkOrder): Record<string, number> {
    const result: Record<string, number> = {
      fabric: 0,
      lining: 0,
      filling: 0,
      accessory: 0,
    };

    // 1. 从生产领料单汇总实际发料数量
    const requisitions = store.materialRequisitions.filter(
      (mr) =>
        mr.related_work_order_no === wo.work_no ||
        mr.related_work_order_no === wo.id,
    );
    for (const mr of requisitions) {
      for (const item of mr.items) {
        if (!item.issued_qty || item.issued_qty <= 0) continue;
        const material = store.materials.find((m) => m.id === item.material_id);
        const category = material?.category || "";
        if (category === "面料" || category === "底布") {
          result.fabric += item.issued_qty;
        } else if (category === "里料") {
          result.lining += item.issued_qty;
        } else if (category === "填充物") {
          result.filling += item.issued_qty;
        } else if (category === "辅料" || category === "配件") {
          result.accessory += item.issued_qty;
        }
      }
    }

    // 2. 从库存出库记录汇总实际发料数量（覆盖/补充未走领料单的场景）
    const stockOutRecords = store.stockRecords.filter(
      (sr: StockRecord) =>
        sr.type === "out" &&
        sr.subtype === "生产领料" &&
        (sr.related_order === wo.work_no || sr.related_order_id === wo.id),
    );
    for (const sr of stockOutRecords) {
      if (!sr.material_id) continue;
      const material = store.materials.find((m) => m.id === sr.material_id);
      const category = material?.category || "";
      if (category === "面料" || category === "底布") {
        result.fabric += sr.quantity;
      } else if (category === "里料") {
        result.lining += sr.quantity;
      } else if (category === "填充物") {
        result.filling += sr.quantity;
      } else if (category === "辅料" || category === "配件") {
        result.accessory += sr.quantity;
      }
    }

    return result;
  }

  function sumLaborAmount(wo: WorkOrder): number {
    let total = 0;
    for (const op of wo.operations || []) {
      for (const r of op.reports || []) {
        total += r.amount || 0;
      }
    }
    return total;
  }

  function computeCost(wo: WorkOrder): WorkOrderCost {
    const existing = store.workOrderCosts.find((c) => c.work_id === wo.id);
    const actualQty = sumMaterialQtyByCategory(wo);
    const labor = sumLaborAmount(wo);
    const planned = wo.plan_quantity * 25;

    // 如果已有成本记录，复用其制造费用；否则按计划数量计算
    const overhead = existing?.overhead ?? wo.plan_quantity * 2.1;

    return {
      work_id: wo.id,
      fabric: actualQty.fabric * 12,
      lining: actualQty.lining * 3.5,
      filling: actualQty.filling * 8,
      accessory: actualQty.accessory * 1.2,
      labor,
      overhead,
      planned,
    };
  }

  const {
    paginatedItems: store_workOrdersPaginated,
    currentPage: store_workOrdersCurrentPage,
    pageSize: store_workOrdersPageSize,
    totalPages: store_workOrdersTotalPages,
    totalItems: store_workOrdersTotalItems,
    setPage: setStore_workOrdersPage,
    setPageSize: setStore_workOrdersPageSize,
  } = usePagination(store.workOrders);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">工单成本统计</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">工单</TableHead>
                <TableHead className="whitespace-nowrap">产品</TableHead>
                <TableHead className="whitespace-nowrap">颜色/规格</TableHead>
                <TableHead className="whitespace-nowrap">面料</TableHead>
                <TableHead className="whitespace-nowrap">填充物</TableHead>
                <TableHead className="whitespace-nowrap">辅料</TableHead>
                <TableHead className="whitespace-nowrap">人工</TableHead>
                <TableHead className="whitespace-nowrap">制造费用</TableHead>
                <TableHead className="whitespace-nowrap">实际成本</TableHead>
                <TableHead className="whitespace-nowrap">计划成本</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store_workOrdersPaginated.map((wo) => {
                const c = computeCost(wo);
                const actual =
                  c.fabric +
                  c.filling +
                  c.accessory +
                  c.labor +
                  c.overhead;
                return (
                  <TableRow key={wo.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {wo.work_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {wo.product_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {[wo.color, wo.sku_summary].filter(Boolean).join(" / ")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      ¥{c.fabric.toFixed(2)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      ¥{c.filling.toFixed(2)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      ¥{c.accessory.toFixed(2)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      ¥{c.labor.toFixed(2)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      ¥{c.overhead.toFixed(2)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      ¥{actual.toFixed(2)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      ¥{c.planned.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination
            currentPage={store_workOrdersCurrentPage}
            totalPages={store_workOrdersTotalPages}
            pageSize={store_workOrdersPageSize}
            totalItems={store_workOrdersTotalItems}
            onPageChange={setStore_workOrdersPage}
            onPageSizeChange={setStore_workOrdersPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ExceptionsTab() {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionException | null>(null);
  const [statusFilter, setStatusFilter] = useState("全部");
  const [form, setForm] = useState<Partial<ProductionException>>({
    type: "设备故障",
    status: "pending",
    submitter: currentUserName,
  });

  const filtered = store.productionExceptions.filter(
    (e) => statusFilter === "全部" || e.status === statusFilter,
  );

  function save() {
    if (
      !form.type ||
      !form.description ||
      !form.work_no ||
      !form.operation_name
    )
      return;
    const ex: ProductionException = {
      id: editing?.id || nanoid(),
      code: editing?.code || `EX-${Date.now().toString().slice(-6)}`,
      work_id: editing?.work_id || "",
      work_no: form.work_no || "",
      operation_name: form.operation_name || "",
      type: form.type as ProductionException["type"],
      description: form.description || "",
      submitter: editing?.submitter || currentUserName || "当前用户",
      created_at: editing?.created_at || now(),
      status: (form.status as ProductionException["status"]) || "pending",
      device: form.device,
      person: form.person,
      handler: form.handler,
      handled_at: form.handled_at,
      solution: form.solution,
      result: form.result,
    };
    if (editing) store.updateProductionException(ex);
    else store.addProductionException(ex);
    setOpen(false);
    setForm({ type: "设备故障", status: "pending", submitter: currentUserName });
    setEditing(null);
  }

  function resolve(status: ProductionException["status"]) {
    if (!editing) return;
    store.updateProductionException({ ...editing, status, handled_at: now() });
    setOpen(false);
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-36">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            {["全部", "pending", "processing", "resolved"].map((s) => (
              <SelectItem key={s} value={s}>
                {s === "全部"
                  ? "全部"
                  : s === "pending"
                    ? "待处理"
                    : s === "processing"
                      ? "处理中"
                      : "已解决"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setForm({ type: "设备故障", status: "pending", submitter: currentUserName });
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          提交异常
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">异常编号</TableHead>
                <TableHead className="whitespace-nowrap">工单</TableHead>
                <TableHead className="whitespace-nowrap">工序</TableHead>
                <TableHead className="whitespace-nowrap">类型</TableHead>
                <TableHead className="whitespace-nowrap">描述</TableHead>
                <TableHead className="whitespace-nowrap">提交人</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPaginated.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {e.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.work_no}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.operation_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline">{e.type}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap max-w-xs truncate">
                    {e.description}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.submitter}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        e.status === "resolved"
                          ? "default"
                          : e.status === "processing"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {e.status === "pending"
                        ? "待处理"
                        : e.status === "processing"
                          ? "处理中"
                          : "已解决"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(e);
                        setForm({ ...e });
                        setOpen(true);
                      }}
                    >
                      处理
                    </Button>
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "处理生产异常" : "提交生产异常"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>工单编号</Label>
                <Select
                  value={form.work_no || ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, work_no: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择工单" />
                  </SelectTrigger>
                  <SelectContent>
                    {store.workOrders.map((wo) => (
                      <SelectItem key={wo.id} value={wo.work_no}>
                        {wo.work_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>工序</Label>
                <Select
                  value={form.operation_name || ""}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, operation_name: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择工序" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      new Set(
                        store.workOrders.flatMap((wo) =>
                          wo.operations.map((o) => o.name),
                        ),
                      ),
                    ).map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editing && (
              <>
                <div className="space-y-2">
                  <Label>异常类型</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        type: v as ProductionException["type"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["设备故障", "物料缺料", "质量问题", "工艺问题"].map(
                        (t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>异常描述</Label>
                  <Textarea
                    value={form.description || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>关联设备</Label>
                    <Select
                      value={form.device_id || "none"}
                      onValueChange={(v) => {
                        const e = store.equipment.find((x) => x.id === v);
                        setForm((f) => ({
                          ...f,
                          device_id: e?.id || "",
                          device: e?.name || "",
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择设备" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">不关联</SelectItem>
                        {store.equipment.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name} · {e.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>关联人员</Label>
                    <Select
                      value={form.person_id || "none"}
                      onValueChange={(v) => {
                        const e = store.employees.find((x) => x.id === v);
                        setForm((f) => ({
                          ...f,
                          person_id: e?.id || "",
                          person: e?.name || "",
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择人员" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">不关联</SelectItem>
                        {store.employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            {editing && (
              <>
                <div className="text-sm text-muted-foreground">
                  {editing.type} · {editing.description}
                </div>
                <div className="space-y-2">
                  <Label>处理人</Label>
                  <Select
                    value={form.handler_id || "none"}
                    onValueChange={(v) => {
                      const e = store.employees.find((x) => x.id === v);
                      setForm((f) => ({
                        ...f,
                        handler_id: e?.id || "",
                        handler: e?.name || "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择处理人" />
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
                  <Label>处理方案</Label>
                  <Textarea
                    value={form.solution || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, solution: e.target.value }))
                    }
                  />
                </div>
                {editing.status !== "resolved" && (
                  <div className="space-y-2">
                    <Label>处理结果</Label>
                    <Textarea
                      value={form.result || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, result: e.target.value }))
                      }
                    />
                  </div>
                )}
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              {!editing && <Button onClick={save}>提交</Button>}
              {editing && editing.status === "pending" && (
                <Button
                  onClick={() => {
                    setForm((f) => ({ ...f, status: "processing" }));
                    save();
                  }}
                >
                  开始处理
                </Button>
              )}
              {editing && editing.status === "processing" && (
                <Button
                  onClick={() => {
                    setForm((f) => ({ ...f, status: "resolved" }));
                    save();
                  }}
                >
                  标记已解决
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function now() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

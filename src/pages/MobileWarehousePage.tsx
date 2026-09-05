import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Search,
  ChevronDown,
  Check,
  AlertTriangle,
  ArrowLeft,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAppStore, type AppState } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { nanoid, cn } from "@/lib/utils";
import type {
  Inventory,
  Material,
  MaterialRequisition,
  OutsourcingDispatch,
  Product,
  PurchaseArrival,
  SalesOutbound,
  Shipment,
  StockRecord,
  WarehouseLocation,
} from "@/types";

/* ------------------------------------------------------------------
   类型定义
------------------------------------------------------------------ */
type TaskType = "inbound" | "outbound";

interface WarehouseTask {
  id: string;
  type: TaskType;
  subType: string;
  sourceId: string;
  sourceNo: string;
  itemName: string;
  itemCode: string;
  targetId: string;
  targetName: string;
  quantity: number;
  doneQty: number;
  pendingQty: number;
  createdAt: string;
  warehouse?: string;
  locationId?: string;
  productId?: string;
  materialId?: string;
  skuId?: string;
}

interface ConfirmForm {
  itemId: string;
  productId?: string;
  materialId?: string;
  skuId?: string;
  itemName: string;
  itemCode: string;
  warehouse: string;
  locationId: string;
  quantity: number;
  logisticsCompany?: string;
  trackingNo?: string;
}

/* ------------------------------------------------------------------
   工具函数
------------------------------------------------------------------ */
const LOGISTICS_OPTIONS = ["顺丰速运", "中通快递", "圆通速递", "申通快递", "韵达快递", "德邦物流", "京东物流", "EMS"];

function formatDate(d: string) {
  return d ? d.slice(0, 10) : "-";
}

function getItemName(item: Inventory, products: Product[], materials: Material[]) {
  if (item.type === "product") {
    return products.find((p) => p.id === item.product_id)?.name || "-";
  }
  return materials.find((m) => m.id === item.material_id)?.name || "-";
}

function getItemCode(item: Inventory, products: Product[], materials: Material[]) {
  if (item.type === "product") {
    return products.find((p) => p.id === item.product_id)?.code || "-";
  }
  return materials.find((m) => m.id === item.material_id)?.code || "-";
}

function getItemUnit(item: Inventory, products: Product[], materials: Material[]) {
  if (item.type === "product") {
    return products.find((p) => p.id === item.product_id)?.unit || "件";
  }
  return materials.find((m) => m.id === item.material_id)?.unit || "米";
}

/* ------------------------------------------------------------------
   页面主组件
------------------------------------------------------------------ */
import { MobileUserMenu } from "@/components/common/MobileUserMenu";

export default function MobileWarehousePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();
  const store = useAppStore();
  const role = profile?.role || store.currentRole;

  useEffect(() => {
    if (role !== "warehouse" && role !== "admin") {
      toast.error("当前角色无权限访问该页面");
      navigate("/mobile/home", { replace: true });
    }
  }, [role, navigate]);

  const tabParam = params.get("tab") as TaskType | null;
  const taskIdParam = params.get("taskId");
  const actionParam = params.get("action");

  const [activeTab, setActiveTab] = useState<TaskType>(tabParam || "inbound");
  const [selectedTask, setSelectedTask] = useState<WarehouseTask | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    if (actionParam === "confirm" && taskIdParam) {
      const task = allTasks.find((t) => t.id === taskIdParam);
      if (task) {
        setSelectedTask(task);
        setActiveTab(task.type);
      }
    }
  }, [actionParam, taskIdParam]);

  const inboundRef = useRef<HTMLDivElement>(null);
  const outboundRef = useRef<HTMLDivElement>(null);

  const allTasks = useMemo<WarehouseTask[]>(() => {
    const tasks: WarehouseTask[] = [];
    const { purchaseOrders, purchaseArrivals, finishedGoodsInbounds, salesOutbounds, materialRequisitions, outsourcingDispatches, outsourceShipments, shipments, salesOrders, workOrders, products, materials } = store;

    // 采购待入库：与 PC 端“待到货采购订单”保持一致，按采购订单行剩余数量生成任务
    purchaseOrders.forEach((order) => {
      if (!["approved", "partial"].includes(order.status)) return;
      order.items.forEach((line, idx) => {
        const ordered = line.quantity || 0;
        const stored = purchaseArrivals
          .filter((a) => a.order_id === order.id)
          .reduce((sum, a) => sum + a.items
            .filter((i) => i.material_code === line.material_code)
            .reduce((s, i) => s + (i.stored_qty || 0), 0), 0);
        const pending = ordered - stored;
        if (pending <= 0) return;
        tasks.push({
          id: `po-${order.id}-${idx}`,
          type: "inbound",
          subType: "采购到货",
          sourceId: order.id,
          sourceNo: order.order_no,
          itemName: line.material_name,
          itemCode: line.material_code,
          targetId: order.id,
          targetName: order.supplier_name,
          quantity: ordered,
          doneQty: stored,
          pendingQty: pending,
          createdAt: order.issued_date,
          warehouse: line.warehouse,
          locationId: line.location_id,
          materialId: line.material_id,
        });
      });
    });

    // 生产完工入库
    finishedGoodsInbounds.forEach((inb) => {
      if (inb.status === "inbound") return;
      tasks.push({
        id: `fg-${inb.id}`,
        type: "inbound",
        subType: "生产完工",
        sourceId: inb.id,
        sourceNo: inb.inbound_no,
        itemName: inb.product_name,
        itemCode: inb.product_code,
        targetId: inb.work_id,
        targetName: inb.work_no,
        quantity: inb.quantity,
        doneQty: 0,
        pendingQty: inb.quantity,
        createdAt: inb.created_at,
        warehouse: inb.warehouse,
        locationId: inb.location_id,
        productId: inb.product_id,
      });
    });

    // 生产领料出库
    materialRequisitions.forEach((req) => {
      if (req.status === "completed" || req.status === "issued") return;
      req.items.forEach((line, idx) => {
        const pending = (line.required_qty || 0) - (line.issued_qty || 0);
        if (pending <= 0) return;
        tasks.push({
          id: `${req.id}-${idx}`,
          type: "outbound",
          subType: "生产领料",
          sourceId: req.id,
          sourceNo: req.code,
          itemName: line.material_name,
          itemCode: line.material_code,
          targetId: req.related_work_order_no || "",
          targetName: req.related_work_order_no || "-",
          quantity: line.required_qty,
          doneQty: line.issued_qty || 0,
          pendingQty: pending,
          createdAt: req.created_at,
          warehouse: line.warehouse,
          locationId: line.location_id,
          materialId: line.material_id,
        });
      });
    });

    // 销售发货出库
    shipments.forEach((ship) => {
      if (ship.status === "shipped" || ship.status === "signed") return;
      ship.items.forEach((line, idx) => {
        const pending = (line.quantity || 0) - (line.shipped_quantity || 0);
        if (pending <= 0) return;
        tasks.push({
          id: `${ship.id}-${idx}`,
          type: "outbound",
          subType: "销售发货",
          sourceId: ship.id,
          sourceNo: ship.shipment_no,
          itemName: line.product_name,
          itemCode: line.product_code,
          targetId: ship.order_id,
          targetName: ship.customer_name,
          quantity: line.quantity,
          doneQty: line.shipped_quantity || 0,
          pendingQty: pending,
          createdAt: ship.shipment_date,
          warehouse: undefined,
          locationId: undefined,
          productId: line.product_id,
          skuId: line.sku_id,
        });
      });
    });

    // 外协发料出库
    outsourcingDispatches.forEach((disp) => {
      if (disp.status === "completed" || disp.status === "returned") return;
      const remaining = disp.qty - disp.return_qty;
      if (remaining <= 0) return;
      tasks.push({
        id: `os-${disp.id}`,
        type: "outbound",
        subType: "外协发料",
        sourceId: disp.id,
        sourceNo: disp.code,
        itemName: disp.product_name,
        itemCode: disp.product_code,
        targetId: disp.work_id,
        targetName: disp.work_no,
        quantity: disp.qty,
        doneQty: disp.return_qty,
        pendingQty: remaining,
        createdAt: disp.dispatch_date,
        productId: disp.product_id,
      });
    });

    return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [store]);

  const inboundTasks = useMemo(
    () => allTasks.filter((t) => t.type === "inbound"),
    [allTasks],
  );
  const outboundTasks = useMemo(
    () => allTasks.filter((t) => t.type === "outbound"),
    [allTasks],
  );

  const scrollTo = (type: TaskType) => {
    setActiveTab(type);
    const ref = type === "inbound" ? inboundRef : outboundRef;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (selectedTask) {
    return (
      <ConfirmView
        task={selectedTask}
        onBack={() => {
          setSelectedTask(null);
          setParams({});
        }}
        onSuccess={() => {
          setSelectedTask(null);
          setSuccessOpen(true);
          setParams({ tab: selectedTask.type });
        }}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <h1 className="text-lg font-semibold text-foreground">仓管工作台</h1>
        <MobileUserMenu />
      </header>

      <div className="grid grid-cols-2 gap-3 p-4">
        <button
          onClick={() => scrollTo("inbound")}
          className="flex flex-col items-start rounded-xl border border-border bg-card p-4 active:border-primary"
        >
          <span className="text-sm text-muted-foreground">今日待入库</span>
          <div className="mt-2 flex items-center gap-2 text-3xl font-bold text-primary">
            <ArrowDownToLine className="h-6 w-6" />
            {inboundTasks.length}
          </div>
          <span className="mt-1 text-xs text-muted-foreground">点击滚动至入库</span>
        </button>
        <button
          onClick={() => scrollTo("outbound")}
          className="flex flex-col items-start rounded-xl border border-border bg-card p-4 active:border-primary"
        >
          <span className="text-sm text-muted-foreground">今日待出库</span>
          <div className="mt-2 flex items-center gap-2 text-3xl font-bold text-primary">
            <ArrowUpFromLine className="h-6 w-6" />
            {outboundTasks.length}
          </div>
          <span className="mt-1 text-xs text-muted-foreground">点击滚动至出库</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div ref={inboundRef} className="border-b border-border">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-background px-4 py-3">
            <h2 className="text-lg font-semibold text-foreground">待入库</h2>
            <span className="text-sm text-muted-foreground">{inboundTasks.length} 单</span>
          </div>
          <div className="px-4 pb-4">
            {inboundTasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无待入库任务</div>
            ) : (
              inboundTasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
              ))
            )}
          </div>
        </div>

        <div ref={outboundRef} className="border-b border-border">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-background px-4 py-3">
            <h2 className="text-lg font-semibold text-foreground">待出库</h2>
            <span className="text-sm text-muted-foreground">{outboundTasks.length} 单</span>
          </div>
          <div className="px-4 pb-4">
            {outboundTasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无待出库任务</div>
            ) : (
              outboundTasks.map((task) => (
                <TaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
              ))
            )}
          </div>
        </div>
      </div>

      <SuccessDialog open={successOpen} onOpenChange={setSuccessOpen} />
    </div>
  );
}

/* ------------------------------------------------------------------
   任务卡片
------------------------------------------------------------------ */
function TaskCard({ task, onClick }: { task: WarehouseTask; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-3 flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left active:border-primary"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary">{task.subType}</span>
        <span className="text-xs text-muted-foreground">{formatDate(task.createdAt)}</span>
      </div>
      <div className="text-lg font-semibold text-foreground">{task.itemName}</div>
      <div className="text-sm text-muted-foreground">编码：{task.itemCode}</div>
      <div className="flex items-center justify-between text-sm text-foreground">
        <span>待{task.type === "inbound" ? "入" : "出"}：{task.pendingQty}</span>
        <span className="text-muted-foreground">来源：{task.sourceNo}</span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------
   确认入库/出库页面
------------------------------------------------------------------ */
function ConfirmView({
  task,
  onBack,
  onSuccess,
}: {
  task: WarehouseTask;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const store = useAppStore();
  const { profile } = useAuth();
  const currentUserName = profile?.full_name || profile?.email || "仓管员";
  const isInbound = task.type === "inbound";

  const warehouses = useMemo(
    () => [...new Set(store.warehouseLocations.map((l) => l.warehouse))].sort(),
    [store.warehouseLocations],
  );

  const [form, setForm] = useState<ConfirmForm>({
    itemId: task.materialId || task.productId || "",
    productId: task.productId,
    materialId: task.materialId,
    skuId: task.skuId,
    itemName: task.itemName,
    itemCode: task.itemCode,
    warehouse: task.warehouse || warehouses[0] || "",
    locationId: task.locationId || "",
    quantity: task.pendingQty,
    logisticsCompany: "",
    trackingNo: "",
  });

  const locations = useMemo(
    () => store.warehouseLocations.filter((l) => l.warehouse === form.warehouse),
    [store.warehouseLocations, form.warehouse],
  );

  const availableInventory = useMemo(() => {
    if (isInbound) return Number.POSITIVE_INFINITY;
    return store.inventory
      .filter(
        (i) =>
          i.warehouse === form.warehouse &&
          i.location_id === form.locationId &&
          ((form.productId && i.product_id === form.productId) ||
            (form.materialId && i.material_id === form.materialId)),
      )
      .reduce((sum, i) => sum + (i.quantity || 0), 0);
  }, [isInbound, store.inventory, form.warehouse, form.locationId, form.productId, form.materialId]);

  const [stockOpen, setStockOpen] = useState(false);
  const [stockQuery, setStockQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shortage, setShortage] = useState<{ open: boolean; available: number }>({ open: false, available: 0 });

  const inventoryOptions = useMemo(() => {
    return store.inventory
      .filter((i) => {
        if (isInbound) return true;
        return (i.quantity || 0) > 0;
      })
      .map((i) => ({
        ...i,
        name: getItemName(i, store.products, store.materials),
        code: getItemCode(i, store.products, store.materials),
        unit: getItemUnit(i, store.products, store.materials),
      }))
      .filter((i) => {
        const q = stockQuery.trim().toLowerCase();
        if (!q) return true;
        return i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q);
      })
      .slice(0, 50);
  }, [store.inventory, store.products, store.materials, stockQuery, isInbound]);

  const handleSelectItem = (item: Inventory & { name: string; code: string }) => {
    setForm((prev) => ({
      ...prev,
      itemId: item.id,
      productId: item.product_id,
      materialId: item.material_id,
      itemName: item.name,
      itemCode: item.code,
      warehouse: item.warehouse || prev.warehouse || warehouses[0] || "",
      locationId: item.location_id || "",
    }));
    setStockOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.itemId) {
      toast.error("请选择物料");
      return;
    }
    if (!form.warehouse) {
      toast.error("请选择仓库");
      return;
    }
    if (!form.locationId) {
      toast.error("请选择库位");
      return;
    }
    if (!form.quantity || form.quantity <= 0) {
      toast.error("请填写正确的数量");
      return;
    }
    if (!isInbound && form.quantity > availableInventory) {
      setShortage({ open: true, available: availableInventory });
      return;
    }
    if (!isInbound && (task.subType === "销售发货" || task.subType === "外协发料") && !form.logisticsCompany) {
      toast.error("请选择物流公司");
      return;
    }
    if (!isInbound && (task.subType === "销售发货" || task.subType === "外协发料") && !form.trackingNo) {
      toast.error("请填写物流单号");
      return;
    }

    setSubmitting(true);
    try {
      await performStockMovement(store, task, form, currentUserName, currentUserName);
      toast.success(isInbound ? "入库成功" : "出库成功");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error(isInbound ? "入库失败" : "出库失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 items-center gap-2 border-b border-border bg-card px-4">
        <button onClick={onBack} className="rounded-full p-2 active:bg-muted">
          <ArrowLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">
          确认{isInbound ? "入库" : "出库"}
        </h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-4 text-lg">
        <div className="space-y-2">
          <Label className="text-base text-muted-foreground">物料</Label>
          <Popover open={stockOpen} onOpenChange={setStockOpen}>
            <PopoverTrigger asChild>
              <button className="flex h-14 w-full items-center justify-between rounded-xl border border-border bg-card px-4 text-left text-lg active:border-primary">
                <span>{form.itemName || "搜索选择物料"}</span>
                <Search className="h-5 w-5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] border-border bg-card p-0 text-foreground">
              <Command className="bg-card">
                <CommandInput
                  placeholder="输入名称/编码搜索"
                  value={stockQuery}
                  onValueChange={setStockQuery}
                  className="h-12 text-lg"
                />
                <CommandList className="max-h-64">
                  <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">无匹配物料</CommandEmpty>
                  <CommandGroup>
                    {inventoryOptions.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => handleSelectItem(item)}
                        className="py-3 text-lg"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-5 w-5",
                            form.itemId === item.id ? "text-primary" : "text-transparent",
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          <span className="text-sm text-muted-foreground">{item.code} · {item.warehouse} · 库存 {item.quantity}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label className="text-base text-muted-foreground">{isInbound ? "入库仓库" : "出库仓库"}</Label>
          <Select
            value={form.warehouse}
            onValueChange={(v) => setForm((prev) => ({ ...prev, warehouse: v, locationId: "" }))}
          >
            <SelectTrigger className="h-14 rounded-xl border-border bg-card text-lg">
              <SelectValue placeholder="请选择仓库" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              {warehouses.map((w) => (
                <SelectItem key={w} value={w} className="text-lg">
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-base text-muted-foreground">{isInbound ? "入库库位" : "出库库位"}</Label>
          <Select
            value={form.locationId}
            onValueChange={(v) => setForm((prev) => ({ ...prev, locationId: v }))}
          >
            <SelectTrigger className="h-14 rounded-xl border-border bg-card text-lg">
              <SelectValue placeholder="请选择库位" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id} className="text-lg">
                  {l.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isInbound && form.locationId && (
            <div className="text-sm text-muted-foreground">
              当前库位可用库存：<span className="font-semibold text-primary">{availableInventory}</span>
            </div>
          )}
        </div>

        {!isInbound && (task.subType === "销售发货" || task.subType === "外协发料") && (
          <>
            <div className="space-y-2">
              <Label className="text-base text-muted-foreground">物流公司</Label>
              <Select
                value={form.logisticsCompany}
                onValueChange={(v) => setForm((prev) => ({ ...prev, logisticsCompany: v }))}
              >
                <SelectTrigger className="h-14 rounded-xl border-border bg-card text-lg">
                  <SelectValue placeholder="请选择物流公司" />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  {LOGISTICS_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o} className="text-lg">
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-base text-muted-foreground">物流单号</Label>
              <Input
                value={form.trackingNo}
                onChange={(e) => setForm((prev) => ({ ...prev, trackingNo: e.target.value }))}
                placeholder="手动输入物流单号"
                className="h-14 rounded-xl border-border bg-card text-lg"
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label className="text-base text-muted-foreground">本次{isInbound ? "入库" : "出库"}数量</Label>
          <Input
            type="number"
            min={1}
            value={form.quantity}
            onChange={(e) => setForm((prev) => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
            className="h-14 rounded-xl border-border bg-card text-lg"
          />
          <div className="text-sm text-muted-foreground">
            应{isInbound ? "入" : "出"}数：{task.pendingQty}
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-card p-4">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="h-14 w-full rounded-xl bg-primary text-lg font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {submitting ? "提交中..." : `确认${isInbound ? "入库" : "出库"}`}
        </Button>
      </div>

      <ShortageDialog
        open={shortage.open}
        onOpenChange={(v) => setShortage({ ...shortage, open: v })}
        available={shortage.available}
      />
    </div>
  );
}

/* ------------------------------------------------------------------
   后台联动：执行出入库并更新单据
------------------------------------------------------------------ */
async function performStockMovement(
  store: AppState,
  task: WarehouseTask,
  form: ConfirmForm,
  handler: string,
  inspector?: string,
) {
  const isInbound = task.type === "inbound";
  const record: StockRecord = {
    id: nanoid(),
    record_no: isInbound
      ? `IN-${Date.now().toString().slice(-6)}`
      : `OUT-${Date.now().toString().slice(-6)}`,
    type: isInbound ? "in" : "out",
    subtype: task.subType,
    product_id: form.productId || "",
    material_id: form.materialId || "",
    sku_id: form.skuId,
    quantity: form.quantity,
    warehouse: form.warehouse,
    location_id: form.locationId,
    related_order: task.sourceNo,
    related_order_id: task.sourceId,
    handler,
    record_date: new Date().toISOString().split("T")[0],
    remark: isInbound ? undefined : `${form.logisticsCompany || ""} ${form.trackingNo || ""}`.trim() || undefined,
  };

  await store.addStockRecord(record);

  // 更新库存
  const existing = store.inventory.find(
    (i) =>
      i.warehouse === form.warehouse &&
      i.location_id === form.locationId &&
      ((form.productId && i.product_id === form.productId) ||
        (form.materialId && i.material_id === form.materialId)) &&
      (!form.skuId || i.sku_id === form.skuId),
  );

  if (existing) {
    const updated: Inventory = {
      ...existing,
      quantity: isInbound ? existing.quantity + form.quantity : existing.quantity - form.quantity,
    };
    await store.updateInventory(updated);
  } else if (isInbound) {
    const newInventory: Inventory = {
      id: nanoid(),
      type: form.productId ? "product" : "material",
      product_id: form.productId,
      material_id: form.materialId,
      sku_id: form.skuId,
      warehouse: form.warehouse,
      location_id: form.locationId,
      quantity: form.quantity,
      min_stock: 0,
      max_stock: 999999,
    };
    await store.addInventory(newInventory);
  }

  // 更新来源单据
  if (task.subType === "采购到货") {
    const order = store.purchaseOrders.find((o) => o.id === task.sourceId);
    if (order) {
      const line = order.items.find((i) => i.material_code === task.itemCode);
      if (line) {
        // 创建到货记录并直接完成入库
        const arrivalCode = `PA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`;
        const arrivalItem = {
          ...line,
          stored_qty: form.quantity,
        };
        await store.addPurchaseArrival({
          id: nanoid(),
          code: arrivalCode,
          order_id: order.id,
          order_no: order.order_no,
          supplier_name: order.supplier_name,
          contract_no: order.contract_no,
          arrival_date: new Date().toISOString().slice(0, 10),
          inspector: inspector || "仓管员",
          status: form.quantity >= (line.quantity || 0) ? "stored" : "partial",
          items: [arrivalItem],
          warehouse: form.warehouse,
          location_id: form.locationId,
        });
        // 同步更新采购订单已入库数量及状态
        const orderItems = order.items.map((item) =>
          item.material_code === task.itemCode
            ? { ...item, stored_qty: (item.stored_qty || 0) + form.quantity }
            : item,
        );
        const totalQty = orderItems.reduce((s, i) => s + (i.quantity || 0), 0);
        const storedQty = orderItems.reduce((s, i) => s + (i.stored_qty || 0), 0);
        await store.updatePurchaseOrder({
          ...order,
          items: orderItems,
          status: storedQty >= totalQty ? "completed" : "partial",
        });
      }
    }
  } else if (task.subType === "生产完工") {
    const inbound = store.finishedGoodsInbounds.find((i) => i.id === task.sourceId);
    if (inbound) {
      await store.updateFinishedGoodsInbound({
        ...inbound,
        status: "inbound",
        warehouse: form.warehouse,
        location_id: form.locationId,
        inbound_date: new Date().toISOString().split("T")[0],
      });
    }
  } else if (task.subType === "生产领料") {
    const req = store.materialRequisitions.find((r) => r.id === task.sourceId);
    if (req) {
      const updatedItems = req.items.map((item, idx) => {
        if (`${req.id}-${idx}` === task.id) {
          return { ...item, issued_qty: (item.issued_qty || 0) + form.quantity };
        }
        return item;
      });
      const totalReq = updatedItems.reduce((s, i) => s + (i.required_qty || 0), 0);
      const totalIssued = updatedItems.reduce((s, i) => s + (i.issued_qty || 0), 0);
      await store.updateMaterialRequisition({
        ...req,
        items: updatedItems,
        status: totalIssued >= totalReq ? "completed" : "partial",
        total_issued_qty: totalIssued,
      });
    }
  } else if (task.subType === "销售发货") {
    const shipment = store.shipments.find((s) => s.id === task.sourceId);
    if (shipment) {
      const updatedItems = shipment.items.map((item, idx) => {
        if (`${shipment.id}-${idx}` === task.id) {
          return { ...item, shipped_quantity: (item.shipped_quantity || 0) + form.quantity };
        }
        return item;
      });
      const allShipped = updatedItems.every(
        (item) => (item.shipped_quantity || 0) >= (item.quantity || 0),
      );
      await store.updateShipment({
        ...shipment,
        items: updatedItems,
        status: allShipped ? "shipped" : "pending",
        logistics_company: form.logisticsCompany || shipment.logistics_company,
        tracking_no: form.trackingNo || shipment.tracking_no,
      });
      // 同步更新销售订单
      const order = store.salesOrders.find((o) => o.id === shipment.order_id);
      if (order) {
        const shippedQty = updatedItems.reduce((s, i) => s + (i.shipped_quantity || 0), 0);
        const orderQty = order.items.reduce((s, i) => s + (i.quantity || 0), 0);
        await store.updateSalesOrder({
          ...order,
          shipped_quantity: shippedQty,
          status: shippedQty >= orderQty ? "completed" : order.status,
        });
      }
    }
  } else if (task.subType === "外协发料") {
    const dispatch = store.outsourcingDispatches.find((d) => d.id === task.sourceId);
    if (dispatch) {
      await store.updateOutsourcingDispatch({
        ...dispatch,
        status: "dispatched",
      });
    }
  }
}

/* ------------------------------------------------------------------
   库存不足全屏提示
------------------------------------------------------------------ */
function ShortageDialog({ open, onOpenChange, available }: { open: boolean; onOpenChange: (v: boolean) => void; available: number }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] border-destructive bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-destructive">
            <AlertTriangle className="h-6 w-6" />
            库存不足
          </DialogTitle>
        </DialogHeader>
        <div className="py-6 text-center text-2xl font-bold text-foreground">
          当前库位可用库存为 {available}
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="h-14 w-full rounded-xl border-destructive text-lg font-semibold text-destructive hover:bg-destructive/10"
          >
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------
   成功弹窗
------------------------------------------------------------------ */
function SuccessDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl text-foreground">操作成功</DialogTitle>
        <DialogDescription className="text-muted-foreground">
          库存与单据已同步更新
        </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary text-primary">
            <Check className="h-8 w-8" />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            保存并继续
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

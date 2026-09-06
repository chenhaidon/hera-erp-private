import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useVisibleTabs } from "@/lib/moduleVisibility";
import { syncSalesOrderStatusFromProduction } from "@/lib/production";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { useAppStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { nanoid, getProductBomsBySku, formatBeijingTime, extractSkuColor, resolveColorMaterial } from "@/lib/utils";
import {
  AlertCircle,
  Layers,
  Calendar,
  BarChart3,
  Plus,
  Trash2,
  Pencil,
  Eye,
  CheckCircle,
  XCircle,
  ClipboardCheck,
  Play,
  Package,
  Users,
  Settings2,
  Sparkles,
  Calculator,
  Search,
  Factory,
} from "lucide-react";
import type {
  SalesOrder,
  ProductionPlan,
  ProductionPlanOrder,
  ProductionPlanOperation,
  ProductionPlanSkuItem,
  WorkOrder,
  Material,
  MRPRequirement,
  Product,
  ProcessRoute,
  PurchaseRequest,
  MaterialRequisition,
  ProductionLine,
  ProductionLineEquipment,
  Equipment,
} from "@/types";
import { ProductionLinePage } from "@/pages/ProductionLinePage";

const WORK_HOURS_PER_DAY = 8;
const WORK_DAYS_PER_WEEK = 5;

interface OrderItemSummary {
  label: string;
  specs: string[];
}

function summarizeOrderItems(
  items?: { product_name: string; sku_summary?: string; quantity: number; unit?: string }[],
): OrderItemSummary {
  if (!items || items.length === 0) return { label: "-", specs: [] };
  const uniqueNames = Array.from(new Set(items.map((i) => i.product_name)));
  const firstName = uniqueNames[0];
  if (uniqueNames.length === 1) {
    return {
      label: `${firstName} (共 ${items.length} 种规格)`,
      specs: items.map(
        (i) => `${i.sku_summary || "默认规格"}: ${i.quantity}${i.unit || "件"}`,
      ),
    };
  }
  return {
    label: `${firstName} 等 (共 ${items.length} 种规格)`,
    specs: items.map(
      (i) =>
        `${i.product_name} ${i.sku_summary || "默认规格"}: ${i.quantity}${i.unit || "件"}`,
    ),
  };
}

const PLAN_STATUS = {
  draft: "未下发",
  pending: "待审核",
  approved: "已审核",
  published: "已发布",
  executing: "执行中",
  completed: "已完成",
};

const WORK_ORDER_STATUS = {
  待排产: "default",
  已下发: "secondary",
  生产中: "outline",
  待质检: "destructive",
  已完成: "default",
  已结案: "default",
};

const PRODUCTION_LINES = ["A线", "B线"];

// 基于产线设备总数、计划天数、每天8小时计算产能负荷
function calculateLoadRate(
  totalHours: number,
  devices: number,
  days = 7,
  workHours = 8,
) {
  if (devices <= 0) return 100;
  return (totalHours / (devices * days * workHours)) * 100;
}

function calculateBottleneckLoadRate(
  bottleneckHours: number,
  devices = 4,
  workHours = 40,
) {
  return (bottleneckHours / (devices * workHours)) * 100;
}

function getTotalEquipmentCount(
  productionLines: ProductionLine[],
  equipments: ProductionLineEquipment[],
  allEquipment: Equipment[],
  excludeMaintenance = true,
) {
  return productionLines.reduce((sum, line) => {
    const lineEquipmentIds = new Set(
      equipments
        .filter((e) => e.production_line_id === line.id)
        .map((e) => e.equipment_id),
    );
    const lineEquipments = allEquipment.filter((e) => lineEquipmentIds.has(e.id));
    const availableCount = excludeMaintenance
      ? lineEquipments.filter((e) => e.status !== "maintenance").length
      : lineEquipments.length;
    return sum + availableCount;
  }, 0);
}

function getAvailableEquipmentCount(
  productionLineId: string,
  equipments: ProductionLineEquipment[],
  allEquipment: Equipment[],
) {
  const lineEquipmentIds = new Set(
    equipments
      .filter((e) => e.production_line_id === productionLineId)
      .map((e) => e.equipment_id),
  );
  const lineEquipments = allEquipment.filter((e) => lineEquipmentIds.has(e.id));
  return lineEquipments.filter((e) => e.status !== "maintenance").length;
}

function getProductStandardHours(product: Product, routes: ProcessRoute[]) {
  const route = routes.find(
    (r) => r.category === product.category && r.status === "active",
  );
  return route?.steps.reduce((sum, s) => sum + s.hours, 0) || 0;
}

export function PlanningPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeTab, setActiveTab, visibleTabKeys } = useVisibleTabs("/planning", "pool");
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && visibleTabKeys.includes(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, visibleTabKeys, activeTab, setActiveTab]);

  function updateTabParam(tab: string) {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === "pool") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="计划排程"
        description="订单池、主生产计划、工序排产、轻量化 MRP 与产线管理"
      />
      <ControlledTabs
        modulePath="/planning"
        defaultTab="pool"
        activeTab={activeTab}
        onActiveTabChange={updateTabParam}
      >
        <TabsList className="w-full flex-wrap justify-start md:w-auto">
          <TabsTrigger value="pool" className="gap-2">
            <Layers className="h-4 w-4" />
            订单池
          </TabsTrigger>
          <TabsTrigger value="mps" className="gap-2">
            <Calendar className="h-4 w-4" />
            主生产计划
          </TabsTrigger>
          <TabsTrigger value="gantt" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            工序排产
          </TabsTrigger>
          <TabsTrigger value="mrp" className="gap-2">
            <Package className="h-4 w-4" />
            轻量化 MRP
          </TabsTrigger>
          <TabsTrigger value="production-line" className="gap-2">
            <Factory className="h-4 w-4" />
            产线管理
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pool">
          <OrderPoolTab />
        </TabsContent>
        <TabsContent value="mps">
          <MPSTab />
        </TabsContent>
        <TabsContent value="gantt">
          <GanttTab />
        </TabsContent>
        <TabsContent value="mrp">
          <MRPTab />
        </TabsContent>
        <TabsContent value="production-line">
          <ProductionLinePage />
        </TabsContent>
      </ControlledTabs>
    </div>
  );
}

function OrderPoolTab() {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [groupBy, setGroupBy] = useState<
    "none" | "category" | "customer" | "pattern"
  >("none");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [urgentOnly, setUrgentOnly] = useState(false);

  const plannedOrderIds = useMemo(() => {
    const ids = new Set<string>();
    store.productionPlans.forEach((p) =>
      (p.orders || []).forEach((o) => ids.add(o.order_id)),
    );
    return ids;
  }, [store.productionPlans]);

  const basePool = useMemo(() => {
    return store.salesOrders
      .filter(
        (o) =>
          ["confirmed", "approved"].includes(o.status) &&
          !plannedOrderIds.has(o.id),
      )
      .sort(
        (a, b) =>
          new Date(a.delivery_date).getTime() -
          new Date(b.delivery_date).getTime(),
      );
  }, [store.salesOrders, plannedOrderIds]);

  const orderPool = useMemo(() => {
    return basePool.filter((o) => {
      if (
        search &&
        !o.order_no.toLowerCase().includes(search.toLowerCase()) &&
        !o.customer_name.includes(search)
      )
        return false;
      if (customerFilter !== "all" && o.customer_id !== customerFilter)
        return false;
      if (
        productFilter !== "all" &&
        !o.items.some(
          (i) =>
            i.product_id === productFilter || i.product_code === productFilter,
        )
      )
        return false;
      if (startDate && new Date(o.delivery_date) < new Date(startDate))
        return false;
      if (endDate && new Date(o.delivery_date) > new Date(endDate))
        return false;
      if (urgentOnly && !isUrgent(o)) return false;
      return true;
    });
  }, [
    basePool,
    search,
    customerFilter,
    productFilter,
    startDate,
    endDate,
    urgentOnly,
  ]);

  function isUrgent(order: SalesOrder) {
    const days = Math.ceil(
      (new Date(order.delivery_date).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    );
    return days <= 7;
  }

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function groupKey(order: SalesOrder) {
    if (groupBy === "category")
      return (
        order.items?.[0]?.product_name?.split("").slice(0, 2).join("") ||
        "未分类"
      );
    if (groupBy === "customer") return order.customer_name;
    if (groupBy === "pattern")
      return order.items?.[0]?.product_name || "未指定";
    return "";
  }

  const grouped = useMemo(() => {
    if (groupBy === "none") return { 全部订单: orderPool };
    const map: Record<string, SalesOrder[]> = {};
    orderPool.forEach((o) => {
      const key = groupKey(o);
      if (!map[key]) map[key] = [];
      map[key].push(o);
    });
    return map;
  }, [orderPool, groupBy]);

  // 智能合并建议：按产品 + 交货期窗口（±3天）分组
  const mergeSuggestions = useMemo(() => {
    const map: Record<string, SalesOrder[]> = {};
    orderPool.forEach((o) => {
      const productCode = o.items?.[0]?.product_code || "未知";
      const delivery = new Date(o.delivery_date);
      const week = `${productCode}#${delivery.getFullYear()}-${String(delivery.getMonth() + 1).padStart(2, "0")}-W${Math.ceil(delivery.getDate() / 7)}`;
      if (!map[week]) map[week] = [];
      map[week].push(o);
    });
    return Object.entries(map).filter(([, orders]) => orders.length >= 2);
  }, [orderPool]);

  function applySuggestion(orders: SalesOrder[]) {
    setSelected(new Set(orders.map((o) => o.id)));
  }

  function capacityCheck(orders: SalesOrder[]): {
    ok: boolean;
    message: string;
    loadRate: number;
  } {
    const productMap = new Map<
      string,
      { product: Product; quantity: number }
    >();
    orders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const product = store.products.find((p) => p.id === it.product_id);
        if (!product) return;
        const entry = productMap.get(product.id);
        if (entry) {
          entry.quantity += it.quantity;
        } else {
          productMap.set(product.id, { product, quantity: it.quantity });
        }
      });
    });
    if (productMap.size === 0)
      return { ok: false, message: "未找到有效的产品信息", loadRate: 0 };
    const deviceCount = getTotalEquipmentCount(
      store.productionLines,
      store.productionLineEquipments,
      store.equipment,
    );
    if (deviceCount === 0)
      return { ok: false, message: "未配置产线设备，请先到产线管理配置设备", loadRate: 0 };
    // 默认按 7 天计划周期计算产能
    const days = 7;
    let totalLoadRate = 0;
    productMap.forEach(({ product, quantity }) => {
      const standardHours = getProductStandardHours(
        product,
        store.processRoutes,
      );
      totalLoadRate += calculateLoadRate(standardHours * quantity, deviceCount, days);
    });
    if (totalLoadRate > 100)
      return {
        ok: false,
        message: `合并后排产总产能负荷预估值 ${totalLoadRate.toFixed(1)}% 超过 100%，建议拆分或延长工期`,
        loadRate: totalLoadRate,
      };
    return { ok: true, message: "产能校验通过", loadRate: totalLoadRate };
  }

  function createMergedPlan() {
    const orders = orderPool.filter((o) => selected.has(o.id));
    if (orders.length === 0) return;
    const check = capacityCheck(orders);
    if (!check.ok) {
      toast.warning(check.message);
      return;
    }

    type ProductGroup = {
      product: Product;
      skuMap: Map<string, ProductionPlanSkuItem>;
      orderMap: Map<string, ProductionPlanOrder>;
    };
    const productGroups = new Map<string, ProductGroup>();

    orders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const product = store.products.find((p) => p.id === it.product_id);
        if (!product) return;
        if (!productGroups.has(product.id)) {
          productGroups.set(product.id, {
            product,
            skuMap: new Map(),
            orderMap: new Map(),
          });
        }
        const group = productGroups.get(product.id)!;

        if (!group.orderMap.has(o.id)) {
          group.orderMap.set(o.id, {
            order_id: o.id,
            order_no: o.order_no,
            customer_name: o.customer_name,
            quantity: 0,
          });
        }
        group.orderMap.get(o.id)!.quantity += it.quantity;

        const defaultSkuId = product.skus?.[0]?.id || "";
        const skuId = it.sku_id || defaultSkuId;
        const skuKey = skuId || `${it.product_id}-default`;
        if (!group.skuMap.has(skuKey)) {
          const sku = product.skus?.find((s) => s.id === skuId);
          group.skuMap.set(skuKey, {
            sku_id: skuId,
            sku_summary:
              it.sku_summary ||
              sku?.barcode ||
              sku?.size ||
              sku?.specification ||
              "默认规格",
            product_id: product.id,
            product_code: product.code,
            product_name: product.name,
            quantity: 0,
            unit: it.unit,
            source_order_ids: [],
            source_order_nos: [],
          });
        }
        const skuItem = group.skuMap.get(skuKey)!;
        skuItem.quantity += it.quantity;
        if (!skuItem.source_order_ids.includes(o.id)) {
          skuItem.source_order_ids.push(o.id);
          skuItem.source_order_nos.push(o.order_no);
        }
      });
    });

    if (productGroups.size === 0) {
      toast.warning("未找到有效的产品信息");
      return;
    }

    const createdPlans: ProductionPlan[] = [];
    productGroups.forEach(({ product, skuMap, orderMap }) => {
      const skuItems = Array.from(skuMap.values());
      const quantity = skuItems.reduce((sum, it) => sum + it.quantity, 0);
      const route =
        product.process_steps && product.process_steps.length > 0
          ? {
              id: product.route_binding?.route_id || '',
              name: product.name + '工艺路线',
              steps: product.process_steps,
            }
          : store.processRoutes.find(
              (r) => r.category === product.category && r.status === "active",
            );
      const version = store.processVersions.find(
        (v) => v.route_id === route?.id && v.status === "active",
      );
      const routeStub = route
        ? {
            id: route.id,
            name: route.name,
            steps: route.steps.map((s) => ({
              seq: s.seq,
              code: s.code,
              name: s.name,
              hours: s.hours,
              device: s.device,
              skill: s.skill,
              is_bottleneck: !!s.is_bottleneck,
            })),
          }
        : undefined;
      const plan = buildPlanFromOrders(
        product,
        quantity,
        Array.from(orderMap.values()),
        routeStub,
        version,
        skuItems,
        currentUserName,
        store.productionLines,
        store.productionLineEquipments,
        store.equipment,
      );
      store.addProductionPlan(plan);
      createdPlans.push(plan);
    });

    const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");
    orders.forEach((o) => {
      store.updateSalesOrder({
        ...o,
        status: "planned",
        logs: [
          ...(o.logs || []),
          {
            status: "planned",
            operator: currentUserName,
            time: nowStr,
            remark: `订单池合并排产，生成主生产计划 ${createdPlans.map((p) => p.plan_no).join(", ")}`,
          },
        ],
      });
    });

    toast.success(
      `已生成 ${createdPlans.length} 张主生产计划：${createdPlans.map((p) => p.plan_no).join(", ")}`,
    );
    setSelected(new Set());
  }

  const selectedOrders = orderPool.filter((o) => selected.has(o.id));
  const check =
    selectedOrders.length > 0
      ? capacityCheck(selectedOrders)
      : { ok: true, message: "请选择订单", loadRate: 0 };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">待排产订单池</CardTitle>
            <p className="text-xs text-muted-foreground">
              共 {orderPool.length} 条待排产订单，{mergeSuggestions.length}{" "}
              组可智能合并
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="搜索订单/客户"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44"
            />
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="筛选客户" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部客户</SelectItem>
                {store.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="筛选产品" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部产品</SelectItem>
                {store.products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={groupBy}
              onValueChange={(v) => setGroupBy(v as typeof groupBy)}
            >
              <SelectTrigger className="w-28">
                <SelectValue placeholder="归集" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不归集</SelectItem>
                <SelectItem value="category">按类别</SelectItem>
                <SelectItem value="customer">按客户</SelectItem>
                <SelectItem value="pattern">按花型</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs">
            <span className="text-muted-foreground">交期范围</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-7 w-32 text-xs"
            />
            <span className="text-muted-foreground">~</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-7 w-32 text-xs"
            />
            <div className="flex items-center gap-1 ml-2">
              <Checkbox
                id="urgent-only"
                checked={urgentOnly}
                onCheckedChange={(v) => setUrgentOnly(!!v)}
              />
              <Label htmlFor="urgent-only" className="font-normal text-xs">
                仅看紧急
              </Label>
            </div>
          </div>
          {mergeSuggestions.length > 0 && (
            <div className="border-b px-4 py-2 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                智能合并建议
              </div>
              <div className="flex flex-wrap gap-2">
                {mergeSuggestions.map(([key, orders]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant="outline"
                    onClick={() => applySuggestion(orders)}
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    {orders[0].items?.[0]?.product_name} · {orders.length} 单 ·
                    实际交期 {orders[0].delivery_date}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap w-10">
                    <Checkbox
                      checked={
                        selected.size > 0 && selected.size === orderPool.length
                      }
                      onCheckedChange={(v) =>
                        setSelected(
                          new Set(v ? orderPool.map((o) => o.id) : []),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead className="whitespace-nowrap">订单编号</TableHead>
                  <TableHead className="whitespace-nowrap">客户</TableHead>
                  <TableHead className="whitespace-nowrap">产品</TableHead>
                  <TableHead className="whitespace-nowrap">数量</TableHead>
                  <TableHead className="whitespace-nowrap">实际交货日期</TableHead>
                  <TableHead className="whitespace-nowrap">剩余天数</TableHead>
                  <TableHead className="whitespace-nowrap">紧急程度</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(grouped).map(([group, orders]) =>
                  orders.map((o, idx) => {
                    const urgent = isUrgent(o);
                    const remainingDays = Math.ceil(
                      (new Date(o.delivery_date).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24),
                    );
                    return (
                      <TableRow
                        key={o.id}
                        className={urgent ? "bg-red-50" : ""}
                      >
                        {idx === 0 && groupBy !== "none" && (
                          <TableCell
                            className="whitespace-nowrap bg-muted font-medium"
                            rowSpan={orders.length}
                          >
                            {group}
                          </TableCell>
                        )}
                        {groupBy === "none" && (
                          <TableCell className="whitespace-nowrap">
                            <Checkbox
                              checked={selected.has(o.id)}
                              onCheckedChange={() => toggleSelect(o.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium whitespace-nowrap">
                          {o.order_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {o.customer_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {(() => {
                            const summary = summarizeOrderItems(o.items);
                            if (summary.specs.length === 0)
                              return <span className="text-muted-foreground">-</span>;
                            return (
                              <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help border-b border-dashed border-muted-foreground">
                                      {summary.label}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    align="start"
                                    className="max-w-xs"
                                  >
                                    <div className="space-y-1">
                                      {summary.specs.map((s, idx) => (
                                        <div key={idx} className="text-sm">
                                          {s}
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {o.items?.reduce((sum, i) => sum + i.quantity, 0)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {["shipped", "completed"].includes(o.status)
                            ? o.delivery_date || "-"
                            : "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span
                            className={
                              remainingDays <= 7
                                ? "text-destructive font-medium"
                                : ""
                            }
                          >
                            {remainingDays} 天
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {urgent ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                              <AlertCircle className="h-3 w-3" /> 紧急
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              正常
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  }),
                )}
                {orderPool.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="p-4 text-center text-muted-foreground"
                    >
                      暂无待排产订单
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            <span className="font-medium">已选 {selectedOrders.length} 单</span>
            {selectedOrders.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                {check.ok ? (
                  <span className="text-emerald-600">产能校验通过</span>
                ) : (
                  <span className="text-destructive">{check.message}</span>
                )}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || !check.ok}
            onClick={createMergedPlan}
          >
            合并排产
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MPSTab() {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [searchParams, setSearchParams] = useSearchParams();
  const [planSearch, setPlanSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionPlan | null>(null);
  const [detail, setDetail] = useState<ProductionPlan | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalPlan, setApprovalPlan] = useState<ProductionPlan | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "reject" | "publish";
    plan: ProductionPlan;
  } | null>(null);
  const [publishing, setPublishing] = useState(false);

  // 现有库存按库存台账聚合
  const stockMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    store.inventory.forEach((inv) => {
      if (inv.type !== "material" || !inv.material_id) return;
      map[inv.material_id] = (map[inv.material_id] || 0) + inv.quantity;
    });
    return map;
  }, [store.inventory]);

  async function publishPlan(p: ProductionPlan) {
    if (p.status === "published" || p.status === "executing" || p.work_orders.length > 0) {
      toast.warning("该计划已发布，无法重复生成工单");
      return;
    }
    const product = store.products.find((x) => x.id === p.product_id);
    const route = store.processRoutes.find((r) => r.id === p.route_id);
    let skuItems = p.sku_items?.length ? p.sku_items : undefined;

    // 兼容旧计划：没有 SKU 明细但关联了销售订单时，从订单 items 重建 SKU 明细
    if (!skuItems && p.orders?.length) {
      const map = new Map<string, ProductionPlanSkuItem>();
      p.orders.forEach((o) => {
        const so = store.salesOrders.find((s) => s.id === o.order_id);
        (so?.items || []).forEach((it) => {
          if (it.product_id !== p.product_id) return;
          const defaultSkuId = product?.skus?.[0]?.id || "";
          const skuId = it.sku_id || defaultSkuId;
          const key = skuId || `${p.product_id}-default`;
          if (!map.has(key)) {
            map.set(key, {
              sku_id: skuId,
              sku_summary:
                it.sku_summary ||
                product?.skus?.find((s) => s.id === skuId)?.barcode ||
                product?.skus?.find((s) => s.id === skuId)?.size ||
                product?.skus?.find((s) => s.id === skuId)?.specification ||
                "默认规格",
              product_id: p.product_id,
              product_code: p.product_code,
              product_name: p.product_name,
              quantity: 0,
              unit: it.unit,
              source_order_ids: [],
              source_order_nos: [],
            });
          }
          const item = map.get(key)!;
          item.quantity += it.quantity;
          if (!item.source_order_ids.includes(o.order_id)) {
            item.source_order_ids.push(o.order_id);
            item.source_order_nos.push(o.order_no);
          }
        });
      });
      if (map.size > 0) skuItems = Array.from(map.values());
    }

    const workNoBase = `WO-${new Date().getFullYear()}-${String(store.workOrders.length + 1).padStart(4, "0")}`;
    const createdWorkNos: string[] = [];

    function buildWorkOrder(
      quantity: number,
      skuId?: string,
      skuSummary?: string,
      seqIndex = 0,
    ): WorkOrder {
      const workNo = skuItems
        ? `${workNoBase}-${seqIndex + 1}`
        : workNoBase;
      createdWorkNos.push(workNo);
      return {
        id: nanoid(),
        work_no: workNo,
        plan_id: p.id,
        product_id: p.product_id,
        product_code: p.product_code,
        product_name: skuSummary
          ? `${p.product_name} - ${skuSummary}`
          : p.product_name,
        product_category: p.category,
        product_images: product?.images || [],
        sku_id: skuId,
        sku_summary: skuSummary,
        plan_quantity: quantity,
        completed_quantity: 0,
        progress: 0,
        status: "issued",
        picking_status: "pending",
        source: "plan",
        priority: "medium",
        created_at: new Date().toISOString().slice(0, 16).replace("T", " "),
        issued_at: new Date().toISOString().slice(0, 16).replace("T", " "),
        operations: p.operations.map((op) => {
          const step = route?.steps.find((s) => s.code === op.code);
          return {
            seq: op.seq,
            code: op.code,
            name: op.name,
            plan_qty: quantity,
            completed_qty: 0,
            status: "pending",
            completed: false,
            device: op.device,
            skill: op.skill,
            category: op.category,
            outsourcing_price: op.category === "outsourcing" ? step?.price : undefined,
            params: step?.quilt_params
              ? {
                  needle_density: step.quilt_params.needle_density || "",
                  pattern: step.quilt_params.pattern || "",
                }
              : undefined,
          };
        }),
      };
    }

    if (skuItems && skuItems.length > 0) {
      // 严格按 MPS 的 SKU 明细行拆分工单，每个规格独立成单
      for (const [idx, it] of skuItems.entries()) {
        const wo = buildWorkOrder(it.quantity, it.sku_id, it.sku_summary, idx);
        await store.addWorkOrder(wo);
        store.setWorkOrderCosts([
          ...store.workOrderCosts,
          {
            work_id: wo.id,
            fabric: it.quantity * 12,
            lining: it.quantity * 3.5,
            filling: it.quantity * 8,
            accessory: it.quantity * 1.2,
            labor: 0,
            overhead: it.quantity * 2.1,
            planned: it.quantity * 26.8,
          },
        ]);
      }
    } else {
      // 无 SKU 明细的旧计划：按整体计划数量生成单张工单
      const wo = buildWorkOrder(p.plan_quantity);
      await store.addWorkOrder(wo);
      store.setWorkOrderCosts([
        ...store.workOrderCosts,
        {
          work_id: wo.id,
          fabric: p.plan_quantity * 12,
          lining: p.plan_quantity * 3.5,
          filling: p.plan_quantity * 8,
          accessory: p.plan_quantity * 1.2,
          labor: 0,
          overhead: p.plan_quantity * 2.1,
          planned: p.plan_quantity * 26.8,
        },
      ]);
    }

    store.updateProductionPlan({
      ...p,
      status: "published",
      work_orders: [...p.work_orders, ...createdWorkNos],
    });
    syncSalesOrderStatusFromProduction(store);
  }

  function approvePlan(p: ProductionPlan) {
    if (p.status !== "pending") return;
    store.updateProductionPlan({
      ...p,
      status: "approved",
      approver: currentUserName,
      approved_at: new Date().toISOString().slice(0, 16).replace("T", " "),
    });
  }

  function rejectPlan(p: ProductionPlan) {
    if (p.status !== "pending") return;
    store.updateProductionPlan({ ...p, status: "draft" });
  }

  function mrpPreCheck(p: ProductionPlan): {
    ok: boolean;
    gaps: { material_name: string; gap: number; unit: string }[];
  } {
    const product = store.products.find((x) => x.id === p.product_id);
    if (!product) return { ok: true, gaps: [] };
    const gaps: { material_name: string; gap: number; unit: string }[] = [];
    // 生产计划尚未关联 SKU，默认使用首个 SKU 的 BOM 进行预检
    getProductBomsBySku(product).forEach((bom) => {
      const required = bom.dosage * p.plan_quantity;
      const stock = stockMap[bom.material_id] ?? 0;
      const gap = Math.max(0, required - stock);
      if (gap > 0)
        gaps.push({ material_name: bom.material_name, gap, unit: bom.unit });
    });
    return { ok: gaps.length === 0, gaps };
  }

  async function publishWithCheck(p: ProductionPlan) {
    if (publishing) return;
    setPublishing(true);
    const check = mrpPreCheck(p);
    if (!check.ok) {
      const gapText = check.gaps
        .map((g) => `${g.material_name} 缺 ${g.gap}${g.unit}`)
        .join("、");
      toast.warning(
        `发布前物料预检未通过：${gapText}。建议先补充库存或生成采购订单后再发布。`,
      );
      setPublishing(false);
      return;
    }
    try {
      await publishPlan(p);
    } finally {
      setPublishing(false);
    }
  }

  const filteredProductionPlans = useMemo(() => {
    const kw = planSearch.trim().toLowerCase();
    if (!kw) return store.productionPlans;
    return store.productionPlans.filter((p) =>
      [p.plan_no, p.contract_no, p.product_name, p.product_code, p.production_line]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(kw)),
    );
  }, [store.productionPlans, planSearch]);

  const {
    paginatedItems: store_productionPlansPaginated,
    currentPage: store_productionPlansCurrentPage,
    pageSize: store_productionPlansPageSize,
    totalPages: store_productionPlansTotalPages,
    totalItems: store_productionPlansTotalItems,
    setPage: setStore_productionPlansPage,
    setPageSize: setStore_productionPlansPageSize,
  } = usePagination(filteredProductionPlans);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索计划编号/合同编号/产品/产线"
            className="pl-9"
            value={planSearch}
            onChange={(e) => {
              setPlanSearch(e.target.value);
              setStore_productionPlansPage(1);
            }}
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          新建主生产计划
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">计划编号</TableHead>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">产品</TableHead>
                <TableHead className="whitespace-nowrap">计划产量</TableHead>
                <TableHead className="whitespace-nowrap">起止日期</TableHead>
                <TableHead className="whitespace-nowrap">分配产线</TableHead>
                <TableHead className="whitespace-nowrap">产能负荷</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store_productionPlansPaginated.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {p.plan_no}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-sm text-primary">
                    {p.contract_no || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {(() => {
                      const items = p.sku_items || [];
                      if (items.length <= 1) return p.product_name;
                      const label = `${p.product_name} (共 ${items.length} 种规格)`;
                      return (
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dashed border-muted-foreground">
                                {label}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              align="start"
                              className="max-w-xs"
                            >
                              <div className="space-y-1">
                                {items.map((it, idx) => (
                                  <div key={idx} className="text-sm">
                                    {it.sku_summary || "默认规格"}: {it.quantity}
                                    {it.unit || "件"}
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.plan_quantity}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.start_date} ~ {p.end_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.production_line || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {(() => {
                      const loadRate = Number(p.load_rate) || 0;
                      return (
                    <div className="flex items-center gap-2">
                      <Progress
                        value={Math.min(loadRate, 100)}
                        className="h-2 w-20"
                      />
                      <span
                        className={`text-xs ${loadRate > 100 ? "text-destructive font-semibold" : ""}`}
                      >
                        {loadRate.toFixed(1)}%
                      </span>
                    </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        p.status === "approved" ? "default" : "secondary"
                      }
                    >
                      {PLAN_STATUS[p.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDetail(p)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {p.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(p);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {p.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="提交审核"
                          onClick={() => {
                            setApprovalPlan(p);
                            setApprovalOpen(true);
                          }}
                        >
                          <ClipboardCheck className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="删除"
                            disabled={
                              p.status === "published" ||
                              p.status === "executing"
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              确认删除主生产计划？
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              删除后无法恢复，请确认。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => store.deleteProductionPlan(p.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {p.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="审核通过"
                          onClick={() =>
                            setConfirmAction({ type: "approve", plan: p })
                          }
                        >
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {p.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="驳回"
                          onClick={() =>
                            setConfirmAction({ type: "reject", plan: p })
                          }
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      {p.status === "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="发布并生成工单"
                          onClick={() =>
                            setConfirmAction({ type: "publish", plan: p })
                          }
                        >
                          <Play className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="MRP 算料"
                        onClick={() => {
                          const next = new URLSearchParams(searchParams);
                          next.set("tab", "mrp");
                          next.set("planId", p.id);
                          setSearchParams(next, { replace: true });
                        }}
                      >
                        <Calculator className="h-4 w-4 text-primary" />
                      </Button>

                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            currentPage={store_productionPlansCurrentPage}
            totalPages={store_productionPlansTotalPages}
            pageSize={store_productionPlansPageSize}
            totalItems={store_productionPlansTotalItems}
            onPageChange={setStore_productionPlansPage}
            onPageSizeChange={setStore_productionPlansPageSize}
          />
        </CardContent>
      </Card>
      <PlanDialog
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
      />
      <PlanDetailDialog plan={detail} onClose={() => setDetail(null)} />
      <ApprovalDialog
        key={approvalPlan?.id}
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        plan={approvalPlan}
      />
      <ConfirmActionDialog
        open={!!confirmAction}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        title={
          confirmAction?.type === "approve"
            ? "审核主生产计划"
            : confirmAction?.type === "reject"
              ? "驳回主生产计划"
              : "发布主生产计划"
        }
        description={
          confirmAction?.type === "approve"
            ? "请确认是否审核通过该主生产计划，审核通过后计划将拆解为生产工单并下发至车间。"
            : confirmAction?.type === "reject"
              ? "驳回后计划将退回草稿状态，请确认。"
              : "请确认是否发布该主生产计划，发布后将自动生成生产工单。"
        }
        items={
          confirmAction
            ? [
                { label: "计划编号", value: confirmAction.plan.plan_no },
                { label: "合同编号", value: confirmAction.plan.contract_no || "-" },
                { label: "产品", value: confirmAction.plan.product_name },
                { label: "计划产量", value: confirmAction.plan.plan_quantity },
                {
                  label: "当前状态",
                  value: PLAN_STATUS[confirmAction.plan.status],
                },
              ]
            : []
        }
        confirmText={
          confirmAction?.type === "approve"
            ? "确认通过"
            : confirmAction?.type === "reject"
              ? "确认驳回"
              : "确认发布"
        }
        confirmVariant={
          confirmAction?.type === "reject" ? "destructive" : "default"
        }
        confirmDisabled={publishing}
        onConfirm={() => {
          if (!confirmAction || publishing) return;
          const { type, plan } = confirmAction;
          if (type === "approve") approvePlan(plan);
          else if (type === "reject") rejectPlan(plan);
          else if (type === "publish") publishWithCheck(plan);
          setConfirmAction(null);
        }}
      />
    </div>
  );
}

function ApprovalDialog({
  open,
  onClose,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  plan: ProductionPlan | null;
}) {
  const store = useAppStore();
  const [line, setLine] = useState(plan?.production_line || "A线");
  const [note, setNote] = useState(plan?.approval_note || "");

  function submit() {
    if (!plan) return;
    store.updateProductionPlan({
      ...plan,
      status: "pending",
      production_line: line,
      approval_note: note,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>计划审核调整</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">计划编号</span>
              <span className="font-medium">{plan?.plan_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">合同编号</span>
              <span className="font-medium">{plan?.contract_no || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">产品</span>
              <span className="font-medium">{plan?.product_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">计划数量</span>
              <span className="font-medium">{plan?.plan_quantity} 件</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>分配产线</Label>
            <Select value={line} onValueChange={setLine}>
              <SelectTrigger>
                <SelectValue placeholder="选择产线" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A线">A线</SelectItem>
                <SelectItem value="B线">B线</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              调整备注{" "}
              <span className="text-muted-foreground font-normal">
                （可选）
              </span>
            </Label>
            <Textarea
              placeholder="例如：优先生产紧急款式，调整至首班次..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <div className="rounded-md bg-yellow-50 text-yellow-800 p-3 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              提交后状态变为「审核中」，计划员可继续修改，最终点击「发布」后才推送
              MRP 与工序排产。
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={submit}>
              <ClipboardCheck className="mr-1 h-4 w-4" />
              提交审核
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: ProductionPlan | null;
}) {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [form, setForm] = useState<Partial<ProductionPlan>>(() =>
    editing
      ? { ...editing }
      : { cycle: "week", workers: 40, devices: 10, work_hours: 40 },
  );

  const selectedProduct = store.products.find((p) => p.id === form.product_id);
  const selectedRoute = store.processRoutes.find((r) => r.id === form.route_id);

  function defaultRouteAndVersion(productId: string) {
    const product = store.products.find((p) => p.id === productId);
    const route = store.processRoutes.find(
      (r) => r.category === product?.category && r.status === "active",
    );
    const version = store.processVersions.find(
      (v) => v.route_id === route?.id && v.status === "active",
    );
    return { route, version };
  }

  function computeRates(
    plan: Partial<ProductionPlan>,
  ): Partial<ProductionPlan> {
    const product = store.products.find((p) => p.id === plan.product_id);
    if (!product) return plan;
    const { route, version } = defaultRouteAndVersion(plan.product_id!);
    const productSteps = product.process_steps;
    const actualRoute =
      (productSteps && productSteps.length > 0
        ? {
            id: product.route_binding?.route_id || route?.id || '',
            name: route?.name || '',
            steps: productSteps,
          }
        : undefined) ||
      store.processRoutes.find((r) => r.id === plan.route_id) ||
      route;
    const cycleHours =
      (plan.cycle === "week" ? WORK_DAYS_PER_WEEK : 1) * WORK_HOURS_PER_DAY;
    const workHours = plan.work_hours || cycleHours;
    const workers = plan.workers || 1;
    const devices = plan.devices || 1;
    const qty = plan.plan_quantity || 0;
    const standardHours =
      actualRoute?.steps.reduce((sum, s) => sum + s.hours, 0) || 0;
    const totalHours = standardHours * qty;
    // 主生产计划使用产线可用设备数（剔除维修中）参与产能计算
    const availableDevices = Math.max(
      1,
      plan.production_line
        ? getAvailableEquipmentCount(
            plan.production_line,
            store.productionLineEquipments,
            store.equipment,
          )
        : getTotalEquipmentCount(
            store.productionLines,
            store.productionLineEquipments,
            store.equipment,
          ) || devices,
    );
    const effectiveDevices = Math.min(devices, availableDevices);
    const loadRate = (totalHours / (workers * effectiveDevices * workHours)) * 100;
    const operations: ProductionPlanOperation[] =
      actualRoute?.steps.map((s) => ({
        seq: s.seq,
        code: s.code,
        name: s.name,
        hours: s.hours,
        device: s.device,
        skill: s.skill,
        load_rate: ((s.hours * qty) / (effectiveDevices * workHours)) * 100,
        category: s.category,
      })) || [];
    return {
      ...plan,
      route_id: actualRoute?.id || plan.route_id || "",
      route_name: actualRoute?.name || "",
      version_id: plan.version_id || version?.id || "",
      version_code: plan.version_code || version?.code || "",
      standard_hours: standardHours,
      load_rate: loadRate,
      operations,
      category: product.category,
    };
  }

  function save() {
    if (
      !form.product_id ||
      !form.plan_quantity ||
      !form.start_date ||
      !form.end_date
    )
      return;
    const computed = computeRates(form);
    const base = editing || {
      id: nanoid(),
      plan_no: `PL-${new Date().getFullYear()}-${String(store.productionPlans.length + 1).padStart(4, "0")}`,
      status: "draft",
      creator: currentUserName,
      created_at: new Date().toISOString().slice(0, 16).replace("T", " "),
      work_orders: [],
      orders: [],
    };
    const plan: ProductionPlan = {
      ...base,
      ...computed,
      contract_no: form.contract_no,
      contract_id: form.contract_id,
      product_code: selectedProduct!.code,
      product_name: selectedProduct!.name,
    } as ProductionPlan;
    if (editing) store.updateProductionPlan(plan);
    else store.addProductionPlan(plan);
    onClose();
    setForm({ cycle: "week", workers: 40, devices: 10, work_hours: 40 });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "编辑主生产计划" : "新建主生产计划"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>计划周期</Label>
              <Select
                value={form.cycle}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    cycle: v as "week" | "day",
                    work_hours: v === "week" ? 40 : 8,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">周计划</SelectItem>
                  <SelectItem value="day">日计划</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>合同编号</Label>
              <Select
                value={form.contract_no || "none"}
                onValueChange={(v) => {
                  const contract = store.contracts.find((c) => c.contract_no === v);
                  if (!contract || v === "none") {
                    setForm((f) => ({ ...f, contract_no: undefined, contract_id: undefined }));
                    return;
                  }
                  const firstProductName = contract.items?.[0]?.product_name;
                  const product = store.products.find((p) => p.name === firstProductName);
                  const productId = product?.id || "";
                  const { route, version } = defaultRouteAndVersion(productId);
                  setForm((f) => ({
                    ...f,
                    contract_no: contract.contract_no,
                    contract_id: contract.id,
                    product_id: productId || f.product_id || "",
                    route_id: route?.id || f.route_id || "",
                    route_name: route?.name || f.route_name || "",
                    version_id: version?.id || f.version_id || "",
                    version_code: version?.code || f.version_code || "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择合同（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联合同</SelectItem>
                  {store.contracts
                    .filter((c) => c.status === "effective" || c.status === "executing")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.contract_no}>
                        {c.contract_no} - {c.customer_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>产品</Label>
              <Select
                value={form.product_id}
                onValueChange={(v) => {
                  const { route, version } = defaultRouteAndVersion(v);
                  setForm((f) => ({
                    ...f,
                    product_id: v,
                    contract_no: f.contract_no,
                    route_id: route?.id || "",
                    route_name: route?.name || "",
                    version_id: version?.id || "",
                    version_code: version?.code || "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择产品" />
                </SelectTrigger>
                <SelectContent>
                  {store.products
                    .filter((p) => p.status === "active")
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>工艺路线</Label>
              <Select
                value={form.route_id}
                onValueChange={(v) => {
                  const route = store.processRoutes.find((r) => r.id === v);
                  setForm((f) => ({
                    ...f,
                    route_id: v,
                    route_name: route?.name || "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择工艺路线" />
                </SelectTrigger>
                <SelectContent>
                  {store.processRoutes
                    .filter((r) => r.status === "active")
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>工艺版本</Label>
              <Select
                value={form.version_id}
                onValueChange={(v) => {
                  const version = store.processVersions.find((x) => x.id === v);
                  setForm((f) => ({
                    ...f,
                    version_id: v,
                    version_code: version?.code || "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择工艺版本" />
                </SelectTrigger>
                <SelectContent>
                  {store.processVersions
                    .filter(
                      (v) =>
                        v.route_id === form.route_id &&
                        v.status === "active" &&
                        new Date(v.effective_date) <= new Date(form.start_date || new Date().toISOString().slice(0, 10)),
                    )
                    .map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.code}
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
                value={form.plan_quantity || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    plan_quantity: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>关联订单</Label>
              <Select
                value={form.orders?.[0]?.order_id}
                onValueChange={(v) => {
                  const order = store.salesOrders.find((o) => o.id === v);
                  if (order)
                    setForm((f) => ({
                      ...f,
                      orders: [
                        {
                          order_id: order.id,
                          order_no: order.order_no,
                          customer_name: order.customer_name,
                          quantity: order.items.reduce(
                            (s, i) => s + i.quantity,
                            0,
                          ),
                        },
                      ],
                    }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择订单池订单" />
                </SelectTrigger>
                <SelectContent>
                  {store.salesOrders
                    .filter((o) => ["confirmed", "approved"].includes(o.status))
                    .map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.order_no} - {o.customer_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>开始日期</Label>
              <Input
                type="date"
                value={form.start_date || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>结束日期</Label>
              <Input
                type="date"
                value={form.end_date || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>在岗人数</Label>
              <Input
                type="number"
                value={form.workers || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, workers: Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>设备数量（绗缝机）</Label>
              <Input
                type="number"
                value={form.devices || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, devices: Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>周期工作时长(小时)</Label>
              <Input
                type="number"
                value={form.work_hours || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, work_hours: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          {selectedProduct && (
            <div className="rounded-md bg-muted p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>标准工时</span>
                <span>
                  {(selectedRoute?.steps.reduce((sum, s) => sum + s.hours, 0) ||
                    0).toFixed(2)}{" "}
                  小时/件
                </span>
              </div>
              <div className="flex justify-between">
                <span>产能负荷率</span>
                <span
                  className={
                    computeRates(form).load_rate! > 100
                      ? "text-destructive font-semibold"
                      : ""
                  }
                >
                  {computeRates(form).load_rate?.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={save}>保存（未下发）</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlanDetailDialog({
  plan,
  onClose,
}: {
  plan: ProductionPlan | null;
  onClose: () => void;
}) {
  const store = useAppStore();

  const planSkuItems = useMemo(() => {
    const items: {
      order_no: string;
      customer_name: string;
      product_name: string;
      sku_summary?: string;
      quantity: number;
      unit?: string;
    }[] = [];
    (plan?.orders || []).forEach((po) => {
      const so = store.salesOrders.find((s) => s.id === po.order_id);
      if (!so) return;
      (so.items || []).forEach((it) => {
        items.push({
          order_no: so.order_no,
          customer_name: so.customer_name,
          product_name: it.product_name,
          sku_summary: it.sku_summary,
          quantity: it.quantity,
          unit: it.unit,
        });
      });
    });
    return items;
  }, [plan?.orders, store.salesOrders]);

  const {
    paginatedItems: plan_operationsPaginated,
    currentPage: plan_operationsCurrentPage,
    pageSize: plan_operationsPageSize,
    totalPages: plan_operationsTotalPages,
    totalItems: plan_operationsTotalItems,
    setPage: setPlan_operationsPage,
    setPageSize: setPlan_operationsPageSize,
  } = usePagination(plan?.operations || []);

  const {
    paginatedItems: plan_ordersPaginated,
    currentPage: plan_ordersCurrentPage,
    pageSize: plan_ordersPageSize,
    totalPages: plan_ordersTotalPages,
    totalItems: plan_ordersTotalItems,
    setPage: setPlan_ordersPage,
    setPageSize: setPlan_ordersPageSize,
  } = usePagination(plan?.orders || []);

  if (!plan) return null;

  return (
    <Dialog open={!!plan} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>计划详情：{plan.plan_no}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">产品</Label>
              <div>{plan.product_name}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">产品类别</Label>
              <div>{plan.category}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">工艺路线</Label>
              <div>{plan.route_name || "-"}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">工艺版本</Label>
              <div>{plan.version_code || "-"}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">计划产量</Label>
              <div>{plan.plan_quantity}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">起止日期</Label>
              <div>
                {plan.start_date} ~ {plan.end_date}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">状态</Label>
              <div>{PLAN_STATUS[plan.status]}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">创建人</Label>
              <div>
                {plan.creator} · {formatBeijingTime(plan.created_at)}
              </div>
            </div>
            {plan.approver && (
              <div>
                <Label className="text-muted-foreground">审核人</Label>
                <div>
                  {plan.approver} · {formatBeijingTime(plan.approved_at)}
                </div>
              </div>
            )}
          </div>
          <div className="rounded-md bg-muted p-3">
            <div className="mb-2 font-medium">产能负荷</div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>整体产能负荷率</span>
                <span
                  className={
                    plan.load_rate > 100 ? "text-destructive font-semibold" : ""
                  }
                >
                  {plan.load_rate.toFixed(1)}%
                </span>
              </div>
              <Progress value={Math.min(plan.load_rate, 100)} />
            </div>
          </div>
          <div>
            <div className="mb-2 font-medium">关联订单</div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">
                      订单编号
                    </TableHead>
                    <TableHead className="whitespace-nowrap">客户</TableHead>
                    <TableHead className="whitespace-nowrap">数量</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan_ordersPaginated.map((o) => (
                    <TableRow key={o.order_id}>
                      <TableCell className="whitespace-nowrap">
                        {o.order_no}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {o.customer_name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {o.quantity}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                currentPage={plan_ordersCurrentPage}
                totalPages={plan_ordersTotalPages}
                pageSize={plan_ordersPageSize}
                totalItems={plan_ordersTotalItems}
                onPageChange={setPlan_ordersPage}
                onPageSizeChange={setPlan_ordersPageSize}
              />
            </div>
          </div>
          <div>
            <div className="mb-2 font-medium">规格明细</div>
            <div className="overflow-x-auto">
              {planSkuItems.length === 0 ? (
                <div className="rounded-md border border-dashed border-muted-foreground/30 p-4 text-center text-sm text-muted-foreground">
                  未找到关联销售订单的 SKU 明细
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        订单编号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">客户</TableHead>
                      <TableHead className="whitespace-nowrap">产品</TableHead>
                      <TableHead className="whitespace-nowrap">规格</TableHead>
                      <TableHead className="whitespace-nowrap">数量</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planSkuItems.map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="whitespace-nowrap">
                          {it.order_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {it.customer_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {it.product_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {it.sku_summary || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {it.quantity} {it.unit || "件"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
          <div>
            <div className="mb-2 font-medium">工序明细</div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">工序</TableHead>
                    <TableHead className="whitespace-nowrap">
                      标准工时
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      所需设备
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      所需技能
                    </TableHead>
                    <TableHead className="whitespace-nowrap">负荷率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan_operationsPaginated.map((op) => (
                    <TableRow key={op.code}>
                      <TableCell className="whitespace-nowrap">
                        {op.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {op.hours} 小时/件
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {op.device}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {op.skill}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {op.load_rate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                currentPage={plan_operationsCurrentPage}
                totalPages={plan_operationsTotalPages}
                pageSize={plan_operationsPageSize}
                totalItems={plan_operationsTotalItems}
                onPageChange={setPlan_operationsPage}
                onPageSizeChange={setPlan_operationsPageSize}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GanttTab() {
  const store = useAppStore();
  const [filterLine, setFilterLine] = useState<string>("all");

  // 产线集合：已发布计划的产线分配 + 默认产线
  const lines = useMemo(() => {
    const assigned = new Set<string>();
    store.productionPlans.forEach((p) => {
      if (p.production_line) assigned.add(p.production_line);
    });
    PRODUCTION_LINES.forEach((l) => assigned.add(l));
    return Array.from(assigned);
  }, [store.productionPlans]);

  const workOrders = useMemo(() => {
    return store.workOrders
      .filter(
        (w) =>
          filterLine === "all" ||
          store.productionPlans.find((p) => p.id === w.plan_id)
            ?.production_line === filterLine,
      )
      .sort(
        (a, b) =>
          new Date(a.issued_at || a.created_at).getTime() -
          new Date(b.issued_at || b.created_at).getTime(),
      );
  }, [store.workOrders, store.productionPlans, filterLine]);

  const schedule = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    // 每个产线维护当前可用时间
    const lineCursor: Record<string, Date> = {};
    lines.forEach((l) => {
      lineCursor[l] = new Date(base);
    });

    return workOrders.map((wo) => {
      const plan = store.productionPlans.find((p) => p.id === wo.plan_id);
      const line = plan?.production_line || PRODUCTION_LINES[0];
      const product = store.products.find(
        (p) => p.id === (plan?.product_id || wo.product_id),
      );
      const route = store.processRoutes.find(
        (r) => r.id === (plan?.route_id || product?.route_binding?.route_id),
      );
      const steps = product?.process_steps || route?.steps || [];

      const bottleneckOp = wo.operations.find((o) => o.is_bottleneck);
      const matchedStep = bottleneckOp
        ? steps.find(
            (s: { code?: string; hours?: number }) => s.code === bottleneckOp.code,
          )
        : undefined;
      const fallbackStep = matchedStep
        ? undefined
        : steps.find((s: { code?: string; hours?: number }) =>
            wo.operations.some((o) => o.code === s.code),
          );
      const stepHours = matchedStep?.hours ?? fallbackStep?.hours ?? 0;

      const qty = bottleneckOp?.plan_qty || wo.plan_quantity || 0;
      // 如果工艺路线缺失标准工时，则按 1 小时/件估算（兜底，避免异常天数）
      const effectiveHoursPerPiece = stepHours > 0 ? stepHours : 1;
      const totalHours = qty * effectiveHoursPerPiece;
      const devices = Math.max(1, plan?.devices || 1);
      const hoursPerDay = 8;
      const durationDays = Math.max(
        1,
        Math.ceil(totalHours / (devices * hoursPerDay)),
      );
      const start = new Date(lineCursor[line]);
      const end = new Date(start);
      end.setDate(end.getDate() + durationDays);
      lineCursor[line] = new Date(end);
      return { wo, line, start, end, durationDays };
    });
  }, [workOrders, lines, store.productionPlans]);

  const dayCount = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">工序排产甘特图</CardTitle>
          <Select value={filterLine} onValueChange={setFilterLine}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="产线筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部产线</SelectItem>
              {lines.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3 overflow-x-auto">
          {/* 日期标尺 */}
          <div className="min-w-[800px]">
            <div className="flex border-b text-xs text-muted-foreground">
              <div className="w-24 shrink-0" />
              {Array.from({ length: dayCount }).map((_, i) => {
                const d = new Date(today);
                d.setDate(d.getDate() + i);
                return (
                  <div key={i} className="flex-1 border-l px-1 py-1">
                    {d.getMonth() + 1}/{d.getDate()}
                  </div>
                );
              })}
            </div>
            {lines
              .filter((l) => filterLine === "all" || l === filterLine)
              .map((line) => (
                <div
                  key={line}
                  className="flex items-center border-b last:border-b-0"
                >
                  <div className="w-24 shrink-0 py-3 text-sm font-medium">
                    <Settings2 className="inline h-4 w-4 mr-1 text-muted-foreground" />
                    {line}
                  </div>
                  <div className="relative flex-1 h-12">
                    {Array.from({ length: dayCount }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l bg-muted/30"
                        style={{
                          left: `${(i / dayCount) * 100}%`,
                          width: `${100 / dayCount}%`,
                        }}
                      />
                    ))}
                    {schedule
                      .filter((s) => s.line === line)
                      .map((s) => {
                        const left = Math.max(
                          0,
                          ((s.start.getTime() - today.getTime()) /
                            (1000 * 60 * 60 * 24) /
                            dayCount) *
                            100,
                        );
                        const width = Math.min(
                          100 - left,
                          (s.durationDays / dayCount) * 100,
                        );
                        return (
                          <div
                            key={s.wo.id}
                            className="absolute top-2 h-8 rounded-md bg-primary px-2 text-xs text-primary-foreground flex items-center truncate"
                            style={{
                              left: `${left}%`,
                              width: `${Math.max(width, 4)}%`,
                            }}
                            title={`${s.wo.work_no} · ${s.wo.product_name} · ${s.durationDays}天`}
                          >
                            {s.wo.work_no}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MRPTab() {
  const store = useAppStore();
  const [searchParams] = useSearchParams();
  const planIdParam = searchParams.get("planId");
  const [planId, setPlanId] = useState<string>(planIdParam || "");

  // 同步 URL 参数中的 planId
  useEffect(() => {
    if (planIdParam) setPlanId(planIdParam);
  }, [planIdParam]);

  // 已发布/执行中计划（MRP 仅应基于已拆分工单的计划）
  const publishedPlans = useMemo(
    () =>
      store.productionPlans.filter(
        (p) => p.status === "published" || p.status === "executing",
      ),
    [store.productionPlans],
  );

  // productionPlans 从 persist 恢复后自动选中首个已发布/执行中计划
  useEffect(() => {
    if (planId) return;
    const first = publishedPlans[0];
    if (first) setPlanId(first.id);
  }, [store.productionPlans, planId, publishedPlans]);

  // 计算现有库存：按库存台账中物料聚合
  const stockMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    store.inventory.forEach((inv) => {
      if (inv.type !== "material" || !inv.material_id) return;
      map[inv.material_id] = (map[inv.material_id] || 0) + inv.quantity;
    });
    return map;
  }, [store.inventory]);

  const hasInventoryRecord = useMemo<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    store.inventory.forEach((inv) => {
      if (inv.type === "material" && inv.material_id)
        map[inv.material_id] = true;
    });
    return map;
  }, [store.inventory]);

  // 计算在途库存：采购订单未到货数量（按物料聚合）
  const inTransitMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    store.purchaseOrders.forEach((po) => {
      if (!po.items || po.status === "completed") return;
      po.items.forEach((item) => {
        if (!item.material_id) return;
        const arrived = item.arrival_qty ?? 0;
        const remaining = Math.max(0, item.quantity - arrived);
        map[item.material_id] = (map[item.material_id] || 0) + remaining;
      });
    });
    return map;
  }, [store.purchaseOrders]);

  const requirements = useMemo<MRPRequirement[]>(() => {
    const plans =
      planId === "__all__"
        ? publishedPlans
        : store.productionPlans.filter((p) => p.id === planId);
    if (plans.length === 0) return [];

    const map: Record<string, MRPRequirement> = {};
    plans.forEach((plan) => {
      const product = store.products.find((p) => p.id === plan.product_id);
      if (!product) return;
      // 按 SKU 拆分计算：有 sku_items 则逐 SKU 取 BOM；否则按整体计划数量 fallback
      const skuItems = plan.sku_items?.length
        ? plan.sku_items
        : [{ sku_id: "", quantity: plan.plan_quantity }];
      skuItems.forEach((sku) => {
        const effectiveSkuId = sku.sku_id || product.skus?.[0]?.id || "";
        // 方案B：读取 SKU 颜色，将 BOM 统称物料解析为具体颜色物料
        const skuObj = product.skus?.find((s) => s.id === effectiveSkuId);
        const color = extractSkuColor(skuObj);
        const boms = effectiveSkuId
          ? getProductBomsBySku(product, effectiveSkuId)
          : product.boms || [];
        if (!boms.length) return;
        boms.forEach((bom) => {
          const baseName = bom.material_name;
          if (!baseName) return;
          const { material: resolved, missingName } = resolveColorMaterial(
            baseName,
            color,
            store.materials,
          );
          // 缺失颜色物料档案时不计入需求（由 missingMaterials 单独红色报错）
          if (missingName) return;
          const matId = resolved?.id || bom.material_id;
          const matCode = resolved?.code || bom.material_code;
          const matName = resolved?.name || bom.material_name;
          const matRecord = store.materials.find((m) => m.id === matId);
          const required = bom.dosage * sku.quantity;
          const stock = stockMap[matId] ?? 0;
          const inTransit = inTransitMap[matId] ?? 0;
          const safetyStock = matRecord?.safety_stock ?? 0;
          // 可用量仅读取真实库存（库存台账），在途库存单独展示不参与可用量
          const available = stock;
          const netReq = Math.max(0, required - available);
          const buffer = Math.ceil(netReq * 0.1);
          const suggestedQty = netReq > 0 ? netReq + buffer : 0;
          const unitPrice = 10;
          const amount = suggestedQty * unitPrice;
          const status: "normal" | "shortage" | "warning" =
            netReq > 0
              ? "shortage"
              : stock <= safetyStock && safetyStock > 0
                ? "warning"
                : "normal";

          if (!map[matId]) {
            map[matId] = {
              material_id: matId,
              material_code: matCode,
              material_name: matName,
              category: bom.category,
              specification: bom.specification,
              unit: bom.unit,
              required_qty: 0,
              required_date: plan.start_date,
              stock_qty: stock,
              in_transit_qty: inTransit,
              available_qty: available,
              net_requirement: 0,
              suggested_purchase_qty: 0,
              safety_stock: safetyStock,
              gap_qty: 0,
              status,
              unit_price: unitPrice,
              amount: 0,
            };
          }
          map[matId].required_qty += required;
          map[matId].in_transit_qty = inTransit;
          // 可用量仅读取真实库存，不叠加在途库存
          map[matId].available_qty = map[matId].stock_qty;
          map[matId].gap_qty = Math.max(
            0,
            map[matId].required_qty - map[matId].available_qty,
          );
          map[matId].net_requirement = map[matId].gap_qty;
          const buf = Math.ceil(map[matId].net_requirement * 0.1);
          map[matId].suggested_purchase_qty =
            map[matId].net_requirement > 0
              ? map[matId].net_requirement + buf
              : 0;
          map[matId].amount =
            map[matId].suggested_purchase_qty * map[matId].unit_price;
          if (map[matId].net_requirement > 0)
            map[matId].status = "shortage";
          else if (
            map[matId].stock_qty <= map[matId].safety_stock &&
            map[matId].safety_stock > 0
          )
            map[matId].status = "warning";
          else map[matId].status = "normal";
        });
      });
    });
    return Object.values(map);
  }, [
    planId,
    publishedPlans,
    store.productionPlans,
    store.products,
    store.materials,
    stockMap,
    inTransitMap,
  ]);

  // 方案B：检测物料档案中缺失的颜色物料，用于红色报错阻断采购
  const missingMaterials = useMemo<string[]>(() => {
    const plans =
      planId === "__all__"
        ? publishedPlans
        : store.productionPlans.filter((p) => p.id === planId);
    const set = new Set<string>();
    plans.forEach((plan) => {
      const product = store.products.find((p) => p.id === plan.product_id);
      if (!product) return;
      const skuItems = plan.sku_items?.length
        ? plan.sku_items
        : [{ sku_id: "", quantity: plan.plan_quantity }];
      skuItems.forEach((sku) => {
        const effectiveSkuId = sku.sku_id || product.skus?.[0]?.id || "";
        const skuObj = product.skus?.find((s) => s.id === effectiveSkuId);
        const color = extractSkuColor(skuObj);
        const boms = effectiveSkuId
          ? getProductBomsBySku(product, effectiveSkuId)
          : product.boms || [];
        boms.forEach((bom) => {
          const baseName = bom.material_name;
          if (!baseName) return;
          const { missingName } = resolveColorMaterial(
            baseName,
            color,
            store.materials,
          );
          if (missingName) set.add(missingName);
        });
      });
    });
    return Array.from(set);
  }, [
    planId,
    publishedPlans,
    store.productionPlans,
    store.products,
    store.materials,
  ]);

  // 无库存台账记录的物料
  const noStockMaterials = useMemo(
    () =>
      requirements.filter(
        (r) => r.required_qty > 0 && !hasInventoryRecord[r.material_id],
      ),
    [requirements, hasInventoryRecord],
  );

  const summary = useMemo(() => {
    const total = requirements.length;
    const shortageList = requirements.filter((r) => r.status === "shortage");
    const warningList = requirements.filter((r) => r.status === "warning");
    const totalAmount = shortageList.reduce((s, r) => s + r.amount, 0);
    return {
      total,
      shortageCount: shortageList.length,
      warningCount: warningList.length,
      totalAmount,
    };
  }, [requirements]);

  function createPurchaseRequest() {
    if (missingMaterials.length > 0) {
      toast.error(
        `${missingMaterials[0]} 物料档案未建立，无法生成采购需求。`,
      );
      return;
    }
    const gaps = requirements.filter((r) => r.net_requirement > 0);
    if (gaps.length === 0) return;
    const now = new Date().toISOString().split("T")[0];
    const sourcePlan =
      planId === "__all__"
        ? "全部主生产计划"
        : store.productionPlans.find((p) => p.id === planId)?.plan_no ||
          "主生产计划";
    const selectedPlan =
      planId === "__all__"
        ? undefined
        : store.productionPlans.find((p) => p.id === planId);
    const req: import("@/types").PurchaseRequest = {
      id: nanoid(),
      code: `PR-${new Date().getFullYear()}-${String(store.purchaseRequests.length + 1).padStart(4, "0")}`,
      applicant: "计划员",
      department: "生产部",
      created_at: now,
      required_date: new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .split("T")[0],
      status: "pending",
      source: sourcePlan,
      related_plan_id: selectedPlan?.id,
      related_plan_no: selectedPlan?.plan_no,
      items: gaps.map((r) => ({
        material_id: r.material_id,
        material_code: r.material_code,
        material_name: r.material_name,
        specification: r.specification,
        quantity: r.suggested_purchase_qty,
        unit: r.unit,
        required_date: r.required_date,
        reason: "MRP 自动生成",
      })),
    };
    store.addPurchaseRequest(req);
    toast.success(`已生成采购建议单 ${req.code}，共 ${gaps.length} 种物料`);
  }

  function createMaterialRequisition() {
    // 必须以当前计划关联的已下发工单为单位生成领料单
    const selectedPlans =
      planId === "__all__"
        ? publishedPlans
        : publishedPlans.filter((p) => p.id === planId);
    const selectedPlanIds = new Set(selectedPlans.map((p) => p.id));
    const pendingWos = store.workOrders.filter(
      (w) =>
        w.picking_status === "pending" &&
        selectedPlanIds.has(w.plan_id) &&
        (w.status === "issued" || w.status === "producing"),
    );

    if (pendingWos.length === 0) {
      if (planId === "__all__") {
        toast.warning(
          "暂无可生成领料单的工单：当前没有已发布/执行中且待领料的生产计划。",
        );
      } else {
        const plan = store.productionPlans.find((p) => p.id === planId);
        if (plan && plan.status !== "published" && plan.status !== "executing") {
          toast.warning(
            `计划 ${plan.plan_no} 当前状态为「${PLAN_STATUS[plan.status]}」，尚未发布，无法生成领料单。请先到「主生产计划」页面完成发布。`,
          );
        } else {
          toast.warning(
            "当前生产计划尚未拆分为生产工单，请先完成工单下发。",
          );
        }
      }
      return;
    }

    // 计划级防呆：若该计划下所有已下发工单均已生成非草稿领料单，则阻断重复点击
    const allHaveRequisition = pendingWos.every((wo) =>
      store.materialRequisitions.some(
        (r) =>
          r.related_work_order_no === wo.work_no &&
          r.status !== "draft",
      ),
    );
    if (allHaveRequisition) {
      toast.warning("该计划下的领料单已生成，无需重复点击。");
      return;
    }

    const now = new Date().toISOString().split("T")[0];
    const createdCodes: string[] = [];
    let seqBase = store.materialRequisitions.length + 1;

    pendingWos.forEach((wo) => {
      // 避免同一工单重复生成领料单
      const existing = store.materialRequisitions.find(
        (r) =>
          r.related_work_order_no === wo.work_no &&
          r.status !== "draft",
      );
      if (existing) return;

      const product = store.products.find((p) => p.id === wo.product_id);
      const effectiveSkuId = wo.sku_id || product?.skus?.[0]?.id || "";
      const boms = effectiveSkuId
        ? getProductBomsBySku(product, effectiveSkuId)
        : [];
      const items = boms.map((bom) => ({
        material_id: bom.material_id,
        material_code: bom.material_code,
        material_name: bom.material_name,
        specification: bom.specification || "",
        unit: bom.unit,
        required_qty: Math.ceil(bom.dosage * wo.plan_quantity),
      }));
      if (items.length === 0) return;

      const code = `MR-${new Date().getFullYear()}-${String(seqBase).padStart(4, "0")}`;
      seqBase += 1;
      const req: import("@/types").MaterialRequisition = {
        id: nanoid(),
        code,
        applicant: "计划员",
        department: "生产部",
        created_at: now,
        required_date: new Date(Date.now() + 3 * 86400000)
          .toISOString()
          .split("T")[0],
        status: "pending",
        items,
        related_plan_no:
          planId !== "__all__"
            ? store.productionPlans.find((p) => p.id === planId)?.plan_no
            : "多计划",
        related_work_order_no: wo.work_no,
      };
      store.addMaterialRequisition(req);
      createdCodes.push(code);
    });

    if (createdCodes.length === 0) {
      toast.warning("未找到可领料的物料清单，请检查成品 BOM 配置。");
      return;
    }

    toast.success(
      `已为您自动生成 ${createdCodes.length} 张关联各工单的领料单，请前往【生产管理】查看。`,
    );
  }

  // 无BOM库存记录警告物料名称列表
  const noStockNames = noStockMaterials
    .slice(0, 8)
    .map((r) => `${r.material_name}（${r.material_code}）`)
    .join("、");
  const shortageNames = requirements
    .filter((r) => r.status === "shortage")
    .slice(0, 8)
    .map((r) => r.material_name)
    .join("、");

  const {
    paginatedItems: requirementsPaginated,
    currentPage: requirementsCurrentPage,
    pageSize: requirementsPageSize,
    totalPages: requirementsTotalPages,
    totalItems: requirementsTotalItems,
    setPage: setRequirementsPage,
    setPageSize: setRequirementsPageSize,
  } = usePagination(requirements);

  return (
    <div className="space-y-4">
      {/* 方案B：颜色物料档案缺失红色报错条 */}
      {missingMaterials.length > 0 && (
        <div className="rounded-md border border-red-400 bg-red-50 p-4 space-y-1">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-red-700 text-sm">
                {missingMaterials.length} 种颜色物料档案未建立，无法生成采购需求
              </div>
              <div className="text-xs text-red-600 mt-1">
                MRP 已读取生产计划 SKU 颜色，但物料档案中找不到对应颜色物料。请先在物料档案中建立以下物料后再运算。
              </div>
              <div className="text-xs text-red-600 mt-1 break-words">
                {missingMaterials.join("、")}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 无库存警告条 */}
      {noStockMaterials.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-1">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-amber-800 text-sm">
                警告：{noStockMaterials.length} 种 BOM 物料尚未建立库存记录
              </div>
              <div className="text-xs text-amber-700 mt-1">
                以下物料在库存台账中找不到任何记录，MRP 已将其现有库存视为
                0，净需求可能被高估。请先在物料档案中完成初始化，或通过采购入库单补充库存后再运算。
              </div>
              <div className="text-xs text-amber-600 mt-1 break-words">
                {noStockNames}
                {noStockMaterials.length > 8
                  ? `……等 ${noStockMaterials.length} 种`
                  : ""}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-amber-700 border-amber-400 hover:bg-amber-100"
              onClick={() => {}}
            >
              <Settings2 className="h-4 w-4 mr-1" />
              刷新库存
            </Button>
          </div>
        </div>
      )}
      {/* 缺料预警条 */}
      {summary.shortageCount > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-1">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-red-700 text-sm">
                缺料预警 — {summary.shortageCount} 种物料库存不足
              </div>
              <div className="text-xs text-red-600 mt-1">
                工序排产将暂停受影响工单，请尽快生成采购建议单并补货后恢复生产。
              </div>
              <div className="text-xs text-red-500 mt-1 break-words">
                缺料物料：{shortageNames}
                {summary.shortageCount > 8
                  ? `……等 ${summary.shortageCount} 种`
                  : ""}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 统计卡片 */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Layers className="h-4 w-4" />
              需求物料种数
            </div>
            <div className="text-2xl font-semibold">{summary.total}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {planId === "__all__"
                ? `基于 ${publishedPlans.length} 个已排产订单`
                : `基于当前所选生产计划`}
            </div>
          </CardContent>
        </Card>
        <Card
          className={
            summary.shortageCount > 0 ? "border-red-200 bg-red-50" : ""
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <AlertCircle className="h-4 w-4 text-red-500" />
              缺货物料
            </div>
            <div
              className={`text-2xl font-semibold ${summary.shortageCount > 0 ? "text-red-600" : ""}`}
            >
              {summary.shortageCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              净需求 &gt; 0
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Package className="h-4 w-4 text-amber-500" />
              预警物料
            </div>
            <div className="text-2xl font-semibold">{summary.warningCount}</div>
            <div className="text-xs text-muted-foreground mt-1">
              低于安全库存
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4 text-primary" />
              建议采购金额
            </div>
            <div className="text-2xl font-semibold">
              ¥
              {summary.totalAmount.toLocaleString("zh-CN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              含 10% 缓冲余量
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 操作按钮区 */}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={summary.shortageCount === 0}
          onClick={createPurchaseRequest}
        >
          <Plus className="h-4 w-4 mr-1" />
          生成采购建议单{" "}
          {summary.shortageCount > 0 ? summary.shortageCount : ""}
        </Button>
        <Button
          variant="outline"
          onClick={createMaterialRequisition}
        >
          <ClipboardCheck className="h-4 w-4 mr-1" />
          生成领料单
        </Button>
      </div>
      {/* MRP 物料需求计划表 */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-3">
          <CardTitle className="text-base">物料需求计划（MRP）</CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">
              数据来源：已排产订单 × BOM
            </span>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="选择主生产计划" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部已发布计划</SelectItem>
                {publishedPlans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.plan_no} · {p.product_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto bg-card rounded-b-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">物料编码</TableHead>
                  <TableHead className="whitespace-nowrap">物料名称</TableHead>
                  <TableHead className="whitespace-nowrap">规格</TableHead>
                  <TableHead className="whitespace-nowrap">单位</TableHead>
                  <TableHead className="whitespace-nowrap">毛需求</TableHead>
                  <TableHead className="whitespace-nowrap">现有库存</TableHead>
                  <TableHead className="whitespace-nowrap">在途库存</TableHead>
                  <TableHead className="whitespace-nowrap">可用量</TableHead>
                  <TableHead className="whitespace-nowrap">净需求</TableHead>
                  <TableHead className="whitespace-nowrap">
                    建议采购量
                  </TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirementsPaginated.map((r) => (
                  <TableRow
                    key={r.material_id}
                    className={
                      r.status === "shortage"
                        ? "bg-red-50/50"
                        : r.status === "warning"
                          ? "bg-amber-50/50"
                          : ""
                    }
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                      {r.material_code}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {r.material_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {r.specification || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {r.unit}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.required_qty.toLocaleString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.stock_qty === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : (
                        r.stock_qty.toLocaleString()
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.in_transit_qty > 0 ? (
                        <span className="text-blue-600">
                          {r.in_transit_qty.toLocaleString()}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell
                      className={`whitespace-nowrap ${r.available_qty <= 0 ? "text-red-500" : ""}`}
                    >
                      {r.available_qty.toLocaleString()}
                    </TableCell>
                    <TableCell
                      className={`whitespace-nowrap font-medium ${r.net_requirement > 0 ? "text-red-600" : ""}`}
                    >
                      {r.net_requirement > 0
                        ? `▲${r.net_requirement.toLocaleString()}`
                        : r.net_requirement.toLocaleString()}
                    </TableCell>
                    <TableCell
                      className={`whitespace-nowrap ${r.suggested_purchase_qty > 0 ? "text-amber-700 font-semibold" : ""}`}
                    >
                      {r.suggested_purchase_qty > 0
                        ? r.suggested_purchase_qty.toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.status === "shortage" ? (
                        <Badge variant="destructive" className="text-xs">
                          缺货
                        </Badge>
                      ) : r.status === "warning" ? (
                        <Badge
                          variant="outline"
                          className="text-xs border-amber-400 text-amber-700 bg-amber-50"
                        >
                          预警
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-xs text-emerald-700 bg-emerald-50"
                        >
                          充足
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {requirements.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="p-8 text-center text-muted-foreground"
                    >
                      {!planId ? (
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">
                            请选择主生产计划生成物料需求
                          </div>
                          <div className="text-xs">
                            未检测到已选计划，请从右上角下拉框选择主生产计划
                          </div>
                        </div>
                      ) : !store.productionPlans.find(
                          (p) => p.id === planId,
                        ) ? (
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">
                            所选计划已不存在
                          </div>
                          <div className="text-xs">
                            请重新选择有效的主生产计划
                          </div>
                        </div>
                      ) : !(store.products.find(
                          (p) =>
                            p.id ===
                            store.productionPlans.find(
                              (plan) => plan.id === planId,
                            )?.product_id,
                        )?.boms || []).length ? (
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">
                            该产品未维护 BOM 物料清单
                          </div>
                          <div className="text-xs">
                            请在「产品管理」中为该产品添加 BOM 后再运行 MRP
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">
                            当前计划无可用物料需求
                          </div>
                          <div className="text-xs">
                            请检查产品 BOM、物料档案及库存数据是否完整
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination
              currentPage={requirementsCurrentPage}
              totalPages={requirementsTotalPages}
              pageSize={requirementsPageSize}
              totalItems={requirementsTotalItems}
              onPageChange={setRequirementsPage}
              onPageSizeChange={setRequirementsPageSize}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function buildPlanFromOrders(
  product: Product,
  quantity: number,
  orders: ProductionPlanOrder[],
  route?: {
    id: string;
    name: string;
    steps: {
      seq: number;
      code: string;
      name: string;
      hours: number;
      device: string;
      skill: string;
      is_bottleneck: boolean;
    }[];
  },
  version?: { id: string; code: string },
  skuItems?: ProductionPlanSkuItem[],
  creatorName = "当前用户",
  allProductionLines: ProductionLine[] = [],
  productionLineEquipments: ProductionLineEquipment[] = [],
  allEquipment: Equipment[] = [],
): ProductionPlan {
  const standardHours = route?.steps.reduce((sum, s) => sum + s.hours, 0) || 0;
  const routeSteps = route?.steps || [
    {
      seq: 1,
      code: "cut",
      name: "裁剪",
      hours: standardHours * 0.15,
      device: "裁剪台",
      skill: "裁剪",
      is_bottleneck: false,
    },
    {
      seq: 2,
      code: "sew",
      name: "拼接",
      hours: standardHours * 0.2,
      device: "缝纫机",
      skill: "缝纫",
      is_bottleneck: false,
    },
    {
      seq: 3,
      code: "quilt",
      name: "绗缝",
      hours: standardHours * 0.45,
      device: "绗缝机",
      skill: "绗缝",
      is_bottleneck: true,
    },
    {
      seq: 4,
      code: "edge",
      name: "包边",
      hours: standardHours * 0.1,
      device: "包边机",
      skill: "包边",
      is_bottleneck: false,
    },
    {
      seq: 5,
      code: "qc",
      name: "质检",
      hours: standardHours * 0.05,
      device: "检验台",
      skill: "质检",
      is_bottleneck: false,
    },
    {
      seq: 6,
      code: "pack",
      name: "包装",
      hours: standardHours * 0.05,
      device: "包装台",
      skill: "包装",
      is_bottleneck: false,
    },
  ];
  const workers = 40;
  const workHours = 40;
  const totalHours = standardHours * quantity;
  const availableDevices = getTotalEquipmentCount(
    allProductionLines,
    productionLineEquipments,
    allEquipment,
  ) || 10;
  const devices = availableDevices;
  return {
    id: nanoid(),
    plan_no: `PL-${new Date().getFullYear()}-${String(Math.random()).slice(2, 6)}`,
    cycle: "week",
    product_id: product.id,
    product_code: product.code,
    product_name: product.name,
    category: product.category,
    route_id: route?.id || "",
    route_name: route?.name || "",
    version_id: version?.id || "",
    version_code: version?.code || "",
    plan_quantity: quantity,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    standard_hours: standardHours,
    workers,
    devices,
    work_hours: workHours,
    load_rate: (totalHours / (workers * devices * workHours)) * 100,
    status: "draft",
    operations: routeSteps.map((s) => ({
      seq: s.seq,
      code: s.code,
      name: s.name,
      hours: s.hours,
      device: s.device,
      skill: s.skill,
      load_rate: ((s.hours * quantity) / (devices * workHours)) * 100,
    })),
    orders,
    sku_items: skuItems || [],
    creator: creatorName,
    created_at: new Date().toISOString().slice(0, 16).replace("T", " "),
    work_orders: [],
  };
}

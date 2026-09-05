import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppStore } from "@/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  TrendingUp,
  BarChart3,
  Package,
  DollarSign,
  ShieldCheck,
  Users,
  Calendar as CalendarIcon,
  Wallet,
  ArrowRightLeft,
  ChevronRight,
  Factory,
} from "lucide-react";
import type { SalesOrder, PaymentRecord, FinanceRecord } from "@/types";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  format,
  isWithinInterval,
  parseISO,
  differenceInDays,
} from "date-fns";
import { zhCN } from "date-fns/locale";

type DateRange = { start: Date; end: Date };
type DateRangePreset = "today" | "week" | "month" | "quarter" | "year" | "custom";

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "今日",
  week: "本周",
  month: "本月",
  quarter: "本季",
  year: "今年",
  custom: "自定义",
};

const PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: PRESET_LABELS.today },
  { value: "week", label: PRESET_LABELS.week },
  { value: "month", label: PRESET_LABELS.month },
  { value: "quarter", label: PRESET_LABELS.quarter },
  { value: "year", label: PRESET_LABELS.year },
  { value: "custom", label: PRESET_LABELS.custom },
];

function getPresetRange(preset: DateRangePreset): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "custom":
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function isDateInRange(dateStr: string | undefined, range: DateRange): boolean {
  if (!dateStr) return false;
  const d = parseDate(dateStr);
  if (!d) return false;
  return isWithinInterval(d, { start: range.start, end: range.end });
}

function useCNYRate(currency: string, rates: { currency: string; rate: number }[]): number {
  if (currency === "CNY") return 1;
  const found = rates.find((r) => r.currency === currency);
  return found?.rate ?? 1;
}

function toCNY(
  amount: number,
  currency: string,
  rates: { currency: string; rate: number }[]
): number {
  return amount * useCNYRate(currency, rates);
}

function formatMoney(value: number): string {
  return `¥${Math.round(value).toLocaleString()}`;
}

const COLORS = [
  "#8B6B4D",
  "#C4A77D",
  "#A89F91",
  "#D8CFC2",
  "#B58A66",
  "#6B8B7D",
  "#9DB5A3",
];

function getReceivableDueDate(
  fr: FinanceRecord,
  orders: SalesOrder[]
): Date | undefined {
  const order = orders.find((o) => o.order_no === fr.related_order);
  if (order?.payment_date) return parseISO(order.payment_date);
  if (order?.delivery_date) return parseISO(order.delivery_date);
  if (fr.record_date) return parseISO(fr.record_date);
  return undefined;
}

export function ReportsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="报表中心"
        description="销售、生产、库存、质量、财务与人员多维度报表"
      />
      <ControlledTabs modulePath="/reports" defaultTab="sales">
        <TabsList className="bg-muted">
          <TabsTrigger value="sales">销售报表</TabsTrigger>
          <TabsTrigger value="production">生产报表</TabsTrigger>
          <TabsTrigger value="inventory">库存报表</TabsTrigger>
          <TabsTrigger value="quality">质量报表</TabsTrigger>
          <TabsTrigger value="finance">财务报表</TabsTrigger>
          <TabsTrigger value="personnel">人员报表</TabsTrigger>
        </TabsList>
        <SalesReportTab />
        <ProductionReportTab />
        <InventoryReportTab />
        <QualityReportTab />
        <FinanceReportTab />
        <PersonnelReportTab />
      </ControlledTabs>
    </div>
  );
}

/* ─── 销售报表 ───────────────────────────────────────────── */

function SalesReportTab() {
  const store = useAppStore();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const salesByChannel = useMemo(() => {
    const map: Record<string, number> = {};
    store.salesOrders.forEach((o) => {
      map[o.channel] = (map[o.channel] || 0) + o.total_amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [store.salesOrders]);

  const salesByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    store.salesOrders.forEach((o) => {
      // 与首页“本月产值”保持一致：仅统计已完成且本月交货的订单，并按汇率换算为人民币
      if (o.status !== "completed" || !o.delivery_date) return;
      const m = o.delivery_date.slice(0, 7);
      if (m) map[m] = (map[m] || 0) + toCNY(o.total_amount, o.currency || "CNY", store.exchangeRates);
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, value]) => ({ name, value }));
  }, [store.salesOrders, store.exchangeRates]);

  const monthOrders = useMemo(
    () =>
      store.salesOrders.filter(
        (o) =>
          o.status === "completed" &&
          o.delivery_date &&
          o.delivery_date.startsWith(month),
      ),
    [store.salesOrders, month],
  );

  const totalMonthSales = monthOrders.reduce(
    (s, o) => s + toCNY(o.total_amount, o.currency || "CNY", store.exchangeRates),
    0,
  );

  const orderProfits = useMemo(() => {
    // 优先按合同号找到对应报价单，用报价单的成本率（total_cost / suggested_price）估算订单成本
    const quoteCostRatioByContract = new Map<string, number>();
    store.quotations.forEach((q) => {
      if (q.contract_no && q.suggested_price > 0) {
        quoteCostRatioByContract.set(
          q.contract_no,
          q.total_cost / q.suggested_price,
        );
      }
    });

    // 兜底：从已关联工单的财务成本记录归集到产品
    const costMap: Record<string, number> = {};
    store.financeRecords
      .filter((f) => f.type === "cost" && f.work_order_id)
      .forEach((f) => {
        const wo = store.workOrders.find((w) => w.id === f.work_order_id);
        if (wo)
          costMap[wo.product_id] = (costMap[wo.product_id] || 0) + f.amount;
      });

    return store.salesOrders
      .map((o: SalesOrder) => {
        const productIds = Array.from(
          new Set(
            o.items
              .map((i) => i.product_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const quoteRatio = o.contract_no
          ? quoteCostRatioByContract.get(o.contract_no)
          : undefined;
        const fallbackCost = productIds.reduce(
          (s, pid) => s + (costMap[pid] || 0),
          0,
        );
        const revenue = o.total_amount;
        const cost = quoteRatio ? revenue * quoteRatio : fallbackCost;
        return {
          ...o,
          revenue,
          cost,
          profit: revenue - cost,
          margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
        };
      })
      .filter((o) => o.cost > 0 || o.status === "completed");
  }, [
    store.salesOrders,
    store.quotations,
    store.financeRecords,
    store.workOrders,
  ]);

  const {
    paginatedItems: orderProfitsPaginated,
    currentPage: orderProfitsCurrentPage,
    pageSize: orderProfitsPageSize,
    totalPages: orderProfitsTotalPages,
    totalItems: orderProfitsTotalItems,
    setPage: setOrderProfitsPage,
    setPageSize: setOrderProfitsPageSize,
  } = usePagination(orderProfits);

  const {
    paginatedItems: monthOrdersPaginated,
    currentPage: monthOrdersCurrentPage,
    pageSize: monthOrdersPageSize,
    totalPages: monthOrdersTotalPages,
    totalItems: monthOrdersTotalItems,
    setPage: setMonthOrdersPage,
    setPageSize: setMonthOrdersPageSize,
  } = usePagination(monthOrders);

  return (
    <TabsContent value="sales" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">订单总数</p>
            <p className="text-xl font-bold">{store.salesOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">总销售额</p>
            <p className="text-xl font-bold">
              ¥
              {store.salesOrders
                .reduce((s, o) => s + o.total_amount, 0)
                .toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">本月销售额</p>
            <p className="text-xl font-bold">
              ¥{totalMonthSales.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              销售额趋势（按月）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v) => `¥${Number(v).toLocaleString()}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#8B6B4D"
                    strokeWidth={2}
                    name="销售额"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              渠道销售额占比
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesByChannel}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {salesByChannel.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => `¥${Number(v).toLocaleString()}`}
                  />
                  <Legend
                    layout="horizontal"
                    wrapperStyle={{ paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">月度销售明细</CardTitle>
            <div className="flex items-center gap-2">
              <Label>月份</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-36"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">订单号</TableHead>
                <TableHead className="whitespace-nowrap">客户</TableHead>
                <TableHead className="whitespace-nowrap">渠道</TableHead>
                <TableHead className="whitespace-nowrap">金额</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthOrdersPaginated.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {o.order_no}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o.customer_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o.channel}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    ¥{o.total_amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        o.status === "completed" ? "default" : "secondary"
                      }
                    >
                      {o.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {monthOrders.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground"
                  >
                    本月暂无订单
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={monthOrdersCurrentPage}
            totalPages={monthOrdersTotalPages}
            pageSize={monthOrdersPageSize}
            totalItems={monthOrdersTotalItems}
            onPageChange={setMonthOrdersPage}
            onPageSizeChange={setMonthOrdersPageSize}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            订单利润分析
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">订单号</TableHead>
                <TableHead className="whitespace-nowrap">客户</TableHead>
                <TableHead className="whitespace-nowrap">销售收入</TableHead>
                <TableHead className="whitespace-nowrap">工单成本</TableHead>
                <TableHead className="whitespace-nowrap">毛利</TableHead>
                <TableHead className="whitespace-nowrap">毛利率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderProfitsPaginated.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {o.order_no}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o.customer_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    ¥{o.revenue.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    ¥{o.cost.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    ¥{o.profit.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        o.margin >= 20
                          ? "default"
                          : o.margin >= 0
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {o.margin.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {orderProfits.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无完工工单，无法计算利润
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={orderProfitsCurrentPage}
            totalPages={orderProfitsTotalPages}
            pageSize={orderProfitsPageSize}
            totalItems={orderProfitsTotalItems}
            onPageChange={setOrderProfitsPage}
            onPageSizeChange={setOrderProfitsPageSize}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}

/* ─── 生产报表 ───────────────────────────────────────────── */

function ProductionReportTab() {
  const store = useAppStore();

  const workOrderData = useMemo(
    () =>
      store.workOrders.map((w) => ({
        name: w.product_name,
        计划: w.plan_quantity,
        完成: w.completed_quantity,
      })),
    [store.workOrders],
  );

  const totalPlan = store.workOrders.reduce((s, w) => s + w.plan_quantity, 0);
  const totalCompleted = store.workOrders.reduce(
    (s, w) => s + w.completed_quantity,
    0,
  );
  const completionRate =
    totalPlan > 0 ? ((totalCompleted / totalPlan) * 100).toFixed(1) : "0.0";

  const exceptionByType = useMemo(() => {
    const map: Record<string, number> = {};
    store.productionExceptions.forEach((e) => {
      map[e.type] = (map[e.type] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [store.productionExceptions]);

  return (
    <TabsContent value="production" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">工单总数</p>
            <p className="text-xl font-bold">{store.workOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">计划完成率</p>
            <p className="text-xl font-bold">{completionRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">异常工单数</p>
            <p className="text-xl font-bold text-destructive">
              {store.productionExceptions.length}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              工单计划 vs 完成
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workOrderData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend
                    layout="horizontal"
                    wrapperStyle={{ paddingTop: 8 }}
                  />
                  <Bar dataKey="计划" fill="#8B6B4D" />
                  <Bar dataKey="完成" fill="#C4A77D" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">异常类型分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={exceptionByType}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {exceptionByType.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="horizontal"
                    wrapperStyle={{ paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}

/* ─── 库存报表 ───────────────────────────────────────────── */

function InventoryReportTab() {
  const store = useAppStore();

  const inventoryData = useMemo(
    () =>
      store.inventory.map((i) => {
        const name =
          i.type === "product"
            ? store.products.find((p) => p.id === i.product_id)?.name
            : store.materials.find((m) => m.id === i.material_id)?.name;
        return { name: name || i.id, 库存: i.quantity, 安全库存: i.min_stock };
      }),
    [store.inventory, store.products, store.materials],
  );

  const lowStockCount = store.inventory.filter(
    (i) => i.quantity < i.min_stock,
  ).length;

  return (
    <TabsContent value="inventory" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">库存品项</p>
              <p className="text-xl font-bold">{store.inventory.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">低于安全库存</p>
              <p className="text-xl font-bold text-destructive">
                {lowStockCount}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">呆滞/周转慢</p>
              <p className="text-xl font-bold text-orange-500">0</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">库存 vs 安全库存</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8 }} />
                <Bar dataKey="库存" fill="#8B6B4D" />
                <Bar dataKey="安全库存" fill="#C4A77D" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

    </TabsContent>
  );
}

/* ─── 质量报表 ───────────────────────────────────────────── */

function QualityReportTab() {
  const store = useAppStore();

  const [
    materialInspections,
    processInspections,
    finishedInspections,
  ] = useMemo(
    () => [
      store.materialInspections,
      store.processInspections,
      store.finishedInspections,
    ],
    [store.materialInspections, store.processInspections, store.finishedInspections],
  );

  // 汇总三种真实检验数据
  const totalInspections =
    materialInspections.length +
    processInspections.length +
    finishedInspections.length;
  const qualifiedCount =
    materialInspections.filter((i) => i.result === "qualified").length +
    processInspections.filter((i) => i.result === "qualified").length +
    finishedInspections.filter((i) => i.result === "qualified").length;
  const unqualifiedCount =
    materialInspections.filter((i) => i.result === "unqualified").length +
    processInspections.filter((i) => i.result === "unqualified").length;
  const partialCount =
    materialInspections.filter((i) => i.result === "partial").length +
    processInspections.filter((i) => i.result === "partial").length;

  const qualifiedRate =
    totalInspections > 0
      ? ((qualifiedCount / totalInspections) * 100).toFixed(1)
      : "0.0";

  const inspByType = useMemo(() => {
    const map: Record<string, { total: number; qualified: number }> = {};
    const add = (label: string, result: string) => {
      if (!map[label]) map[label] = { total: 0, qualified: 0 };
      map[label].total++;
      if (result === "qualified") map[label].qualified++;
    };
    materialInspections.forEach((i) => add("来料检验", i.result));
    processInspections.forEach((i) => add("过程检验", i.result));
    finishedInspections.forEach((i) => add("成品检验", i.result || "qualified"));
    return Object.entries(map).map(([name, v]) => ({
      name,
      合格率: v.total > 0 ? Number(((v.qualified / v.total) * 100).toFixed(1)) : 0,
      总次数: v.total,
    }));
  }, [materialInspections, processInspections, finishedInspections]);

  const resultDistribution = useMemo(() => {
    const map: Record<string, number> = {
      合格: 0,
      部分合格: 0,
      不合格: 0,
    };
    const add = (result: string) => {
      if (result === "qualified") map["合格"]++;
      else if (result === "partial") map["部分合格"]++;
      else if (result === "unqualified") map["不合格"]++;
    };
    materialInspections.forEach((i) => add(i.result));
    processInspections.forEach((i) => add(i.result));
    finishedInspections.forEach((i) => add(i.result || "qualified"));
    return Object.entries(map)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [materialInspections, processInspections, finishedInspections]);

  const defectRank = useMemo(() => {
    const map: Record<string, number> = {};
    const add = (record: {
      result?: string;
      defect_reason?: string;
      items?: { result?: string; name?: string }[];
    }) => {
      const items = record.items || [];
      const hasUnqualifiedItem = items.some((it) => it.result === "unqualified");
      const reason = record.defect_reason || (hasUnqualifiedItem ? "检验项目不合格" : "");
      if (reason) {
        map[reason] = (map[reason] || 0) + 1;
      }
      items.forEach((it) => {
        if (it.result === "unqualified" && it.name) {
          map[it.name] = (map[it.name] || 0) + 1;
        }
      });
    };
    materialInspections.forEach(add);
    processInspections.forEach(add);
    finishedInspections.forEach(add);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [materialInspections, processInspections, finishedInspections]);

  return (
    <TabsContent value="quality" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">检验总次</p>
              <p className="text-xl font-bold">{totalInspections}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">合格率</p>
            <p className="text-xl font-bold text-green-600">{qualifiedRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">不合格数</p>
            <p className="text-xl font-bold text-destructive">
              {unqualifiedCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">部分合格数</p>
            <p className="text-xl font-bold text-amber-600">
              {partialCount}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">按检验类型合格率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inspByType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip
                    formatter={(value, name) => [value, name]}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="合格率" fill="#6B8B7D" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">检验结果分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={resultDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name} ${entry.value}`}
                  >
                    {resultDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="horizontal"
                    wrapperStyle={{ paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">缺陷原因 Top 8</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={defectRank} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Bar dataKey="value" fill="#B58A66" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

/* ─── 财务报表 ───────────────────────────────────────────── */

function FinanceReportTab() {
  const store = useAppStore();
  const [preset, setPreset] = useState<DateRangePreset>("month");
  const [customRange, setCustomRange] = useState<DateRange>(() =>
    getPresetRange("month")
  );
  const [detailCustomer, setDetailCustomer] = useState<string | null>(null);
  const [drilldownMonth, setDrilldownMonth] = useState<string | null>(null);

  const range: DateRange = useMemo(() => {
    if (preset === "custom") return customRange;
    return getPresetRange(preset);
  }, [preset, customRange]);

  const rates = useMemo(
    () => store.exchangeRates.map((r) => ({ currency: r.currency, rate: r.rate })),
    [store.exchangeRates]
  );

  // 总成本（cost 类型）
  const totalCost = useMemo(() => {
    return store.financeRecords
      .filter((f) => f.type === "cost" && isDateInRange(f.record_date, range))
      .reduce((s, f) => s + toCNY(f.amount, f.currency, rates), 0);
  }, [store.financeRecords, range, rates]);

  // 本月销售实收（实际到账回款）
  const monthSalesReceived = useMemo(() => {
    return store.paymentRecords
      .filter(
        (p) =>
          p.type === "receive" &&
          p.status === "completed" &&
          isDateInRange(p.payment_date, range)
      )
      .reduce((s, p) => s + toCNY(p.amount, p.currency, rates), 0);
  }, [store.paymentRecords, range, rates]);

  // 本期应确认收入（按应收账款确认的收入）
  const recognizedRevenue = useMemo(() => {
    return store.financeRecords
      .filter((f) => f.type === "应收" && isDateInRange(f.record_date, range))
      .reduce((s, f) => s + toCNY(f.amount, f.currency, rates), 0);
  }, [store.financeRecords, range, rates]);

  // 本期毛利 = 应确认收入 - 总成本
  const monthGrossProfit = recognizedRevenue - totalCost;

  // 收支趋势数据
  const trendData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: startOfMonth(range.start),
      end: endOfMonth(range.end),
    }).map((d) => format(d, "yyyy-MM"));
    const map: Record<string, { month: string; income: number; expense: number }> = {};
    months.forEach((m) => {
      map[m] = { month: m, income: 0, expense: 0 };
    });
    // 收入：实际到账回款
    store.paymentRecords.forEach((p) => {
      if (!isDateInRange(p.payment_date, range)) return;
      const m = (p.payment_date || "").slice(0, 7);
      if (!map[m]) return;
      if (p.type === "receive" && p.status === "completed") {
        map[m].income += toCNY(p.amount, p.currency, rates);
      }
    });
    // 支出：cost 类型财务记录（含采购/外协/工资，避免与回款重复计算）
    store.financeRecords.forEach((f) => {
      if (f.type !== "cost" || !isDateInRange(f.record_date, range)) return;
      const m = (f.record_date || "").slice(0, 7);
      if (!map[m]) return;
      map[m].expense += toCNY(f.amount, f.currency, rates);
    });
    return Object.values(map);
  }, [store.paymentRecords, store.financeRecords, range, rates]);

  // 每月支出构成明细（用于折线图下钻）
  const monthlyBreakdown = useMemo(() => {
    const map: Record<string, { 采购面料: number; 员工工资: number; 外协加工: number }> = {};
    const months = eachMonthOfInterval({
      start: startOfMonth(range.start),
      end: endOfMonth(range.end),
    }).map((d) => format(d, "yyyy-MM"));
    months.forEach((m) => {
      map[m] = { 采购面料: 0, 员工工资: 0, 外协加工: 0 };
    });
    // 采购面料：采购付款
    store.paymentRecords.forEach((p) => {
      if (p.type !== "pay" || p.status !== "completed" || !isDateInRange(p.payment_date, range)) return;
      const m = (p.payment_date || "").slice(0, 7);
      if (map[m]) map[m].采购面料 += toCNY(p.amount, p.currency, rates);
    });
    // 员工工资
    store.financeRecords.forEach((f) => {
      if (f.type !== "salary" || !isDateInRange(f.record_date, range)) return;
      const m = (f.record_date || "").slice(0, 7);
      if (map[m]) map[m].员工工资 += toCNY(f.amount, f.currency, rates);
    });
    // 外协加工 = 当月总成本 - 采购面料 - 员工工资
    Object.keys(map).forEach((m) => {
      const cost = trendData.find((t) => t.month === m)?.expense || 0;
      map[m].外协加工 = Math.max(0, cost - map[m].采购面料 - map[m].员工工资);
    });
    return map;
  }, [store.paymentRecords, store.financeRecords, trendData, range, rates]);

  // 客户回款排行榜（按所选期间回款金额）
  const customerPaymentRanks = useMemo(() => {
    const map: Record<string, number> = {};
    store.paymentRecords
      .filter(
        (p) =>
          p.type === "receive" &&
          p.status === "completed" &&
          isDateInRange(p.payment_date, range)
      )
      .forEach((p) => {
        map[p.counterparty] =
          (map[p.counterparty] || 0) + toCNY(p.amount, p.currency, rates);
      });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [store.paymentRecords, range, rates]);

  // 客户欠款排行榜（累计未结清应收）
  const customerDebtRanks = useMemo(() => {
    const map: Record<string, number> = {};
    store.financeRecords
      .filter(
        (f) =>
          f.type === "应收" &&
          (f.status === "unsettled" || f.status === "partial")
      )
      .forEach((f) => {
        const key = f.counterparty || "未命名客户";
        map[key] =
          (map[key] || 0) + toCNY(f.amount - f.paid_amount, f.currency, rates);
      });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [store.financeRecords, rates]);

  // 客户欠款下钻明细
  const customerDebtOrders = useMemo(() => {
    if (!detailCustomer) return [];
    const today = startOfDay(new Date());
    return store.financeRecords
      .filter(
        (f) =>
          f.type === "应收" &&
          (f.status === "unsettled" || f.status === "partial") &&
          (f.counterparty === detailCustomer || f.customer_id === detailCustomer)
      )
      .map((f) => {
        const order = store.salesOrders.find((o) => o.order_no === f.related_order);
        const due = getReceivableDueDate(f, store.salesOrders);
        const overdue = due ? Math.max(0, differenceInDays(today, due)) : 0;
        return {
          order_no: order?.order_no || f.related_order || "-",
          customer_name: order?.customer_name || f.counterparty || "-",
          amount: toCNY(f.amount - f.paid_amount, f.currency, rates),
          due_date: due ? format(due, "yyyy-MM-dd") : "-",
          overdue,
        };
      })
      .sort((a, b) => b.overdue - a.overdue);
  }, [detailCustomer, store.financeRecords, store.salesOrders, rates]);

  const handlePresetChange = (value: DateRangePreset) => {
    setPreset(value);
    if (value !== "custom") {
      setCustomRange(getPresetRange(value));
    }
  };

  const paymentRanksPadded = useMemo(() => {
    const arr: { name: string; value: number; placeholder?: boolean }[] =
      customerPaymentRanks.map((r) => ({ name: r.name, value: r.value }));
    while (arr.length < 5) arr.push({ name: "", value: 0, placeholder: true });
    return arr;
  }, [customerPaymentRanks]);
  const debtRanksPadded = useMemo(() => {
    const arr: { name: string; value: number; placeholder?: boolean }[] =
      customerDebtRanks.map((r) => ({ name: r.name, value: r.value }));
    while (arr.length < 5) arr.push({ name: "", value: 0, placeholder: true });
    return arr;
  }, [customerDebtRanks]);

  const maxDebt = customerDebtRanks[0]?.value || 1;
  const maxPayment = customerPaymentRanks[0]?.value || 1;

  return (
    <TabsContent value="finance" className="space-y-4">
      {/* 时间筛选器 */}
      <Card className="bg-card/50">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">时间范围</span>
          </div>
          <Select value={preset} onValueChange={(v) => handlePresetChange(v as DateRangePreset)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 px-3 text-sm">
                    {toISODate(customRange.start)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <Calendar
                    mode="single"
                    selected={customRange.start}
                    onSelect={(d) => d && setCustomRange((prev) => ({ ...prev, start: startOfDay(d) }))}
                    initialFocus
                    locale={zhCN}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">至</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 px-3 text-sm">
                    {toISODate(customRange.end)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <Calendar
                    mode="single"
                    selected={customRange.end}
                    onSelect={(d) => d && setCustomRange((prev) => ({ ...prev, end: endOfDay(d) }))}
                    initialFocus
                    locale={zhCN}
                  />
                </PopoverContent>
              </Popover>
            </>
          )}
          <span className="text-xs text-muted-foreground">
            {toISODate(range.start)} ~ {toISODate(range.end)}
          </span>
        </CardContent>
      </Card>

      {/* KPI 卡片 */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm text-muted-foreground">总成本</p>
              <p className="text-xl font-bold">{formatMoney(totalCost)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">本期销售实收</p>
              <p className="text-xl font-bold">{formatMoney(monthSalesReceived)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowRightLeft className="h-5 w-5 text-accent" />
            <div>
              <p className="text-sm text-muted-foreground">本期毛利</p>
              <p className="text-xl font-bold">{formatMoney(monthGrossProfit)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 图表区 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">收支趋势对比</CardTitle>
            <CardDescription>所选时间范围内每月收入与支出曲线（点击支出数据点查看构成明细）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${v.slice(5)}月`}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v) => formatMoney(Number(v))}
                    labelFormatter={(l) => `${l}月`}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="收入"
                    stroke="#8B6B4D"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#8B6B4D" }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name="支出"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(var(--accent))", cursor: "pointer" }}
                    activeDot={(props: {
                      cx?: number;
                      cy?: number;
                      payload?: { month?: string };
                    }) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill="hsl(var(--accent))"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            if (payload?.month) setDrilldownMonth(payload.month);
                          }}
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">客户回款与欠款排行榜</CardTitle>
            <CardDescription>前 5 名客户回款与累计欠款</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">回款额 TOP5</p>
                <div className="space-y-3">
                  {paymentRanksPadded.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-5 text-sm text-muted-foreground">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        {item.placeholder ? (
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground/50">暂无其他回款记录</span>
                            <span className="text-muted-foreground/50">-</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="truncate">{item.name}</span>
                              <span className="font-medium">{formatMoney(item.value)}</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${maxPayment ? (item.value / maxPayment) * 100 : 0}%` }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">累计欠款 TOP5</p>
                <div className="space-y-3">
                  {debtRanksPadded.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => !item.placeholder && setDetailCustomer(item.name)}
                      className="w-full flex items-center gap-3 text-left hover:bg-muted/50 rounded-md p-1 transition-colors"
                    >
                      <span className="w-5 text-sm text-muted-foreground">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        {item.placeholder ? (
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground/50">暂无其他欠款记录</span>
                            <span className="text-muted-foreground/50">-</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="truncate">{item.name}</span>
                              <span className="font-medium text-destructive">{formatMoney(item.value)}</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-destructive"
                                style={{ width: `${maxDebt ? (item.value / maxDebt) * 100 : 0}%` }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      {!item.placeholder && (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 欠款明细弹窗 */}
      <Dialog
        open={!!detailCustomer}
        onOpenChange={(open) => !open && setDetailCustomer(null)}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailCustomer} - 待回款订单明细</DialogTitle>
            <DialogDescription>
              当前客户名下未结清应收对应的销售订单
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {customerDebtOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">该客户暂无待回款订单</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">订单号</TableHead>
                      <TableHead className="whitespace-nowrap">客户</TableHead>
                      <TableHead className="whitespace-nowrap text-right">欠款金额</TableHead>
                      <TableHead className="whitespace-nowrap">应交日期</TableHead>
                      <TableHead className="whitespace-nowrap text-right">逾期天数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerDebtOrders.map((o) => (
                      <TableRow key={o.order_no}>
                        <TableCell className="whitespace-nowrap">{o.order_no}</TableCell>
                        <TableCell className="whitespace-nowrap">{o.customer_name}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatMoney(o.amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{o.due_date}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {o.overdue > 0 ? (
                            <Badge variant="destructive">{o.overdue} 天</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">未逾期</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 支出明细下钻弹窗 */}
      <Dialog open={!!drilldownMonth} onOpenChange={(open) => !open && setDrilldownMonth(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>{drilldownMonth} 支出构成明细</DialogTitle>
            <DialogDescription>当月各类支出金额（已折算人民币），点击折线图数据点查看</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {drilldownMonth && monthlyBreakdown[drilldownMonth] ? (
              (() => {
                const bd = monthlyBreakdown[drilldownMonth];
                const total = bd.采购面料 + bd.员工工资 + bd.外协加工;
                const items = [
                  { key: "采购面料", icon: Package },
                  { key: "员工工资", icon: Users },
                  { key: "外协加工", icon: Factory },
                ] as const;
                return (
                  <>
                    {items.map(({ key, icon: Icon }) => (
                      <div key={key} className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="truncate">{key}</span>
                            <span className="font-medium">{formatMoney(bd[key])}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${total ? (bd[key] / total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-3 text-sm font-medium">
                      <span>合计</span>
                      <span>{formatMoney(total)}</span>
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="text-sm text-muted-foreground">该月暂无支出数据</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 人员报表 ───────────────────────────────────────────── */

function PersonnelReportTab() {
  const store = useAppStore();

  const deptData = useMemo(() => {
    const map: Record<string, number> = {};
    store.employees.forEach((e) => {
      const d = e.department || "未分配";
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [store.employees]);

  const skillData = useMemo(() => {
    const map: Record<string, number> = {};
    store.employees.forEach((e) => {
      map[e.skill_level] = (map[e.skill_level] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [store.employees]);

  const perfData = useMemo(() => {
    return store.performanceRecords.map((r) => ({
      name: r.employee_name || r.employee_id,
      综合分: r.total_score,
    }));
  }, [store.performanceRecords]);

  const activeCount = store.employees.filter(
    (e) => e.status === "active",
  ).length;
  const attendanceNormalRate =
    store.attendanceRecords.length > 0
      ? (
          (store.attendanceRecords.filter((r) => r.status === "normal").length /
            store.attendanceRecords.length) *
          100
        ).toFixed(1)
      : "0.0";
  const completedTrainingCount = store.trainingRecords.filter(
    (t) => t.status === "completed",
  ).length;

  return (
    <TabsContent value="personnel" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">在职员工</p>
              <p className="text-xl font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">出勤正常率</p>
            <p className="text-xl font-bold text-green-600">
              {attendanceNormalRate}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已完成培训</p>
            <p className="text-xl font-bold">{completedTrainingCount} 场</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">部门人员分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deptData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                  >
                    {deptData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="horizontal"
                    wrapperStyle={{ paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">技能等级分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={skillData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                  >
                    {skillData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="horizontal"
                    wrapperStyle={{ paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">员工绩效对比</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="综合分" fill="#8B6B4D" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}

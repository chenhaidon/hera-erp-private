import { useMemo } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppStore } from "@/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  Monitor,
  Factory,
  Warehouse,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Users,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

const COLORS = [
  "#8B6B4D",
  "#C4A77D",
  "#A89F91",
  "#D8CFC2",
  "#B58A66",
  "#6B8B7D",
  "#9DB5A3",
];

export function DashboardPage() {
  const store = useAppStore();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const allInspections = useMemo(
    () => [
      ...store.materialInspections.map((i) => ({ ...i, source: "incoming" as const })),
      ...store.processInspections.map((i) => ({ ...i, source: "process" as const })),
      ...store.finishedInspections.map((i) => ({ ...i, source: "finished" as const })),
    ],
    [store.materialInspections, store.processInspections, store.finishedInspections],
  );

  const monthOrders = useMemo(
    () =>
      store.salesOrders.filter((o) =>
        (o.created_at || o.delivery_date || "").startsWith(currentMonth),
      ),
    [store.salesOrders],
  );
  const monthShipment = useMemo(
    () => store.salesOrders.filter((o) => o.status === "completed").length,
    [store.salesOrders],
  );
  const inventoryValue = useMemo(() => {
    return store.inventory.reduce((sum, i) => {
      let unitPrice = 0;
      if (i.type === "product") {
        const product = store.products.find((p) => p.id === i.product_id);
        unitPrice =
          product?.pricing_strategy?.cost_price ??
          product?.skus?.[0]?.suggested_price ??
          0;
      } else {
        const price = store.materialSupplierPrices.find(
          (p) => p.material_id === i.material_id && p.status === "active",
        );
        unitPrice = price?.price ?? 0;
      }
      return sum + i.quantity * unitPrice;
    }, 0);
  }, [store.inventory, store.products, store.materialSupplierPrices]);

  const overviewKPIs = [
    {
      label: "本月订单数",
      value: monthOrders.length.toString(),
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      label: "本月出货量",
      value: monthShipment.toString(),
      icon: Package,
      color: "text-green-500",
    },
    {
      label: "库存总金额",
      value: `¥${inventoryValue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-orange-500",
    },
    {
      label: "在制工单",
      value: store.workOrders
        .filter((w) => w.status === "producing")
        .length.toString(),
      icon: Factory,
      color: "text-blue-500",
    },
    {
      label: "合格批次",
      value: allInspections
        .filter((i) => i.result === "qualified")
        .length.toString(),
      icon: ShieldCheck,
      color: "text-green-600",
    },
    {
      label: "在职员工",
      value: store.employees
        .filter((e) => e.status === "active")
        .length.toString(),
      icon: Users,
      color: "text-purple-500",
    },
  ];

  const wipData = useMemo(() => {
    const counts: Record<string, number> = {};
    store.workOrders.forEach((w) => {
      w.operations.forEach((op) => {
        if (!op.completed) {
          const qty = w.plan_quantity - (op.completed_qty || 0);
          counts[op.name] = (counts[op.name] || 0) + qty;
        }
      });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [store.workOrders]);

  const outputTrend = useMemo(() => {
    const map: Record<string, number> = {};
    store.workOrders.forEach((wo) => {
      wo.operations.forEach((op) => {
        op.reports?.forEach((r) => {
          const d = (r.report_time || "").slice(0, 10);
          if (d) map[d] = (map[d] || 0) + r.qty;
        });
      });
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, value]) => ({ name, value }));
  }, [store.workOrders]);

  const inventoryCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    store.inventory.forEach((i) => {
      const key = i.type === "product" ? "成品" : "物料";
      counts[key] = (counts[key] || 0) + i.quantity;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [store.inventory]);

  const orderChannelData = useMemo(() => {
    const map: Record<string, number> = {};
    store.salesOrders.forEach((o) => {
      map[o.channel] = (map[o.channel] || 0) + o.total_amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [store.salesOrders]);

  const workOrderStatusData = useMemo(() => {
    const map: Record<string, number> = {};
    store.workOrders.forEach((w) => {
      map[w.status] = (map[w.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [store.workOrders]);

  const exceptionStatusData = useMemo(() => {
    const map: Record<string, number> = {
      pending: 0,
      processing: 0,
      resolved: 0,
    };
    store.productionExceptions.forEach((e) => {
      map[e.status] = (map[e.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [store.productionExceptions]);

  const qualifiedRate = useMemo(() => {
    const total = allInspections.length;
    const ok = allInspections.filter((i) => i.result === "qualified").length;
    return total > 0 ? ((ok / total) * 100).toFixed(1) : "0.0";
  }, [allInspections]);

  const stockAlerts = store.inventory.filter(
    (i) => i.quantity < i.min_stock,
  ).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="数据大屏"
        description="总览/生产/仓库/质量/销售实时数据看板"
      />
      <ControlledTabs modulePath="/dashboard" defaultTab="overview">
        <TabsList className="bg-muted flex-wrap">
          <TabsTrigger value="overview">总览大屏</TabsTrigger>
          <TabsTrigger value="production">生产大屏</TabsTrigger>
          <TabsTrigger value="warehouse">仓库大屏</TabsTrigger>
          <TabsTrigger value="quality">质量大屏</TabsTrigger>
          <TabsTrigger value="sales">销售大屏</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {overviewKPIs.map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {kpi.label}
                      </p>
                      <p className="text-xl font-bold">{kpi.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-primary" />
                  实时生产进度
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {store.workOrders.map((w) => (
                    <div key={w.id}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>
                          {w.work_no} {w.product_name}
                        </span>
                        <span>{w.progress}%</span>
                      </div>
                      <Progress value={w.progress} className="h-2" />
                    </div>
                  ))}
                  {store.workOrders.length === 0 && (
                    <p className="text-sm text-muted-foreground">暂无工单</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  渠道销售额分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderChannelData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                      >
                        {orderChannelData.map((_, idx) => (
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
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">总工单</p>
                <p className="text-2xl font-bold">{store.workOrders.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">在制工单</p>
                <p className="text-2xl font-bold text-blue-500">
                  {
                    store.workOrders.filter((w) => w.status === "producing")
                      .length
                  }
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">异常待处理</p>
                <p className="text-2xl font-bold text-destructive">
                  {
                    store.productionExceptions.filter(
                      (e) => e.status !== "resolved",
                    ).length
                  }
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">平均进度</p>
                <p className="text-2xl font-bold text-green-600">
                  {store.workOrders.length > 0
                    ? Math.round(
                        store.workOrders.reduce((s, w) => s + w.progress, 0) /
                          store.workOrders.length,
                      )
                    : 0}
                  %
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Factory className="h-4 w-4 text-primary" />
                  各工序在制品分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-60 w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={wipData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8B6B4D" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  工单状态分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-60 w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={workOrderStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                      >
                        {workOrderStatusData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
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
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  工序日产出趋势
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-60 w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={outputTrend}>
                      <defs>
                        <linearGradient
                          id="colorOutput"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#8B6B4D"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#8B6B4D"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#8B6B4D"
                        fill="url(#colorOutput)"
                        name="报工数量"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">异常处理状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-60 w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={exceptionStatusData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#C4A77D" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="warehouse" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">库存品项</p>
                <p className="text-2xl font-bold">{store.inventory.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">库存总数量</p>
                <p className="text-2xl font-bold">
                  {store.inventory
                    .reduce((s, i) => s + i.quantity, 0)
                    .toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">低于安全库存</p>
                <p className="text-2xl font-bold text-destructive">
                  {stockAlerts}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">库存金额</p>
                <p className="text-2xl font-bold text-orange-500">
                  ¥{inventoryValue.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-primary" />
                  库存品类占比
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-60 w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={inventoryCategory}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {inventoryCategory.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
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
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  库存预警明细
                </CardTitle>
              </CardHeader>
              <CardContent>
                {store.inventory.filter((i) => i.quantity < i.min_stock)
                  .length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    暂无库存预警
                  </p>
                ) : (
                  <div className="space-y-2">
                    {store.inventory
                      .filter((i) => i.quantity < i.min_stock)
                      .map((i) => {
                        const name =
                          i.type === "product"
                            ? store.products.find((p) => p.id === i.product_id)
                                ?.name
                            : store.materials.find(
                                (m) => m.id === i.material_id,
                              )?.name;
                        return (
                          <div
                            key={i.id}
                            className="flex items-center justify-between rounded border p-2 text-sm"
                          >
                            <span>{name || i.id}</span>
                            <Badge variant="destructive">
                              {i.quantity} &lt; {i.min_stock}
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">检验总次</p>
                <p className="text-2xl font-bold">{allInspections.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">合格率</p>
                <p className="text-2xl font-bold text-green-600">
                  {qualifiedRate}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">不合格批次</p>
                <p className="text-2xl font-bold text-destructive">
                  {allInspections.filter((i) => i.result !== "qualified").length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">来料检验</p>
                <p className="text-2xl font-bold">
                  {store.materialInspections.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">过程检验</p>
                <p className="text-2xl font-bold">
                  {store.processInspections.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">成品检验</p>
                <p className="text-2xl font-bold">
                  {store.finishedInspections.length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">合格批次</p>
                <p className="text-2xl font-bold text-green-600">
                  {allInspections.filter((i) => i.result === "qualified").length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">本月检验</p>
                <p className="text-2xl font-bold">
                  {
                    allInspections.filter((i) =>
                      (i.created_at || "").startsWith(currentMonth),
                    ).length
                  }
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                检验结果分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: "合格",
                          value: allInspections.filter(
                            (i) => i.result === "qualified",
                          ).length,
                        },
                        {
                          name: "不合格",
                          value: allInspections.filter(
                            (i) => i.result !== "qualified",
                          ).length,
                        },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                    >
                      <Cell fill="#6B8B7D" />
                      <Cell fill="#ef4444" />
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
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">订单总数</p>
                <p className="text-2xl font-bold">{store.salesOrders.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">销售总额</p>
                <p className="text-2xl font-bold text-primary">
                  ¥
                  {store.salesOrders
                    .reduce((s, o) => s + o.total_amount, 0)
                    .toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">本月销售</p>
                <p className="text-2xl font-bold text-orange-500">
                  ¥
                  {monthOrders
                    .reduce((s, o) => s + o.total_amount, 0)
                    .toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">完成订单</p>
                <p className="text-2xl font-bold text-green-600">
                  {
                    store.salesOrders.filter((o) => o.status === "completed")
                      .length
                  }
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">渠道销售额趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={orderChannelData}>
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
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </ControlledTabs>
    </div>
  );
}

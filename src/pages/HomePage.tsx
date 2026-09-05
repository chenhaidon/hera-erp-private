import { StatCard } from "@/components/common/StatCard";
import {
  ShoppingCart,
  Factory,
  Warehouse,
  TrendingUp,
  ClipboardList,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useAppStore } from "@/store";
import {
  formatMoney,
  ORDER_STATUS,
  getStatusLabel,
  getStatusColor,
} from "@/lib/data";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/db/supabase";
import { AlertTriangle } from "lucide-react";
import type { EcommerceAlertLog } from "@/types";

export function HomePage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const [ecommerceAlerts, setEcommerceAlerts] = useState<EcommerceAlertLog[]>([]);

  const todayOrders = store.salesOrders.filter(
    (o) => o.status !== "completed",
  ).length;
  const activeWorkOrders = store.workOrders.filter(
    (w) => w.status === "producing",
  ).length;
  const lowStock = store.inventory.filter(
    (i) => i.quantity < i.min_stock,
  ).length;
  const monthlyOutput = store.workOrders.reduce(
    (sum, w) => sum + (Number(w.completed_quantity) || 0),
    0,
  );

  // 本月产值：按当前年月筛选已完成销售订单，按汇率换算为人民币
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rateMap = new Map<string, number>();
  for (const r of store.exchangeRates) rateMap.set(r.currency, r.rate);
  const toCny = (amount: number, currency: string) =>
    amount * (rateMap.get(currency) || 1);

  const thisMonthCompleted = store.salesOrders.filter(
    (o) =>
      o.status === "completed" &&
      o.delivery_date &&
      o.delivery_date.slice(0, 7) === yearMonth,
  );
  const monthlyValue = thisMonthCompleted.reduce(
    (sum, o) => sum + toCny(o.total_amount || 0, o.currency || "CNY"),
    0,
  );

  const todos = [
    {
      label: "待审核订单",
      count: store.salesOrders.filter((o) => o.status === "pending").length,
      icon: ShoppingCart,
      path: "/marketing",
    },
    {
      label: "待检验批次",
      // 成品检验单中待检验的批次数量
      count: store.finishedInspections.filter((f) => f.status === "pending")
        .length,
      icon: ShieldCheck,
      path: "/quality",
    },
    {
      label: "待发货订单",
      count: store.salesOrders.filter((o) => o.status === "shipping").length,
      icon: Truck,
      path: "/marketing",
    },
  ];

  useEffect(() => {
    async function loadAlerts() {
      const { data, error } = await supabase
        .from('ecommerce_alert_log')
        .select('*')
        .eq('alert_status', 'pending')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setEcommerceAlerts(data as EcommerceAlertLog[]);
      }
    }
    loadAlerts();
  }, []);

  return (
    <div className="space-y-6">
      {ecommerceAlerts.length > 0 && (
        <div
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
          onClick={() => navigate('/ecommerce?tab=platform-auth')}
          role="button"
          tabIndex={0}
        >
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              {ecommerceAlerts.some((a) => a.alert_type === 'sync_failed')
                ? '某电商平台订单拉取失败，请尽快检查授权状态。'
                : '某电商平台授权异常，请尽快检查授权状态。'}
            </p>
            <p className="text-sm text-destructive/90">
              {ecommerceAlerts.slice(0, 3).map((a) => `${a.platform_code || ''} ${a.shop_name || ''}`).join('、')}
            </p>
          </div>
        </div>
      )}
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">首页工作台</h1>
        <p className="text-sm text-muted-foreground">
          欢迎来到浦江家纺智造管理平台
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="今日订单数"
          value={todayOrders}
          icon={ShoppingCart}
          description="待处理销售订单"
          onClick={() => navigate("/marketing?tab=orders")}
        />
        <StatCard
          title="在产工单数"
          value={activeWorkOrders}
          icon={Factory}
          description="正在生产中的工单"
          trend={`本月累计产量 ${monthlyOutput} 件/套`}
          onClick={() => navigate("/production?tab=orders&status=producing")}
        />
        <StatCard
          title="库存预警数"
          value={lowStock}
          icon={Warehouse}
          description="低于安全库存的物料/成品"
          onClick={() => navigate("/inventory?tab=product&low=1")}
        />
        <StatCard
          title="本月产值"
          value={formatMoney(monthlyValue)}
          icon={TrendingUp}
          description="按本月交货且已完成的销售订单合计（已汇率换算）"
          trend={`本月累计产量 ${monthlyOutput} 件/套`}
          onClick={() => navigate("/finance?tab=dashboard")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" />
              待办事项
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {todos.map((todo) => (
                <button
                  key={todo.label}
                  onClick={() => navigate(todo.path)}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <todo.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{todo.label}</span>
                  </div>
                  <span className="text-lg font-bold text-primary">
                    {todo.count}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" />
              快捷入口
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => navigate("/marketing")}>
              新建销售订单
            </Button>
            <Button variant="outline" onClick={() => navigate("/production")}>
              新建生产工单
            </Button>
            <Button variant="outline" onClick={() => navigate("/inventory")}>
              成品入库
            </Button>
            <Button variant="outline" onClick={() => navigate("/quality")}>
              质量检验
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">近期订单状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {store.salesOrders.slice(0, 5).map((order) => {
              const status = getStatusLabel(order.status, ORDER_STATUS);
              const color = getStatusColor(order.status, ORDER_STATUS);
              return (
                <button
                  key={order.id}
                  onClick={() => navigate(`/marketing?tab=orders&detailId=${order.id}`)}
                  className="flex w-full items-center justify-between rounded-md border border-border p-3 text-left transition-colors hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{order.order_no}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.customer_name} · {order.order_type}
                    </p>
                  </div>
                  <span
                    className={`ml-3 shrink-0 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white ${color}`}
                  >
                    {status}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

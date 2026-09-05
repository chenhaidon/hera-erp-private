import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store";
import { Truck, Factory, Wallet, CreditCard, Users } from "lucide-react";
import { PayablePurchaseList } from "./PayablePurchaseList";
import { PayableProcessingList } from "./PayableProcessingList";
import { PayableSalaryList } from "./PayableSalaryList";

const CY = (amount: number) =>
  `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function PayableTab() {
  const store = useAppStore();
  const [subTab, setSubTab] = useState("purchase");
  const month = currentMonth();

  const stats = useMemo(() => {
    // 按实际付款记录计算已付金额，确保与应付口径一致
    const paidByOrder = (orderId: string) =>
      store.paymentRecords
        .filter((p) => p.type === "pay" && p.status === "completed" && p.order_id === orderId)
        .reduce((s, p) => s + p.amount, 0);

    const purchaseOrders = store.purchaseOrders.filter(
      (o) => o.status === "completed" || o.status === "received",
    );

    const purchasePayable = purchaseOrders.reduce(
      (s, o) => s + Math.max(0, o.total_amount - paidByOrder(o.id)),
      0,
    );
    const purchaseCount = purchaseOrders.filter(
      (o) => o.total_amount > paidByOrder(o.id),
    ).length;

    const processingOrders = store.outsourceProcessingPayments;
    const processingPayable = processingOrders
      .filter((p) => p.status === "confirmed")
      .reduce((s, p) => s + Math.max(0, p.amount - paidByOrder(p.id)), 0);
    const processingCount = processingOrders.filter(
      (p) => p.status === "confirmed" && p.amount > paidByOrder(p.id),
    ).length;

    // 员工报工薪资应付：pending/confirmed 且未付清的工资记录
    const salaryRecords = store.salaryRecords.filter((s) => s.month === month);
    const salaryPayable = salaryRecords
      .filter((s) => s.status !== "paid")
      .reduce((s, r) => s + Math.max(0, r.amount - paidByOrder(r.id)), 0);
    const salaryCount = salaryRecords.filter(
      (s) => s.status !== "paid" && s.amount > paidByOrder(s.id),
    ).length;
    const salaryPaid = salaryRecords.reduce((s, r) => s + paidByOrder(r.id), 0);
    const salaryPaidCount = salaryRecords.filter((r) => paidByOrder(r.id) > 0).length;

    const total = purchasePayable + processingPayable + salaryPayable;

    const purchasePaid = purchaseOrders.reduce((s, o) => s + paidByOrder(o.id), 0);
    const purchasePaidCount = purchaseOrders.filter((o) => paidByOrder(o.id) > 0).length;

    const processingPaid = processingOrders.reduce((s, p) => s + paidByOrder(p.id), 0);
    const processingPaidCount = processingOrders.filter((p) => paidByOrder(p.id) > 0).length;

    const totalPaid = purchasePaid + processingPaid + salaryPaid;

    return {
      purchasePayable,
      purchaseCount,
      processingPayable,
      processingCount,
      salaryPayable,
      salaryCount,
      total,
      purchasePaid,
      purchasePaidCount,
      processingPaid,
      processingPaidCount,
      salaryPaid,
      salaryPaidCount,
      totalPaid,
    };
  }, [store.purchaseOrders, store.outsourceProcessingPayments, store.salaryRecords, store.paymentRecords, month]);

  const cards = [
    {
      label: "采购应付",
      value: stats.purchasePayable,
      count: stats.purchaseCount,
      icon: Truck,
      color: "text-blue-500",
    },
    {
      label: "加工款应付",
      value: stats.processingPayable,
      count: stats.processingCount,
      icon: Factory,
      color: "text-orange-500",
    },
    {
      label: "员工薪资应付",
      value: stats.salaryPayable,
      count: stats.salaryCount,
      icon: Users,
      color: "text-purple-500",
    },
    {
      label: "总计应付",
      value: stats.total,
      count: stats.purchaseCount + stats.processingCount + stats.salaryCount,
      icon: Wallet,
      color: "text-destructive",
    },
    {
      label: "总计已付",
      value: stats.totalPaid,
      count: stats.purchasePaidCount + stats.processingPaidCount + stats.salaryPaidCount,
      icon: CreditCard,
      color: "text-green-500",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-lg bg-muted ${c.color}`}>
                <c.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">{c.label}</p>
                <p className="text-xl font-bold">{CY(c.value)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.label === "总计已付" ? "已付款" : "待付款"} {c.count} 笔
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
        <TabsList className="bg-muted">
          <TabsTrigger value="purchase">应付采购款</TabsTrigger>
          <TabsTrigger value="processing">加工款应付</TabsTrigger>
          <TabsTrigger value="salary">员工薪资应付</TabsTrigger>
        </TabsList>
        <TabsContent value="purchase" className="mt-4">
          <PayablePurchaseList />
        </TabsContent>
        <TabsContent value="processing" className="mt-4">
          <PayableProcessingList />
        </TabsContent>
        <TabsContent value="salary" className="mt-4">
          <PayableSalaryList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
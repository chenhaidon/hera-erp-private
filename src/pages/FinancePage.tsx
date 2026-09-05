import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { syncContractStatusFromSalesOrders } from "@/lib/contract";
import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayableTab } from "@/pages/finance/PayableTab";
import { SalaryDetailTab } from "@/pages/finance/SalaryDetailTab";
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
import {
  Banknote,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  CheckCircle2,
  Plus,
} from "lucide-react";
import type { FinanceRecord, PaymentRecord } from "@/types";
import { nanoid } from "@/lib/utils";

const CY = (amount: number, currency = "CNY") =>
  `${currency === "USD" ? "$" : currency === "EUR" ? "€" : "¥"}${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";
  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title="财务管理"
        description="资金看板、应收应付、成本核算与薪资明细"
      />
      <ControlledTabs
        modulePath="/finance"
        defaultTab="dashboard"
        activeTab={activeTab}
        onActiveTabChange={handleTabChange}
      >
        <TabsList className="bg-muted">
          <TabsTrigger value="dashboard">资金看板</TabsTrigger>
          <TabsTrigger value="receivable">应收账款</TabsTrigger>
          <TabsTrigger value="payable">应付款</TabsTrigger>
          <TabsTrigger value="salary-detail">报工薪资明细</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="receivable">
          <ReceivableTab />
        </TabsContent>
        <TabsContent value="payable">
          <PayableTab />
        </TabsContent>
        <TabsContent value="salary-detail">
          <SalaryDetailTab />
        </TabsContent>
      </ControlledTabs>
    </div>
  );
}

/* ─── 资金看板 ───────────────────────────────────────────── */

function DashboardTab() {
  const store = useAppStore();
  const receivables = store.financeRecords.filter((f) => f.type === "应收");
  const costs = store.financeRecords.filter((f) => f.type === "cost");

  const totalReceivable = receivables.reduce(
    (s, f) => s + (f.amount - f.paid_amount),
    0,
  );

  // 未付应付：从采购订单 + 外协加工费应付中汇总，与应付款 tab 口径一致
  const paidByOrder = (orderId: string) =>
    store.paymentRecords
      .filter((p) => p.type === "pay" && p.status === "completed" && p.order_id === orderId)
      .reduce((s, p) => s + p.amount, 0);
  const purchasePayable = store.purchaseOrders
    .filter((o) => o.status === "completed" || o.status === "received")
    .reduce((s, o) => s + Math.max(0, o.total_amount - paidByOrder(o.id)), 0);
  const processingPayable = store.outsourceProcessingPayments
    .filter((p) => p.status === "confirmed")
    .reduce((s, p) => s + Math.max(0, p.amount - paidByOrder(p.id)), 0);
  const totalPayable = purchasePayable + processingPayable;
  // 人工薪资只取财务记录中 type=salary 的薪资数据，避免与工序费用/外协加工费混淆
  const salaries = store.financeRecords.filter((f) => f.type === "salary");
  const totalSalary = useMemo(
    () => salaries.reduce((s, f) => s + f.amount, 0),
    [salaries],
  );
  const totalIncome = receivables.reduce((s, f) => s + f.paid_amount, 0);

  const stats = [
    {
      label: "未收应收",
      value: CY(totalReceivable),
      icon: ArrowUpRight,
      color: "text-blue-500",
    },
    {
      label: "未付应付",
      value: CY(totalPayable),
      icon: ArrowDownRight,
      color: "text-destructive",
    },
    {
      label: "实收款",
      value: CY(totalIncome),
      icon: DollarSign,
      color: "text-green-500",
    },
    {
      label: "人工薪资",
      value: CY(totalSalary),
      icon: Banknote,
      color: "text-purple-500",
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
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TabsContent>
  );
}

/* ─── 应收账款 ───────────────────────────────────────────── */

function ReceivableTab() {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<FinanceRecord>>({
    type: "应收",
    currency: "CNY",
    paid_amount: 0,
    status: "unsettled",
  });
  const [search, setSearch] = useState("");

  const records = useMemo(
    () =>
      store.financeRecords
        .filter((f) => f.type === "应收")
        .filter((f) => {
          if (!search) return true;
          const s = search.toLowerCase();
          return (
            f.counterparty.toLowerCase().includes(s) ||
            (f.related_order || "").toLowerCase().includes(s) ||
            (f.contract_no || "").toLowerCase().includes(s)
          );
        }),
    [store.financeRecords, search],
  );
  const total = records.reduce((s, f) => s + f.amount, 0);
  const totalPaid = records.reduce((s, f) => s + f.paid_amount, 0);
  const totalUnpaid = total - totalPaid;

  function save() {
    if (!form.counterparty || !form.amount) return;
    const payload: FinanceRecord = {
      ...(form as FinanceRecord),
      id: nanoid(),
      record_date: new Date().toISOString().split("T")[0],
    };
    store.addFinanceRecord(payload);
    setOpen(false);
    setForm({
      type: "应收",
      currency: "CNY",
      paid_amount: 0,
      status: "unsettled",
    });
  }

  async function settleReceivable(item: FinanceRecord, amount: number) {
    if (!amount || amount <= 0) return;
    const newPaid = Math.min(item.paid_amount + amount, item.amount);
    const settled = newPaid >= item.amount;
    const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");
    const paymentDate = new Date().toISOString().split("T")[0];
    store.updateFinanceRecord({
      ...item,
      paid_amount: newPaid,
      status: settled ? "settled" : "partial",
    });
    store.addPaymentRecord({
      id: nanoid(),
      code: `REC-${Date.now().toString().slice(-6)}`,
      type: "receive",
      order_id: item.related_order_id,
      order_no: item.related_order,
      counterparty: item.counterparty,
      amount,
      currency: item.currency || "CNY",
      payment_date: paymentDate,
      payment_method: "银行转账",
      status: "completed",
    });
    if (settled) {
      const order = item.related_order_id
        ? store.salesOrders.find((o) => o.id === item.related_order_id)
        : store.salesOrders.find((o) => o.order_no === item.related_order);
      if (order) {
        await store.updateSalesOrder({
          ...order,
          status: "completed",
          payment_date: paymentDate,
          logs: [
            ...(order.logs || []),
            {
              status: "completed",
              operator: currentUserName,
              time: nowStr,
              remark: `应收账款已结清，销售订单回款完成`,
            },
          ],
        });
        toast.success(`销售订单 ${order.order_no} 已更新为已完成`);
        // 同步更新关联合同状态为已完结
        await syncContractStatusFromSalesOrders(
          store.salesOrders.map((o) =>
            o.id === order.id ? { ...o, status: "completed" } : o,
          ),
          store.contracts,
          store.updateContract,
        );
      }
    }
  }

  async function collect(item: FinanceRecord) {
    const paid = Number(
      prompt("请输入收款金额", String(item.amount - item.paid_amount)),
    );
    await settleReceivable(item, paid);
  }

  async function settleFull(item: FinanceRecord) {
    await settleReceivable(item, item.amount - item.paid_amount);
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
    <TabsContent value="receivable" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">应收总额</p>
            <p className="text-xl font-bold">{CY(total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已收</p>
            <p className="text-xl font-bold text-green-600">{CY(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">未收余额</p>
            <p className="text-xl font-bold text-destructive">
              {CY(totalUnpaid)}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="搜索客户/关联单号/合同编号"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-64"
        />
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新增应收
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">客户</TableHead>
                <TableHead className="whitespace-nowrap">币种</TableHead>
                <TableHead className="whitespace-nowrap">应收</TableHead>
                <TableHead className="whitespace-nowrap">已收</TableHead>
                <TableHead className="whitespace-nowrap">未收</TableHead>
                <TableHead className="whitespace-nowrap">关联单号</TableHead>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsPaginated.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {f.counterparty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {f.currency}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {CY(f.amount, f.currency)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-green-600">
                    {CY(f.paid_amount, f.currency)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-destructive">
                    {CY(f.amount - f.paid_amount, f.currency)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {f.related_order || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {f.contract_no || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {f.status === "settled" ? (
                      <Badge variant="default" className="bg-green-500">
                        已结清
                      </Badge>
                    ) : f.status === "partial" ? (
                      <Badge variant="secondary">部分收款</Badge>
                    ) : (
                      <Badge variant="outline">待回款</Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-col gap-1 md:flex-row">
                      {f.status !== "settled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => collect(f)}
                        >
                          登记收款
                        </Button>
                      )}
                      {f.status !== "settled" && (
                        <Button
                          size="sm"
                          onClick={() => settleFull(f)}
                        >
                          一键结清
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无应收记录
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
          if (!v)
            setForm({
              type: "应收",
              currency: "CNY",
              paid_amount: 0,
              status: "unsettled",
            });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>新增应收账款</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>客户</Label>
              <Select
                value={form.customer_id || "none"}
                onValueChange={(v) => {
                  const c = store.customers.find((x) => x.id === v);
                  setForm({
                    ...form,
                    customer_id: c?.id || "",
                    counterparty: c?.name || "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择客户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">选择客户</SelectItem>
                  {store.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>关联销售订单</Label>
              <Select
                value={form.related_order_id || "none"}
                onValueChange={(v) => {
                  const o = store.salesOrders.find((x) => x.id === v);
                  setForm({
                    ...form,
                    related_order_id: o?.id,
                    related_order: o?.order_no,
                    contract_no: o?.contract_no,
                    amount: o ? o.total_amount : form.amount,
                    currency: o ? o.currency : form.currency || "CNY",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择订单" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联</SelectItem>
                  {store.salesOrders
                    .filter(
                      (o) =>
                        !form.customer_id || o.customer_id === form.customer_id,
                    )
                    .map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.order_no} · {o.customer_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>合同编号</Label>
              <Input
                value={form.contract_no || ""}
                onChange={(e) =>
                  setForm({ ...form, contract_no: e.target.value })
                }
                placeholder="不关联可留空"
              />
            </div>
            <div className="grid gap-2">
              <Label>币种</Label>
              <Select
                value={form.currency || "CNY"}
                onValueChange={(v) => setForm({ ...form, currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">CNY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>应收金额</Label>
              <Input
                type="number"
                value={form.amount || ""}
                onChange={(e) =>
                  setForm({ ...form, amount: Number(e.target.value) })
                }
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
    </TabsContent>
  );
}


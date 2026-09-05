import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/store";
import { PaymentDialog } from "@/components/finance/PaymentDialog";
import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";

const CY = (amount: number) =>
  `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PayableProcessingList() {
  const store = useAppStore();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("unpaid");
  const [payOpen, setPayOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 按实际付款记录计算剩余应付金额，读取真实数据
  const paidByOrder = (orderId: string) =>
    store.paymentRecords
      .filter((p) => p.type === "pay" && p.status === "completed" && p.order_id === orderId)
      .reduce((s, p) => s + p.amount, 0);

  const payablePayments = useMemo(
    () =>
      store.outsourceProcessingPayments
        .filter((p) => p.status === "confirmed")
        .map((p) => ({ ...p, remaining: Math.max(0, p.amount - paidByOrder(p.id)) }))
        .filter((p) => p.remaining > 0),
    [store.outsourceProcessingPayments, store.paymentRecords],
  );

  const totalAmount = payablePayments.reduce((s, p) => s + p.remaining, 0);
  const pendingCount = payablePayments.length;

  const rows = useMemo(() => {
    return store.outsourceProcessingPayments
      .map((p) => ({ ...p, remaining: Math.max(0, p.amount - paidByOrder(p.id)) }))
      .filter((p) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "paid") return p.remaining <= 0;
        if (statusFilter === "pending") return p.status === "pending";
        return p.status === "confirmed" && p.remaining > 0;
      })
      .filter((p) => {
        if (!filter) return true;
        const name = (p.factory_name || "").toLowerCase();
        return (
          p.payment_no.toLowerCase().includes(filter.toLowerCase()) ||
          name.includes(filter.toLowerCase()) ||
          (p.contract_no || "").toLowerCase().includes(filter.toLowerCase())
        );
      })
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [store.outsourceProcessingPayments, filter, statusFilter, store.paymentRecords]);

  const {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    setPage,
    setPageSize,
  } = usePagination(rows);

  const selected = rows.find((r) => r.id === selectedId);

  function handlePay(data: {
    amount: number;
    payment_date: string;
    payment_method: string;
    remark: string;
  }) {
    if (!selected) return;
    store.updateOutsourceProcessingPayment({
      ...selected,
      status: "paid",
      payment_amount: data.amount,
      payment_date: data.payment_date,
      payment_method: data.payment_method,
      remark: data.remark || selected.remark,
      updated_at: new Date().toISOString(),
    });
    store.addPaymentRecord({
      id: `${selected.id}-pay-${Date.now()}`,
      code: `PAY-${Date.now().toString().slice(-6)}`,
      type: "pay",
      order_id: selected.id,
      order_no: selected.payment_no,
      counterparty: selected.factory_name || "加工人员",
      amount: data.amount,
      currency: "CNY",
      payment_date: data.payment_date,
      payment_method: data.payment_method,
      status: "completed",
    });
    toast.success(`加工款 ${selected.payment_no} 已确认付款`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">应付总额</p>
            <p className="text-xl font-bold">{CY(totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">待付款笔数</p>
            <p className="text-xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索加工款单号或加工人员..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          {[
            { v: "all", l: "全部" },
            { v: "unpaid", l: "待付款" },
            { v: "pending", l: "待确认" },
            { v: "paid", l: "已付款" },
          ].map((s) => (
            <Button
              key={s.v}
              variant={statusFilter === s.v ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s.v)}
            >
              {s.l}
            </Button>
          ))}
        </div>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto bg-card">
          <Table className="[&>div]:max-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">往来单位</TableHead>
                <TableHead className="whitespace-nowrap">应付金额</TableHead>
                <TableHead className="whitespace-nowrap">付款日期</TableHead>
                <TableHead className="whitespace-nowrap">付款状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((p) => {
                const isPaid = p.remaining <= 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{p.factory_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{CY(p.amount)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isPaid && p.payment_date
                        ? (p.payment_date || "").split("T")[0]
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.status === "pending" ? (
                        <Badge variant="outline">待确认</Badge>
                      ) : isPaid ? (
                        <Badge className="bg-green-500">已结清</Badge>
                      ) : (
                        <Badge variant="secondary">待付款</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.status === "confirmed" && !isPaid ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedId(p.id);
                            setPayOpen(true);
                          }}
                        >
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          确认付款
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">已结清</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    暂无加工款结算记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        defaultAmount={selected?.amount ?? 0}
        onConfirm={handlePay}
      />
    </div>
  );
}
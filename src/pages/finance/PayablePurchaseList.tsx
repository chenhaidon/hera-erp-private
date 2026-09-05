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
import { Search, CheckCircle2, Eye } from "lucide-react";
import { useAppStore } from "@/store";
import { PaymentDialog } from "@/components/finance/PaymentDialog";
import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { PurchaseOrder } from "@/types";

const CY = (amount: number) =>
  `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PayablePurchaseList() {
  const store = useAppStore();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [payOpen, setPayOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 按实际付款记录计算剩余应付金额，读取真实数据
  const paidByOrder = (orderId: string) =>
    store.paymentRecords
      .filter((p) => p.type === "pay" && p.status === "completed" && p.order_id === orderId)
      .reduce((s, p) => s + p.amount, 0);

  const purchaseOrders = useMemo(
    () => store.purchaseOrders.filter((o) => o.status === "completed" || o.status === "received"),
    [store.purchaseOrders],
  );

  const payableOrders = useMemo(
    () =>
      purchaseOrders
        .map((o) => ({ ...o, remaining: Math.max(0, o.total_amount - paidByOrder(o.id)) }))
        .filter((o) => o.payment_status !== "paid"),
    [purchaseOrders, store.paymentRecords],
  );

  const totalAmount = payableOrders.reduce((s, o) => s + o.remaining, 0);
  const pendingCount = payableOrders.length;

  const rows = useMemo(() => {
    return purchaseOrders
      .map((o) => ({ ...o, remaining: Math.max(0, o.total_amount - paidByOrder(o.id)) }))
      .filter((o) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "paid") return o.payment_status === "paid";
        if (statusFilter === "partial") return o.payment_status === "partial";
        return o.payment_status === "unpaid";
      })
      .filter((o) => {
        if (!filter) return true;
        return (
          o.order_no.toLowerCase().includes(filter.toLowerCase()) ||
          o.supplier_name.toLowerCase().includes(filter.toLowerCase()) ||
          (o.contract_no || "").toLowerCase().includes(filter.toLowerCase())
        );
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [purchaseOrders, filter, statusFilter, store.paymentRecords]);

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

  function getPaymentDate(orderId: string) {
    const payment = store.paymentRecords
      .filter((p) => p.type === "pay" && p.order_id === orderId)
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date))[0];
    return payment?.payment_date;
  }

  function handlePay(data: {
    amount: number;
    payment_date: string;
    payment_method: string;
    remark: string;
  }) {
    if (!selected) return;
    const totalPaid = paidByOrder(selected.id) + data.amount;
    const nextStatus: PurchaseOrder['payment_status'] =
      totalPaid <= 0 ? 'unpaid' : totalPaid >= selected.total_amount ? 'paid' : 'partial';
    store.updatePurchaseOrder({
      ...selected,
      payment_status: nextStatus,
    });
    store.addPaymentRecord({
      id: `${selected.id}-pay-${Date.now()}`,
      code: `PAY-${Date.now().toString().slice(-6)}`,
      type: "pay",
      order_id: selected.id,
      order_no: selected.order_no,
      counterparty: selected.supplier_name,
      amount: data.amount,
      currency: selected.currency || "CNY",
      payment_date: data.payment_date,
      payment_method: data.payment_method,
      status: "completed",
    });
    toast.success(`采购单 ${selected.order_no} 已确认付款`);
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
            placeholder="搜索采购单号或供应商..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { v: "all", l: "全部" },
            { v: "unpaid", l: "待付款" },
            { v: "partial", l: "部分付款" },
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
                <TableHead className="whitespace-nowrap">关联单号</TableHead>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">往来单位</TableHead>
                <TableHead className="whitespace-nowrap">应付金额</TableHead>
                <TableHead className="whitespace-nowrap">付款日期</TableHead>
                <TableHead className="whitespace-nowrap">付款状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((o) => {
                const hasPaid = o.payment_status === "paid" || o.payment_status === "partial";
                return (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {o.order_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-sm text-primary">
                      {o.contract_no || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{o.supplier_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{CY(o.total_amount)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {hasPaid ? (getPaymentDate(o.id) || "—") : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {o.payment_status === "paid" ? (
                        <Badge className="bg-green-500">已付款</Badge>
                      ) : o.payment_status === "partial" ? (
                        <Badge className="bg-yellow-500">部分付款</Badge>
                      ) : (
                        <Badge variant="secondary">待付款</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedId(o.id);
                            setDetailOpen(true);
                          }}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          详情
                        </Button>
                        {o.payment_status !== "paid" ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedId(o.id);
                              setPayOpen(true);
                            }}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            确认付款
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">已付款</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    暂无采购记录
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
        defaultAmount={selected?.total_amount ?? 0}
        totalAmount={selected?.total_amount}
        paidAmount={selected ? paidByOrder(selected.id) : 0}
        onConfirm={handlePay}
      />
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-balance">采购单详情</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">采购单号</p>
                  <p className="font-medium">{selected.order_no}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">合同编号</p>
                  <p className="font-medium">{selected.contract_no || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">供应商</p>
                  <p className="font-medium">{selected.supplier_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">采购日期</p>
                  <p className="font-medium">{selected.issued_date || "—"}</p>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="mb-2 text-sm font-medium">采购明细</h4>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">物料名称</TableHead>
                        <TableHead className="whitespace-nowrap">规格</TableHead>
                        <TableHead className="whitespace-nowrap">数量</TableHead>
                        <TableHead className="whitespace-nowrap">单价</TableHead>
                        <TableHead className="whitespace-nowrap">金额</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.items?.length > 0 ? (
                        selected.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="whitespace-nowrap">{item.material_name}</TableCell>
                            <TableCell className="whitespace-nowrap">{item.specification || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.quantity} {item.unit}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{CY(item.unit_price)}</TableCell>
                            <TableCell className="whitespace-nowrap">{CY(item.amount)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-sm text-muted-foreground py-6"
                          >
                            暂无明细
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">订单金额</p>
                  <p className="font-medium">{CY(selected.total_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">已付金额</p>
                  <p className="font-medium">{CY(paidByOrder(selected.id))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">剩余应付</p>
                  <p className="font-medium">{CY(Math.max(0, selected.total_amount - paidByOrder(selected.id)))}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
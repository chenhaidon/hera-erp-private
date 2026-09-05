import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { useAppStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Headset,
  MessageSquare,
  Star,
  Eye,
  Pencil,
  Trash2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Package,
  Truck,
  Banknote,
  BarChart3,
  ClipboardList,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type {
  AfterSalesTicket,
  AfterSalesStatus,
  AfterSalesIssueType,
  AfterSalesLiability,
  AfterSalesSolution,
  AfterSalesRecord,
  AfterSalesFeedback,
  AfterSalesReturn,
  AfterSalesReturnStatus,
  AfterSalesReshipment,
  AfterSalesReshipmentStatus,
} from "@/types";
import { nanoid, formatBeijingTime } from "@/lib/utils";

const issueTypeMap: Record<AfterSalesIssueType, string> = {
  quality: "质量问题",
  logistics: "物流问题",
  size: "尺寸问题",
  damage: "破损问题",
  other: "其他",
};

const statusMap: Record<
  AfterSalesStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "待处理", variant: "destructive" },
  analyzing: { label: "原因分析", variant: "secondary" },
  processing: { label: "处理中", variant: "secondary" },
  awaiting_feedback: { label: "待回访", variant: "default" },
  resolved: { label: "已解决", variant: "default" },
  closed: { label: "已关闭", variant: "outline" },
};

const liabilityMap: Record<AfterSalesLiability, string> = {
  quality: "质量部门",
  logistics: "物流部门",
  production: "生产部门",
  warehouse: "仓库部门",
  pending: "待判定",
};

const solutionMap: Record<AfterSalesSolution, string> = {
  return: "退货",
  exchange: "换货",
  reship: "补发货",
  reship_parts: "补发配件",
  refund_only: "仅退款",
  other: "其他",
};

const returnStatusMap: Record<
  AfterSalesReturnStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "待审核", variant: "destructive" },
  approved: { label: "已审核", variant: "secondary" },
  awaiting_inbound: { label: "待入库", variant: "secondary" },
  inbounded: { label: "已入库", variant: "default" },
  awaiting_ship: { label: "待发货", variant: "secondary" },
  shipped: { label: "已发货", variant: "default" },
  completed: { label: "已完成", variant: "outline" },
};

const reshipStatusMap: Record<
  AfterSalesReshipmentStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "待审核", variant: "destructive" },
  approved: { label: "已审核", variant: "secondary" },
  awaiting_ship: { label: "待发货", variant: "secondary" },
  shipped: { label: "已发货", variant: "default" },
  completed: { label: "已完成", variant: "outline" },
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--destructive))",
];

export function AfterSalesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="售后服务"
        description="管理客户售后请求，完成原因分析、责任判定、退换补发、成本核算与满意度回访闭环"
      />
      <ControlledTabs modulePath="/after-sales" defaultTab="tickets">
        <TabsList className="bg-muted flex-wrap">
          <TabsTrigger value="tickets">
            <Headset className="h-4 w-4 mr-1" />
            售后工单
          </TabsTrigger>
          <TabsTrigger value="returns">
            <Package className="h-4 w-4 mr-1" />
            退换货管理
          </TabsTrigger>
          <TabsTrigger value="reshipments">
            <Truck className="h-4 w-4 mr-1" />
            补发管理
          </TabsTrigger>
          <TabsTrigger value="cost">
            <Banknote className="h-4 w-4 mr-1" />
            售后成本
          </TabsTrigger>
          <TabsTrigger value="feedback">
            <MessageSquare className="h-4 w-4 mr-1" />
            满意度回访
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-1" />
            统计分析
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tickets">
          <TicketList />
        </TabsContent>
        <TabsContent value="returns">
          <ReturnList />
        </TabsContent>
        <TabsContent value="reshipments">
          <ReshipmentList />
        </TabsContent>
        <TabsContent value="cost">
          <CostSummary />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackList />
        </TabsContent>
        <TabsContent value="stats">
          <AfterSalesStats />
        </TabsContent>
      </ControlledTabs>
    </div>
  );
}

/* ─── 售后工单 ────────────────────────────────────────────── */

function TicketList() {
  const store = useAppStore();
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<AfterSalesStatus | "all">(
    "all",
  );
  const [issueFilter, setIssueFilter] = useState<AfterSalesIssueType | "all">(
    "all",
  );
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<AfterSalesTicket | null>(
    null,
  );

  const tickets = useMemo(() => {
    return store.afterSalesTickets
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .filter((t) => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (issueFilter !== "all" && t.issue_type !== issueFilter) return false;
        if (!keyword) return true;
        const k = keyword.toLowerCase();
        return (
          t.ticket_no.toLowerCase().includes(k) ||
          t.order_no.toLowerCase().includes(k) ||
          t.customer_name.toLowerCase().includes(k) ||
          (t.product_name?.toLowerCase() || "").includes(k)
        );
      });
  }, [store.afterSalesTickets, keyword, statusFilter, issueFilter]);

  const summary = useMemo(() => {
    const total = store.afterSalesTickets.length;
    const pending = store.afterSalesTickets.filter(
      (t) => t.status === "pending",
    ).length;
    const analyzing = store.afterSalesTickets.filter(
      (t) => t.status === "analyzing",
    ).length;
    const processing = store.afterSalesTickets.filter(
      (t) => t.status === "processing",
    ).length;
    const awaiting = store.afterSalesTickets.filter(
      (t) => t.status === "awaiting_feedback",
    ).length;
    const resolved = store.afterSalesTickets.filter(
      (t) => t.status === "resolved" || t.status === "closed",
    ).length;
    return { total, pending, analyzing, processing, awaiting, resolved };
  }, [store.afterSalesTickets]);

  function handleEdit(ticket: AfterSalesTicket) {
    setSelectedTicket(ticket);
    setOpen(true);
  }

  function handleNew() {
    setSelectedTicket(null);
    setOpen(true);
  }

  function handleDetail(ticket: AfterSalesTicket) {
    setSelectedTicket(ticket);
    setDetailOpen(true);
  }

  const {
    paginatedItems: ticketsPaginated,
    currentPage: ticketsCurrentPage,
    pageSize: ticketsPageSize,
    totalPages: ticketsTotalPages,
    totalItems: ticketsTotalItems,
    setPage: setTicketsPage,
    setPageSize: setTicketsPageSize,
  } = usePagination(tickets);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">售后工单总数</div>
            <div className="text-2xl font-semibold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">待处理</div>
            <div className="text-2xl font-semibold text-destructive">
              {summary.pending}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">原因分析/处理中</div>
            <div className="text-2xl font-semibold">
              {summary.analyzing + summary.processing}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">待回访</div>
            <div className="text-2xl font-semibold">{summary.awaiting}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">已解决/已关闭</div>
            <div className="text-2xl font-semibold">{summary.resolved}</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Headset className="h-4 w-4 text-primary" />
            售后工单列表
          </CardTitle>
          <Button size="sm" onClick={handleNew}>
            <Plus className="h-4 w-4 mr-1" />
            新建售后工单
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索售后单号、订单号、客户、产品"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as AfterSalesStatus | "all")
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待处理</SelectItem>
                <SelectItem value="analyzing">原因分析</SelectItem>
                <SelectItem value="processing">处理中</SelectItem>
                <SelectItem value="awaiting_feedback">待回访</SelectItem>
                <SelectItem value="resolved">已解决</SelectItem>
                <SelectItem value="closed">已关闭</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={issueFilter}
              onValueChange={(v) =>
                setIssueFilter(v as AfterSalesIssueType | "all")
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="问题类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="quality">质量问题</SelectItem>
                <SelectItem value="logistics">物流问题</SelectItem>
                <SelectItem value="size">尺寸问题</SelectItem>
                <SelectItem value="damage">破损问题</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto bg-card rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">售后单号</TableHead>
                  <TableHead className="whitespace-nowrap">关联订单</TableHead>
                  <TableHead className="whitespace-nowrap">客户</TableHead>
                  <TableHead className="whitespace-nowrap">产品</TableHead>
                  <TableHead className="whitespace-nowrap">问题类型</TableHead>
                  <TableHead className="whitespace-nowrap">责任归属</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="whitespace-nowrap">提交时间</TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketsPaginated.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {t.ticket_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.order_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.customer_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.product_name || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {issueTypeMap[t.issue_type]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {liabilityMap[t.liability || "pending"]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={statusMap[t.status].variant}>
                        {statusMap[t.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatBeijingTime(t.created_at)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDetail(t)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(t)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton ticket={t} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {tickets.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="p-4 text-center text-muted-foreground"
                    >
                      暂无售后工单
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination
              currentPage={ticketsCurrentPage}
              totalPages={ticketsTotalPages}
              pageSize={ticketsPageSize}
              totalItems={ticketsTotalItems}
              onPageChange={setTicketsPage}
              onPageSizeChange={setTicketsPageSize}
            />
          </div>
        </CardContent>
      </Card>
      <TicketFormDialog
        open={open}
        onClose={() => setOpen(false)}
        ticket={selectedTicket}
      />
      <TicketDetailDialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        ticket={selectedTicket}
      />
    </div>
  );
}

function TicketFormDialog({
  open,
  onClose,
  ticket,
}: {
  open: boolean;
  onClose: () => void;
  ticket: AfterSalesTicket | null;
}) {
  const store = useAppStore();
  const [form, setForm] = useState<Partial<AfterSalesTicket>>({
    issue_type: "quality",
    issue_desc: "",
    attachments: [],
    status: "pending",
    records: [],
  });

  function save() {
    if (!form.order_id || !form.issue_type || !form.issue_desc) return;
    const now = new Date().toISOString().split("T")[0];
    if (ticket) {
      store.updateAfterSalesTicket({
        ...ticket,
        ...(form as AfterSalesTicket),
        updated_at: now,
      });
    } else {
      const order = store.salesOrders.find((o) => o.id === form.order_id);
      const customer = store.customers.find((c) => c.id === order?.customer_id);
      const count = store.afterSalesTickets.length + 1;
      const newTicket: AfterSalesTicket = {
        id: nanoid(),
        ticket_no: `AS-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`,
        order_id: form.order_id,
        order_no: order?.order_no || "",
        customer_name: order?.customer_name || customer?.name || "",
        contact_name: customer?.contact || "",
        contact_phone: customer?.phone || "",
        product_id: form.product_id || order?.items?.[0]?.product_id || "",
        product_code:
          form.product_code || order?.items?.[0]?.product_code || "",
        product_name:
          form.product_name || order?.items?.[0]?.product_name || "",
        issue_type: form.issue_type as AfterSalesIssueType,
        issue_desc: form.issue_desc || "",
        attachments: form.attachments || [],
        status: "pending",
        records: [],
        created_at: now,
        updated_at: now,
      };
      store.addAfterSalesTicket(newTicket);
    }
    onClose();
    setForm({
      issue_type: "quality",
      issue_desc: "",
      attachments: [],
      status: "pending",
      records: [],
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ticket ? "编辑售后工单" : "新建售后工单"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>
                关联销售订单 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.order_id}
                onValueChange={(v) => {
                  const order = store.salesOrders.find((o) => o.id === v);
                  const customer = store.customers.find(
                    (c) => c.id === order?.customer_id,
                  );
                  setForm((f) => ({
                    ...f,
                    order_id: v,
                    order_no: order?.order_no || "",
                    customer_name: order?.customer_name || customer?.name || "",
                    contact_name: customer?.contact || "",
                    contact_phone: customer?.phone || "",
                    product_id: order?.items?.[0]?.product_id || "",
                    product_code: order?.items?.[0]?.product_code || "",
                    product_name: order?.items?.[0]?.product_name || "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择销售订单" />
                </SelectTrigger>
                <SelectContent>
                  {store.salesOrders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_no} · {o.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                问题类型 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.issue_type}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    issue_type: v as AfterSalesIssueType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择问题类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quality">质量问题</SelectItem>
                  <SelectItem value="logistics">物流问题</SelectItem>
                  <SelectItem value="size">尺寸问题</SelectItem>
                  <SelectItem value="damage">破损问题</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>产品名称</Label>
              <Input
                value={form.product_name || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, product_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>客户名称</Label>
              <Input
                value={form.customer_name || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customer_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>联系人</Label>
              <Input
                value={form.contact_name || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>联系电话</Label>
              <Input
                value={form.contact_phone || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_phone: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>
              问题描述 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={form.issue_desc || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, issue_desc: e.target.value }))
              }
              placeholder="请详细描述客户反馈的问题"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button
              onClick={save}
              disabled={!form.order_id || !form.issue_type || !form.issue_desc}
            >
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetailDialog({
  open,
  onClose,
  ticket,
}: {
  open: boolean;
  onClose: () => void;
  ticket: AfterSalesTicket | null;
}) {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [recordContent, setRecordContent] = useState("");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [rating, setRating] = useState(5);
  const [nps, setNps] = useState(9);

  if (!ticket) return null;

  function addRecord(nextStatus: AfterSalesStatus) {
    if (!recordContent.trim() || !ticket) return;
    const record: AfterSalesRecord = {
      id: nanoid(),
      handler: currentUserName,
      handled_at: new Date().toISOString().split("T")[0],
      content: recordContent.trim(),
      status: nextStatus,
    };
    store.updateAfterSalesTicket({
      ...ticket,
      status: nextStatus,
      records: [...ticket.records, record],
      updated_at: new Date().toISOString().split("T")[0],
    });
    setRecordContent("");
  }

  function addFeedback() {
    if (!feedbackContent.trim() || !ticket) return;
    const feedback: AfterSalesFeedback = {
      id: nanoid(),
      submitted_at: new Date().toISOString().split("T")[0],
      content: feedbackContent.trim(),
      rating,
      nps,
    };
    store.updateAfterSalesTicket({
      ...ticket,
      status: "resolved",
      feedback,
      updated_at: new Date().toISOString().split("T")[0],
    });
    setFeedbackContent("");
    setRating(5);
    setNps(9);
  }

  function closeTicket() {
    if (!ticket) return;
    store.updateAfterSalesTicket({
      ...ticket,
      status: "closed",
      updated_at: new Date().toISOString().split("T")[0],
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>售后工单详情：{ticket.ticket_no}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label className="text-muted-foreground">关联订单</Label>
              <div>{ticket.order_no}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">客户名称</Label>
              <div>{ticket.customer_name}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">联系人</Label>
              <div>{ticket.contact_name || "-"}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">联系电话</Label>
              <div>{ticket.contact_phone || "-"}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">产品名称</Label>
              <div>{ticket.product_name || "-"}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">问题类型</Label>
              <div>{issueTypeMap[ticket.issue_type]}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">提交时间</Label>
              <div>{formatBeijingTime(ticket.created_at)}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">当前状态</Label>
              <div>
                <Badge variant={statusMap[ticket.status].variant}>
                  {statusMap[ticket.status].label}
                </Badge>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground">问题描述</Label>
            <div className="rounded-md bg-muted p-3 mt-1">
              {ticket.issue_desc}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <AnalysisPanel ticket={ticket} />
            <SolutionPanel ticket={ticket} />
          </div>

          <TraceabilityPanel ticket={ticket} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-primary" />
                处理记录
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticket.records.length === 0 && (
                <div className="text-muted-foreground">暂无处理记录</div>
              )}
              {ticket.records.map((r) => (
                <div key={r.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.handler}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.handled_at}
                    </span>
                  </div>
                  <div className="text-muted-foreground">{r.content}</div>
                  <Badge variant={statusMap[r.status].variant}>
                    {statusMap[r.status].label}
                  </Badge>
                </div>
              ))}
              {ticket.status !== "closed" && ticket.status !== "resolved" && (
                <div className="space-y-2">
                  <Textarea
                    value={recordContent}
                    onChange={(e) => setRecordContent(e.target.value)}
                    placeholder="填写处理内容"
                  />
                  <div className="flex flex-wrap gap-2">
                    {ticket.status === "pending" && (
                      <Button size="sm" onClick={() => addRecord("analyzing")}>
                        <ClipboardList className="h-4 w-4 mr-1" />
                        提交原因分析
                      </Button>
                    )}
                    {ticket.status === "analyzing" && (
                      <Button size="sm" onClick={() => addRecord("processing")}>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        开始处理
                      </Button>
                    )}
                    {ticket.status === "processing" && (
                      <Button
                        size="sm"
                        onClick={() => addRecord("awaiting_feedback")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        完成处理待回访
                      </Button>
                    )}
                    {ticket.status === "awaiting_feedback" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          store.updateAfterSalesTicket({
                            ...ticket,
                            status: "resolved",
                            updated_at: new Date().toISOString().split("T")[0],
                          })
                        }
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        直接标记已解决
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {ticket.status === "awaiting_feedback" && !ticket.feedback && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  客户满意度回访
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  placeholder="填写回访记录及客户反馈"
                />
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="flex items-center gap-2">
                    <Label className="shrink-0">满意度</Label>
                    <Select
                      value={String(rating)}
                      onValueChange={(v) => setRating(Number(v))}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} 分
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="shrink-0">NPS</Label>
                    <Select
                      value={String(nps)}
                      onValueChange={(v) => setNps(Number(v))}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 11 }).map((_, n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} 分
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="sm" onClick={addFeedback}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  提交回访并解决
                </Button>
              </CardContent>
            </Card>
          )}

          {ticket.feedback && (
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  客户反馈
                </CardTitle>
                {ticket.status === "resolved" && (
                  <Button size="sm" variant="outline" onClick={closeTicket}>
                    <XCircle className="h-4 w-4 mr-1" />
                    关闭工单
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < ticket.feedback!.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`}
                    />
                  ))}
                  <span className="ml-2 text-muted-foreground">
                    满意度 {ticket.feedback.rating} 分
                  </span>
                </div>
                <div className="text-muted-foreground">
                  NPS {ticket.feedback.nps} 分
                </div>
                <div className="rounded-md bg-muted p-3">
                  {ticket.feedback.content}
                </div>
                <div className="text-xs text-muted-foreground">
                  反馈时间：{ticket.feedback.submitted_at}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnalysisPanel({ ticket }: { ticket: AfterSalesTicket }) {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [cause, setCause] = useState(ticket.cause_analysis || "");
  const [liability, setLiability] = useState<AfterSalesLiability>(
    ticket.liability || "pending",
  );
  const [basis, setBasis] = useState(ticket.liability_basis || "");

  function save() {
    if (!cause.trim() || liability === "pending" || !basis.trim()) return;
    store.updateAfterSalesTicket({
      ...ticket,
      cause_analysis: cause.trim(),
      liability,
      liability_basis: basis.trim(),
      status: ticket.status === "pending" ? "analyzing" : ticket.status,
      updated_at: new Date().toISOString().split("T")[0],
      records: [
        ...ticket.records,
        {
          id: nanoid(),
          handler: currentUserName,
          handled_at: new Date().toISOString().split("T")[0],
          content: `原因分析：${cause.trim()}；责任归属：${liabilityMap[liability]}；判定依据：${basis.trim()}`,
          status: ticket.status === "pending" ? "analyzing" : ticket.status,
        },
      ],
    });
  }

  const editable = ticket.status === "pending" || ticket.status === "analyzing";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          原因分析与责任判定
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>问题原因分析</Label>
          <Textarea
            disabled={!editable}
            value={cause}
            onChange={(e) => setCause(e.target.value)}
            placeholder="分析售后问题产生的根本原因"
          />
        </div>
        <div className="space-y-2">
          <Label>责任归属</Label>
          <Select
            disabled={!editable}
            value={liability}
            onValueChange={(v) => setLiability(v as AfterSalesLiability)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">待判定</SelectItem>
              <SelectItem value="quality">质量部门</SelectItem>
              <SelectItem value="logistics">物流部门</SelectItem>
              <SelectItem value="production">生产部门</SelectItem>
              <SelectItem value="warehouse">仓库部门</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>责任判定依据</Label>
          <Textarea
            disabled={!editable}
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            placeholder="记录判定责任归属的依据"
          />
        </div>
        {editable && (
          <Button
            size="sm"
            onClick={save}
            disabled={!cause.trim() || liability === "pending" || !basis.trim()}
          >
            保存分析
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SolutionPanel({ ticket }: { ticket: AfterSalesTicket }) {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [solution, setSolution] = useState<AfterSalesSolution>(
    ticket.solution || "other",
  );
  const [desc, setDesc] = useState(ticket.solution_desc || "");
  const [refund, setRefund] = useState(String(ticket.refund_amount ?? ""));
  const [reshipCost, setReshipCost] = useState(
    String(ticket.reship_cost ?? ""),
  );
  const [freightBearer, setFreightBearer] = useState<"customer" | "company">(
    ticket.freight_bearer || "company",
  );
  const [freightAmount, setFreightAmount] = useState(
    String(ticket.freight_amount ?? ""),
  );

  const editable =
    ticket.status === "analyzing" ||
    ticket.status === "processing" ||
    ticket.status === "awaiting_feedback";

  function save() {
    if (!desc.trim()) return;
    const refundAmount = Number(refund) || 0;
    const cost = Number(reshipCost) || 0;
    const freight = Number(freightAmount) || 0;
    const total = refundAmount + cost + freight;
    store.updateAfterSalesTicket({
      ...ticket,
      solution,
      solution_desc: desc.trim(),
      refund_amount: refundAmount,
      reship_cost: cost,
      freight_bearer: freightBearer,
      freight_amount: freight,
      total_cost: total,
      status: ticket.status === "analyzing" ? "processing" : ticket.status,
      updated_at: new Date().toISOString().split("T")[0],
      records: [
        ...ticket.records,
        {
          id: nanoid(),
          handler: currentUserName,
          handled_at: new Date().toISOString().split("T")[0],
          content: `确认处理方案：${solutionMap[solution]}；方案说明：${desc.trim()}；预计总成本：${total.toFixed(2)} 元`,
          status: ticket.status === "analyzing" ? "processing" : ticket.status,
        },
      ],
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          处理方案与成本
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>处理方式</Label>
          <Select
            disabled={!editable}
            value={solution}
            onValueChange={(v) => setSolution(v as AfterSalesSolution)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="return">退货</SelectItem>
              <SelectItem value="exchange">换货</SelectItem>
              <SelectItem value="reship">补发货</SelectItem>
              <SelectItem value="reship_parts">补发配件</SelectItem>
              <SelectItem value="refund_only">仅退款</SelectItem>
              <SelectItem value="other">其他</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>处理方案说明</Label>
          <Textarea
            disabled={!editable}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="描述具体处理步骤"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>退款金额（元）</Label>
            <Input
              disabled={!editable}
              type="number"
              min={0}
              value={refund}
              onChange={(e) => setRefund(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>补发成本（元）</Label>
            <Input
              disabled={!editable}
              type="number"
              min={0}
              value={reshipCost}
              onChange={(e) => setReshipCost(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>运费承担方</Label>
            <Select
              disabled={!editable}
              value={freightBearer}
              onValueChange={(v) =>
                setFreightBearer(v as "customer" | "company")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">公司承担</SelectItem>
                <SelectItem value="customer">客户承担</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>运费金额（元）</Label>
            <Input
              disabled={!editable}
              type="number"
              min={0}
              value={freightAmount}
              onChange={(e) => setFreightAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="rounded-md bg-muted p-3 flex justify-between items-center">
          <span className="font-medium">预计售后总成本</span>
          <span className="text-lg font-semibold">
            ¥
            {(
              (Number(refund) || 0) +
              (Number(reshipCost) || 0) +
              (Number(freightAmount) || 0)
            ).toFixed(2)}
          </span>
        </div>
        {editable && (
          <Button size="sm" onClick={save} disabled={!desc.trim()}>
            保存方案
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TraceabilityPanel({ ticket }: { ticket: AfterSalesTicket }) {
  const store = useAppStore();
  const workOrder = store.workOrders.find(
    (w) => w.id === ticket.related_work_order_no,
  );
  const [workOrderNo, setWorkOrderNo] = useState(
    ticket.related_work_order_no || "none",
  );
  const [batch, setBatch] = useState(ticket.related_material_batch || "");
  const [deviceCode, setDeviceCode] = useState(
    ticket.related_device_code || "none",
  );

  const editable = ticket.status !== "closed" && ticket.status !== "resolved";

  function save() {
    store.updateAfterSalesTicket({
      ...ticket,
      related_work_order_no: workOrderNo === "none" ? "" : workOrderNo,
      related_material_batch: batch,
      related_device_code: deviceCode === "none" ? "" : deviceCode,
      updated_at: new Date().toISOString().split("T")[0],
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          质量追溯关联
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>关联生产工单</Label>
            <Select
              disabled={!editable}
              value={workOrderNo}
              onValueChange={(v) => setWorkOrderNo(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择生产工单" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                {store.workOrders.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.work_no} · {w.product_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {workOrder?.work_no && (
              <div className="text-xs text-muted-foreground">
                工单编号：{workOrder.work_no}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>关联原材料批次</Label>
            <Input
              disabled={!editable}
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="批次号"
            />
          </div>
          <div className="space-y-2">
            <Label>关联绗缝设备</Label>
            <Select
              disabled={!editable}
              value={deviceCode}
              onValueChange={(v) => setDeviceCode(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择设备" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                {store.equipment
                  .filter((e) => e.category === "quilting")
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.code} · {e.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {editable && (
          <Button size="sm" onClick={save}>
            保存追溯信息
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteButton({ ticket }: { ticket: AfterSalesTicket }) {
  const store = useAppStore();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            删除后无法恢复，是否确认删除售后工单 {ticket.ticket_no}？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => store.deleteAfterSalesTicket(ticket.id)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ─── 退换货管理 ────────────────────────────────────────────── */

function ReturnList() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [confirmReturn, setConfirmReturn] = useState<{
    r: AfterSalesReturn;
    next: AfterSalesReturnStatus;
    title: string;
    desc: string;
  } | null>(null);

  function advanceReturn(r: AfterSalesReturn, next: AfterSalesReturnStatus) {
    const today = new Date().toISOString().split("T")[0];
    const payload: AfterSalesReturn = { ...r, status: next, updated_at: today };
    if (next === "inbounded") payload.inbound_time = today;
    if (next === "shipped") payload.ship_time = today;
    store.updateAfterSalesReturn(payload);
  }

  const returns = useMemo(() => {
    return store.afterSalesReturns
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .filter((r) => {
        if (!keyword) return true;
        const k = keyword.toLowerCase();
        return (
          r.return_no.toLowerCase().includes(k) ||
          r.ticket_no.toLowerCase().includes(k) ||
          r.customer_name.toLowerCase().includes(k)
        );
      });
  }, [store.afterSalesReturns, keyword]);

  const {
    paginatedItems: returnsPaginated,
    currentPage: returnsCurrentPage,
    pageSize: returnsPageSize,
    totalPages: returnsTotalPages,
    totalItems: returnsTotalItems,
    setPage: setReturnsPage,
    setPageSize: setReturnsPageSize,
  } = usePagination(returns);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            退换货管理
          </CardTitle>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索退换货单号"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              新建退换货单
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto bg-card rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">
                    退换货单号
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    关联售后单
                  </TableHead>
                  <TableHead className="whitespace-nowrap">客户</TableHead>
                  <TableHead className="whitespace-nowrap">处理方式</TableHead>
                  <TableHead className="whitespace-nowrap">数量</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="whitespace-nowrap">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnsPaginated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      {r.return_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.ticket_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.customer_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.type === "return" ? "退货" : "换货"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.quantity}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={returnStatusMap[r.status].variant}>
                        {returnStatusMap[r.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex gap-1">
                        {r.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfirmReturn({
                                r,
                                next: "approved",
                                title: "审核退换货单",
                                desc: "请确认是否审核通过该退换货单。",
                              })
                            }
                          >
                            审核
                          </Button>
                        )}
                        {r.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfirmReturn({
                                r,
                                next: "awaiting_inbound",
                                title: "标记待入库",
                                desc: "请确认是否将该退换货单标记为待入库。",
                              })
                            }
                          >
                            待入库
                          </Button>
                        )}
                        {r.status === "awaiting_inbound" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfirmReturn({
                                r,
                                next: "inbounded",
                                title: "确认入库",
                                desc: "请确认是否将该退换货商品确认入库，入库后库存将相应增加。",
                              })
                            }
                          >
                            确认入库
                          </Button>
                        )}
                        {r.status === "inbounded" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfirmReturn({
                                r,
                                next: "awaiting_ship",
                                title: "标记待发货",
                                desc: "请确认是否将该退换货单标记为待发货。",
                              })
                            }
                          >
                            待发货
                          </Button>
                        )}
                        {r.status === "awaiting_ship" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfirmReturn({
                                r,
                                next: "shipped",
                                title: "确认发货",
                                desc: "请确认是否将该退换货单确认发货。",
                              })
                            }
                          >
                            确认发货
                          </Button>
                        )}
                        {r.status === "shipped" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfirmReturn({
                                r,
                                next: "completed",
                                title: "完成退换货",
                                desc: "请确认是否将该退换货单标记为已完成。",
                              })
                            }
                          >
                            完成
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => store.deleteAfterSalesReturn(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {returns.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="p-4 text-center text-muted-foreground"
                    >
                      暂无退换货单
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination
              currentPage={returnsCurrentPage}
              totalPages={returnsTotalPages}
              pageSize={returnsPageSize}
              totalItems={returnsTotalItems}
              onPageChange={setReturnsPage}
              onPageSizeChange={setReturnsPageSize}
            />
          </div>
        </CardContent>
      </Card>
      <ReturnFormDialog open={open} onClose={() => setOpen(false)} />
      <ConfirmActionDialog
        open={!!confirmReturn}
        onOpenChange={(v) => !v && setConfirmReturn(null)}
        title={confirmReturn?.title || ""}
        description={confirmReturn?.desc}
        items={
          confirmReturn
            ? [
                { label: "退换货单号", value: confirmReturn.r.return_no },
                { label: "关联售后单", value: confirmReturn.r.ticket_no },
                { label: "客户", value: confirmReturn.r.customer_name },
                {
                  label: "处理方式",
                  value: confirmReturn.r.type === "return" ? "退货" : "换货",
                },
                {
                  label: "当前状态",
                  value: returnStatusMap[confirmReturn.r.status].label,
                },
                {
                  label: "下一状态",
                  value: returnStatusMap[confirmReturn.next].label,
                },
              ]
            : []
        }
        confirmText="确认"
        onConfirm={() => {
          if (confirmReturn) advanceReturn(confirmReturn.r, confirmReturn.next);
          setConfirmReturn(null);
        }}
      />
    </div>
  );
}

function ReturnFormDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const store = useAppStore();
  const [ticketId, setTicketId] = useState("");
  const [type, setType] = useState<"return" | "exchange">("return");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [returnAddress, setReturnAddress] = useState("");
  const [logistics, setLogistics] = useState("");
  const [tracking, setTracking] = useState("");

  const ticket = store.afterSalesTickets.find((t) => t.id === ticketId);

  function save() {
    if (!ticket || !reason.trim() || !quantity || Number(quantity) <= 0) return;
    const now = new Date().toISOString().split("T")[0];
    const count = store.afterSalesReturns.length + 1;
    store.addAfterSalesReturn({
      id: nanoid(),
      return_no: `RT-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`,
      ticket_id: ticket.id,
      ticket_no: ticket.ticket_no,
      customer_name: ticket.customer_name,
      product_code: ticket.product_code,
      product_name: ticket.product_name,
      type,
      quantity: Number(quantity),
      reason: reason.trim(),
      return_address: returnAddress,
      logistics_company: logistics,
      tracking_no: tracking,
      status: "pending",
      created_at: now,
      updated_at: now,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建退换货单</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>关联售后工单</Label>
              <Select value={ticketId} onValueChange={setTicketId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择售后工单" />
                </SelectTrigger>
                <SelectContent>
                  {store.afterSalesTickets.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.ticket_no} · {t.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>处理方式</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "return" | "exchange")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="return">退货</SelectItem>
                  <SelectItem value="exchange">换货</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>数量</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>退货地址/发货地址</Label>
              <Input
                value={returnAddress}
                onChange={(e) => setReturnAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>物流公司</Label>
              <Input
                value={logistics}
                onChange={(e) => setLogistics(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>运单号</Label>
              <Input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>原因</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button
              onClick={save}
              disabled={
                !ticketId ||
                !reason.trim() ||
                !quantity ||
                Number(quantity) <= 0
              }
            >
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── 补发管理 ────────────────────────────────────────────── */

function ReshipmentList() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  const reshipments = useMemo(() => {
    return store.afterSalesReshipments
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .filter((r) => {
        if (!keyword) return true;
        const k = keyword.toLowerCase();
        return (
          r.reship_no.toLowerCase().includes(k) ||
          r.ticket_no.toLowerCase().includes(k) ||
          r.customer_name.toLowerCase().includes(k)
        );
      });
  }, [store.afterSalesReshipments, keyword]);

  const {
    paginatedItems: reshipmentsPaginated,
    currentPage: reshipmentsCurrentPage,
    pageSize: reshipmentsPageSize,
    totalPages: reshipmentsTotalPages,
    totalItems: reshipmentsTotalItems,
    setPage: setReshipmentsPage,
    setPageSize: setReshipmentsPageSize,
  } = usePagination(reshipments);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            补发管理
          </CardTitle>
          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索补发单号"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              新建补发单
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto bg-card rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">补发单号</TableHead>
                  <TableHead className="whitespace-nowrap">
                    关联售后单
                  </TableHead>
                  <TableHead className="whitespace-nowrap">客户</TableHead>
                  <TableHead className="whitespace-nowrap">补发类型</TableHead>
                  <TableHead className="whitespace-nowrap">数量</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="whitespace-nowrap">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reshipmentsPaginated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      {r.reship_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.ticket_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.customer_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.type === "reship" ? "补发货" : "补发配件"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.quantity}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={reshipStatusMap[r.status].variant}>
                        {reshipStatusMap[r.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex gap-1">
                        {r.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              store.updateAfterSalesReshipment({
                                ...r,
                                status: "approved",
                                updated_at: new Date()
                                  .toISOString()
                                  .split("T")[0],
                              })
                            }
                          >
                            审核
                          </Button>
                        )}
                        {r.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              store.updateAfterSalesReshipment({
                                ...r,
                                status: "awaiting_ship",
                                updated_at: new Date()
                                  .toISOString()
                                  .split("T")[0],
                              })
                            }
                          >
                            待发货
                          </Button>
                        )}
                        {r.status === "awaiting_ship" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              store.updateAfterSalesReshipment({
                                ...r,
                                status: "shipped",
                                ship_time: new Date()
                                  .toISOString()
                                  .split("T")[0],
                                updated_at: new Date()
                                  .toISOString()
                                  .split("T")[0],
                              })
                            }
                          >
                            确认发货
                          </Button>
                        )}
                        {r.status === "shipped" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              store.updateAfterSalesReshipment({
                                ...r,
                                status: "completed",
                                updated_at: new Date()
                                  .toISOString()
                                  .split("T")[0],
                              })
                            }
                          >
                            完成
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => store.deleteAfterSalesReshipment(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {reshipments.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="p-4 text-center text-muted-foreground"
                    >
                      暂无补发单
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination
              currentPage={reshipmentsCurrentPage}
              totalPages={reshipmentsTotalPages}
              pageSize={reshipmentsPageSize}
              totalItems={reshipmentsTotalItems}
              onPageChange={setReshipmentsPage}
              onPageSizeChange={setReshipmentsPageSize}
            />
          </div>
        </CardContent>
      </Card>
      <ReshipmentFormDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function ReshipmentFormDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const store = useAppStore();
  const [ticketId, setTicketId] = useState("");
  const [type, setType] = useState<"reship" | "reship_parts">("reship");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [shipAddress, setShipAddress] = useState("");
  const [logistics, setLogistics] = useState("");
  const [tracking, setTracking] = useState("");

  const ticket = store.afterSalesTickets.find((t) => t.id === ticketId);

  function save() {
    if (!ticket || !reason.trim() || !quantity || Number(quantity) <= 0) return;
    const now = new Date().toISOString().split("T")[0];
    const count = store.afterSalesReshipments.length + 1;
    store.addAfterSalesReshipment({
      id: nanoid(),
      reship_no: `RS-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`,
      ticket_id: ticket.id,
      ticket_no: ticket.ticket_no,
      customer_name: ticket.customer_name,
      product_code: ticket.product_code,
      product_name: ticket.product_name,
      type,
      quantity: Number(quantity),
      reason: reason.trim(),
      ship_address: shipAddress,
      logistics_company: logistics,
      tracking_no: tracking,
      status: "pending",
      created_at: now,
      updated_at: now,
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建补发单</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>关联售后工单</Label>
              <Select value={ticketId} onValueChange={setTicketId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择售后工单" />
                </SelectTrigger>
                <SelectContent>
                  {store.afterSalesTickets.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.ticket_no} · {t.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>补发类型</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "reship" | "reship_parts")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reship">补发货</SelectItem>
                  <SelectItem value="reship_parts">补发配件</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>数量</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>发货地址</Label>
              <Input
                value={shipAddress}
                onChange={(e) => setShipAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>物流公司</Label>
              <Input
                value={logistics}
                onChange={(e) => setLogistics(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>运单号</Label>
              <Input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>原因</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button
              onClick={save}
              disabled={
                !ticketId ||
                !reason.trim() ||
                !quantity ||
                Number(quantity) <= 0
              }
            >
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── 售后成本核算 ────────────────────────────────────────────── */

function CostSummary() {
  const store = useAppStore();
  const tickets = store.afterSalesTickets;

  const stats = useMemo(() => {
    const totalCost = tickets.reduce((sum, t) => sum + (t.total_cost || 0), 0);
    const refundTotal = tickets.reduce(
      (sum, t) => sum + (t.refund_amount || 0),
      0,
    );
    const reshipTotal = tickets.reduce(
      (sum, t) => sum + (t.reship_cost || 0),
      0,
    );
    const freightTotal = tickets
      .filter((t) => t.freight_bearer === "company")
      .reduce((sum, t) => sum + (t.freight_amount || 0), 0);
    return { totalCost, refundTotal, reshipTotal, freightTotal };
  }, [tickets]);

  const byIssue = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      map[issueTypeMap[t.issue_type]] =
        (map[issueTypeMap[t.issue_type]] || 0) + (t.total_cost || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const byLiability = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      const key = liabilityMap[t.liability || "pending"];
      map[key] = (map[key] || 0) + (t.total_cost || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const {
    paginatedItems: ticketsPaginated,
    currentPage: ticketsCurrentPage,
    pageSize: ticketsPageSize,
    totalPages: ticketsTotalPages,
    totalItems: ticketsTotalItems,
    setPage: setTicketsPage,
    setPageSize: setTicketsPageSize,
  } = usePagination(tickets);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">售后总成本</div>
            <div className="text-2xl font-semibold text-destructive">
              ¥{stats.totalCost.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">退款合计</div>
            <div className="text-2xl font-semibold">
              ¥{stats.refundTotal.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">补发成本</div>
            <div className="text-2xl font-semibold">
              ¥{stats.reshipTotal.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">公司承担运费</div>
            <div className="text-2xl font-semibold">
              ¥{stats.freightTotal.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" />
            售后成本明细
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto bg-card rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">售后单号</TableHead>
                  <TableHead className="whitespace-nowrap">客户</TableHead>
                  <TableHead className="whitespace-nowrap">问题类型</TableHead>
                  <TableHead className="whitespace-nowrap">责任归属</TableHead>
                  <TableHead className="whitespace-nowrap">退款</TableHead>
                  <TableHead className="whitespace-nowrap">补发成本</TableHead>
                  <TableHead className="whitespace-nowrap">运费</TableHead>
                  <TableHead className="whitespace-nowrap">总成本</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketsPaginated.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">
                      {t.ticket_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.customer_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {issueTypeMap[t.issue_type]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {liabilityMap[t.liability || "pending"]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      ¥{(t.refund_amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      ¥{(t.reship_cost || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.freight_bearer === "company" ? "公司" : "客户"} ¥
                      {(t.freight_amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-semibold">
                      ¥{(t.total_cost || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                {tickets.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="p-4 text-center text-muted-foreground"
                    >
                      暂无成本数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination
              currentPage={ticketsCurrentPage}
              totalPages={ticketsTotalPages}
              pageSize={ticketsPageSize}
              totalItems={ticketsTotalItems}
              onPageChange={setTicketsPage}
              onPageSizeChange={setTicketsPageSize}
            />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">成本按问题类型分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byIssue}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {byIssue.map((_, i) => (
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
            <CardTitle className="text-base">成本按责任部门分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byLiability}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── 满意度回访 ────────────────────────────────────────────── */

function FeedbackList() {
  const store = useAppStore();
  const tickets = store.afterSalesTickets.filter(
    (t) => t.status === "awaiting_feedback" || t.feedback,
  );

  const {
    paginatedItems: ticketsPaginated,
    currentPage: ticketsCurrentPage,
    pageSize: ticketsPageSize,
    totalPages: ticketsTotalPages,
    totalItems: ticketsTotalItems,
    setPage: setTicketsPage,
    setPageSize: setTicketsPageSize,
  } = usePagination(tickets);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            满意度回访
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto bg-card rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">售后单号</TableHead>
                  <TableHead className="whitespace-nowrap">客户</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="whitespace-nowrap">满意度</TableHead>
                  <TableHead className="whitespace-nowrap">NPS</TableHead>
                  <TableHead className="whitespace-nowrap">反馈时间</TableHead>
                  <TableHead className="whitespace-nowrap">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketsPaginated.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">
                      {t.ticket_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.customer_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={statusMap[t.status].variant}>
                        {statusMap[t.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.feedback ? renderStars(t.feedback.rating) : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.feedback ? `${t.feedback.nps} 分` : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.feedback?.submitted_at || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {!t.feedback && t.status === "awaiting_feedback" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            const feedback: AfterSalesFeedback = {
                              id: nanoid(),
                              submitted_at: new Date()
                                .toISOString()
                                .split("T")[0],
                              content: "客户对处理结果表示满意",
                              rating: 5,
                              nps: 9,
                            };
                            store.updateAfterSalesTicket({
                              ...t,
                              status: "resolved",
                              feedback,
                              updated_at: new Date()
                                .toISOString()
                                .split("T")[0],
                            });
                          }}
                        >
                          回访完成
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {tickets.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="p-4 text-center text-muted-foreground"
                    >
                      暂无待回访记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination
              currentPage={ticketsCurrentPage}
              totalPages={ticketsTotalPages}
              pageSize={ticketsPageSize}
              totalItems={ticketsTotalItems}
              onPageChange={setTicketsPage}
              onPageSizeChange={setTicketsPageSize}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function renderStars(rating: number) {
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

/* ─── 统计分析 ────────────────────────────────────────────── */

function AfterSalesStats() {
  const store = useAppStore();
  const tickets = store.afterSalesTickets;

  const issueData = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      map[issueTypeMap[t.issue_type]] =
        (map[issueTypeMap[t.issue_type]] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const liabilityData = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      const key = liabilityMap[t.liability || "pending"];
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => {
      map[statusMap[t.status].label] =
        (map[statusMap[t.status].label] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const feedbackData = useMemo(() => {
    const feedbacks = tickets.filter((t) => t.feedback);
    if (feedbacks.length === 0) return [];
    const avgRating =
      feedbacks.reduce((s, t) => s + (t.feedback?.rating || 0), 0) /
      feedbacks.length;
    const avgNps =
      feedbacks.reduce((s, t) => s + (t.feedback?.nps || 0), 0) /
      feedbacks.length;
    return [
      { name: "满意度", value: Number(avgRating.toFixed(1)) },
      { name: "NPS", value: Number(avgNps.toFixed(1)) },
    ];
  }, [tickets]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">售后工单总数</div>
            <div className="text-2xl font-semibold">{tickets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">待处理</div>
            <div className="text-2xl font-semibold">
              {tickets.filter((t) => t.status === "pending").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">平均满意度</div>
            <div className="text-2xl font-semibold">
              {feedbackData.length ? feedbackData[0].value.toFixed(1) : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">平均 NPS</div>
            <div className="text-2xl font-semibold">
              {feedbackData.length ? feedbackData[1].value.toFixed(1) : "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">问题类型分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={issueData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {issueData.map((_, i) => (
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
            <CardTitle className="text-base">处理状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">责任部门 TOP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liabilityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">满意度 / NPS 平均分</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={feedbackData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--accent))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

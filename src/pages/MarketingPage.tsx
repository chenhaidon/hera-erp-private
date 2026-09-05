import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { ensureReceivableForOrder } from "@/lib/finance";
import { syncContractStatusFromSalesOrders } from "@/lib/contract";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAppStore } from "@/store";
import { useCanButton } from "@/lib/rbac";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { ShipOrderDialog } from "@/components/marketing/ShipOrderDialog";
import { CreateSalesOrderDialog } from "@/components/marketing/CreateSalesOrderDialog";
import { downloadSalesOrderTemplate, parseSalesOrderExcel, type ImportError } from "@/lib/salesOrderImport";
import type { CreateSalesOrderPrefillData } from "@/components/marketing/CreateSalesOrderDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Plus,
  Search,
  User,
  FileText,
  Truck,
  Tag,
  BarChart3,
  Eye,
  CheckCircle,
  XCircle,
  Printer,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Save,
  Pencil,
  Trash2,
  Package,
  Play,
  Factory,
  ClipboardCheck,
  Receipt,
  Download,
  Upload,
} from "lucide-react";
import {
  CUSTOMER_TYPES,
  CURRENCIES,
  TRADE_TERMS,
  ORDER_STATUS,
  ORDER_TYPES,
  formatMoney,
} from "@/lib/data";
import { nanoid, formatBeijingTime, formatBeijingDate } from "@/lib/utils";
import { supabase } from "@/db/supabase";
import { syncSalesOrderStatusFromProduction } from "@/lib/production";
import {
  buildShipmentItems,
  executeShipment,
} from "@/lib/marketing";
import type {
  Customer,
  SalesOrder,
  SalesOrderItem,
  Shipment,
  ShipmentBox,
  FollowUp,
  PriceList,
  CustomerDiscount,
  ExchangeRate,
} from "@/types";

const ORDER_STATUS_FLOW = [
  "pending",
  "confirmed",
  "approval",
  "approved",
  "planned",
  "producing",
  "inspecting",
  "shipping",
  "partial_shipped",
  "shipped",
  "invoicing",
  "payment",
  "completed",
];

// 销售订单状态流转展示用精简节点
const SIMPLIFIED_STATUS_FLOW = [
  "pending",
  "confirmed",
  "approved",
  "producing",
  "shipping",
  "shipped",
  "completed",
];

const STATUS_TO_DISPLAY_INDEX: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  approval: 1,
  approved: 2,
  planned: 3,
  producing: 3,
  inspecting: 3,
  shipping: 4,
  partial_shipped: 5,
  shipped: 5,
  invoicing: 6,
  payment: 6,
  completed: 6,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "待确认",
  confirmed: "已确认",
  approval: "待审批",
  approved: "已审批",
  planned: "待排产",
  producing: "生产中",
  inspecting: "待检验",
  shipping: "待发货",
  partial_shipped: "部分发货",
  shipped: "已发货",
  invoicing: "待开票",
  payment: "待回款",
  completed: "已完成",
};

function getDisplayStatusIndex(status: string) {
  return STATUS_TO_DISPLAY_INDEX[status] ?? -1;
}

function extractColorFromSkuSummary(skuSummary?: string): string {
  if (!skuSummary) return "-";
  const parts = skuSummary.split("-").map((s) => s.trim());
  if (parts.length < 2) return "-";
  const last = parts[parts.length - 1];
  // 颜色通常是非数字字符串，长度较短；末尾是尺寸时忽略
  if (/^\d/.test(last) || last.length > 12) return "-";
  return last;
}

export function MarketingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "customers";
  const defaultOrderId = searchParams.get("detailId") || undefined;
  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="营销管理"
        description="客户管理、报价管理、销售订单、发货管理、价格政策与销售统计"
      />
      <OrderDetailInitializer
        defaultOrderId={defaultOrderId}
        onClose={() => {
          searchParams.delete("detailId");
          setSearchParams(searchParams, { replace: true });
        }}
      />
      <ControlledTabs modulePath="/marketing" defaultTab={defaultTab}>
        <TabsList className="w-full flex-wrap justify-start md:w-auto">
          <TabsTrigger value="customers" className="gap-2">
            <User className="h-4 w-4" />
            客户管理
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <FileText className="h-4 w-4" />
            销售订单
          </TabsTrigger>
          <TabsTrigger value="shipments" className="gap-2">
            <Truck className="h-4 w-4" />
            发货管理
          </TabsTrigger>
          <TabsTrigger value="price" className="gap-2">
            <Tag className="h-4 w-4" />
            价格政策
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            销售统计
          </TabsTrigger>
        </TabsList>
        <TabsContent value="customers">
          <CustomerTab />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="shipments">
          <ShipmentsTab />
        </TabsContent>
        <TabsContent value="price">
          <PriceTab />
        </TabsContent>
        <TabsContent value="stats">
          <StatsTab />
        </TabsContent>
      </ControlledTabs>
    </div>
  );
}

const emptyCustomer: Customer = {
  id: "",
  name: "",
  contact: "",
  phone: "",
  address: "",
  email: "",
  country: "",
  customer_type: "贸易商",
};

function CustomerForm({
  customer,
  onSave,
  onCancel,
}: {
  customer: Customer;
  onSave: (c: Customer) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Customer>(customer);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>客户名称</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="请输入客户名称"
          />
        </div>
        <div className="space-y-2">
          <Label>联系人</Label>
          <Input
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            placeholder="请输入联系人"
          />
        </div>
        <div className="space-y-2">
          <Label>电话</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="请输入电话"
          />
        </div>
        <div className="space-y-2">
          <Label>国家/地区</Label>
          <Input
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            placeholder="请输入国家/地区"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>地址</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="请输入地址"
          />
        </div>
        <div className="space-y-2">
          <Label>邮箱</Label>
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="请输入邮箱"
          />
        </div>
        <div className="space-y-2">
          <Label>客户类型</Label>
          <Select
            value={form.customer_type}
            onValueChange={(v) => setForm({ ...form, customer_type: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={() => onSave(form)} disabled={!form.name.trim()}>
          保存
        </Button>
      </div>
    </div>
  );
}

function CustomerTab() {
  const store = useAppStore();
  const can = useCanButton();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const TARGET_LAST_CUSTOMER = "宁波馨家艺纺织品有限公司";

  const filtered = store.customers
    .filter((c) => {
      const s = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(s) || c.contact.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => {
      const aIsTarget = a.name === TARGET_LAST_CUSTOMER;
      const bIsTarget = b.name === TARGET_LAST_CUSTOMER;
      if (aIsTarget && !bIsTarget) return 1;
      if (!aIsTarget && bIsTarget) return -1;
      return a.name.localeCompare(b.name, "zh-CN");
    });

  function handleAdd(c: Customer) {
    store.addCustomer({ ...c, id: nanoid() });
    setIsAddOpen(false);
  }

  function handleUpdate(c: Customer) {
    store.updateCustomer(c);
    setEditing(null);
  }

  function handleDelete(id: string) {
    store.deleteCustomer(id);
  }

  const {
    paginatedItems: filteredPaginated,
    currentPage: filteredCurrentPage,
    pageSize: filteredPageSize,
    totalPages: filteredTotalPages,
    totalItems: filteredTotalItems,
    setPage: setFilteredPage,
    setPageSize: setFilteredPageSize,
  } = usePagination(filtered);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索客户名称/联系人"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className={can("marketing-customers", "create") ? "" : "hidden"}>
              <Plus className="mr-1 h-4 w-4" />
              新增客户
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新增客户</DialogTitle>
            </DialogHeader>
            <CustomerForm
              customer={emptyCustomer}
              onSave={handleAdd}
              onCancel={() => setIsAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">客户名称</TableHead>
                <TableHead className="whitespace-nowrap">联系人</TableHead>
                <TableHead className="whitespace-nowrap">电话</TableHead>
                <TableHead className="whitespace-nowrap">国家/地区</TableHead>
                <TableHead className="whitespace-nowrap">类型</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPaginated.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {c.name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.contact}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.phone}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.country}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.customer_type}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelected(c)}
                        title="360视图"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(c)}
                        title="编辑"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="删除">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除客户？</AlertDialogTitle>
                            <AlertDialogDescription>
                              删除后将无法恢复，相关订单记录中仍会保留客户名称。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(c.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            currentPage={filteredCurrentPage}
            totalPages={filteredTotalPages}
            pageSize={filteredPageSize}
            totalItems={filteredTotalItems}
            onPageChange={setFilteredPage}
            onPageSizeChange={setFilteredPageSize}
          />
        </CardContent>
      </Card>
      <Customer360 customer={selected} onClose={() => setSelected(null)} />
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑客户</DialogTitle>
          </DialogHeader>
          {editing && (
            <CustomerForm
              customer={editing}
              onSave={handleUpdate}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Customer360({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  if (!customer) return null;

  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [active, setActive] = useState("info");
  const [follow, setFollow] = useState({ content: "", next_time: "" });

  const orders = store.salesOrders.filter((o) => o.customer_id === customer.id);
  const followUps = store.followUps.filter(
    (f) => f.customer_id === customer.id,
  );

  const total = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const paid = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + o.total_amount, 0);

  const {
    paginatedItems: ordersPaginated,
    currentPage: ordersCurrentPage,
    pageSize: ordersPageSize,
    totalPages: ordersTotalPages,
    totalItems: ordersTotalItems,
    setPage: setOrdersPage,
    setPageSize: setOrdersPageSize,
  } = usePagination(orders);

  return (
    <Dialog open={!!customer} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>客户 360 视图：{customer.name}</DialogTitle>
        </DialogHeader>
        <Tabs value={active} onValueChange={setActive}>
          <TabsList className="w-full flex-wrap">
            <TabsTrigger value="info">基本信息</TabsTrigger>
            <TabsTrigger value="orders">订单历史</TabsTrigger>
            <TabsTrigger value="credit">信用额度</TabsTrigger>
            <TabsTrigger value="follow">跟进记录</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div>
                <Label className="text-muted-foreground">联系人</Label>
                <div>{customer.contact}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">电话</Label>
                <div>{customer.phone}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">邮箱</Label>
                <div>{customer.email || "-"}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">地址</Label>
                <div>{customer.address}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">客户类型</Label>
                <div>{customer.customer_type}</div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="orders">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单编号</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>实际交货日期</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersPaginated.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.order_no}</TableCell>
                    <TableCell>{formatMoney(o.total_amount)}</TableCell>
                    <TableCell>
                      {["shipped", "completed"].includes(o.status)
                        ? o.delivery_date || "-"
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} options={ORDER_STATUS} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              currentPage={ordersCurrentPage}
              totalPages={ordersTotalPages}
              pageSize={ordersPageSize}
              totalItems={ordersTotalItems}
              onPageChange={setOrdersPage}
              onPageSizeChange={setOrdersPageSize}
            />
          </TabsContent>
          <TabsContent value="credit">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      信用额度
                    </div>
                    <div className="text-xl font-semibold">
                      {formatMoney(500000)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      已用额度
                    </div>
                    <div className="text-xl font-semibold">
                      {formatMoney(total - paid)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      可用额度
                    </div>
                    <div className="text-xl font-semibold">
                      {formatMoney(500000 - (total - paid))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="follow" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="跟进内容"
                value={follow.content}
                onChange={(e) =>
                  setFollow({ ...follow, content: e.target.value })
                }
              />
              <Input
                type="date"
                value={follow.next_time}
                onChange={(e) =>
                  setFollow({ ...follow, next_time: e.target.value })
                }
              />
              <Button
                onClick={() => {
                  if (!follow.content) return;
                  store.addFollowUp({
                    id: nanoid(),
                    customer_id: customer.id,
                    time: new Date()
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " "),
                    operator: currentUserName,
                    content: follow.content,
                    next_time: follow.next_time,
                  });
                  setFollow({ content: "", next_time: "" });
                }}
              >
                新增跟进
              </Button>
            </div>
            <div className="space-y-2">
              {followUps.map((f) => (
                <div key={f.id} className="rounded-md border p-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{f.operator}</span>
                    <span>{f.time}</span>
                  </div>
                  <div className="mt-1">{f.content}</div>
                  {f.next_time && (
                    <div className="mt-1 text-xs">下次跟进：{f.next_time}</div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function OrdersTab() {
  const store = useAppStore();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<SalesOrder | null>(null);
  const [shipOrder, setShipOrder] = useState<SalesOrder | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<SalesOrder | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "advance";
    order: SalesOrder;
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<CreateSalesOrderPrefillData | null>(null);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importMode, setImportMode] = useState<{
    open: boolean;
    orders: import("@/lib/salesOrderImport").PrefillOrderData[];
  }>({ open: false, orders: [] });
  const [importProgress, setImportProgress] = useState<{
    open: boolean;
    status: "running" | "done";
    current: number;
    total: number;
    success: number;
    failed: number;
    failedGroups: string[];
  }>({
    open: false,
    status: "running",
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    failedGroups: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDownloadTemplate() {
    downloadSalesOrderTemplate();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const result = await parseSalesOrderExcel(file, store.customers, store.products, store.contracts);
    if (!result.success) {
      setImportErrors(result.errors);
      return;
    }

    const orders = result.orders || [];
    if (orders.length === 0) {
      toast.error("未解析到有效订单数据");
      return;
    }

    // 若客户不存在，自动创建
    if (orders.length === 1 && orders[0].customerName && !orders[0].customerId) {
      const newCustomer: Customer = {
        id: nanoid(),
        name: orders[0].customerName,
        contact: "",
        phone: "",
        address: "",
        email: "",
        country: "中国",
        customer_type: "B2B",
      };
      store.addCustomer(newCustomer);
      orders[0].customerId = newCustomer.id;
      toast.success(`已自动创建客户：${newCustomer.name}`);
    }

    if (orders.length === 1) {
      const data: CreateSalesOrderPrefillData = {
        customerId: orders[0].customerId,
        orderDate: orders[0].orderDate,
        deliveryDate: orders[0].deliveryDate,
        contractId: orders[0].contractId,
        remark: orders[0].remark,
        items: orders[0].items,
      };
      setPrefillData(data);
      setCreateOpen(true);
      toast.success("导入成功，已自动填充表单");
      return;
    }

    // 多条订单弹出模式选择
    setImportMode({ open: true, orders });
  }

  function buildOrderFromImport(
    orderData: import("@/lib/salesOrderImport").PrefillOrderData,
    seqIndex: number,
    status: "pending" | "confirmed",
  ): SalesOrder {
    const customer = store.customers.find((c) => c.id === orderData.customerId);
    const items = (orderData.items || []).map((it) => ({
      ...it,
      amount: Number((it.quantity * it.unit_price).toFixed(2)),
    }));
    const totalAmount = Number(
      items.reduce((sum, it) => sum + it.amount, 0).toFixed(2),
    );
    return {
      id: nanoid(),
      order_no: `SO-${new Date().getFullYear()}-${String(store.salesOrders.length + 1 + seqIndex).padStart(4, "0")}`,
      order_type: "B2B",
      channel: "批发",
      customer_id: orderData.customerId || "",
      customer_name: customer?.name || "",
      currency: "CNY",
      trade_term: "",
      destination: "",
      delivery_date: orderData.deliveryDate || "",
      total_amount: totalAmount,
      status,
      created_at: new Date().toISOString(),
      contract_id: orderData.contractId || undefined,
      contract_no: orderData.contractId
        ? store.contracts.find((c) => c.id === orderData.contractId)?.contract_no
        : undefined,
      items,
      logs: [
        {
          status,
          operator: currentUserName,
          time: new Date().toISOString().slice(0, 16).replace("T", " "),
          remark:
            status === "pending"
              ? `Excel批量导入（分组：${orderData.group}）`
              : `Excel批量导入并提交为正式订单（分组：${orderData.group}）`,
        },
      ],
    };
  }

  function checkStockForOrders(
    orders: import("@/lib/salesOrderImport").PrefillOrderData[],
  ): { ok: boolean; message?: string } {
    const insufficient: { group: string; productName: string; skuSummary: string; qty: number; stock: number }[] = [];
    orders.forEach((orderData) => {
      (orderData.items || []).forEach((it) => {
        const inventory = store.inventory.find(
          (inv) => inv.type === "product" && inv.product_id === it.product_id,
        );
        const stock = inventory?.quantity || 0;
        if (it.quantity > stock) {
          insufficient.push({
            group: orderData.group,
            productName: it.product_name,
            skuSummary: it.sku_summary || "",
            qty: it.quantity,
            stock,
          });
        }
      });
    });
    if (insufficient.length === 0) return { ok: true };
    const detail = insufficient
      .map(
        (x) =>
          `分组 ${x.group}：产品 ${x.productName} 的SKU ${x.skuSummary} 库存不足，可用 ${x.stock}，订单 ${x.qty}`,
      )
      .join("；");
    return { ok: false, message: `${detail}。是否继续提交？` };
  }

  async function handleBatchImport(status: "pending" | "confirmed") {
    const { orders } = importMode;
    if (orders.length === 0) return;

    if (status === "confirmed") {
      const stockCheck = checkStockForOrders(orders);
      if (!stockCheck.ok) {
        const ok = window.confirm(stockCheck.message);
        if (!ok) {
          setImportMode({ open: false, orders: [] });
          return;
        }
      }
    }

    setImportMode({ open: false, orders: [] });
    setImportProgress({
      open: true,
      status: "running",
      current: 0,
      total: orders.length,
      success: 0,
      failed: 0,
      failedGroups: [],
    });

    const failedGroups: string[] = [];
    for (let i = 0; i < orders.length; i++) {
      const orderData = orders[i];
      const order = buildOrderFromImport(orderData, i, status);
      try {
        await store.addSalesOrder(order);
        setImportProgress((prev) => ({
          ...prev,
          current: i + 1,
          success: prev.success + 1,
        }));
      } catch (err) {
        console.error(err);
        failedGroups.push(orderData.group);
        setImportProgress((prev) => ({
          ...prev,
          current: i + 1,
          failed: prev.failed + 1,
          failedGroups: [...prev.failedGroups, orderData.group],
        }));
      }
    }

    setImportProgress((prev) => ({ ...prev, status: "done" }));
    const label = status === "pending" ? "草稿订单" : "正式订单";
    toast.success(`批量导入完成，成功创建 ${orders.length - failedGroups.length}/${orders.length} 个${label}`);
  }

  function closeImportProgress() {
    setImportProgress({
      open: false,
      status: "running",
      current: 0,
      total: 0,
      success: 0,
      failed: 0,
      failedGroups: [],
    });
  }

  const filtered = store.salesOrders
    .filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      const s = search.toLowerCase();
      return (
        o.order_no.toLowerCase().includes(s) ||
        o.customer_name.toLowerCase().includes(s)
      );
    })
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );

  async function syncReceivable(order: SalesOrder) {
    await ensureReceivableForOrder(
      order,
      store.financeRecords,
      store.addFinanceRecord,
      store.updateFinanceRecord,
    );
  }

  async function advance(order: SalesOrder) {
    const idx = ORDER_STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= ORDER_STATUS_FLOW.length - 1) return;
    const next = ORDER_STATUS_FLOW[idx + 1];
    await store.updateSalesOrder({
      ...order,
      status: next,
      logs: [
        ...(order.logs || []),
        {
          status: next,
          operator: currentUserName,
          time: new Date().toISOString().slice(0, 16).replace("T", " "),
          remark: "状态推进",
        },
      ],
    });
    if (next === "shipping" || next === "shipped" || next === "invoicing" || next === "payment") {
      await syncReceivable({ ...order, status: next });
    }
    if (next === "completed") {
      await syncContractStatusFromSalesOrders(
        store.salesOrders.map((o) =>
          o.id === order.id ? { ...o, status: "completed" } : o,
        ),
        store.contracts,
        store.updateContract,
      );
    }
  }

  function issueToProduction(order: SalesOrder) {
    const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");

    // 销售订单下达生产后先进入订单池，由计划员在订单池合并排产后生成主生产计划
    store.updateSalesOrder({
      ...order,
      status: "approved",
      logs: [
        ...(order.logs || []),
        {
          status: "approved",
          operator: currentUserName,
          time: nowStr,
          remark: "销售订单已下达生产，进入订单池等待排产",
        },
      ],
    });

    toast.success("销售订单已下达至订单池，请前往计划排程-订单池进行排产");
    navigate("/planning");
  }

  function approveOrder(order: SalesOrder) {
    const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");
    const next = "approved";
    store.updateSalesOrder({
      ...order,
      status: next,
      logs: [
        ...(order.logs || []),
        {
          status: next,
          operator: currentUserName,
          time: nowStr,
          remark: "审核通过",
        },
      ],
    });
    toast.success("订单已审核通过");
  }

  const {
    paginatedItems: filteredPaginated,
    currentPage: filteredCurrentPage,
    pageSize: filteredPageSize,
    totalPages: filteredTotalPages,
    totalItems: filteredTotalItems,
    setPage: setFilteredPage,
    setPageSize: setFilteredPageSize,
  } = usePagination(filtered);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索订单号/客户"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setFilteredPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="订单状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {ORDER_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={handleDownloadTemplate}>
          <Download className="mr-1 h-4 w-4" />
          下载模板
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" />
          导入
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          新建订单
        </Button>
      </div>
      <CreateSalesOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        prefillData={prefillData}
        onPrefillConsumed={() => setPrefillData(null)}
      />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">订单编号</TableHead>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">客户</TableHead>
                <TableHead className="whitespace-nowrap">金额</TableHead>
                <TableHead className="whitespace-nowrap">创建时间</TableHead>
                <TableHead className="whitespace-nowrap">实际交货日期</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPaginated.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {o.order_no}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {o.contract_no || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o.customer_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatMoney(o.total_amount)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatBeijingDate(o.created_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {["shipped", "completed"].includes(o.status)
                      ? o.delivery_date || "-"
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} options={ORDER_STATUS} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelected(o)}
                        title="详情"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {["pending", "confirmed"].includes(o.status) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setConfirmAction({ type: "approve", order: o })
                          }
                          title="审核通过"
                          className="text-green-600"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                        </Button>
                      )}
                      {o.status === "approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => issueToProduction(o)}
                          title="下达生产"
                          className="text-primary"
                        >
                          <Factory className="h-4 w-4" />
                        </Button>
                      )}
                      {(o.status === "shipping" ||
                        o.status === "partial_shipped" ||
                        o.status === "completed" ||
                        o.status === "invoicing") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShipOrder(o)}
                          title="发货"
                          className="text-primary"
                        >
                          <Truck className="h-4 w-4" />
                        </Button>
                      )}
                      {o.status === "invoicing" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setInvoiceOrder(o)}
                          title="开票"
                          className="text-primary"
                        >
                          <Receipt className="h-4 w-4" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="删除">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              确认删除销售订单？
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              删除后无法恢复，相关应收记录不会自动删除，请确认。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => store.deleteSalesOrder(o.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            currentPage={filteredCurrentPage}
            totalPages={filteredTotalPages}
            pageSize={filteredPageSize}
            totalItems={filteredTotalItems}
            onPageChange={setFilteredPage}
            onPageSizeChange={setFilteredPageSize}
          />
        </CardContent>
      </Card>
      {selected && (
        <OrderDetailDialog order={selected} onClose={() => setSelected(null)} />
      )}
      <ShipOrderDialog
        order={shipOrder}
        open={!!shipOrder}
        onClose={() => setShipOrder(null)}
      />
      <InvoiceDialog
        order={invoiceOrder}
        open={!!invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
        onSyncReceivable={syncReceivable}
      />
      <ConfirmActionDialog
        open={!!confirmAction}
        onOpenChange={(v) => !v && setConfirmAction(null)}
        title={
          confirmAction?.type === "approve" ? "审核销售订单" : "推进销售订单"
        }
        description={
          confirmAction?.type === "approve"
            ? "请确认是否审核通过该销售订单，审核通过后订单将进入下一流程。"
            : "请确认是否推进该销售订单，推进后订单状态将更新。"
        }
        items={
          confirmAction
            ? [
                { label: "订单编号", value: confirmAction.order.order_no },
                { label: "客户", value: confirmAction.order.customer_name },
                {
                  label: "当前状态",
                  value:
                    ORDER_STATUS.find(
                      (s) => s.value === confirmAction.order.status,
                    )?.label || confirmAction.order.status,
                },
                ...(confirmAction.type === "advance"
                  ? [
                      {
                        label: "下一状态",
                        value:
                          ORDER_STATUS.find(
                            (s) =>
                              s.value ===
                              ORDER_STATUS_FLOW[
                                ORDER_STATUS_FLOW.indexOf(
                                  confirmAction.order.status,
                                ) + 1
                              ],
                          )?.label || "",
                      },
                    ]
                  : []),
              ]
            : []
        }
        confirmText={
          confirmAction?.type === "approve" ? "确认通过" : "确认推进"
        }
        confirmVariant={
          confirmAction?.type === "approve" ? "default" : "default"
        }
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.type === "approve") {
            approveOrder(confirmAction.order);
          } else {
            advance(confirmAction.order);
          }
          setConfirmAction(null);
        }}
      />
      <Dialog open={importErrors.length > 0} onOpenChange={(v) => !v && setImportErrors([])}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>导入校验失败</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <p className="text-sm text-muted-foreground">请根据以下错误修正后重新上传：</p>
            <ul className="space-y-1 text-sm">
              {importErrors.map((err, idx) => (
                <li key={idx} className="rounded-md border p-2">
                  <span className="font-medium">第 {err.row} 行：</span>
                  {err.message}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => setImportErrors([])}>我知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importMode.open}
        onOpenChange={(v) => !v && setImportMode({ open: false, orders: [] })}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>批量导入销售订单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              检测到 {importMode.orders.length} 个销售订单，请选择导入方式：
            </p>
            <div className="grid gap-3">
              <Button
                variant="outline"
                onClick={() => handleBatchImport("pending")}
              >
                <Save className="mr-2 h-4 w-4" />
                保存为草稿
              </Button>
              <Button onClick={() => handleBatchImport("confirmed")}>
                <Play className="mr-2 h-4 w-4" />
                提交为正式订单
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importProgress.open}
        onOpenChange={(v) => !v && closeImportProgress()}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {importProgress.status === "running" ? "正在批量创建订单" : "批量导入完成"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                进度 {importProgress.current}/{importProgress.total}
              </span>
              <span className="font-medium">
                {Math.round(
                  importProgress.total > 0
                    ? (importProgress.current / importProgress.total) * 100
                    : 0,
                )}%
              </span>
            </div>
            <Progress
              value={
                importProgress.total > 0
                  ? (importProgress.current / importProgress.total) * 100
                  : 0
              }
            />
            <div className="grid grid-cols-2 gap-4 text-center text-sm">
              <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:bg-green-950/30">
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {importProgress.success}
                </div>
                <div className="text-muted-foreground">成功</div>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:bg-red-950/30">
                <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {importProgress.failed}
                </div>
                <div className="text-muted-foreground">失败</div>
              </div>
            </div>
            {importProgress.status === "done" && importProgress.failedGroups.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">失败分组：</p>
                <ul className="max-h-32 overflow-y-auto rounded-md border p-2 text-sm">
                  {importProgress.failedGroups.map((group, idx) => (
                    <li key={idx} className="text-destructive">
                      {group}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            {importProgress.status === "done" && (
              <Button onClick={closeImportProgress}>我知道了</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoiceDialog({
  order,
  open,
  onClose,
  onSyncReceivable,
}: {
  order: SalesOrder | null;
  open: boolean;
  onClose: () => void;
  onSyncReceivable: (order: SalesOrder) => void;
}) {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (order) {
      setInvoiceNo(order.invoice_no || "");
      setInvoiceDate(
        order.invoice_date || new Date().toISOString().split("T")[0],
      );
      setFile(null);
    }
  }, [order]);

  async function handleSubmit() {
    if (!order || !invoiceNo.trim()) return;
    if (!user) {
      toast.error("请先登录后再开具发票");
      return;
    }
    setUploading(true);
    let invoice_file = order.invoice_file;

    try {
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${order.id}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
        const { error } = await supabase.storage
          .from("invoice-files")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) {
          toast.error(`发票文件上传失败：${error.message}`);
          setUploading(false);
          return;
        }
        const { data } = supabase.storage
          .from("invoice-files")
          .getPublicUrl(path);
        invoice_file = data.publicUrl;
      }

      const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");
      const updatedOrder: SalesOrder = {
        ...order,
        status: "payment",
        invoice_no: invoiceNo.trim(),
        invoice_date: invoiceDate,
        invoice_file,
        logs: [
          ...(order.logs || []),
          {
            status: "payment",
            operator: currentUserName,
            time: nowStr,
            remark: `已开票，发票号：${invoiceNo.trim()}`,
          },
        ],
      };
      store.updateSalesOrder(updatedOrder);
      onSyncReceivable(updatedOrder);
      toast.success("开票成功，订单已更新为待回款");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "请重试";
      toast.error(`开票失败：${message}`);
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle>开具发票</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>
              发票号码 <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="请输入发票号码"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>
              开票日期 <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>发票文件（选填）</Label>
            <Input
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={!user}
            />
            {file && (
              <p className="text-xs text-muted-foreground">{file.name}</p>
            )}
            {order?.invoice_file && !file && (
              <p className="text-xs text-muted-foreground">
                已上传：
                <a
                  href={order.invoice_file}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  查看发票文件
                </a>
              </p>
            )}
            {!user && (
              <p className="text-xs text-destructive">
                您当前未登录，无法上传发票文件。请先登录系统。
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!invoiceNo.trim() || uploading || !user}
          >
            {uploading ? "上传中" : user ? "确认开票" : "请先登录"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderDetailInitializer({
  defaultOrderId,
  onClose,
}: {
  defaultOrderId?: string;
  onClose: () => void;
}) {
  const store = useAppStore();
  const [selected, setSelected] = useState<SalesOrder | null>(null);

  useEffect(() => {
    if (defaultOrderId) {
      const order = store.salesOrders.find((o) => o.id === defaultOrderId);
      if (order) setSelected(order);
    } else {
      setSelected(null);
    }
  }, [defaultOrderId, store.salesOrders]);

  if (!selected) return null;
  return <OrderDetailDialog order={selected} onClose={() => {
    setSelected(null);
    onClose();
  }} />;
}

function OrderDetailDialog({
  order,
  onClose,
}: {
  order: SalesOrder;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const store = useAppStore();
  const [local, setLocal] = useState<SalesOrder>(order);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLocal(order);
  }, [order]);

  const displayIdx = getDisplayStatusIndex(local.status);

  const customer = store.customers.find((c) => c.id === local.customer_id);
  const discount =
    store.customerDiscounts.find((d) => d.level === customer?.customer_type)
      ?.discount || 1;

  function recalcItem(item: SalesOrderItem, productCode: string) {
    const pl = store.priceLists.find(
      (p) =>
        p.product_code === productCode &&
        new Date(p.effective_date) <= new Date() &&
        (!p.expiry_date || new Date(p.expiry_date) >= new Date()),
    );
    const price = pl?.price || item.unit_price || 0;
    const unitPrice = price * discount;
    return {
      ...item,
      unit_price: unitPrice,
      amount: Math.round(unitPrice * item.quantity * 100) / 100,
    };
  }

  function updateItem(index: number, patch: Partial<SalesOrderItem>) {
    const items = local.items.map((it, i) => {
      if (i !== index) return it;
      const updated = { ...it, ...patch };
      return recalcItem(updated, updated.product_code);
    });
    setLocal({
      ...local,
      items,
      total_amount:
        Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100,
    });
  }

  function addItem() {
    const product = store.products[0];
    if (!product) return;
    const item: SalesOrderItem = recalcItem(
      {
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        sku_id: "",
        sku_summary: "",
        quantity: 1,
        unit: "件",
        unit_price: 0,
        amount: 0,
        image: product.images[0],
      },
      product.code,
    );
    const items = [...local.items, item];
    setLocal({
      ...local,
      items,
      total_amount:
        Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100,
    });
  }

  function removeItem(index: number) {
    const items = local.items.filter((_, i) => i !== index);
    setLocal({
      ...local,
      items,
      total_amount:
        Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100,
    });
  }

  function save() {
    const missingSku = local.items.some((item) => !item.sku_id);
    if (missingSku) {
      toast.error("请为每个订单明细选择具体的 SKU 规格");
      return;
    }
    store.updateSalesOrder(local);
    setEditing(false);
  }

  const {
    paginatedItems: local_itemsPaginated,
    currentPage: local_itemsCurrentPage,
    pageSize: local_itemsPageSize,
    totalPages: local_itemsTotalPages,
    totalItems: local_itemsTotalItems,
    setPage: setLocal_itemsPage,
    setPageSize: setLocal_itemsPageSize,
  } = usePagination(local.items);

  return (
    <Dialog open={!!order} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                navigate(-1);
              }}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
            <DialogTitle>订单详情：{local.order_no}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">客户</Label>
              <div>{local.customer_name}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">币种</Label>
              <div>{local.currency}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">贸易术语</Label>
              <div>{local.trade_term || "-"}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">实际交货日期</Label>
              <div>{local.delivery_date}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">目的地</Label>
              <div>{local.destination || "-"}</div>
            </div>
          </div>
          <div className="rounded-md bg-muted p-3">
            <div className="mb-2 font-medium">状态流转</div>
            <div className="flex flex-wrap items-center gap-2">
              {SIMPLIFIED_STATUS_FLOW.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`rounded-full px-2.5 py-1 text-xs ${i <= displayIdx ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                  >
                    {STATUS_LABELS[s]}
                  </div>
                  {i < SIMPLIFIED_STATUS_FLOW.length - 1 && (
                    <span className="text-muted-foreground">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          {local.invoice_no && (
            <div className="rounded-md bg-muted p-3">
              <div className="mb-2 font-medium">发票信息</div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">发票号码</Label>
                  <div>{local.invoice_no}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">开票日期</Label>
                  <div>{local.invoice_date || "-"}</div>
                </div>
                {local.invoice_file && (
                  <div className="md:col-span-2">
                    <Label className="text-muted-foreground">发票文件</Label>
                    <div>
                      <a
                        href={local.invoice_file}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        查看发票文件
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">订单明细</span>
              {editing ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(false)}
                  >
                    取消
                  </Button>
                  <Button size="sm" onClick={save}>
                    <Save className="mr-1 h-4 w-4" />
                    保存
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="mr-1 h-4 w-4" />
                  编辑明细
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">产品</TableHead>
                    <TableHead className="whitespace-nowrap">
                      SKU 规格
                    </TableHead>
                    <TableHead className="whitespace-nowrap">颜色</TableHead>
                    <TableHead className="whitespace-nowrap">数量</TableHead>
                    <TableHead className="whitespace-nowrap">单价</TableHead>
                    <TableHead className="whitespace-nowrap">金额</TableHead>
                    {editing && (
                      <TableHead className="whitespace-nowrap text-right">
                        操作
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {local_itemsPaginated.map((item, i) => {
                    const product = store.products.find(
                      (x) => x.code === item.product_code,
                    );
                    const sku = product?.skus?.find(
                      (s) => s.id === item.sku_id,
                    );
                    const skuOptions = product?.skus || [];
                    return (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">
                          {editing ? (
                            <Select
                              value={item.product_code}
                              onValueChange={(v) => {
                                const p = store.products.find(
                                  (x) => x.code === v,
                                );
                                if (p)
                                  updateItem(i, {
                                    product_id: p.id,
                                    product_code: p.code,
                                    product_name: p.name,
                                    sku_id: "",
                                    sku_summary: "",
                                    image: p.images[0],
                                  });
                              }}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {store.products.map((p) => (
                                  <SelectItem key={p.id} value={p.code}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            item.product_name
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {editing ? (
                            <Select
                              value={item.sku_id || ""}
                              onValueChange={(v) => {
                                const s = skuOptions.find((x) => x.id === v);
                                if (s)
                                  updateItem(i, {
                                    sku_id: s.id,
                                    sku_summary:
                                      `${s.specification || s.size || ""} ${s.pattern || ""} ${s.color || ""}`.trim(),
                                  });
                              }}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="选择 SKU" />
                              </SelectTrigger>
                              <SelectContent>
                                {skuOptions.map((s) => (
                                  <SelectItem
                                    key={s.id}
                                    value={s.id}
                                  >{`${s.specification || s.size || "-"} / ${s.pattern || s.color || "-"}`}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            item.sku_summary || item.specification || "-"
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.color || sku?.color || extractColorFromSkuSummary(item.sku_summary) || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {editing ? (
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(i, {
                                  quantity: Number(e.target.value),
                                })
                              }
                              className="w-24"
                            />
                          ) : (
                            `${item.quantity} ${item.unit}`
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatMoney(item.unit_price, local.currency)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatMoney(item.amount, local.currency)}
                        </TableCell>
                        {editing && (
                          <TableCell className="whitespace-nowrap text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(i)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                currentPage={local_itemsCurrentPage}
                totalPages={local_itemsTotalPages}
                pageSize={local_itemsPageSize}
                totalItems={local_itemsTotalItems}
                onPageChange={setLocal_itemsPage}
                onPageSizeChange={setLocal_itemsPageSize}
              />
            </div>
            {editing && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={addItem}
              >
                <Plus className="mr-1 h-4 w-4" />
                新增明细
              </Button>
            )}
            <div className="mt-2 text-right font-semibold">
              订单总金额：{formatMoney(local.total_amount, local.currency)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShipmentsTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Shipment | null>(null);
  const [form, setForm] = useState<Partial<Shipment>>({});
  const [items, setItems] = useState<Shipment["items"]>([]);
  const [search, setSearch] = useState("");

  const filteredShipments = useMemo(() => {
    return store.shipments.filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.shipment_no.toLowerCase().includes(q) ||
        s.order_no.toLowerCase().includes(q) ||
        s.customer_name.toLowerCase().includes(q) ||
        s.logistics_company.toLowerCase().includes(q) ||
        s.tracking_no.toLowerCase().includes(q) ||
        (s.contract_no || "").toLowerCase().includes(q)
      );
    });
  }, [store.shipments, search]);

  const handleCreate = async () => {
    const order = store.salesOrders.find((o) => o.id === form.order_id);
    if (!order || !form.shipment_date) return;
    const shippingItems = items.filter((i) => (i.quantity || 0) > 0);
    if (shippingItems.length === 0) return;

    try {
      await executeShipment(
        store,
        order,
        `SH-${Date.now().toString().slice(-6)}`,
        form.contract_no || order.contract_no || "",
        form.shipment_date,
        form.logistics_company || "",
        form.tracking_no || "",
        form.remark || "",
        shippingItems,
      );
      toast.success('发货成功并已扣减成品库存');
      setOpen(false);
      setForm({});
      setItems([]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '发货失败';
      toast.error(msg);
    }
  };

  const {
    paginatedItems: store_shipmentsPaginated,
    currentPage: store_shipmentsCurrentPage,
    pageSize: store_shipmentsPageSize,
    totalPages: store_shipmentsTotalPages,
    totalItems: store_shipmentsTotalItems,
    setPage: setStore_shipmentsPage,
    setPageSize: setStore_shipmentsPageSize,
  } = usePagination(filteredShipments);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="搜索发货单号/订单/客户/物流/运单号/合同编号"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-72"
        />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              创建发货单
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-4xl">
            <DialogHeader>
              <DialogTitle>创建发货单</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="shipment-order">销售订单</Label>
                  <Select
                    value={form.order_id}
                    onValueChange={(v) => {
                      const o = store.salesOrders.find((x) => x.id === v);
                      setForm({
                        ...form,
                        order_id: v,
                        contract_no: o?.contract_no || "",
                        customer_id: o?.customer_id || "",
                        customer_name: o?.customer_name || "",
                      });
                      if (!o) {
                        setItems([]);
                        return;
                      }
                      setItems(
                        buildShipmentItems(o, store.salesOutbounds, store.products),
                      );
                    }}
                  >
                    <SelectTrigger id="shipment-order">
                      <SelectValue placeholder="选择销售订单" />
                    </SelectTrigger>
                    <SelectContent>
                      {store.salesOrders.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.order_no} - {o.customer_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shipment-contract">合同编号</Label>
                  <Input
                    id="shipment-contract"
                    placeholder="选择订单后自动带入"
                    value={form.contract_no || ""}
                    onChange={(e) =>
                      setForm({ ...form, contract_no: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shipment-date">发货日期</Label>
                  <Input
                    id="shipment-date"
                    type="date"
                    value={form.shipment_date || ""}
                    onChange={(e) =>
                      setForm({ ...form, shipment_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shipment-logistics">物流公司</Label>
                  <Input
                    id="shipment-logistics"
                    placeholder="请输入物流公司"
                    value={form.logistics_company || ""}
                    onChange={(e) =>
                      setForm({ ...form, logistics_company: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="shipment-tracking">运单号</Label>
                  <Input
                    id="shipment-tracking"
                    placeholder="请输入运单号"
                    value={form.tracking_no || ""}
                    onChange={(e) =>
                      setForm({ ...form, tracking_no: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">发货明细</div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">产品名</TableHead>
                        <TableHead className="whitespace-nowrap">SKU 规格</TableHead>
                        <TableHead className="whitespace-nowrap">颜色</TableHead>
                        <TableHead className="whitespace-nowrap text-right">订单数量</TableHead>
                        <TableHead className="whitespace-nowrap text-right">历史已发</TableHead>
                        <TableHead className="whitespace-nowrap text-right">剩余未发</TableHead>
                        <TableHead className="whitespace-nowrap text-right">本次发货</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="whitespace-nowrap">
                            {item.product_name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {item.sku_summary || item.specification || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {(() => {
                              const p = store.products.find((x) => x.code === item.product_code);
                              const s = p?.skus?.find((x) => x.id === item.sku_id);
                              return item.color || s?.color || extractColorFromSkuSummary(item.sku_summary) || "-";
                            })()}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {item.ordered_quantity}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {item.shipped_quantity}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {Math.max(0, (item.ordered_quantity || 0) - (item.shipped_quantity || 0))}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            <Input
                              type="number"
                              min={0}
                              className="w-24 ml-auto"
                              value={item.quantity}
                              onChange={(e) => {
                                const next = [...items];
                                const val = Number(e.target.value);
                                const max = (item.ordered_quantity || 0) - (item.shipped_quantity || 0);
                                next[i].quantity = Math.max(0, Math.min(val, max));
                                setItems(next);
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {items.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground"
                          >
                            请选择销售订单以带出 SKU 明细
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCreate}>确认发货</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">发货单号</TableHead>
                <TableHead className="whitespace-nowrap">关联订单</TableHead>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">客户</TableHead>
                <TableHead className="whitespace-nowrap">产品</TableHead>
                <TableHead className="whitespace-nowrap">数量</TableHead>
                <TableHead className="whitespace-nowrap">物流公司</TableHead>
                <TableHead className="whitespace-nowrap">运单号</TableHead>
                <TableHead className="whitespace-nowrap">发货时间</TableHead>
                <TableHead className="whitespace-nowrap">创建人</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store_shipmentsPaginated.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => setDetail(s)}
                >
                  <TableCell className="font-medium whitespace-nowrap">
                    {s.shipment_no}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.order_no}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.contract_no || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.customer_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.items.map((i) => i.product_name).join(", ") || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.items.reduce((sum, i) => sum + i.quantity, 0)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.logistics_company || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.tracking_no || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.shipment_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.creator || "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={s.status}
                      options={[
                        {
                          value: "pending",
                          label: "待发货",
                          color: "bg-amber-500",
                        },
                        {
                          value: "shipped",
                          label: "已发货",
                          color: "bg-blue-500",
                        },
                        {
                          value: "transit",
                          label: "运输中",
                          color: "bg-indigo-500",
                        },
                        {
                          value: "signed",
                          label: "已签收",
                          color: "bg-emerald-500",
                        },
                      ]}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetail(s);
                      }}
                    >
                      详情
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            currentPage={store_shipmentsCurrentPage}
            totalPages={store_shipmentsTotalPages}
            pageSize={store_shipmentsPageSize}
            totalItems={store_shipmentsTotalItems}
            onPageChange={setStore_shipmentsPage}
            onPageSizeChange={setStore_shipmentsPageSize}
          />
        </CardContent>
      </Card>
      <ShipmentDetailDialog shipment={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function ShipmentDetailDialog({
  shipment,
  onClose,
}: {
  shipment: Shipment | null;
  onClose: () => void;
}) {
  const store = useAppStore();
  const [local, setLocal] = useState<Shipment | null>(shipment);
  const [tracking, setTracking] = useState<{ time: string; status: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [printMode, setPrintMode] = useState<"shipment" | "box">("shipment");

  useEffect(() => {
    if (shipment) setLocal(shipment);
  }, [shipment]);

  const customer = store.customers.find((c) => c.id === local?.customer_id);

  const statusFlow: Shipment["status"][] = [
    "pending",
    "shipped",
    "transit",
    "signed",
  ];
  function advanceStatus() {
    if (!local) return;
    const idx = statusFlow.indexOf(local.status);
    if (idx < statusFlow.length - 1) {
      const next = statusFlow[idx + 1];
      const updated = { ...local, status: next };
      setLocal(updated);
      store.updateShipment(updated);
    }
  }

  async function queryTracking() {
    if (!local || !local.tracking_no) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("kdi-query", {
      body: { no: local.tracking_no },
    });
    setLoading(false);
    if (error) {
      const msg = await error.context?.text();
      console.error("物流查询失败:", msg || error.message);
      setTracking([]);
      return;
    }
    if (data?.result?.list) {
      setTracking(
        data.result.list.map((i: { time: string; status: string }) => ({
          time: i.time,
          status: i.status,
        })),
      );
    } else {
      setTracking([]);
    }
  }

  function addBox() {
    if (!local) return;
    const boxes = [
      ...(local.boxes || []),
      {
        id: nanoid(),
        box_no: `BOX-${(local.boxes?.length || 0) + 1}`,
        product_code: local.items[0]?.product_code || "",
        product_name: local.items[0]?.product_name || "",
        quantity: 0,
        gross_weight: 0,
        net_weight: 0,
        volume: "",
      },
    ];
    setLocal({ ...local, boxes });
  }

  function updateBox(id: string, patch: Partial<ShipmentBox>) {
    if (!local) return;
    const boxes = (local.boxes || []).map((b) =>
      b.id === id ? { ...b, ...patch } : b,
    );
    setLocal({ ...local, boxes });
  }

  function removeBox(id: string) {
    if (!local) return;
    const boxes = (local.boxes || []).filter((b) => b.id !== id);
    setLocal({ ...local, boxes });
  }

  function save() {
    if (!local) return;
    store.updateShipment(local);
  }

  function printShipment() {
    setPrintMode("shipment");
    setTimeout(() => window.print(), 200);
  }

  function printBox() {
    setPrintMode("box");
    setTimeout(() => window.print(), 200);
  }

  const statusLabel = {
    pending: "待发货",
    shipped: "已发货",
    transit: "运输中",
    signed: "已签收",
  };

  const {
    paginatedItems: local_itemsPaginated,
    currentPage: local_itemsCurrentPage,
    pageSize: local_itemsPageSize,
    totalPages: local_itemsTotalPages,
    totalItems: local_itemsTotalItems,
    setPage: setLocal_itemsPage,
    setPageSize: setLocal_itemsPageSize,
  } = usePagination(local?.items || []);

  if (!shipment || !local) return null;

  return (
    <>
      <Dialog open={!!shipment} onOpenChange={onClose}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>发货单详情：{local.shipment_no}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">关联订单</Label>
                <div>{local.order_no}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">合同编号</Label>
                <div>{local.contract_no || "-"}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">客户</Label>
                <div>{local.customer_name}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">发货时间</Label>
                <div>{local.shipment_date}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">创建时间</Label>
                <div>{formatBeijingTime(local.created_at)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">创建人</Label>
                <div>{local.creator || "-"}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">状态</Label>
                <div>
                  <Badge>{statusLabel[local.status]}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">物流公司</Label>
                <Input
                  value={local.logistics_company}
                  onChange={(e) =>
                    setLocal({ ...local, logistics_company: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-muted-foreground">运单号</Label>
                <Input
                  value={local.tracking_no}
                  onChange={(e) =>
                    setLocal({ ...local, tracking_no: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">备注</Label>
              <Input
                value={local.remark || ""}
                onChange={(e) => setLocal({ ...local, remark: e.target.value })}
                placeholder="发货备注"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {local.status !== "signed" && (
                <Button size="sm" onClick={advanceStatus}>
                  更新为
                  {
                    statusLabel[
                      statusFlow[statusFlow.indexOf(local.status) + 1]
                    ]
                  }
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={queryTracking}
                disabled={loading || !local.tracking_no}
              >
                {loading ? "查询中" : "查询物流"}
              </Button>
              <Button size="sm" variant="outline" onClick={save}>
                保存信息
              </Button>
              <Button size="sm" variant="outline" onClick={printShipment}>
                <Printer className="mr-1 h-4 w-4" />
                打印发货单
              </Button>
              <Button size="sm" variant="outline" onClick={printBox}>
                <Package className="mr-1 h-4 w-4" />
                打印箱单
              </Button>
            </div>
            {tracking.length > 0 && (
              <div className="rounded-md border p-3">
                <div className="mb-2 font-medium">物流轨迹</div>
                <div className="space-y-2">
                  {tracking.map((t, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span>{t.status}</span>
                      <span className="text-muted-foreground">{t.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="mb-2 font-medium">发货明细</div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">产品</TableHead>
                      <TableHead className="whitespace-nowrap">SKU</TableHead>
                      <TableHead className="whitespace-nowrap">颜色</TableHead>
                      <TableHead className="whitespace-nowrap">数量</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {local_itemsPaginated.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">
                          {item.product_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.sku_summary || item.specification || item.product_code}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {(() => {
                            const p = store.products.find((x) => x.code === item.product_code);
                            const s = p?.skus?.find((x) => x.id === item.sku_id);
                            return item.color || s?.color || extractColorFromSkuSummary(item.sku_summary) || "-";
                          })()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.quantity}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination
                  currentPage={local_itemsCurrentPage}
                  totalPages={local_itemsTotalPages}
                  pageSize={local_itemsPageSize}
                  totalItems={local_itemsTotalItems}
                  onPageChange={setLocal_itemsPage}
                  onPageSizeChange={setLocal_itemsPageSize}
                />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">箱单信息</span>
                <Button size="sm" variant="outline" onClick={addBox}>
                  <Plus className="mr-1 h-4 w-4" />
                  新增箱单
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">箱号</TableHead>
                      <TableHead className="whitespace-nowrap">产品</TableHead>
                      <TableHead className="whitespace-nowrap">数量</TableHead>
                      <TableHead className="whitespace-nowrap">
                        毛重(kg)
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        净重(kg)
                      </TableHead>
                      <TableHead className="whitespace-nowrap">体积</TableHead>
                      <TableHead className="whitespace-nowrap text-right">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(local.boxes || []).map((box) => (
                      <TableRow key={box.id}>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            value={box.box_no}
                            onChange={(e) =>
                              updateBox(box.id, { box_no: e.target.value })
                            }
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            value={box.product_name}
                            onChange={(e) =>
                              updateBox(box.id, {
                                product_name: e.target.value,
                              })
                            }
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            type="number"
                            value={box.quantity}
                            onChange={(e) =>
                              updateBox(box.id, {
                                quantity: Number(e.target.value),
                              })
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            type="number"
                            value={box.gross_weight}
                            onChange={(e) =>
                              updateBox(box.id, {
                                gross_weight: Number(e.target.value),
                              })
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            type="number"
                            value={box.net_weight}
                            onChange={(e) =>
                              updateBox(box.id, {
                                net_weight: Number(e.target.value),
                              })
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            value={box.volume}
                            onChange={(e) =>
                              updateBox(box.id, { volume: e.target.value })
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeBox(box.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(local.boxes || []).length === 0 && (
                      <TableRow>
                        <TableCell
                          className="p-4 text-center text-muted-foreground"
                          colSpan={7}
                        >
                          暂无箱单
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <PrintSheet mode={printMode} shipment={local} customer={customer} />
    </>
  );
}

function PrintSheet({
  mode,
  shipment,
  customer,
}: {
  mode: "shipment" | "box";
  shipment: Shipment;
  customer?: Customer;
}) {
  const id = mode === "shipment" ? "print-shipment" : "print-box";
  return (
    <div
      id={id}
      className="hidden print:block print:fixed print:inset-0 print:z-50 print:bg-white print:p-8 print:text-black"
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #${id}, #${id} * { visibility: visible !important; }
          #${id} { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      {mode === "shipment" ? (
        <div className="space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">发货单</h1>
            <p className="text-sm">{shipment.shipment_no}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>关联订单：</strong>
              {shipment.order_no}
            </div>
            <div>
              <strong>合同编号：</strong>
              {shipment.contract_no || "-"}
            </div>
            <div>
              <strong>客户：</strong>
              {shipment.customer_name}
            </div>
            <div>
              <strong>发货日期：</strong>
              {shipment.shipment_date}
            </div>
            <div>
              <strong>状态：</strong>
              {shipment.status}
            </div>
            <div>
              <strong>物流公司：</strong>
              {shipment.logistics_company || "-"}
            </div>
            <div>
              <strong>运单号：</strong>
              {shipment.tracking_no || "-"}
            </div>
          </div>
          <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">产品</th>
                <th className="border p-2 text-left">款号</th>
                <th className="border p-2 text-left">数量</th>
              </tr>
            </thead>
            <tbody>
              {shipment.items.map((item, i) => (
                <tr key={i}>
                  <td className="border p-2">{item.product_name}</td>
                  <td className="border p-2">{item.product_code}</td>
                  <td className="border p-2">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">箱单</h1>
            <p className="text-sm">发货单：{shipment.shipment_no}</p>
          </div>
          <div className="text-sm">
            <div>
              <strong>收货人：</strong>
              {customer?.name || shipment.customer_name}
            </div>
            <div>
              <strong>联系人：</strong>
              {customer?.contact || "-"}
            </div>
            <div>
              <strong>电话：</strong>
              {customer?.phone || "-"}
            </div>
            <div>
              <strong>地址：</strong>
              {customer?.address || "-"}
            </div>
          </div>
          <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">箱号</th>
                <th className="border p-2 text-left">产品</th>
                <th className="border p-2 text-left">数量</th>
                <th className="border p-2 text-left">毛重(kg)</th>
                <th className="border p-2 text-left">净重(kg)</th>
                <th className="border p-2 text-left">体积</th>
              </tr>
            </thead>
            <tbody>
              {(shipment.boxes || []).map((box) => (
                <tr key={box.id}>
                  <td className="border p-2">{box.box_no}</td>
                  <td className="border p-2">{box.product_name}</td>
                  <td className="border p-2">{box.quantity}</td>
                  <td className="border p-2">{box.gross_weight}</td>
                  <td className="border p-2">{box.net_weight}</td>
                  <td className="border p-2">{box.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PriceTab() {
  const store = useAppStore();
  const [price, setPrice] = useState<Partial<PriceList>>({});
  const [discount, setDiscount] = useState<Partial<CustomerDiscount>>({});
  const [priceSearch, setPriceSearch] = useState("");
  const [discountSearch, setDiscountSearch] = useState("");

  async function addPrice() {
    if (!price.product_id) {
      toast.error("请选择产品");
      return;
    }
    if (!price.price || price.price <= 0) {
      toast.error("请输入标准售价");
      return;
    }
    if (!price.effective_date || !price.expiry_date) {
      toast.error("请选择生效日期和失效日期");
      return;
    }
    const p = store.products.find((x) => x.id === price.product_id);
    await store.addPriceList({
      id: nanoid(),
      product_id: price.product_id,
      product_code: p?.code || "",
      product_name: p?.name || "",
      price: Number(price.price),
      effective_date: price.effective_date || "",
      expiry_date: price.expiry_date || "",
    });
    setPrice({});
    toast.success("价格政策已新增");
  }
  function addDiscount() {
    if (!discount.level) return;
    store.addCustomerDiscount({
      id: nanoid(),
      level: discount.level,
      discount: Number(discount.discount),
    });
    setDiscount({});
  }

  const filteredPriceLists = useMemo(
    () =>
      store.priceLists.filter(
        (p) =>
          p.product_code?.toLowerCase().includes(priceSearch.toLowerCase()) ||
          p.product_name?.toLowerCase().includes(priceSearch.toLowerCase()),
      ),
    [store.priceLists, priceSearch],
  );
  const filteredCustomerDiscounts = useMemo(
    () =>
      store.customerDiscounts.filter((d) =>
        d.level.toLowerCase().includes(discountSearch.toLowerCase()),
      ),
    [store.customerDiscounts, discountSearch],
  );

  const {
    paginatedItems: store_customerDiscountsPaginated,
    currentPage: store_customerDiscountsCurrentPage,
    pageSize: store_customerDiscountsPageSize,
    totalPages: store_customerDiscountsTotalPages,
    totalItems: store_customerDiscountsTotalItems,
    setPage: setStore_customerDiscountsPage,
    setPageSize: setStore_customerDiscountsPageSize,
  } = usePagination(filteredCustomerDiscounts);

  const {
    paginatedItems: store_priceListsPaginated,
    currentPage: store_priceListsCurrentPage,
    pageSize: store_priceListsPageSize,
    totalPages: store_priceListsTotalPages,
    totalItems: store_priceListsTotalItems,
    setPage: setStore_priceListsPage,
    setPageSize: setStore_priceListsPageSize,
  } = usePagination(filteredPriceLists);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select
          value={price.product_id}
          onValueChange={(v) => setPrice({ ...price, product_id: v })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="选择产品" />
          </SelectTrigger>
          <SelectContent>
            {store.products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          placeholder="标准售价"
          className="w-32"
          value={price.price || ""}
          onChange={(e) =>
            setPrice({ ...price, price: Number(e.target.value) })
          }
        />
        <Input
          type="date"
          className="w-40"
          value={price.effective_date || ""}
          onChange={(e) =>
            setPrice({ ...price, effective_date: e.target.value })
          }
        />
        <Input
          type="date"
          className="w-40"
          value={price.expiry_date || ""}
          onChange={(e) =>
            setPrice({ ...price, expiry_date: e.target.value })
          }
        />
        <Button onClick={addPrice}>新增</Button>
        <Input
          placeholder="搜索款号/品名"
          className="w-48"
          value={priceSearch}
          onChange={(e) => setPriceSearch(e.target.value)}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>款号</TableHead>
            <TableHead>品名</TableHead>
            <TableHead>标准售价</TableHead>
            <TableHead>生效日期</TableHead>
            <TableHead>失效日期</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {store_priceListsPaginated.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.product_code}</TableCell>
              <TableCell>{p.product_name}</TableCell>
              <TableCell>{formatMoney(p.price)}</TableCell>
              <TableCell>{p.effective_date}</TableCell>
              <TableCell>{p.expiry_date}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => store.deletePriceList(p.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        currentPage={store_priceListsCurrentPage}
        totalPages={store_priceListsTotalPages}
        pageSize={store_priceListsPageSize}
        totalItems={store_priceListsTotalItems}
        onPageChange={setStore_priceListsPage}
        onPageSizeChange={setStore_priceListsPageSize}
      />
    </div>
  );
}

function StatsTab() {
  const store = useAppStore();
  const [dimension, setDimension] = useState<"customer" | "product">(
    "customer",
  );

  const data = useMemo(() => {
    if (dimension === "customer") {
      const map: Record<
        string,
        { name: string; sales: number; quantity: number }
      > = {};
      store.salesOrders.forEach((o) => {
        if (!map[o.customer_id])
          map[o.customer_id] = { name: o.customer_name, sales: 0, quantity: 0 };
        map[o.customer_id].sales += o.total_amount;
        map[o.customer_id].quantity += o.items.reduce(
          (s, i) => s + i.quantity,
          0,
        );
      });
      return Object.values(map);
    }
    const map: Record<
      string,
      { name: string; sales: number; quantity: number }
    > = {};
    store.salesOrders.forEach((o) =>
      o.items.forEach((i) => {
        if (!map[i.product_code])
          map[i.product_code] = {
            name: i.product_name,
            sales: 0,
            quantity: 0,
          };
        map[i.product_code].sales += i.amount;
        map[i.product_code].quantity += i.quantity;
      }),
    );
    return Object.values(map);
  }, [store.salesOrders, dimension]);

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "#8B6B4D",
    "#C4A77D",
    "#D6C4A6",
  ];

  const {
    paginatedItems: dataPaginated,
    currentPage: dataCurrentPage,
    pageSize: dataPageSize,
    totalPages: dataTotalPages,
    totalItems: dataTotalItems,
    setPage: setDataPage,
    setPageSize: setDataPageSize,
  } = usePagination(data);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={dimension === "customer" ? "default" : "outline"}
          size="sm"
          onClick={() => setDimension("customer")}
        >
          按客户
        </Button>
        <Button
          variant={dimension === "product" ? "default" : "outline"}
          size="sm"
          onClick={() => setDimension("product")}
        >
          按产品
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">销售额分布</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" name="销售额" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">销量分布</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="quantity"
                  nameKey="name"
                  outerRadius={80}
                  label
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {dimension === "customer" ? "客户" : "产品"}
                </TableHead>
                <TableHead>销售额</TableHead>
                <TableHead>销量</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataPaginated.map((d, i) => (
                <TableRow key={i}>
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{formatMoney(d.sales)}</TableCell>
                  <TableCell>{d.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            currentPage={dataCurrentPage}
            totalPages={dataTotalPages}
            pageSize={dataPageSize}
            totalItems={dataTotalItems}
            onPageChange={setDataPage}
            onPageSizeChange={setDataPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}

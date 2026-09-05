import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useState, useMemo, Fragment, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { addDays } from "date-fns";
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
import { FileUpload } from "@/components/common/FileUpload";
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
  Truck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FileText,
  Package,
  CreditCard,
  Pencil,
  Trash2,
  Eye,
  Database,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Download,
  Upload,
  Loader2,
} from "lucide-react";
import {
  downloadPurchaseTemplate,
  parsePurchaseExcel,
  type PurchaseImportError,
} from "@/lib/purchaseImport";
import type {
  Supplier,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseArrival,
  PurchaseReturn,
  PaymentRecord,
  FinanceRecord,
  Material,
  WarehouseLocation,
  StockRecord,
  MaterialInspection,
  QualityInspectionItem,
} from "@/types";

import { nanoid, formatBeijingTime } from "@/lib/utils";

export function PurchasePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "po";

  function updateUrlTab(value: string) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="采购管理"
        description="采购需求、订单、到货质检与付款管理"
      />
      <ControlledTabs
        modulePath="/purchase"
        defaultTab={initialTab}
        onActiveTabChange={updateUrlTab}
      >
        <TabsList className="bg-muted flex-wrap">
          <TabsTrigger value="request">采购需求</TabsTrigger>
          <TabsTrigger value="po">采购订单</TabsTrigger>
          <TabsTrigger value="supplier">供应商</TabsTrigger>
          <TabsTrigger value="material">物料档案</TabsTrigger>
          <TabsTrigger value="arrival">到货入库</TabsTrigger>
          <TabsTrigger value="payment">付款申请</TabsTrigger>
        </TabsList>
        <PurchaseRequestTab />
        <PurchaseOrderTab />
        <SupplierTab />
        <MaterialTab />
        <ArrivalTab />
        <PaymentTab />
      </ControlledTabs>
    </div>
  );
}

/* ─── 采购需求 ────────────────────────────────────────────── */

function PurchaseRequestTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [convertRequest, setConvertRequest] = useState<PurchaseRequest | null>(
    null,
  );
  const [supplierAlloc, setSupplierAlloc] = useState<Record<string, string>>(
    {},
  );
  const [convertSuccess, setConvertSuccess] = useState<{
    count: number;
    orderNos: string[];
  } | null>(null);
  const [form, setForm] = useState<Partial<PurchaseRequest>>({
    status: "draft",
    items: [],
  });

  // 为旧数据自动补全来源字段
  useEffect(() => {
    const needsPatch = store.purchaseRequests.filter(
      (r) => !r.source && !r.related_plan_no,
    );
    if (needsPatch.length === 0) return;
    needsPatch.forEach((r) => {
      const isMRP = r.items.some((it) => it.reason?.includes("MRP"));
      const relatedPlan = isMRP
        ? store.productionPlans
            .slice()
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
            )
            .find((p) => {
              const product = store.products.find(
                (prod) => prod.id === p.product_id,
              );
              if (!product) return false;
              const planMaterialIds = new Set(
                (product.boms || [])
                  .map((b) => b.material_id)
                  .filter(Boolean),
              );
              return r.items.every(
                (it) =>
                  !it.material_id || planMaterialIds.has(it.material_id),
              );
            })
        : undefined;
      store.updatePurchaseRequest({
        ...r,
        source: getRequestSource(r),
        related_plan_id: relatedPlan?.id,
        related_plan_no: relatedPlan?.plan_no,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requests = useMemo(
    () =>
      store.purchaseRequests
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [store.purchaseRequests],
  );

  function getRequestSource(r: PurchaseRequest): string {
    if (r.related_plan_no) return r.related_plan_no;
    if (r.source) return r.source;
    const isMRP = r.items.some((it) => it.reason?.includes("MRP"));
    return isMRP ? "MRP 自动生成" : "手工创建";
  }

  function addItem() {
    setForm((f) => ({
      ...f,
      items: [
        ...(f.items || []),
        {
          material_id: "",
          material_code: "",
          material_name: "",
          specification: "",
          quantity: 1,
          unit: "米",
          required_date: "",
        },
      ],
    }));
  }

  function updateItem(idx: number, patch: Partial<PurchaseRequestItem>) {
    const items = [...(form.items || [])];
    items[idx] = { ...items[idx], ...patch };
    setForm({ ...form, items });
  }

  function save() {
    if (!form.applicant || !form.items?.length) return;
    const payload: PurchaseRequest = {
      ...(form as PurchaseRequest),
      id: nanoid(),
      code: `PR-${Date.now().toString().slice(-6)}`,
      created_at: new Date().toISOString().split("T")[0],
      status: "pending",
    };
    store.addPurchaseRequest({ ...payload, source: "手工创建" });
    setOpen(false);
    setForm({ status: "draft", items: [] });
  }

  function approve(item: PurchaseRequest) {
    store.updatePurchaseRequest({ ...item, status: "approved" });
  }

  function getDefaultSupplierId(materialId?: string): string {
    if (!materialId) return "";
    const m = store.materials.find((x) => x.id === materialId);
    if (m?.default_supplier) {
      const exact = store.suppliers.find((s) => s.id === m.default_supplier);
      if (exact) return exact.id;
      const byName = store.suppliers.find(
        (s) =>
          s.name.includes(m.default_supplier) ||
          m.default_supplier.includes(s.name),
      );
      if (byName) return byName.id;
    }
    const defaultPrice = store.materialSupplierPrices.find(
      (p) =>
        p.material_id === materialId && p.is_default && p.status === "active",
    );
    return defaultPrice?.supplier_id || "";
  }

  function getSupplierPrice(materialId?: string, supplierId?: string): number {
    if (!materialId || !supplierId) return 0;
    const price = store.materialSupplierPrices.find(
      (p) =>
        p.material_id === materialId &&
        p.supplier_id === supplierId &&
        p.status === "active",
    );
    if (price) return price.price;
    // 无报价时，取该物料最近一次采购订单的成交价
    const latest = store.purchaseOrders
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .flatMap((o) => o.items)
      .find(
        (it) =>
          it.material_id === materialId ||
          it.material_code ===
            store.materials.find((x) => x.id === materialId)?.code,
      );
    if (latest && latest.unit_price > 0) return latest.unit_price;
    return 0;
  }

  function openConvertDialog(item: PurchaseRequest) {
    if (item.status !== "approved") return;
    const alloc: Record<string, string> = {};
    item.items.forEach((it, idx) => {
      alloc[idx] = getDefaultSupplierId(it.material_id);
    });
    setSupplierAlloc(alloc);
    setConvertSuccess(null);
    setConvertRequest(item);
  }

  function closeConvertDialog() {
    setConvertRequest(null);
    setSupplierAlloc({});
    setConvertSuccess(null);
  }

  function generatePurchaseOrderNo(idx: number): string {
    return `PO-${Date.now().toString().slice(-6)}-${String(idx + 1).padStart(2, "0")}`;
  }

  function confirmConvert() {
    if (!convertRequest) return;
    const groups = new Map<
      string,
      { supplier: Supplier; items: PurchaseRequestItem[] }
    >();
    for (let i = 0; i < convertRequest.items.length; i++) {
      const item = convertRequest.items[i];
      const supplierId = supplierAlloc[i];
      if (!supplierId) {
        toast.error(`请为物料 ${item.material_name} 选择供应商`);
        return;
      }
      const supplier = store.suppliers.find((s) => s.id === supplierId);
      if (!supplier) {
        toast.error(`未找到供应商 ${supplierId}`);
        return;
      }
      const existing = groups.get(supplierId);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(supplierId, { supplier, items: [item] });
      }
    }

    const createdNos: string[] = [];
    let idx = 0;
    for (const [, { supplier, items }] of groups) {
      const orderNo = generatePurchaseOrderNo(idx++);
      const order: PurchaseOrder = {
        id: nanoid(),
        order_no: orderNo,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        request_id: convertRequest.id,
        request_code: convertRequest.code,
        total_amount: 0,
        currency: "CNY",
        status: "pending",
        payment_status: "unpaid",
        issued_date: convertRequest.required_date || new Date().toISOString().split("T")[0],
        created_at: new Date().toISOString().split("T")[0],
        items: items.map((it) => {
          const unitPrice = getSupplierPrice(it.material_id, supplier.id);
          return {
            material_id: it.material_id,
            material_code: it.material_code,
            material_name: it.material_name,
            specification: it.specification,
            quantity: it.quantity,
            unit: it.unit,
            unit_price: unitPrice,
            amount: Number((unitPrice * it.quantity).toFixed(2)),
          };
        }),
      };
      order.total_amount = Number(
        order.items.reduce((sum, it) => sum + it.amount, 0).toFixed(2),
      );
      store.addPurchaseOrder(order);
      createdNos.push(orderNo);
    }

    store.updatePurchaseRequest({ ...convertRequest, status: "converted" });
    setConvertSuccess({ count: createdNos.length, orderNos: createdNos });
    toast.success(`已生成 ${createdNos.length} 张采购订单`);
  }

  const convertSummary = useMemo(() => {
    if (!convertRequest) return [];
    const map = new Map<string, Supplier>();
    Object.values(supplierAlloc).forEach((sid) => {
      if (!sid) return;
      const s = store.suppliers.find((x) => x.id === sid);
      if (s) map.set(s.id, s);
    });
    return Array.from(map.values());
  }, [convertRequest, supplierAlloc, store.suppliers]);

  function statusBadge(status: string) {
    const map: Record<
      string,
      {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
      }
    > = {
      draft: { label: "草稿", variant: "outline" },
      pending: { label: "待审批", variant: "secondary" },
      approved: { label: "已批准", variant: "default" },
      rejected: { label: "已驳回", variant: "destructive" },
      partial: { label: "部分到货", variant: "secondary" },
      completed: { label: "已完成", variant: "default" },
      converted: { label: "已转单", variant: "outline" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  }

  const {
    paginatedItems: convertRequest_itemsPaginated,
    currentPage: convertRequest_itemsCurrentPage,
    pageSize: convertRequest_itemsPageSize,
    totalPages: convertRequest_itemsTotalPages,
    totalItems: convertRequest_itemsTotalItems,
    setPage: setConvertRequest_itemsPage,
    setPageSize: setConvertRequest_itemsPageSize,
  } = usePagination(convertRequest?.items || []);

  const {
    paginatedItems: requestsPaginated,
    currentPage: requestsCurrentPage,
    pageSize: requestsPageSize,
    totalPages: requestsTotalPages,
    totalItems: requestsTotalItems,
    setPage: setRequestsPage,
    setPageSize: setRequestsPageSize,
  } = usePagination(requests);

  return (
    <TabsContent value="request" className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新增采购需求
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">需求编号</TableHead>
                <TableHead className="whitespace-nowrap">申请人</TableHead>
                <TableHead className="whitespace-nowrap">部门</TableHead>
                <TableHead className="whitespace-nowrap">来源</TableHead>
                <TableHead className="whitespace-nowrap">申请日期</TableHead>
                <TableHead className="whitespace-nowrap">需货日期</TableHead>
                <TableHead className="whitespace-nowrap">物料数量</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requestsPaginated.map((r) => {
                const isExpanded = expandedId === r.id;

                return (
                  <Fragment key={r.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    >
                      <TableCell className="whitespace-nowrap font-medium">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(isExpanded ? null : r.id);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          {r.code}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.applicant}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.department}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {getRequestSource(r)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatBeijingTime(r.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.required_date}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.items.length} 项
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {statusBadge(r.status)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {r.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                approve(r);
                              }}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              审批通过
                            </Button>
                          )}
                          {r.status === "approved" && (
                            <Button
                              size="sm"
                              className="bg-[#4A6A7F] text-white hover:bg-[#3A5569]"
                              onClick={(e) => {
                                e.stopPropagation();
                                openConvertDialog(r);
                              }}
                            >
                              <Truck className="mr-1 h-3 w-3" />
                              生成采购订单
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={8} className="p-0">
                          <div className="p-4 overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="whitespace-nowrap">
                                    物料编码
                                  </TableHead>
                                  <TableHead className="whitespace-nowrap">
                                    物料名称
                                  </TableHead>
                                  <TableHead className="whitespace-nowrap">
                                    规格
                                  </TableHead>
                                  <TableHead className="whitespace-nowrap">
                                    数量
                                  </TableHead>
                                  <TableHead className="whitespace-nowrap">
                                    单位
                                  </TableHead>
                                  <TableHead className="whitespace-nowrap">
                                    需货日期
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {r.items.map((item, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="whitespace-nowrap font-mono text-xs">
                                      {item.material_code || "-"}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm">
                                      {item.material_name || "-"}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                      {item.specification || "-"}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm">
                                      {item.quantity}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm">
                                      {item.unit}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-sm">
                                      {r.required_date}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {r.items.length === 0 && (
                                  <TableRow>
                                    <TableCell
                                      colSpan={6}
                                      className="text-center text-sm text-muted-foreground"
                                    >
                                      暂无物料明细
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无采购需求
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={requestsCurrentPage}
            totalPages={requestsTotalPages}
            pageSize={requestsPageSize}
            totalItems={requestsTotalItems}
            onPageChange={setRequestsPage}
            onPageSizeChange={setRequestsPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm({ status: "draft", items: [] });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增采购需求</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>申请人</Label>
              <Input
                value={form.applicant || ""}
                onChange={(e) =>
                  setForm({ ...form, applicant: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>部门</Label>
              <Input
                value={form.department || ""}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>需货日期</Label>
              <Input
                type="date"
                value={form.required_date || ""}
                onChange={(e) =>
                  setForm({ ...form, required_date: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>需求明细</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                添加物料
              </Button>
            </div>
            {(form.items || []).map((item, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Select
                  value={item.material_id || "none"}
                  onValueChange={(v) => {
                    const m = store.materials.find((x) => x.id === v);
                    updateItem(idx, {
                      material_id: m?.id || "",
                      material_code: m?.code || "",
                      material_name: m?.name || "",
                      specification: m?.specification || "",
                      unit: m?.unit || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择物料" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">选择物料</SelectItem>
                    {store.materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="规格"
                  value={item.specification}
                  onChange={(e) =>
                    updateItem(idx, { specification: e.target.value })
                  }
                />
                <Input
                  type="number"
                  placeholder="数量"
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(idx, { quantity: Number(e.target.value) })
                  }
                />
                <Input
                  placeholder="单位"
                  value={item.unit}
                  onChange={(e) => updateItem(idx, { unit: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>
              <FileText className="mr-2 h-4 w-4" />
              提交需求
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!convertRequest}
        onOpenChange={(v) => {
          if (!v) closeConvertDialog();
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {convertSuccess ? "生成成功" : "生成采购订单"}
            </DialogTitle>
          </DialogHeader>
          {!convertSuccess && convertRequest && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                需求单：{convertRequest.code}，共 {convertRequest.items.length}{" "}
                项物料
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        物料编码
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        物料名称
                      </TableHead>
                      <TableHead className="whitespace-nowrap">规格</TableHead>
                      <TableHead className="whitespace-nowrap">数量</TableHead>
                      <TableHead className="whitespace-nowrap">单位</TableHead>
                      <TableHead className="whitespace-nowrap">
                        供应商
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convertRequest_itemsPaginated.map((item, idx) => {
                      const supplierId = supplierAlloc[idx] || "";
                      return (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap font-mono text-xs">
                            {item.material_code || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {item.material_name || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {item.specification || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {item.unit}
                          </TableCell>
                          <TableCell className="whitespace-nowrap min-w-[160px]">
                            <Select
                              value={supplierId || "none"}
                              onValueChange={(v) =>
                                setSupplierAlloc({
                                  ...supplierAlloc,
                                  [idx]: v === "none" ? "" : v,
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="选择供应商" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">请选择</SelectItem>
                                {store.suppliers.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <Pagination
                  currentPage={convertRequest_itemsCurrentPage}
                  totalPages={convertRequest_itemsTotalPages}
                  pageSize={convertRequest_itemsPageSize}
                  totalItems={convertRequest_itemsTotalItems}
                  onPageChange={setConvertRequest_itemsPage}
                  onPageSizeChange={setConvertRequest_itemsPageSize}
                />
              </div>
              {convertSummary.length > 0 && (
                <div className="text-sm bg-muted/40 p-3 rounded-md">
                  该需求将拆分为 <strong>{convertSummary.length}</strong>{" "}
                  张采购订单，分别发给：
                  {convertSummary.map((s) => s.name).join("、")}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeConvertDialog}>
                  取消
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={confirmConvert}
                >
                  确认生成采购订单
                </Button>
              </div>
            </div>
          )}
          {convertSuccess && (
            <div className="space-y-4 py-4">
              <div className="text-sm">
                已成功生成 <strong>{convertSuccess.count}</strong>{" "}
                张采购订单，订单号：
                {convertSuccess.orderNos.join("、")}。
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeConvertDialog}>
                  关闭
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  onClick={closeConvertDialog}
                >
                  跳转至采购订单
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 采购订单 ────────────────────────────────────────────── */

function PurchaseOrderTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [draft, setDraft] = useState<PurchaseOrder | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form, setForm] = useState<Partial<PurchaseOrder>>({
    status: "draft",
    payment_status: "unpaid",
    items: [],
  });

  // 导入相关
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<PurchaseImportError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDownloadTemplate() {
    downloadPurchaseTemplate();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setImporting(true);
    try {
      const result = await parsePurchaseExcel(
        file,
        store.suppliers,
        store.materials,
        store.contracts,
      );
      if (!result.success) {
        setImportErrors(result.errors);
        return;
      }
      // 按供应商分组生成采购订单
      const groups = new Map<
        string,
        { supplierName: string; supplierId: string; items: typeof result.rows }
      >();
      for (const row of result.rows) {
        let g = groups.get(row.supplier_id);
        if (!g) {
          g = { supplierName: row.supplier_name, supplierId: row.supplier_id, items: [] };
          groups.set(row.supplier_id, g);
        }
        g.items.push(row);
      }
      let idx = 0;
      for (const [, g] of groups) {
        const orderNo = `PO-${Date.now().toString().slice(-6)}-${String(idx + 1).padStart(2, "0")}`;
        idx++;
        const items: PurchaseOrderItem[] = g.items.map((it) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          specification: it.specification,
          quantity: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          amount: it.amount,
        }));
        const total = Number(items.reduce((s, it) => s + it.amount, 0).toFixed(2));
        const firstContract = g.items.find((it) => it.contract_id);
        const order: PurchaseOrder = {
          id: nanoid(),
          order_no: orderNo,
          supplier_id: g.supplierId,
          supplier_name: g.supplierName,
          total_amount: total,
          currency: "CNY",
          status: "pending",
          payment_status: "unpaid",
          issued_date: g.items[0].issued_date,
          created_at: g.items[0].order_date,
          items,
          contract_id: firstContract?.contract_id || undefined,
          contract_no: firstContract?.contract_no || undefined,
          remark: g.items.find((it) => it.remark)?.remark || undefined,
        };
        store.addPurchaseOrder(order);
      }
      toast.success(`成功导入 ${result.rows.length} 条采购明细`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  const [searchText, setSearchText] = useState("");

  const orders = useMemo(() => {
    const sorted = store.purchaseOrders
      .slice()
      .sort((a, b) => (b.issued_date || "").localeCompare(a.issued_date || ""));
    if (!searchText.trim()) return sorted;
    const kw = searchText.trim().toLowerCase();
    return sorted.filter(
      (o) =>
        o.order_no?.toLowerCase().includes(kw) ||
        (o.contract_no || "").toLowerCase().includes(kw),
    );
  }, [store.purchaseOrders, searchText]);

  function addItem() {
    setForm((f) => ({
      ...f,
      items: [
        ...(f.items || []),
        {
          material_id: "",
          material_code: "",
          material_name: "",
          color: "",
          specification: "",
          quantity: 1,
          unit: "米",
          unit_price: 0,
          amount: 0,
        },
      ],
    }));
  }

  function updateItem(idx: number, patch: Partial<PurchaseOrderItem>) {
    const items = [...(form.items || [])];
    items[idx] = { ...items[idx], ...patch };
    items[idx].amount = items[idx].quantity * items[idx].unit_price;
    setForm({
      ...form,
      items,
      total_amount: items.reduce((s, i) => s + i.amount, 0),
    });
  }

  function save() {
    if (!form.supplier_id || !form.items?.length) return;
    const payload: PurchaseOrder = {
      ...(form as PurchaseOrder),
      id: nanoid(),
      order_no: `PO-${Date.now().toString().slice(-6)}`,
      issued_date: form.issued_date || new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString().split("T")[0],
    };
    store.addPurchaseOrder(payload);
    setOpen(false);
    setForm({ status: "draft", payment_status: "unpaid", items: [] });
  }

  function approve(order: PurchaseOrder) {
    store.updatePurchaseOrder({ ...order, status: "approved" });
    const exists = store.financeRecords.some(
      (f) => f.type === "\u5e94\u4ed8" && f.related_order_id === order.id,
    );
    if (!exists) {
      store.addFinanceRecord({
        id: nanoid(),
        type: "\u5e94\u4ed8",
        counterparty: order.supplier_name,
        supplier_id: order.supplier_id,
        related_order_id: order.id,
        related_order: order.order_no,
        amount: order.total_amount,
        paid_amount: 0,
        currency: order.currency || "CNY",
        record_date: new Date().toISOString().split("T")[0],
        status: "unsettled",
      });
    }
  }

  function updateDraftItem(
    base: PurchaseOrder,
    current: PurchaseOrder | null,
    set: (v: PurchaseOrder) => void,
    idx: number,
    patch: Partial<PurchaseOrderItem>,
  ) {
    const items = [...(current?.items ?? base.items)];
    items[idx] = { ...items[idx], ...patch };
    items[idx].amount = items[idx].quantity * items[idx].unit_price;
    set({
      ...(current ?? base),
      items,
      total_amount: items.reduce((s, i) => s + i.amount, 0),
    });
  }

  function statusBadge(status: string) {
    const map: Record<
      string,
      {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
      }
    > = {
      draft: { label: "草稿", variant: "outline" },
      pending: { label: "待审批", variant: "secondary" },
      approved: { label: "已批准", variant: "default" },
      partial: { label: "部分到货", variant: "secondary" },
      received: { label: "已到货", variant: "default" },
      completed: { label: "已完成", variant: "default" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  }

  function payBadge(status: string) {
    if (status === "paid")
      return (
        <Badge variant="default" className="bg-green-500">
          已付款
        </Badge>
      );
    if (status === "partial")
      return <Badge variant="secondary">部分付款</Badge>;
    return <Badge variant="outline">未付款</Badge>;
  }

  function getPaymentStatus(order: PurchaseOrder): "unpaid" | "partial" | "paid" {
    const totalPaid = store.paymentRecords
      .filter((p) => p.type === "pay" && p.order_id === order.id)
      .reduce((s, p) => s + p.amount, 0);
    if (totalPaid <= 0) return "unpaid";
    if (totalPaid >= order.total_amount) return "paid";
    return "partial";
  }

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
    <TabsContent value="po" className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
          <Download className="mr-1 h-4 w-4" />
          下载模板
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1 h-4 w-4" />
          )}
          导入采购
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleImportFile}
        />
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          新增采购订单
        </Button>
      </div>
      <Card>
        <CardContent className="p-4 pb-0">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="搜索采购单号或合同编号..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setOrdersPage(1); }}
              className="max-w-xs"
            />
          </div>
        </CardContent>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">采购单号</TableHead>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">供应商</TableHead>
                <TableHead className="whitespace-nowrap">总金额</TableHead>
                <TableHead className="whitespace-nowrap">下达采购日期</TableHead>
                <TableHead className="whitespace-nowrap">订单状态</TableHead>
                <TableHead className="whitespace-nowrap">付款状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersPaginated.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {o.order_no}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {o.contract_no || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o.supplier_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    ¥{o.total_amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o.issued_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {statusBadge(o.status)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {payBadge(getPaymentStatus(o))}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDetail(o)}
                      >
                        详情
                      </Button>
                      {o.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approve(o)}
                        >
                          提交审批
                        </Button>
                      )}
                      {o.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approve(o)}
                        >
                          审批通过
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {ordersPaginated.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-sm text-muted-foreground"
                  >
                    {searchText ? "未找到匹配的采购订单" : "暂无采购订单"}
                  </TableCell>
                </TableRow>
              )}
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
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v)
            setForm({ status: "draft", payment_status: "unpaid", items: [] });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增采购订单</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>供应商</Label>
              <Select
                value={form.supplier_id || ""}
                onValueChange={(v) => {
                  const s = store.suppliers.find((x) => x.id === v);
                  setForm({
                    ...form,
                    supplier_id: s?.id || "",
                    supplier_name: s?.name || "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择供应商" />
                </SelectTrigger>
                <SelectContent>
                  {store.suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>下达采购日期</Label>
              <Input
                type="date"
                value={form.issued_date || ""}
                onChange={(e) =>
                  setForm({ ...form, issued_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>关联合同编号</Label>
              <Select
                value={form.contract_no || "none"}
                onValueChange={(v) => {
                  const contractNo = v === "none" ? undefined : v;
                  const contract = contractNo
                    ? store.contracts.find((c) => c.contract_no === contractNo)
                    : null;
                  const issued = contract?.sign_date
                    ? addDays(new Date(contract.sign_date), 1 + Math.floor(Math.random() * 2)).toISOString().slice(0, 10)
                    : form.issued_date;
                  setForm({ ...form, contract_no: contractNo, issued_date: issued });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择关联合同（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联合同</SelectItem>
                  {store.contracts.map((c) => (
                    <SelectItem key={c.id} value={c.contract_no}>
                      {c.contract_no}
                      {c.customer_name ? ` — ${c.customer_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>总金额（自动计算）</Label>
              <Input type="number" value={form.total_amount || 0} readOnly />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>采购明细</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                添加物料
              </Button>
            </div>
            {(form.items || []).map((item, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2 md:grid-cols-6">
                <Select
                  value={item.material_id || "none"}
                  onValueChange={(v) => {
                    const m = store.materials.find((x) => x.id === v);
                    updateItem(idx, {
                      material_id: m?.id || "",
                      material_code: m?.code || "",
                      material_name: m?.name || "",
                      specification: m?.specification || "",
                      unit: m?.unit || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择物料" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">选择物料</SelectItem>
                    {store.materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="颜色"
                  value={item.color || ""}
                  onChange={(e) => updateItem(idx, { color: e.target.value })}
                />
                <Input
                  placeholder="规格"
                  value={item.specification}
                  onChange={(e) =>
                    updateItem(idx, { specification: e.target.value })
                  }
                />
                <Input
                  type="number"
                  placeholder="数量"
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(idx, { quantity: Number(e.target.value) })
                  }
                />
                <Input
                  type="number"
                  placeholder="单价"
                  value={item.unit_price}
                  onChange={(e) =>
                    updateItem(idx, { unit_price: Number(e.target.value) })
                  }
                />
                <Input
                  placeholder="金额"
                  value={item.amount.toFixed(2)}
                  readOnly
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>
              <Truck className="mr-2 h-4 w-4" />
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) {
            setDetail(null);
            setDraft(null);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>采购订单详情：{detail?.order_no}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">供应商</Label>
                  <div>{detail.supplier_name}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">关联合同</Label>
                  <div>{detail.contract_no || "-"}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">总金额</Label>
                  <div>
                    ¥
                    {(draft?.total_amount ?? detail.total_amount).toLocaleString()}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">下达采购日期</Label>
                  <div>{detail.issued_date}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">订单状态</Label>
                  <div>{statusBadge(detail.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">付款状态</Label>
                  <div>{payBadge(getPaymentStatus(detail))}</div>
                </div>
              </div>
              <div>
                <div className="mb-2 font-medium">物料明细</div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">
                          物料编码
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          物料名称
                        </TableHead>
                        <TableHead className="whitespace-nowrap">颜色</TableHead>
                        <TableHead className="whitespace-nowrap">规格</TableHead>
                        <TableHead className="whitespace-nowrap">数量</TableHead>
                        <TableHead className="whitespace-nowrap">单价</TableHead>
                        <TableHead className="whitespace-nowrap">金额</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(draft?.items ?? detail.items).map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap">
                            {it.material_code}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {it.material_name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {it.color || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {it.specification || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {detail.status === "draft" ||
                            detail.status === "pending" ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={1}
                                  className="w-24"
                                  value={it.quantity}
                                  onChange={(e) =>
                                    updateDraftItem(
                                      detail,
                                      draft,
                                      setDraft,
                                      idx,
                                      {
                                        quantity: Number(e.target.value),
                                      },
                                    )
                                  }
                                />
                                <span className="text-sm text-muted-foreground">
                                  {it.unit}
                                </span>
                              </div>
                            ) : (
                              `${it.quantity} ${it.unit}`
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {detail.status === "draft" ||
                            detail.status === "pending" ? (
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                className="w-28"
                                value={it.unit_price}
                                onChange={(e) =>
                                  updateDraftItem(
                                    detail,
                                    draft,
                                    setDraft,
                                    idx,
                                    {
                                      unit_price: Number(e.target.value),
                                    },
                                  )
                                }
                              />
                            ) : (
                              `¥${it.unit_price.toLocaleString()}`
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            ¥{it.amount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {detail.items.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground"
                          >
                            暂无物料明细
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {(detail.status === "draft" || detail.status === "pending") && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDraft(null);
                    }}
                  >
                    重置
                  </Button>
                  <Button
                    onClick={() => {
                      const target = draft ?? detail;
                      const quantityChanged = detail.items.some(
                        (it, idx) =>
                          it.quantity !==
                          (draft?.items[idx]?.quantity ?? it.quantity),
                      );
                      if (quantityChanged) {
                        setConfirmOpen(true);
                      } else {
                        store.updatePurchaseOrder(target);
                        setDetail(target);
                        setDraft(null);
                        toast.success("采购订单已更新");
                      }
                    }}
                  >
                    保存
                  </Button>
                </div>
              )}
              {(detail.status === "approved" ||
                detail.status === "partial" ||
                detail.status === "received" ||
                detail.status === "completed") && (
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  该订单已审批通过，详情仅可查看，不可编辑。
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>确认修改采购数量？</AlertDialogTitle>
            <AlertDialogDescription>
              采购数量变更可能影响到货、质检与库存预期，请确认是否继续保存。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = draft ?? detail;
                if (target) {
                  store.updatePurchaseOrder(target);
                  setDetail(target);
                  setDraft(null);
                  toast.success("采购订单已更新");
                }
                setConfirmOpen(false);
              }}
            >
              确认保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 导入错误弹窗 */}
      <Dialog open={importErrors.length > 0} onOpenChange={(v) => !v && setImportErrors([])}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>导入校验失败</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <ul className="space-y-2">
              {importErrors.map((err, idx) => (
                <li key={idx} className="text-sm text-foreground bg-muted/50 rounded-md px-3 py-2">
                  <span className="font-medium text-destructive">第 {err.row} 行：</span>
                  {err.message}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setImportErrors([])}>知道了</Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 供应商 ──────────────────────────────────────────────── */

function SupplierTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>({
    status: "active",
    qualification_files: [],
  });
  const [search, setSearch] = useState("");

  const suppliers = useMemo(() => {
    let list = store.suppliers;
    if (search)
      list = list.filter(
        (s) => s.name.includes(search) || s.contact.includes(search),
      );
    return list;
  }, [store.suppliers, search]);

  function save() {
    if (!form.name) return;
    const payload = form.id
      ? (form as Supplier)
      : ({ ...form, id: nanoid() } as Supplier);
    if (form.id) store.updateSupplier(payload);
    else store.addSupplier(payload);
    setOpen(false);
    setForm({
      status: "active",
      qualification_files: [],
    });
  }

  const {
    paginatedItems: suppliersPaginated,
    currentPage: suppliersCurrentPage,
    pageSize: suppliersPageSize,
    totalPages: suppliersTotalPages,
    totalItems: suppliersTotalItems,
    setPage: setSuppliersPage,
    setPageSize: setSuppliersPageSize,
  } = usePagination(suppliers);

  return (
    <TabsContent value="supplier" className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索供应商"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          onClick={() => {
            setForm({
              status: "active",
              qualification_files: [],
            });
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          新增供应商
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">供应商名称</TableHead>
                <TableHead className="whitespace-nowrap">联系人</TableHead>
                <TableHead className="whitespace-nowrap">电话</TableHead>
                <TableHead className="whitespace-nowrap">地址</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliersPaginated.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {s.name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.contact}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{s.phone}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.address}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={s.status === "active" ? "default" : "secondary"}
                    >
                      {s.status === "active" ? "合作中" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setForm({ ...s });
                        setOpen(true);
                      }}
                    >
                      编辑
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {suppliers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无供应商
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={suppliersCurrentPage}
            totalPages={suppliersTotalPages}
            pageSize={suppliersPageSize}
            totalItems={suppliersTotalItems}
            onPageChange={setSuppliersPage}
            onPageSizeChange={setSuppliersPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v)
            setForm({
              status: "active",
              qualification_files: [],
            });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "编辑供应商" : "新增供应商"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>供应商名称</Label>
              <Input
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>联系人</Label>
              <Input
                value={form.contact || ""}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>电话</Label>
              <Input
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select
                value={form.status || "active"}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">合作中</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>地址</Label>
              <Input
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>
              <Building2 className="mr-2 h-4 w-4" />
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

const emptyMaterial: Material = {
  id: "",
  code: "",
  name: "",
  category: "面料",
  specification: "",
  unit: "米",
  default_supplier: "",
  color: "",
  pattern_code: "",
  composition: "",
  weight: 0,
  resilience_level: "",
  safety_stock: 0,
  stock: 0,
  status: "active",
};

/* ─── 物料档案 ────────────────────────────────────────────── */

function MaterialTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Material>(emptyMaterial);
  const [search, setSearch] = useState("");

  const materials = useMemo(() => {
    let list = store.materials;
    if (search)
      list = list.filter(
        (m) => m.name.includes(search) || m.code.includes(search),
      );
    return list;
  }, [store.materials, search]);

  function save() {
    if (!form.code || !form.name) return;
    if (form.id) store.updateMaterial(form);
    else store.addMaterial({ ...form, id: nanoid() });
    setOpen(false);
    setForm(emptyMaterial);
  }

  function handleEdit(m: Material) {
    setForm({ ...m });
    setOpen(true);
  }

  const {
    paginatedItems: materialsPaginated,
    currentPage: materialsCurrentPage,
    pageSize: materialsPageSize,
    totalPages: materialsTotalPages,
    totalItems: materialsTotalItems,
    setPage: setMaterialsPage,
    setPageSize: setMaterialsPageSize,
  } = usePagination(materials);

  return (
    <TabsContent value="material" className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索物料编码/名称"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          onClick={() => {
            setForm(emptyMaterial);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          新增物料
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">物料编码</TableHead>
                <TableHead className="whitespace-nowrap">物料名称</TableHead>
                <TableHead className="whitespace-nowrap">类别</TableHead>
                <TableHead className="whitespace-nowrap">规格</TableHead>
                <TableHead className="whitespace-nowrap">单位</TableHead>
                <TableHead className="whitespace-nowrap">默认供应商</TableHead>
                <TableHead className="whitespace-nowrap">安全库存</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialsPaginated.map((m) => {
                const supplier = store.suppliers.find(
                  (s) => s.id === m.default_supplier,
                );
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {m.code}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {m.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {m.category}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {m.specification || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {m.unit}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {supplier?.name || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {m.safety_stock}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        variant={
                          m.status === "active" ? "default" : "secondary"
                        }
                      >
                        {m.status === "active" ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(m)}
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
                              <AlertDialogTitle>
                                确认删除物料？
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                删除后无法恢复，已有的采购记录中仍会保留物料名称。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => store.deleteMaterial(m.id)}
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
                );
              })}
              {materials.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无物料
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={materialsCurrentPage}
            totalPages={materialsTotalPages}
            pageSize={materialsPageSize}
            totalItems={materialsTotalItems}
            onPageChange={setMaterialsPage}
            onPageSizeChange={setMaterialsPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm(emptyMaterial);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "编辑物料" : "新增物料"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>物料编码</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>物料名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>类别</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="如：面料、填充物、辅料"
              />
            </div>
            <div className="grid gap-2">
              <Label>规格</Label>
              <Input
                value={form.specification}
                onChange={(e) =>
                  setForm({ ...form, specification: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>单位</Label>
              <Input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="米/公斤/件"
              />
            </div>
            <div className="grid gap-2">
              <Label>默认供应商</Label>
              <Select
                value={form.default_supplier || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, default_supplier: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择供应商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无</SelectItem>
                  {store.suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>颜色</Label>
              <Input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>花型代码</Label>
              <Input
                value={form.pattern_code}
                onChange={(e) =>
                  setForm({ ...form, pattern_code: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>成分</Label>
              <Input
                value={form.composition}
                onChange={(e) =>
                  setForm({ ...form, composition: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>克重</Label>
              <Input
                type="number"
                value={form.weight}
                onChange={(e) =>
                  setForm({ ...form, weight: Number(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>回弹等级</Label>
              <Input
                value={form.resilience_level}
                onChange={(e) =>
                  setForm({ ...form, resilience_level: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>安全库存</Label>
              <Input
                type="number"
                value={form.safety_stock}
                onChange={(e) =>
                  setForm({ ...form, safety_stock: Number(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={save}
              disabled={!form.code.trim() || !form.name.trim()}
            >
              <Database className="mr-2 h-4 w-4" />
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 到货入库 ────────────────────────────────────────────── */

function ArrivalTab() {
  const store = useAppStore();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const canStockIn =
    profile?.role === "admin" || profile?.role === "warehouse";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<PurchaseArrival>>({
    status: "pending",
    items: [],
    inspector: currentUserName,
  });
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectArrival, setInspectArrival] = useState<PurchaseArrival | null>(
    null,
  );
  const [inspectItems, setInspectItems] = useState<PurchaseOrderItem[]>([]);
  const [inspectFiles, setInspectFiles] = useState<string[]>([]);
  const [inspectRemark, setInspectRemark] = useState("");
  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockInArrival, setStockInArrival] = useState<PurchaseArrival | null>(
    null,
  );
  type StockInItem = PurchaseOrderItem & {
    this_in_qty: number;
    warehouse: string;
    location_id: string;
  };
  const [stockInItems, setStockInItems] = useState<StockInItem[]>([]);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnArrival, setReturnArrival] = useState<PurchaseArrival | null>(
    null,
  );
  const [returnReason, setReturnReason] = useState("");
  const [poDetailOpen, setPoDetailOpen] = useState(false);
  const [poDetail, setPoDetail] = useState<PurchaseOrder | null>(null);
  const [arrivalDetailOpen, setArrivalDetailOpen] = useState(false);
  const [arrivalDetail, setArrivalDetail] = useState<PurchaseArrival | null>(
    null,
  );
  const [excessConfirmOpen, setExcessConfirmOpen] = useState(false);
  const [pendingArrivalPayload, setPendingArrivalPayload] =
    useState<PurchaseArrival | null>(null);
  const [excessMessages, setExcessMessages] = useState<string[]>([]);

  const [arrivalSearch, setArrivalSearch] = useState("");

  const arrivals = useMemo(() => {
    const kw = arrivalSearch.trim().toLowerCase();
    return store.purchaseArrivals
      .slice()
      .filter((a) =>
        !kw ||
        (a.contract_no || "").toLowerCase().includes(kw) ||
        (a.order_no || "").toLowerCase().includes(kw) ||
        (a.code || "").toLowerCase().includes(kw) ||
        (a.supplier_name || "").toLowerCase().includes(kw),
      )
      .sort((a, b) => b.arrival_date.localeCompare(a.arrival_date));
  }, [store.purchaseArrivals, arrivalSearch]);

  const activeLocations = useMemo(
    () => store.warehouseLocations.filter((l) => l.status === "active"),
    [store.warehouseLocations],
  );

  const warehouses = useMemo(
    () => Array.from(new Set(activeLocations.map((l) => l.warehouse))),
    [activeLocations],
  );

  function getLocationsByWarehouse(warehouse: string) {
    return activeLocations.filter((l) => l.warehouse === warehouse);
  }

  function openPODetail(order: PurchaseOrder) {
    setPoDetail(order);
    setPoDetailOpen(true);
  }

  function openArrivalDetail(arrival: PurchaseArrival) {
    setArrivalDetail(arrival);
    setArrivalDetailOpen(true);
  }

  function defaultArrivalDate(issuedDate: string) {
    // 下达采购后 5-7 天到货
    return addDays(new Date(issuedDate), 5 + Math.floor(Math.random() * 3))
      .toISOString()
      .slice(0, 10);
  }

  function openFromPO(order: PurchaseOrder) {
    setForm({
      order_id: order.id,
      order_no: order.order_no,
      supplier_name: order.supplier_name,
      arrival_date: defaultArrivalDate(order.issued_date || new Date().toISOString().split("T")[0]),
      status: "pending",
      items: order.items.map((i) => ({ ...i })),
      inspector: currentUserName,
    });
    setExcessConfirmOpen(false);
    setPendingArrivalPayload(null);
    setExcessMessages([]);
    setOpen(true);
  }

  function checkArrivalExcess(payload: PurchaseArrival): string[] {
    const order = store.purchaseOrders.find((o) => o.id === payload.order_id);
    if (!order) return [];
    const messages: string[] = [];
    for (const item of payload.items) {
      const ordered =
        order.items.find((oi) => oi.material_id === item.material_id)
          ?.quantity ?? 0;
      const arrived = store.purchaseArrivals
        .filter(
          (a) =>
            a.order_id === payload.order_id &&
            a.id !== payload.id &&
            a.status !== "rejected",
        )
        .reduce(
          (sum, a) =>
            sum +
            (a.items.find((i) => i.material_id === item.material_id)
              ?.quantity || 0),
          0,
        );
      const total = arrived + (item.quantity || 0);
      if (total > ordered) {
        messages.push(
          `${item.material_name}：累计到货 ${total}${item.unit}，超过采购量 ${ordered}${item.unit}`,
        );
      }
    }
    return messages;
  }

  function saveArrival(payload: PurchaseArrival) {
    store.addPurchaseArrival(payload);
    setOpen(false);
    setForm({ status: "pending", items: [], inspector: currentUserName });
    setPendingArrivalPayload(null);
    setExcessMessages([]);
    setExcessConfirmOpen(false);
    toast.success("到货登记已保存");
  }

  function openInspect(arrival: PurchaseArrival) {
    setInspectArrival(arrival);
    setInspectItems(
      arrival.items.map((i) => ({
        ...i,
        received_qty: i.quantity,
        qualified_qty: i.quantity,
        rejected_qty: 0,
      })),
    );
    setInspectFiles(arrival.inspection_files || []);
    setInspectRemark(arrival.inspection_remark || "");
    setInspectOpen(true);
  }

  function updateInspectItem(idx: number, patch: Partial<PurchaseOrderItem>) {
    setInspectItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  function confirmInspection() {
    if (!inspectArrival) return;
    for (const item of inspectItems) {
      const received = item.received_qty ?? item.quantity;
      const qualified = item.qualified_qty ?? 0;
      const rejected = item.rejected_qty ?? 0;
      if (qualified + rejected !== received) {
        toast.error(
          `${item.material_name} 合格数量与不合格数量之和必须等于实收数量`,
        );
        return;
      }
    }

    const makeItem = (
      i: PurchaseOrderItem,
      qty: number,
      qualified: number,
      rejected: number,
    ): PurchaseOrderItem => ({
      ...i,
      quantity: qty,
      qualified_qty: qualified,
      rejected_qty: rejected,
      amount: (i.unit_price || 0) * qty,
    });

    const qualifiedItems = inspectItems
      .filter((i) => (i.qualified_qty || 0) > 0)
      .map((i) => makeItem(i, i.qualified_qty || 0, i.qualified_qty || 0, 0));
    const rejectedItems = inspectItems
      .filter((i) => (i.rejected_qty || 0) > 0)
      .map((i) => makeItem(i, i.rejected_qty || 0, 0, i.rejected_qty || 0));

    if (qualifiedItems.length === 0 && rejectedItems.length === 0) {
      toast.error("至少需要一个合格或不合格物料");
      return;
    }

    const order = store.purchaseOrders.find(
      (o) => o.id === inspectArrival.order_id,
    );

    const baseUpdate: Partial<PurchaseArrival> = {
      inspection_files: inspectFiles.length ? inspectFiles : undefined,
      inspection_remark: inspectRemark || undefined,
    };

    if (qualifiedItems.length > 0) {
      store.updatePurchaseArrival({
        ...inspectArrival,
        ...baseUpdate,
        items: qualifiedItems,
        status: "qualified",
      });
    } else {
      store.updatePurchaseArrival({
        ...inspectArrival,
        ...baseUpdate,
        items: rejectedItems,
        status: "rejected",
      });
    }

    if (rejectedItems.length > 0 && qualifiedItems.length > 0) {
      store.addPurchaseArrival({
        id: nanoid(),
        code: `PA-${Date.now().toString().slice(-6)}-R`,
        order_id: inspectArrival.order_id,
        order_no: inspectArrival.order_no,
        supplier_name: inspectArrival.supplier_name,
        arrival_date: inspectArrival.arrival_date,
        inspector: inspectArrival.inspector,
        status: "rejected",
        items: rejectedItems,
        related_order: inspectArrival.code,
      });
    }

    if (order) {
      store.updatePurchaseOrder({ ...order, status: "received" });
    }

    // 同步生成来料检验记录，确保质量管理页面可见
    const inspectionItems = [...qualifiedItems, ...rejectedItems];
    inspectionItems.forEach((item) => {
      const material = store.materials.find((m) => m.id === item.material_id);
      const standard = store.qualityStandards.find(
        (s) => s.category === material?.category,
      );
      const inspectionResult: MaterialInspection["result"] =
        (item.rejected_qty || 0) > 0 && (item.qualified_qty || 0) === 0
          ? "unqualified"
          : "qualified";
      const record: MaterialInspection = {
        id: nanoid(),
        code: `MI-${Date.now().toString().slice(-6)}-${item.material_code}`,
        material_id: item.material_id || "",
        material_name: item.material_name,
        category: material?.category || "面料",
        supplier: inspectArrival.supplier_name,
        purchase_order_id: inspectArrival.order_id,
        purchase_order_no: inspectArrival.order_no,
        arrival_id: inspectArrival.id,
        arrival_code: inspectArrival.code,
        batch: `${inspectArrival.code}-${item.material_code}`,
        arrival_qty: item.received_qty ?? item.quantity,
        check_qty: item.received_qty ?? item.quantity,
        qualified_qty: item.qualified_qty || 0,
        unqualified_qty: item.rejected_qty || 0,
        result: inspectionResult,
        status: "inspected",
        inspector: inspectArrival.inspector || currentUserName || "质检员",
        created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
        items: (standard?.items || []).map<QualityInspectionItem>((si) => ({
          name: si.name,
          standard: si.standard,
          upper: si.upper,
          lower: si.lower,
          unit: si.unit,
          actual: undefined,
          result: "pending",
        })),
        defect_reason:
          inspectionResult === "unqualified"
            ? inspectRemark || "来料不合格"
            : undefined,
      };
      store.addMaterialInspection(record);
    });

    setInspectOpen(false);
    setInspectArrival(null);
    setInspectItems([]);
    toast.success("质检完成，已同步至来料检验");
  }

  function openStockIn(arrival: PurchaseArrival) {
    setStockInArrival(arrival);
    setStockInItems(
      arrival.items.map((item) => {
        const qualified = item.qualified_qty ?? item.quantity;
        const remaining = Math.max(
          0,
          qualified - (item.stored_qty || 0),
        );
        return {
          ...item,
          this_in_qty: remaining,
          warehouse: item.warehouse || "",
          location_id: item.location_id || "",
        };
      }),
    );
    setStockInOpen(true);
  }

  function updateStockInItem(idx: number, patch: Partial<StockInItem>) {
    setStockInItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  function confirmStockIn() {
    if (!stockInArrival || stockInItems.length === 0) {
      toast.error("没有可入库的物料");
      return;
    }

    for (const item of stockInItems) {
      if (item.this_in_qty <= 0) continue;
      if (!item.warehouse || !item.location_id) {
        toast.error(`${item.material_name} 请选择入库仓库和库位`);
        return;
      }
      const location = activeLocations.find(
        (l) => l.id === item.location_id && l.warehouse === item.warehouse,
      );
      if (!location) {
        toast.error(`${item.material_name} 所选库位不存在`);
        return;
      }
      if (!item.material_id) {
        toast.error(`${item.material_name} 缺少物料 ID`);
        return;
      }
    }

    const hasInbound = stockInItems.some((i) => i.this_in_qty > 0);
    if (!hasInbound) {
      toast.error("至少有一条物料的本次入库数量大于 0");
      return;
    }

    const updatedArrivalItems: PurchaseOrderItem[] = stockInArrival.items.map(
      (item, idx) => {
        const inbound = stockInItems[idx];
        if (!inbound) return item;
        return {
          ...item,
          stored_qty: (item.stored_qty || 0) + inbound.this_in_qty,
          warehouse: inbound.warehouse || item.warehouse,
          location_id: inbound.location_id || item.location_id,
        };
      },
    );

    const isFullyStored = updatedArrivalItems.every((item) => {
      const qualified = item.qualified_qty ?? item.quantity;
      return (item.stored_qty || 0) >= qualified;
    });

    const updatedArrival: PurchaseArrival = {
      ...stockInArrival,
      items: updatedArrivalItems,
      status: isFullyStored ? "stored" : "partial",
    };
    store.updatePurchaseArrival(updatedArrival);

    for (const item of stockInItems) {
      if (item.this_in_qty <= 0) continue;
      const existing = store.inventory.find(
        (i) =>
          i.material_id === item.material_id &&
          i.warehouse === item.warehouse &&
          i.location_id === item.location_id,
      );
      if (existing) {
        store.updateInventory({
          ...existing,
          quantity: existing.quantity + item.this_in_qty,
        });
      } else {
        store.addInventory({
          id: nanoid(),
          type: "material",
          material_id: item.material_id,
          quantity: item.this_in_qty,
          min_stock: 0,
          max_stock: 10000,
          warehouse: item.warehouse,
          location_id: item.location_id,
        });
      }
      store.addStockRecord({
        id: nanoid(),
        record_no: `SR-${Date.now().toString().slice(-6)}`,
        type: "in",
        subtype: "采购入库",
        material_id: item.material_id,
        quantity: item.this_in_qty,
        warehouse: item.warehouse,
        related_order: stockInArrival.code,
        related_order_id: stockInArrival.id,
        handler: stockInArrival.inspector,
        record_date: new Date().toISOString().split("T")[0],
      });
    }

    const order = store.purchaseOrders.find(
      (o) => o.id === stockInArrival.order_id,
    );
    if (order) {
      store.updatePurchaseOrder({
        ...order,
        status: isFullyStored ? "completed" : "partial",
        payment_status: isFullyStored ? "paid" : order.payment_status,
      });
      if (isFullyStored) {
        generatePayable(order, stockInArrival.arrival_date);
      }
    }

    setStockInOpen(false);
    setStockInArrival(null);
    setStockInItems([]);
    toast.success(isFullyStored ? "入库完成" : "部分入库完成");
  }

  function generatePayable(order: PurchaseOrder, arrivalDate: string) {
    const paymentDate = addDays(
      new Date(arrivalDate),
      1 + Math.floor(Math.random() * 2),
    )
      .toISOString()
      .slice(0, 10);

    const existingFinance = store.financeRecords.find(
      (f) => f.type === "应付" && f.related_order_id === order.id,
    );
    if (!existingFinance) {
      const financeRecord: FinanceRecord = {
        id: nanoid(),
        type: "应付",
        counterparty: order.supplier_name,
        currency: order.currency || "CNY",
        amount: order.total_amount,
        paid_amount: order.total_amount,
        supplier_id: order.supplier_id,
        related_order_id: order.id,
        related_order: order.order_no,
        contract_no: order.contract_no,
        month: paymentDate.slice(0, 7),
        record_date: paymentDate,
        status: "settled",
      };
      store.addFinanceRecord(financeRecord);
    } else {
      store.updateFinanceRecord({
        ...existingFinance,
        paid_amount: existingFinance.amount,
        status: "settled",
      });
    }

    const existingPayment = store.paymentRecords.find(
      (p) => p.type === "pay" && p.order_id === order.id,
    );
    if (!existingPayment) {
      const payment: PaymentRecord = {
        id: nanoid(),
        code: `PH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
        type: "pay",
        order_id: order.id,
        order_no: order.order_no,
        contract_no: order.contract_no,
        counterparty: order.supplier_name,
        amount: order.total_amount,
        currency: order.currency || "CNY",
        payment_method: "银行转账",
        payment_date: paymentDate,
        status: "completed",
      };
      store.addPaymentRecord(payment);
    }
  }

  function openReturn(arrival: PurchaseArrival) {
    setReturnArrival(arrival);
    setReturnReason("");
    setReturnOpen(true);
  }

  function confirmReturn() {
    if (!returnArrival) return;
    const items = returnArrival.items
      .filter((i) => (i.rejected_qty ?? i.quantity) > 0)
      .map((i) => ({
        ...i,
        quantity: i.rejected_qty ?? i.quantity,
        amount: (i.unit_price || 0) * (i.rejected_qty ?? i.quantity),
      }));
    if (items.length === 0) {
      toast.error("没有可退货的物料");
      return;
    }

    const returnOrder: PurchaseReturn = {
      id: nanoid(),
      code: `PR-${Date.now().toString().slice(-6)}`,
      arrival_id: returnArrival.id,
      order_id: returnArrival.order_id,
      order_no: returnArrival.order_no,
      supplier_name: returnArrival.supplier_name,
      return_date: new Date().toISOString().split("T")[0],
      reason: returnReason || "质检不合格",
      items,
      status: "completed",
    };
    store.addPurchaseReturn(returnOrder);
    store.updatePurchaseArrival({ ...returnArrival, status: "returned" });
    const order = store.purchaseOrders.find(
      (o) => o.id === returnArrival.order_id,
    );
    if (order) {
      store.updatePurchaseOrder({ ...order, status: "completed" });
    }

    setReturnOpen(false);
    setReturnArrival(null);
    setReturnReason("");
    toast.success("采购退货单已生成");
  }

  function statusBadge(status: string) {
    const map: Record<
      string,
      {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
      }
    > = {
      pending: { label: "待检验", variant: "outline" },
      inspected: { label: "已检验", variant: "secondary" },
      qualified: { label: "合格", variant: "default" },
      rejected: { label: "不合格", variant: "destructive" },
      partial: { label: "部分合格", variant: "secondary" },
      stored: { label: "已入库", variant: "default" },
      returned: { label: "已退货", variant: "secondary" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  }

  function renderActions(a: PurchaseArrival) {
    switch (a.status) {
      case "pending":
      case "inspected":
        return (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => openInspect(a)}>
              质检
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                navigate(`/quality?tab=incoming&arrivalCode=${a.code}`)
              }
              title="在质量管理中打开"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        );
      case "qualified":
      case "partial":
        if (!canStockIn) {
          return (
            <span className="text-sm text-muted-foreground">待入库</span>
          );
        }
        return (
          <Button size="sm" onClick={() => openStockIn(a)}>
            办理入库
          </Button>
        );
      case "rejected":
        return (
          <Button size="sm" variant="destructive" onClick={() => openReturn(a)}>
            退货/退回
          </Button>
        );
      case "stored":
        return <span className="text-sm text-muted-foreground">已入库</span>;
      case "returned":
        return <span className="text-sm text-muted-foreground">已退货</span>;
      default:
        return null;
    }
  }

  const {
    paginatedItems: arrivalsPaginated,
    currentPage: arrivalsCurrentPage,
    pageSize: arrivalsPageSize,
    totalPages: arrivalsTotalPages,
    totalItems: arrivalsTotalItems,
    setPage: setArrivalsPage,
    setPageSize: setArrivalsPageSize,
  } = usePagination(arrivals);

  return (
    <TabsContent value="arrival" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">待到货采购订单</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">采购单号</TableHead>
                <TableHead className="whitespace-nowrap">供应商</TableHead>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">到货进度</TableHead>
                <TableHead className="whitespace-nowrap">下达采购日期</TableHead>
                <TableHead className="whitespace-nowrap">金额</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.purchaseOrders
                .filter((o) => ["approved", "partial"].includes(o.status))
                .map((o) => {
                  const totalQty = o.items.reduce(
                    (sum, i) => sum + (i.quantity || 0),
                    0,
                  );
                  const storedQty = store.purchaseArrivals
                    .filter(
                      (a) => a.order_id === o.id && a.status === "stored",
                    )
                    .reduce(
                      (sum, a) =>
                        sum +
                        a.items.reduce(
                          (s, i) => s + (i.stored_qty || 0),
                          0,
                        ),
                      0,
                    );
                  const progress =
                    totalQty > 0 ? Math.round((storedQty / totalQty) * 100) : 0;
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {o.order_no}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {o.supplier_name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {o.contract_no || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">
                            {storedQty} / {totalQty} ({progress}%)
                          </span>
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {o.issued_date}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        ¥{o.total_amount.toLocaleString()}
                    </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPODetail(o)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            详情
                          </Button>
                          <Button size="sm" onClick={() => openFromPO(o)}>
                            <Package className="mr-1 h-3 w-3" />
                            录入到货
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {store.purchaseOrders.filter((o) =>
                ["approved", "partial"].includes(o.status),
              ).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无待到货订单
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base shrink-0">到货记录</CardTitle>
            <div className="relative w-56">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-7 h-8 text-sm"
                placeholder="搜索合同编号 / 采购单号..."
                value={arrivalSearch}
                onChange={(e) => { setArrivalSearch(e.target.value); setArrivalsPage(1); }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">到货单号</TableHead>
                <TableHead className="whitespace-nowrap">采购单号</TableHead>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">供应商</TableHead>
                <TableHead className="whitespace-nowrap">到货日期</TableHead>
                <TableHead className="whitespace-nowrap">检验员</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {arrivalsPaginated.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {a.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {a.order_no}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {a.contract_no || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {a.supplier_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {a.arrival_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {a.inspector}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {statusBadge(a.status)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openArrivalDetail(a)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        详情
                      </Button>
                      {renderActions(a)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {arrivals.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无到货记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={arrivalsCurrentPage}
            totalPages={arrivalsTotalPages}
            pageSize={arrivalsPageSize}
            totalItems={arrivalsTotalItems}
            onPageChange={setArrivalsPage}
            onPageSizeChange={setArrivalsPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm({ status: "pending", items: [] });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>录入到货信息</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>关联采购单</Label>
              <Input value={form.order_no || ""} readOnly />
            </div>
            <div className="grid gap-2">
              <Label>到货日期</Label>
              <Input
                type="date"
                value={form.arrival_date || ""}
                onChange={(e) =>
                  setForm({ ...form, arrival_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>检验员</Label>
              <Input
                value={form.inspector || ""}
                onChange={(e) =>
                  setForm({ ...form, inspector: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>到货明细（可修改实收数量）</Label>
            {(form.items || []).map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-3 gap-2 md:grid-cols-4 text-sm"
              >
                <span className="self-center">{item.material_name}</span>
                <span className="self-center text-muted-foreground">
                  订购 {item.quantity} {item.unit}
                </span>
                <Input
                  type="number"
                  placeholder="实收数量"
                  defaultValue={item.quantity}
                  onChange={(e) => {
                    const qty = Number(e.target.value);
                    setForm((f) => ({
                      ...f,
                      items: (f.items || []).map((it, i) =>
                        i === idx
                          ? {
                              ...it,
                              quantity: qty,
                              amount: (it.unit_price || 0) * qty,
                            }
                          : it,
                      ),
                    }));
                  }}
                />
                <span className="self-center text-muted-foreground">
                  ¥{item.amount}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                const payload: PurchaseArrival = {
                  ...(form as PurchaseArrival),
                  id: nanoid(),
                  code: `PA-${Date.now().toString().slice(-6)}`,
                  status: "pending",
                };
                if (!payload.order_id || payload.items.length === 0) {
                  toast.error("缺少关联采购单或到货明细");
                  return;
                }
                const excess = checkArrivalExcess(payload);
                if (excess.length > 0) {
                  setExcessMessages(excess);
                  setPendingArrivalPayload(payload);
                  setExcessConfirmOpen(true);
                  return;
                }
                saveArrival(payload);
              }}
            >
              <Truck className="mr-2 h-4 w-4" />
              确认到货
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={excessConfirmOpen}
        onOpenChange={(v) => {
          setExcessConfirmOpen(v);
          if (!v) setPendingArrivalPayload(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>到货数量超出采购量</AlertDialogTitle>
            <AlertDialogDescription className="space-y-1">
              <span>继续保存将导致以下物料超额到货：</span>
              <ul className="list-disc pl-5 text-sm">
                {excessMessages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
              <span>请确认是否为补差、分批到货等正常业务场景。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingArrivalPayload(null)}>
              返回修改
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingArrivalPayload) saveArrival(pendingArrivalPayload);
              }}
            >
              仍确认到货
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={inspectOpen}
        onOpenChange={(v) => {
          setInspectOpen(v);
          if (!v) {
            setInspectArrival(null);
            setInspectItems([]);
            setInspectFiles([]);
            setInspectRemark("");
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>到货质检</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-4 gap-2 text-sm font-medium text-muted-foreground">
              <span>物料</span>
              <span>实收数量</span>
              <span>合格数量</span>
              <span>不合格数量</span>
            </div>
            {inspectItems.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-4 gap-2 text-sm items-center"
              >
                <span className="truncate">{item.material_name}</span>
                <Input
                  type="number"
                  value={item.received_qty ?? item.quantity}
                  onChange={(e) =>
                    updateInspectItem(idx, {
                      received_qty: Number(e.target.value),
                    })
                  }
                />
                <Input
                  type="number"
                  value={item.qualified_qty ?? 0}
                  onChange={(e) =>
                    updateInspectItem(idx, {
                      qualified_qty: Number(e.target.value),
                    })
                  }
                />
                <Input
                  type="number"
                  value={item.rejected_qty ?? 0}
                  onChange={(e) =>
                    updateInspectItem(idx, {
                      rejected_qty: Number(e.target.value),
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            <Label>质检备注</Label>
            <Textarea
              value={inspectRemark}
              onChange={(e) => setInspectRemark(e.target.value)}
              placeholder="填写质检结论或异常说明"
            />
          </div>
          <div className="grid gap-2">
            <Label>质检报告 / 图片</Label>
            <FileUpload value={inspectFiles} onChange={setInspectFiles} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInspectOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmInspection}>确认质检</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={stockInOpen}
        onOpenChange={(v) => {
          setStockInOpen(v);
          if (!v) {
            setStockInArrival(null);
            setStockInItems([]);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>办理入库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">
                      物料
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      合格数量
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      本次入库
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      入库仓库
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      入库库位
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      剩余待入
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockInItems.map((item, idx) => {
                    const qualified = item.qualified_qty ?? item.quantity;
                    const stored = item.stored_qty ?? 0;
                    const remaining = Math.max(
                      0,
                      qualified - stored - item.this_in_qty,
                    );
                    return (
                      <TableRow key={idx}>
                        <TableCell className="whitespace-nowrap">
                          {item.material_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {qualified} {item.unit}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            type="number"
                            min={0}
                            max={qualified}
                            value={item.this_in_qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              updateStockInItem(idx, {
                                this_in_qty: Math.max(0, Math.min(val, qualified)),
                              });
                            }}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Select
                            value={item.warehouse}
                            onValueChange={(v) =>
                              updateStockInItem(idx, {
                                warehouse: v,
                                location_id: "",
                              })
                            }
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="选择仓库" />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses.map((w) => (
                                <SelectItem key={w} value={w}>
                                  {w}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Select
                            value={item.location_id}
                            onValueChange={(v) =>
                              updateStockInItem(idx, { location_id: v })
                            }
                            disabled={!item.warehouse}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="选择库位" />
                            </SelectTrigger>
                            <SelectContent>
                              {getLocationsByWarehouse(item.warehouse).map(
                                (l) => (
                                  <SelectItem key={l.id} value={l.id}>
                                    {l.code}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {remaining} {item.unit}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStockInOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmStockIn}>确认入库</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={returnOpen}
        onOpenChange={(v) => {
          setReturnOpen(v);
          if (!v) {
            setReturnArrival(null);
            setReturnReason("");
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>采购退货</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>退货原因</Label>
              <Textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="如：质检不合格"
              />
            </div>
            <div className="space-y-2">
              <Label>退货明细</Label>
              {returnArrival?.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{item.material_name}</span>
                  <span className="font-medium">
                    {item.rejected_qty ?? item.quantity} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmReturn}>
              生成退货单
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={poDetailOpen}
        onOpenChange={(v) => {
          setPoDetailOpen(v);
          if (!v) setPoDetail(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>采购订单详情</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">采购单号</div>
                <div className="font-medium">{poDetail?.order_no}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">供应商</div>
                <div className="font-medium">{poDetail?.supplier_name}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">下达采购日期</div>
                <div className="font-medium">{poDetail?.issued_date}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">金额</div>
                <div className="font-medium">
                  ¥{poDetail?.total_amount.toLocaleString()}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">状态</div>
                <div className="font-medium">
                  {poDetail?.status === "approved"
                    ? "已批准"
                    : poDetail?.status === "partial"
                      ? "部分到货"
                      : poDetail?.status}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">付款状态</div>
                <div className="font-medium">
                  {poDetail?.payment_status === "unpaid"
                    ? "未付款"
                    : poDetail?.payment_status === "partial"
                      ? "部分付款"
                      : "已付款"}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>采购物料</Label>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>物料编码</TableHead>
                      <TableHead>物料名称</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poDetail?.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.material_code}</TableCell>
                        <TableCell>{item.material_name}</TableCell>
                        <TableCell>{item.specification}</TableCell>
                        <TableCell>
                          {item.quantity} {item.unit}
                        </TableCell>
                        <TableCell>
                          ¥{item.unit_price.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          ¥{item.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {poDetail?.items.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground"
                        >
                          暂无物料
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
      <Dialog
        open={arrivalDetailOpen}
        onOpenChange={(v) => {
          setArrivalDetailOpen(v);
          if (!v) setArrivalDetail(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>到货详情</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">到货单号</div>
                <div className="font-medium">{arrivalDetail?.code}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">采购单号</div>
                <div className="font-medium">{arrivalDetail?.order_no}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">合同编号</div>
                <div className="font-medium">{arrivalDetail?.contract_no || "-"}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">供应商</div>
                <div className="font-medium">
                  {arrivalDetail?.supplier_name}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">到货日期</div>
                <div className="font-medium">
                  {arrivalDetail?.arrival_date}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">检验员</div>
                <div className="font-medium">{arrivalDetail?.inspector}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">状态</div>
                <div className="font-medium">
                  {arrivalDetail?.status === "pending"
                    ? "待检验"
                    : arrivalDetail?.status === "inspected"
                      ? "已检验"
                      : arrivalDetail?.status === "qualified"
                        ? "合格"
                        : arrivalDetail?.status === "partial"
                          ? "部分合格"
                          : arrivalDetail?.status === "stored"
                            ? "已入库"
                            : arrivalDetail?.status === "returned"
                              ? "已退货"
                              : arrivalDetail?.status === "rejected"
                                ? "不合格"
                                : arrivalDetail?.status}
                </div>
              </div>
              {arrivalDetail?.warehouse && (
                <div className="space-y-1">
                  <div className="text-muted-foreground">入库仓库</div>
                  <div className="font-medium">{arrivalDetail.warehouse}</div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>到货物料</Label>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>物料编码</TableHead>
                      <TableHead>物料名称</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>合格数</TableHead>
                      <TableHead>不合格数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arrivalDetail?.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.material_code}</TableCell>
                        <TableCell>{item.material_name}</TableCell>
                        <TableCell>{item.specification}</TableCell>
                        <TableCell>
                          {item.quantity} {item.unit}
                        </TableCell>
                        <TableCell>
                          {item.qualified_qty ?? "-"} {item.unit}
                        </TableCell>
                        <TableCell>
                          {item.rejected_qty ?? "-"} {item.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                    {arrivalDetail?.items.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground"
                        >
                          暂无物料
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            {arrivalDetail?.inspection_remark && (
              <div className="space-y-1">
                <Label>检验备注</Label>
                <div className="text-sm rounded-md border p-2">
                  {arrivalDetail.inspection_remark}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 付款申请 ────────────────────────────────────────────── */

function PaymentTab() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<PaymentRecord>>({
    type: "pay",
    currency: "CNY",
    payment_method: "银行转账",
    status: "pending",
  });

  const payments = useMemo(
    () =>
      store.paymentRecords
        .slice()
        .sort((a, b) => b.payment_date.localeCompare(a.payment_date)),
    [store.paymentRecords],
  );

  function save() {
    if (!form.counterparty || !form.amount) return;
    const payload: PaymentRecord = {
      ...(form as PaymentRecord),
      id: nanoid(),
      code: `PAY-${Date.now().toString().slice(-6)}`,
      payment_date: new Date().toISOString().split("T")[0],
    };
    store.addPaymentRecord(payload);
    // 更新采购订单付款状态并核销应付
    if (form.order_id) {
      const order = store.purchaseOrders.find((o) => o.id === form.order_id);
      if (order) {
        const totalPaid = store.paymentRecords
          .filter((p) => p.type === "pay" && p.order_id === form.order_id)
          .reduce((s, p) => s + p.amount, 0);
        store.updatePurchaseOrder({
          ...order,
          payment_status: totalPaid >= order.total_amount ? "paid" : "partial",
        });
      }
      const payable = store.financeRecords.find(
        (f) => f.type === "应付" && f.related_order_id === form.order_id,
      );
      if (payable) {
        const newPaid = Math.min(
          payable.paid_amount + payload.amount,
          payable.amount,
        );
        store.updateFinanceRecord({
          ...payable,
          paid_amount: newPaid,
          status: newPaid >= payable.amount ? "settled" : "partial",
        });
      }
    }
    setOpen(false);
    setForm({
      type: "pay",
      currency: "CNY",
      payment_method: "银行转账",
      status: "pending",
    });
  }

  const {
    paginatedItems: paymentsPaginated,
    currentPage: paymentsCurrentPage,
    pageSize: paymentsPageSize,
    totalPages: paymentsTotalPages,
    totalItems: paymentsTotalItems,
    setPage: setPaymentsPage,
    setPageSize: setPaymentsPageSize,
  } = usePagination(payments);

  return (
    <TabsContent value="payment" className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <CreditCard className="mr-2 h-4 w-4" />
          新增付款申请
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">单号</TableHead>
                <TableHead className="whitespace-nowrap">类型</TableHead>
                <TableHead className="whitespace-nowrap">往来方</TableHead>
                <TableHead className="whitespace-nowrap">金额</TableHead>
                <TableHead className="whitespace-nowrap">方式</TableHead>
                <TableHead className="whitespace-nowrap">日期</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsPaginated.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {p.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={p.type === "pay" ? "secondary" : "default"}>
                      {p.type === "pay" ? "付款" : "收款"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.counterparty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.currency === "USD" ? "$" : "¥"}
                    {p.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.payment_method}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.payment_date}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={
                        p.status === "completed" ? "default" : "secondary"
                      }
                      className={p.status === "completed" ? "bg-green-500" : ""}
                    >
                      {p.status === "completed" ? "已完成" : "待确认"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无付款记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={paymentsCurrentPage}
            totalPages={paymentsTotalPages}
            pageSize={paymentsPageSize}
            totalItems={paymentsTotalItems}
            onPageChange={setPaymentsPage}
            onPageSizeChange={setPaymentsPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v)
            setForm({
              type: "pay",
              currency: "CNY",
              payment_method: "银行转账",
              status: "pending",
            });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>付款申请</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>类型</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm({ ...form, type: v as "pay" | "receive" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pay">付款</SelectItem>
                  <SelectItem value="receive">收款</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>关联采购单</Label>
              <Select
                value={form.order_id || "none"}
                onValueChange={(v) => {
                  if (v === "none")
                    return setForm({ ...form, order_id: "", order_no: "" });
                  const o = store.purchaseOrders.find((x) => x.id === v);
                  setForm({
                    ...form,
                    order_id: o?.id,
                    order_no: o?.order_no,
                    counterparty: o?.supplier_name,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="可选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联</SelectItem>
                  {store.purchaseOrders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_no} - {o.supplier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>往来方</Label>
              <Input
                value={form.counterparty || ""}
                onChange={(e) =>
                  setForm({ ...form, counterparty: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>金额</Label>
              <Input
                type="number"
                value={form.amount || ""}
                onChange={(e) =>
                  setForm({ ...form, amount: Number(e.target.value) })
                }
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
              <Label>付款方式</Label>
              <Select
                value={form.payment_method || "银行转账"}
                onValueChange={(v) => setForm({ ...form, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["银行转账", "支票", "现金", "电汇"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>付款日期</Label>
              <Input
                type="date"
                value={
                  form.payment_date || new Date().toISOString().split("T")[0]
                }
                onChange={(e) =>
                  setForm({ ...form, payment_date: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>
              <CreditCard className="mr-2 h-4 w-4" />
              提交
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

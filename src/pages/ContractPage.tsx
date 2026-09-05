import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CraftSheetMaintenanceDialog } from "@/components/contract/CraftSheetMaintenanceDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { useVisibleTabs } from "@/lib/moduleVisibility";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  FileText,
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  FilePlus2,
  ListChecks,
  BookTemplate,
  ChevronDown,
  ChevronUp,
  Layers,
  ShoppingCart,
  RefreshCw,
  ExternalLink,
  Download,
  Upload,
  Loader2,
  Banknote,
} from "lucide-react";
import {
  CONTRACT_STATUS,
  CONTRACT_TYPES,
  CONTRACT_CUSTOMER_LEVELS,
  PAYMENT_TERMS,
  PERFORMANCE_NODE_TYPES,
  formatMoney,
} from "@/lib/data";
import { nanoid } from "@/lib/utils";
import {
  generateContractNo,
  createEmptyContract,
  createContractFromQuotation,
  getDefaultClauses,
  recalcContractItems,
  calculateProgress,
  calculatePaymentProgress,
  syncPerformanceNodesFromSalesOrder,
} from "@/lib/contract";
import { createSalesOrderFromContract } from "@/lib/salesOrder";
import {
  downloadContractTemplate,
  parseContractExcel,
  buildContractFromImport,
  applyContractImportRow,
  type ContractImportError,
  type ContractImportOptions,
} from "@/lib/contractImport";
import type {
  Contract,
  ContractItem,
  ContractClause,
  ContractTemplate,
  ContractPerformanceNode,
  ContractCraftSheet,
  ContractCraftSheetRow,
  PurchaseOrder,
  Product,
  ProductSku,
  SalesOrder,
  WorkOrder,
} from "@/types";

type TabKey =
  | "list"
  | "create"
  | "detail"
  | "approval"
  | "performance"
  | "templates"
  | "reminders";

// ---------- 工具 ----------
function fmt(d?: string) {
  return d ? d.slice(0, 10) : "-";
}

function ProgressBar({ value, color }: { value: number; color?: string }) {
  const colorClass =
    color ||
    (value >= 80
      ? "bg-green-500"
      : value >= 40
        ? "bg-amber-500"
        : "bg-red-400");
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">
        {value}%
      </span>
    </div>
  );
}

// ---------- 产品选择辅助 ----------
function getProductUniqueSpecs(product: Product | undefined): string[] {
  if (!product) return [];
  const specs = new Set<string>();
  product.skus?.forEach((sku) => {
    if (sku.specification) specs.add(sku.specification);
  });
  if (product.specification && specs.size === 0) {
    specs.add(product.specification);
  }
  return Array.from(specs);
}

function getProductUniqueColors(product: Product | undefined): string[] {
  if (!product) return [];
  const colors = new Set<string>();
  product.skus?.forEach((sku) => {
    if (sku.color) colors.add(sku.color);
  });
  return Array.from(colors);
}

function findSkuBySpecAndColor(
  product: Product | undefined,
  specification: string,
  color: string,
): ProductSku | undefined {
  if (!product?.skus?.length) return undefined;
  return product.skus.find(
    (sku) => sku.specification === specification && sku.color === color,
  );
}

// ---------- 主页面 ----------
export function ContractPage() {
  const store = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeTab, setActiveTab } = useVisibleTabs("/contract", "list");
  const navigate = useNavigate();
  const [detailId, setDetailId] = useState<string | null>(null);

  // 列表筛选
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterContractNo, setFilterContractNo] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [signDateSort, setSignDateSort] = useState<"desc" | "asc" | null>(
    "desc",
  );

  // 新建/编辑表单
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Contract>>({});

  // 编辑权限控制：已完结/已终止全部锁定；已生效/执行中核心字段锁定
  const isCompleted = form.status === "completed" || form.status === "terminated";
  const isCoreLocked = isCompleted || form.status === "effective" || form.status === "executing";

  // 从 URL 参数跳转到对应合同/恢复详情状态
  useEffect(() => {
    const contractId = searchParams.get("contractId");
    if (contractId) {
      const c = store.contracts.find((x) => x.id === contractId);
      if (c) {
        // 已完结/已终止仅支持查看详情
        if (c.status === "completed" || c.status === "terminated") {
          setDetailId(c.id);
          setActiveTab("detail");
        } else if (c.status === "draft" || c.status === "pending") {
          setForm({ ...c });
          setEditingId(c.id);
          setActiveTab("create");
        } else {
          // 已生效/执行中进入可编辑模式，但核心字段受限
          setForm({ ...c });
          setEditingId(c.id);
          setActiveTab("create");
        }
      }
      searchParams.delete("contractId");
      setSearchParams(searchParams, { replace: true });
      return;
    }

    const detailIdParam = searchParams.get("detailId");
    if (detailIdParam) {
      const c = store.contracts.find((x) => x.id === detailIdParam);
      if (c) {
        setDetailId(c.id);
        setActiveTab("detail");
      }
    }
  }, [searchParams, setSearchParams, store.contracts, setActiveTab]);

  // 从报价单选择弹窗
  const [quotationPickerOpen, setQuotationPickerOpen] = useState(false);

  // 审批弹窗
  const [approvalContractId, setApprovalContractId] = useState<string | null>(
    null,
  );
  const [approvalOpinion, setApprovalOpinion] = useState("");

  // 履约节点更新弹窗
  const [perfContractId, setPerfContractId] = useState<string | null>(null);
  const [perfNode, setPerfNode] = useState<ContractPerformanceNode | null>(
    null,
  );

  // 模板编辑弹窗
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState<Partial<ContractTemplate>>(
    {},
  );
  const [templateEditId, setTemplateEditId] = useState<string | null>(null);

  // 生产工艺单弹窗
  const [selectedCraftSheet, setSelectedCraftSheet] =
    useState<ContractCraftSheet | null>(null);
  const [craftSheetDialogOpen, setCraftSheetDialogOpen] = useState(false);
  const [craftSheetDraft, setCraftSheetDraft] = useState<ContractCraftSheet | null>(null);
  const craftSheetImportRef = useRef<HTMLInputElement>(null);
  const [poDetailOpen, setPoDetailOpen] = useState(false);
  const [poDetailData, setPoDetailData] = useState<PurchaseOrder | null>(null);
  const [soDetailOpen, setSODetailOpen] = useState(false);
  const [soDetailData, setSODetailData] = useState<SalesOrder | null>(null);
  const [woDetailOpen, setWODetailOpen] = useState(false);
  const [woDetailData, setWODetailData] = useState<WorkOrder | null>(null);

  // 导入相关
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<ContractImportError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDownloadTemplate() {
    downloadContractTemplate();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>, onDuplicate: ContractImportOptions["onDuplicate"] = "update") {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setImporting(true);
    try {
      const result = await parseContractExcel(file, store.contracts, { onDuplicate });
      if (!result.success) {
        setImportErrors(result.errors);
        return;
      }
      const now = new Date().toISOString();
      for (const row of result.contracts) {
        const contract = buildContractFromImport(row);
        contract.created_at = now;
        contract.updated_at = now;
        store.addContract(contract);
      }
      for (const { row, existing } of result.updates) {
        const updated = applyContractImportRow(existing, row);
        updated.updated_at = now;
        store.updateContract(updated);
      }
      const addCount = result.contracts.length;
      const updateCount = result.updates.length;
      if (updateCount > 0) {
        toast.success(`成功导入 ${addCount} 条，更新 ${updateCount} 条合同`);
      } else {
        toast.success(`成功导入 ${addCount} 条合同`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  // ---------- 筛选后的合同列表 ----------
  const filteredContracts = useMemo(() => {
    const customerQuery = filterCustomer.trim().toLowerCase();
    const contractQuery = filterContractNo.trim().toLowerCase();
    return store.contracts
      .filter((c) => {
        if (filterStatus !== "all" && c.status !== filterStatus) return false;
        if (
          customerQuery &&
          !c.customer_name?.toLowerCase().includes(customerQuery)
        )
          return false;
        if (
          contractQuery &&
          !c.contract_no?.toLowerCase().includes(contractQuery)
        )
          return false;
        if (filterDateFrom && c.sign_date && c.sign_date < filterDateFrom)
          return false;
        if (filterDateTo && c.sign_date && c.sign_date > filterDateTo)
          return false;
        return true;
      })
      .sort((a, b) => {
        if (signDateSort) {
          const ta = a.sign_date || "";
          const tb = b.sign_date || "";
          return signDateSort === "asc"
            ? ta.localeCompare(tb)
            : tb.localeCompare(ta);
        }
        const ta = a.created_at || a.sign_date || "";
        const tb = b.created_at || b.sign_date || "";
        return tb.localeCompare(ta);
      });
  }, [
    store.contracts,
    filterStatus,
    filterCustomer,
    filterContractNo,
    filterDateFrom,
    filterDateTo,
    signDateSort,
  ]);

  // ---------- 统计卡片数据 ----------
  const stats = useMemo(() => {
    const total = store.contracts.length;
    const effective = store.contracts.filter(
      (c) => c.status === "effective" || c.status === "executing",
    ).length;
    const executing = store.contracts.filter(
      (c) => c.status === "executing",
    ).length;
    const pending = store.contracts.filter(
      (c) => c.status === "pending",
    ).length;
    return { total, effective, executing, pending };
  }, [store.contracts]);

  // ---------- 新建合同 ----------
  function handleNew() {
    const draft = createEmptyContract();
    draft.contract_no = generateContractNo(store.contracts);
    setForm(draft);
    setEditingId(null);
    setActiveTab("create");
  }

  function handleEdit(c: Contract) {
    // 已完结合同不允许编辑
    if (c.status === "completed" || c.status === "terminated") {
      toast.error("已完结/已终止的合同仅支持查看详情");
      return;
    }
    setForm({ ...c });
    setEditingId(c.id);
    setActiveTab("create");
  }

  function handleView(id: string) {
    setDetailId(id);
    setActiveTab("detail");
    setSearchParams({ detailId: id }, { replace: false });
  }

  function handleDelete(id: string) {
    store.deleteContract(id);
    toast.success("合同已删除");
    if (detailId === id) setActiveTab("list");
  }

  // ---------- 从报价单转合同 ----------
  function handleFromQuotation(quotationId: string) {
    const q = store.quotations.find((q) => q.id === quotationId);
    if (!q) return;
    const draft = createContractFromQuotation(q as any);
    draft.contract_no = generateContractNo(store.contracts);
    draft.clauses = getDefaultClauses(
      draft.contract_type,
      draft.customer_level,
      store.contractTemplates,
    );
    setForm(draft);
    setEditingId(null);
    setQuotationPickerOpen(false);
    // 更新报价单状态为已转合同
    store.updateQuotation({ ...(q as any), status: "converted" });
    setActiveTab("create");
    toast.success(`已从报价单 ${q.quotation_no} 创建合同草稿`);
  }

  // ---------- 保存合同 ----------
  function handleSave() {
    if (!form.customer_name?.trim()) {
      toast.error("请填写客户名称");
      return;
    }
    if (!form.title?.trim()) {
      toast.error("请填写合同标题");
      return;
    }
    const now = new Date().toISOString();
    if (editingId) {
      const updated: Contract = {
        ...store.contracts.find((c) => c.id === editingId)!,
        ...form,
        updated_at: now,
      } as Contract;
      store.updateContract(updated);
      toast.success("合同已更新");
    } else {
      const newContract: Contract = {
        ...createEmptyContract(),
        ...form,
        id: nanoid(),
        contract_no: form.contract_no || generateContractNo(store.contracts),
        created_at: now,
        updated_at: now,
      } as Contract;
      store.addContract(newContract);
      toast.success("合同已创建");
    }
    setActiveTab("list");
  }

  // ---------- 提交审批 ----------
  function handleSubmitApproval(id: string) {
    const c = store.contracts.find((c) => c.id === id);
    if (!c) return;
    store.updateContract({
      ...c,
      status: "pending",
      updated_at: new Date().toISOString(),
    });
    toast.success("已提交审批");
  }

  // ---------- 审批操作 ----------
  // 初始化生产工艺单维护草稿
  function initCraftSheetDraft() {
    const sheet = (detailContract?.craft_sheets || [])[0];
    if (sheet) {
      setCraftSheetDraft(JSON.parse(JSON.stringify(sheet)));
    } else {
      setCraftSheetDraft({
        id: nanoid(),
        seq_no: '',
        title: '',
        customer_contract_no: detailContract?.original_contract_no || '',
        finish_date: '',
        colors: ['米色', '橄榄绿', '复古蓝'],
        rows: [],
        process_requirements: '',
        total_quantity: 0,
      });
    }
  }

  // 保存生产工艺单草稿
  function handleSaveCraftSheet() {
    if (!detailContract || !craftSheetDraft) return;
    const total = craftSheetDraft.rows.reduce(
      (sum, r) => sum + (r.total_quantity || 0),
      0,
    );
    const updatedSheet = { ...craftSheetDraft, total_quantity: total };
    const updatedContract: Contract = {
      ...detailContract,
      craft_sheets: [updatedSheet],
      updated_at: new Date().toISOString(),
    };
    store.updateContract(updatedContract);
    toast.success('生产工艺单已保存');
    setCraftSheetDialogOpen(false);
  }

  // 从卡片头部下载 Excel 模板
  function handleDownloadCraftSheetTemplate() {
    import('xlsx').then((XLSX) => {
      const sheet = (detailContract?.craft_sheets || [])[0];
      const colors = sheet?.colors || ['米色', '橄榄绿', '复古蓝'];
      const headers = ['货号', '尺寸', ...colors];
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '生产工艺单');
      const blob = new Blob(
        [XLSX.write(wb, { bookType: 'xlsx', type: 'array' })],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '生产工艺单导入模板.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  // 从卡片头部导入 Excel，预填草稿后打开维护弹窗供确认
  async function handleImportCraftSheetFile(file: File) {
    const XLSX = await import('xlsx');
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as (string | number)[][];
      if (rows.length < 2) { toast.error('Excel 内容为空或缺少表头'); return; }
      const headers = rows[0].map((h) => String(h).trim());
      const productCodeIdx = headers.findIndex((h) => h.includes('货号'));
      const sizeIdx = headers.findIndex((h) => h.includes('尺寸'));
      if (productCodeIdx === -1 || sizeIdx === -1) { toast.error('Excel 缺少"货号"或"尺寸"列'); return; }
      const existingSheet = (detailContract?.craft_sheets || [])[0];
      const baseColors = existingSheet?.colors || [];
      const allColors = [...baseColors];
      for (const h of headers) {
        if (!h.includes('货号') && !h.includes('尺寸') && !allColors.includes(h)) allColors.push(h);
      }
      const colorIdxMap: Record<string, number> = {};
      for (const c of allColors) {
        const idx = headers.indexOf(c);
        if (idx !== -1) colorIdxMap[c] = idx;
      }
      const importedRows: ContractCraftSheetRow[] = [];
      for (const row of rows.slice(1)) {
        const productCode = String(row[productCodeIdx] || '').trim();
        if (!productCode) continue;
        const colorQuantities: Record<string, number> = {};
        for (const c of allColors) {
          const raw = colorIdxMap[c] !== undefined ? row[colorIdxMap[c]] : 0;
          colorQuantities[c] = typeof raw === 'number' ? raw : parseInt(String(raw || '0'), 10) || 0;
        }
        importedRows.push({
          id: nanoid(),
          product_code: productCode,
          size: String(row[sizeIdx] || ''),
          color_quantities: colorQuantities,
          total_quantity: Object.values(colorQuantities).reduce((a, b) => a + b, 0),
        });
      }
      if (importedRows.length === 0) { toast.error('未找到有效数据行'); return; }
      const base: ContractCraftSheet = existingSheet
        ? JSON.parse(JSON.stringify(existingSheet))
        : {
            id: nanoid(), seq_no: '', title: '', colors: allColors,
            customer_contract_no: detailContract?.original_contract_no || '',
            finish_date: '', rows: [], process_requirements: '', total_quantity: 0,
          };
      setCraftSheetDraft({ ...base, colors: allColors, rows: [...base.rows, ...importedRows] });
      setCraftSheetDialogOpen(true);
      toast.success(`已导入 ${importedRows.length} 行，请确认后保存`);
    } catch (e) {
      console.error('导入失败', e);
      toast.error('导入失败，请检查 Excel 格式');
    }
  }

  function handleApprove(id: string, result: "approved" | "rejected") {
    const c = store.contracts.find((c) => c.id === id);
    if (!c) return;
    const log = {
      id: nanoid(),
      approver: "销售主管",
      node: "销售主管审批",
      result,
      opinion: approvalOpinion || (result === "approved" ? "同意" : "驳回"),
      created_at: new Date().toISOString(),
    };
    const newStatus = result === "approved" ? "effective" : "draft";
    const todayStr = new Date().toISOString().split("T")[0];
    let updates: Partial<Contract> = {
      sign_date: c.sign_date || todayStr,
      effective_date: c.effective_date || todayStr,
    };
    if (result === "approved" && !c.sales_order_id) {
      const order = createSalesOrderFromContract(c, store.salesOrders);
      store.addSalesOrder(order);
      updates = {
        ...updates,
        sales_order_id: order.id,
        sales_order_no: order.order_no,
        status: "executing",
      };
      toast.success(`审批通过，合同已生效并生成销售订单 ${order.order_no}`);
    } else {
      toast.success(
        result === "approved" ? "审批通过，合同已生效" : "已驳回，合同退回草稿",
      );
    }
    store.updateContract({
      ...c,
      ...updates,
      status: updates.status || newStatus,
      approval_logs: [...(c.approval_logs || []), log],
      updated_at: new Date().toISOString(),
    });
    setApprovalContractId(null);
    setApprovalOpinion("");
  }

  function handleConvertToSalesOrder(c: Contract) {
    if (c.status !== "effective" && c.status !== "executing") {
      toast.error("仅生效中或执行中的合同可生成销售订单");
      return;
    }
    if (c.sales_order_id) {
      toast.error("该合同已生成销售订单，请勿重复操作");
      return;
    }
    const order = createSalesOrderFromContract(c, store.salesOrders);
    store.addSalesOrder(order);
    store.updateContract({
      ...c,
      sales_order_id: order.id,
      sales_order_no: order.order_no,
      status: "executing",
      updated_at: new Date().toISOString(),
    });
    toast.success(`已为合同 ${c.contract_no} 生成销售订单 ${order.order_no}`);
    navigate(`/marketing?tab=orders`);
  }

  // ---------- 更新履约节点 ----------
  function handleUpdatePerfNode(contractId: string) {
    if (!perfNode) return;
    const c = store.contracts.find((c) => c.id === contractId);
    if (!c) return;
    const updated = c.performance_nodes.map((n) =>
      n.id === perfNode.id
        ? { ...perfNode, operated_at: new Date().toISOString() }
        : n,
    );
    // 若所有节点完成则自动完结
    const allDone = updated.every((n) => {
      const cfg = PERFORMANCE_NODE_TYPES.find((t) => t.value === n.node_type);
      return cfg && n.status === cfg.statuses[cfg.statuses.length - 1];
    });
    store.updateContract({
      ...c,
      performance_nodes: updated,
      status: allDone
        ? "completed"
        : c.status === "effective"
          ? "executing"
          : c.status,
      updated_at: new Date().toISOString(),
    });
    setPerfNode(null);
    setPerfContractId(null);
    toast.success("履约进度已更新");
  }

  // ---------- 同步销售订单履约节点 ----------
  async function handleSyncPerformanceNodes(contractId: string) {
    const c = store.contracts.find((c) => c.id === contractId);
    if (!c) return;
    const order = store.salesOrders.find((o) => o.id === c.sales_order_id);
    if (!order) {
      toast.error("未找到关联销售订单，无法同步");
      return;
    }
    const synced = syncPerformanceNodesFromSalesOrder(c, order);
    const allDone = synced.every((n) => {
      const cfg = PERFORMANCE_NODE_TYPES.find((t) => t.value === n.node_type);
      return cfg && n.status === cfg.statuses[cfg.statuses.length - 1];
    });
    await store.updateContract({
      ...c,
      performance_nodes: synced,
      status: allDone
        ? "completed"
        : c.status === "effective"
          ? "executing"
          : c.status,
      updated_at: new Date().toISOString(),
    });
    toast.success("履约节点已从销售订单同步");
  }

  // ---------- 模板保存 ----------
  function handleSaveTemplate() {
    if (!templateForm.name?.trim()) {
      toast.error("请填写模板名称");
      return;
    }
    const now = new Date().toISOString();
    if (templateEditId) {
      store.updateContractTemplate({
        ...store.contractTemplates.find((t) => t.id === templateEditId)!,
        ...templateForm,
        updated_at: now,
      } as ContractTemplate);
    } else {
      store.addContractTemplate({
        id: nanoid(),
        name: templateForm.name || "",
        contract_type: templateForm.contract_type || "domestic",
        customer_level: templateForm.customer_level || "normal",
        clauses: templateForm.clauses || [],
        status: "active",
        created_at: now,
        updated_at: now,
      } as ContractTemplate);
    }
    setTemplateDialogOpen(false);
    setTemplateForm({});
    setTemplateEditId(null);
    toast.success("模板已保存");
  }

  // ---------- 更新表单项 ----------
  function updateFormItem(
    idx: number,
    field: keyof ContractItem,
    val: string | number,
  ) {
    const items = [...(form.items || [])];
    items[idx] = { ...items[idx], [field]: val };

    if (field === "product_id") {
      const product = store.products.find((p) => p.id === val);
      const specs = getProductUniqueSpecs(product);
      const colors = getProductUniqueColors(product);
      items[idx] = {
        ...items[idx],
        product_id: (val as string) || "",
        product_code: product?.code || "",
        product_name: product?.name || "",
        specification: specs.length === 1 ? specs[0] : "",
        color: colors.length === 1 ? colors[0] : "",
      };
      const matchedSku = findSkuBySpecAndColor(
        product,
        items[idx].specification,
        items[idx].color || "",
      );
      if (matchedSku?.suggested_price) {
        items[idx].unit_price = matchedSku.suggested_price;
      } else if (product?.pricing_strategy?.suggested_price) {
        items[idx].unit_price = product.pricing_strategy.suggested_price;
      }
      items[idx].total_price =
        Number(items[idx].quantity) * Number(items[idx].unit_price);
    }

    if (field === "specification" || field === "color") {
      const product = store.products.find(
        (p) => p.id === items[idx].product_id,
      );
      const matchedSku = findSkuBySpecAndColor(
        product,
        items[idx].specification,
        items[idx].color || "",
      );
      if (matchedSku?.suggested_price) {
        items[idx].unit_price = matchedSku.suggested_price;
      }
      items[idx].total_price =
        Number(items[idx].quantity) * Number(items[idx].unit_price);
    }

    if (field === "quantity" || field === "unit_price") {
      items[idx].total_price =
        Number(items[idx].quantity) * Number(items[idx].unit_price);
    }
    setForm({ ...form, items, amount: recalcContractItems(items) });
  }

  function updateClause(
    idx: number,
    field: keyof ContractClause,
    val: string | number,
  ) {
    const clauses = [...(form.clauses || [])];
    clauses[idx] = { ...clauses[idx], [field]: val };
    setForm({ ...form, clauses });
  }

  const detailContract = store.contracts.find((c) => c.id === detailId);
  const relatedSalesOrders = useMemo(
    () =>
      detailContract
        ? store.salesOrders.filter(
            (o) => o.contract_id === detailContract.id || o.contract_no === detailContract.contract_no,
          )
        : [],
    [store.salesOrders, detailContract],
  );
  const relatedPurchaseOrders = useMemo(
    () =>
      detailContract
        ? store.purchaseOrders.filter(
            (p) => p.contract_id === detailContract.id || p.contract_no === detailContract.contract_no,
          )
        : [],
    [store.purchaseOrders, detailContract],
  );
  // 关联加工款：与财务-报工薪资明细字段保持一致，通过合同产品货号匹配
  const relatedProcessingPayments = useMemo(() => {
    if (!detailContract) return [];
    const contractProductCodes = new Set(
      (detailContract.items || []).map((it) => it.product_code).filter(Boolean),
    );
    if (contractProductCodes.size === 0) return [];
    return store.payrollDetails.filter((p) => contractProductCodes.has(p.product_code));
  }, [detailContract, store.payrollDetails]);
  // 关联生产工单：按工单归属的合同号精确匹配，避免同产品不同合同混淆
  const relatedWorkOrders = useMemo(() => {
    if (!detailContract) return [];
    return store.workOrders.filter(
      (wo) => wo.contract_no === detailContract.contract_no,
    );
  }, [detailContract, store.workOrders]);
  const relatedSalesOrder = useMemo(
    () =>
      store.salesOrders.find((o) => o.id === detailContract?.sales_order_id),
    [store.salesOrders, detailContract?.sales_order_id],
  );
  const syncedNodes = useMemo(
    () =>
      detailContract
        ? syncPerformanceNodesFromSalesOrder(detailContract, relatedSalesOrder)
        : [],
    [detailContract, relatedSalesOrder],
  );
  const effectiveContract = useMemo(
    () =>
      detailContract
        ? { ...detailContract, performance_nodes: syncedNodes }
        : undefined,
    [detailContract, syncedNodes],
  );

  const approvalContract = store.contracts.find(
    (c) => c.id === approvalContractId,
  );
  const perfContract = store.contracts.find((c) => c.id === perfContractId);

  const {
    paginatedItems: detailContract_approval_logsPaginated,
    currentPage: detailContract_approval_logsCurrentPage,
    pageSize: detailContract_approval_logsPageSize,
    totalPages: detailContract_approval_logsTotalPages,
    totalItems: detailContract_approval_logsTotalItems,
    setPage: setDetailContract_approval_logsPage,
    setPageSize: setDetailContract_approval_logsPageSize,
  } = usePagination(detailContract?.approval_logs || []);

  const {
    paginatedItems: detailContract_itemsPaginated,
    currentPage: detailContract_itemsCurrentPage,
    pageSize: detailContract_itemsPageSize,
    totalPages: detailContract_itemsTotalPages,
    totalItems: detailContract_itemsTotalItems,
    setPage: setDetailContract_itemsPage,
    setPageSize: setDetailContract_itemsPageSize,
  } = usePagination(detailContract?.items || []);

  // ==================== RENDER ====================
  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="合同管理"
        description="从报价到履约 · 全生命周期"
        onAdd={handleNew}
      />
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="合同总数"
          value={stats.total}
          sub="较上月 +6"
          icon="📋"
        />
        <StatCard
          label="生效中"
          value={stats.effective}
          sub={`执行中 ${stats.executing}`}
          icon="✅"
          color="text-blue-600"
        />
        <StatCard
          label="待审批"
          value={stats.pending}
          sub={stats.pending > 0 ? "⚠ 需尽快处理" : "无待处理"}
          icon="🕐"
          color={stats.pending > 0 ? "text-amber-600" : ""}
        />

      </div>
      <ControlledTabs
        modulePath="/contract"
        defaultTab="list"
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="bg-muted flex-wrap h-auto gap-1">
          <TabsTrigger value="list" className="gap-1">
            <ListChecks className="h-4 w-4" />
            合同台账
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-1">
            <FilePlus2 className="h-4 w-4" />
            {editingId ? "编辑合同" : "新建合同"}
          </TabsTrigger>
          {detailId && (
            <TabsTrigger value="detail" className="gap-1">
              <Eye className="h-4 w-4" />
              合同详情
            </TabsTrigger>
          )}
          <TabsTrigger value="templates" className="gap-1">
            <BookTemplate className="h-4 w-4" />
            合同模板
          </TabsTrigger>
        </TabsList>

        {/* ==================== 台账列表 ==================== */}
        <TabsContent value="list" className="space-y-4 mt-4">
          {/* 筛选行 */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <Label className="text-xs mb-1 block">合同编号</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="搜索合同编号"
                      className="pl-8 h-9 text-sm"
                      value={filterContractNo}
                      onChange={(e) => setFilterContractNo(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">客户</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="搜索客户名称"
                      className="pl-8 h-9 text-sm"
                      value={filterCustomer}
                      onChange={(e) => setFilterCustomer(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">签订日期从</Label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">签订日期至</Label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground h-9 flex-1"
                    onClick={() => {}}
                  >
                    <Search className="h-3.5 w-3.5 mr-1" /> 查询
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() => {
                      setFilterContractNo("");
                      setFilterCustomer("");
                      setFilterDateFrom("");
                      setFilterDateTo("");
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 表格 */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" /> 合同台账
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="h-3.5 w-3.5" /> 下载模板
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                  >
                    {importing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    导入合同
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    onClick={() => setQuotationPickerOpen(true)}
                  >
                    <FileText className="h-3.5 w-3.5" /> 从报价单转合同
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1 bg-primary text-primary-foreground"
                    onClick={handleNew}
                  >
                    <Plus className="h-3.5 w-3.5" /> 新建合同
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="whitespace-nowrap font-semibold">
                        合同编号
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">
                        客户
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">
                        合同金额
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">
                        <button
                          type="button"
                          onClick={() =>
                            setSignDateSort((prev) =>
                              prev === "asc" ? "desc" : "asc",
                            )
                          }
                          className="flex items-center gap-1 hover:text-primary focus:outline-none"
                        >
                          签订日期
                          {signDateSort === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-semibold text-right">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-12 text-muted-foreground"
                        >
                          暂无合同数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredContracts.map((c) => {
                        const progress = calculateProgress(c);
                        return (
                          <TableRow key={c.id} className="hover:bg-muted/20">
                            <TableCell className="whitespace-nowrap font-mono text-sm font-semibold text-primary">
                              {c.contract_no}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {c.customer_name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm font-medium">
                              {formatMoney(c.amount)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {fmt(c.sign_date)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleView(c.id)}
                                  title="查看"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {c.status !== "completed" &&
                                  c.status !== "terminated" && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => handleEdit(c)}
                                      title="编辑"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                {c.status === "draft" && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-amber-600"
                                    onClick={() => handleSubmitApproval(c.id)}
                                    title="提交审批"
                                  >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {c.status === "pending" && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-blue-600"
                                    onClick={() => {
                                      setApprovalContractId(c.id);
                                    }}
                                    title="审批"
                                  >
                                    <Layers className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {(c.status === "effective" ||
                                  c.status === "executing") && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-teal-600"
                                    onClick={() => {
                                      setPerfContractId(c.id);
                                      setPerfNode(null);
                                    }}
                                    title="履约跟踪"
                                  >
                                    <ListChecks className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {(c.status === "effective" ||
                                  c.status === "executing") &&
                                  !c.sales_order_id && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-indigo-600"
                                      onClick={() =>
                                        handleConvertToSalesOrder(c)
                                      }
                                      title="生成销售订单"
                                    >
                                      <ShoppingCart className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(c.id)}
                                  title="删除"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== 新建/编辑 ==================== */}
        <TabsContent value="create" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("list")}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
            <span className="text-sm text-muted-foreground">
              {editingId ? `编辑合同：${form.contract_no}` : "新建合同"}
            </span>
            {isCompleted && (
              <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                已锁定
              </span>
            )}
            {!isCompleted && isCoreLocked && (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
                核心字段已锁定
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 基本信息 */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">合同编号</Label>
                  <Input
                    value={form.contract_no || ""}
                    readOnly
                    className="bg-muted text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">合同标题 *</Label>
                  <Input
                    value={form.title || ""}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="如：上海锦华 - 绗缝被销售合同"
                    className="text-sm"
                    disabled={isCoreLocked}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">合同类型</Label>
                    <Select
                      value={form.contract_type || "domestic"}
                      onValueChange={(v) =>
                        setForm({ ...form, contract_type: v as any })
                      }
                      disabled={isCoreLocked}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRACT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">客户等级</Label>
                    <Select
                      value={form.customer_level || "normal"}
                      onValueChange={(v) =>
                        setForm({ ...form, customer_level: v as any })
                      }
                      disabled={isCoreLocked}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTRACT_CUSTOMER_LEVELS.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">付款条件</Label>
                  <Select
                    value={form.payment_terms || PAYMENT_TERMS[0]}
                    onValueChange={(v) =>
                      setForm({ ...form, payment_terms: v })
                    }
                    disabled={isCompleted}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">签订日期</Label>
                    <Input
                      type="date"
                      className="text-sm h-9"
                      value={form.sign_date || ""}
                      onChange={(e) =>
                        setForm({ ...form, sign_date: e.target.value })
                      }
                      disabled={isCoreLocked}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">生效日期</Label>
                    <Input
                      type="date"
                      className="text-sm h-9"
                      value={form.effective_date || ""}
                      onChange={(e) =>
                        setForm({ ...form, effective_date: e.target.value })
                      }
                      disabled={isCoreLocked}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">交货日期</Label>
                    <Input
                      type="date"
                      className="text-sm h-9"
                      value={form.delivery_date || ""}
                      onChange={(e) =>
                        setForm({ ...form, delivery_date: e.target.value })
                      }
                      disabled={isCoreLocked}
                    />
                  </div>
                </div>
                {form.quotation_no && (
                  <div className="rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-2 text-xs text-blue-700 dark:text-blue-300">
                    关联报价单：{form.quotation_no}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 客户信息 */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">客户信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">客户名称 *</Label>
                  <Input
                    value={form.customer_name || ""}
                    onChange={(e) =>
                      setForm({ ...form, customer_name: e.target.value })
                    }
                    className="text-sm"
                    disabled={isCoreLocked}
                  />
                </div>
                <div>
                  <Label className="text-xs">联系人</Label>
                  <Input
                    value={form.contact_name || ""}
                    onChange={(e) =>
                      setForm({ ...form, contact_name: e.target.value })
                    }
                    className="text-sm"
                    disabled={isCompleted}
                  />
                </div>
                <div>
                  <Label className="text-xs">联系电话</Label>
                  <Input
                    value={form.contact_phone || ""}
                    onChange={(e) =>
                      setForm({ ...form, contact_phone: e.target.value })
                    }
                    className="text-sm"
                    disabled={isCompleted}
                  />
                </div>
                <div>
                  <Label className="text-xs">客户地址</Label>
                  <Input
                    value={form.customer_address || ""}
                    onChange={(e) =>
                      setForm({ ...form, customer_address: e.target.value })
                    }
                    className="text-sm"
                    disabled={isCompleted}
                  />
                </div>
                <div>
                  <Label className="text-xs">备注</Label>
                  <Textarea
                    value={form.remark || ""}
                    onChange={(e) =>
                      setForm({ ...form, remark: e.target.value })
                    }
                    rows={3}
                    className="text-sm resize-none"
                    disabled={isCompleted}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 产品明细 */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">产品明细</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  disabled={isCoreLocked}
                  onClick={() => {
                    setForm({
                      ...form,
                      items: [
                        ...(form.items || []),
                        {
                          id: nanoid(),
                          product_id: "",
                          product_code: "",
                          product_name: "",
                          specification: "",
                          color: "",
                          quantity: 1,
                          unit_price: 0,
                          total_price: 0,
                          remark: "",
                        },
                      ],
                    });
                  }}
                >
                  <Plus className="h-3 w-3" /> 添加明细
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="whitespace-nowrap">
                        产品名称
                      </TableHead>
                      <TableHead className="whitespace-nowrap">规格</TableHead>
                      <TableHead className="whitespace-nowrap w-20">
                        颜色
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-24">
                        数量
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-28">
                        单价
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-28">
                        总价
                      </TableHead>
                      <TableHead className="whitespace-nowrap w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(form.items || []).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-6 text-muted-foreground text-sm"
                        >
                          暂无产品明细
                        </TableCell>
                      </TableRow>
                    ) : (
                      (form.items || []).map((item, idx) => {
                      const activeProducts = store.products.filter(
                        (p) => p.status === "active",
                      );
                      const selectedProduct = activeProducts.find(
                        (p) => p.id === item.product_id,
                      );
                      const specOptions = [
                        ...new Set([
                          ...getProductUniqueSpecs(selectedProduct),
                          item.specification || "",
                        ]),
                      ].filter(Boolean);
                      const colorOptions = [
                        ...new Set([
                          ...getProductUniqueColors(selectedProduct),
                          item.color || "",
                        ]),
                      ].filter(Boolean);
                      const hasSkus = !!selectedProduct?.skus?.length;

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Select
                              value={item.product_id || ""}
                              onValueChange={(v) =>
                                updateFormItem(idx, "product_id", v)
                              }
                              disabled={isCoreLocked}
                            >
                              <SelectTrigger className="h-8 text-sm w-44">
                                <SelectValue placeholder="选择产品" />
                              </SelectTrigger>
                              <SelectContent>
                                {activeProducts.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({p.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {hasSkus ? (
                              <Select
                                value={item.specification || ""}
                                onValueChange={(v) =>
                                  updateFormItem(idx, "specification", v)
                                }
                                disabled={isCoreLocked}
                              >
                                <SelectTrigger className="h-8 text-sm w-44">
                                  <SelectValue placeholder="选择规格" />
                                </SelectTrigger>
                                <SelectContent>
                                  {specOptions.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={item.specification}
                                onChange={(e) =>
                                  updateFormItem(
                                    idx,
                                    "specification",
                                    e.target.value,
                                  )
                                }
                                className="h-8 text-sm"
                                placeholder="规格"
                                disabled={isCoreLocked}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {hasSkus ? (
                              <Select
                                value={item.color || ""}
                                onValueChange={(v) =>
                                  updateFormItem(idx, "color", v)
                                }
                                disabled={isCoreLocked}
                              >
                                <SelectTrigger className="h-8 text-sm w-28">
                                  <SelectValue placeholder="选择颜色" />
                                </SelectTrigger>
                                <SelectContent>
                                  {colorOptions.map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {c}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={item.color || ""}
                                onChange={(e) =>
                                  updateFormItem(idx, "color", e.target.value)
                                }
                                className="h-8 text-sm"
                                placeholder="颜色"
                                disabled={isCoreLocked}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updateFormItem(
                                  idx,
                                  "quantity",
                                  Number(e.target.value),
                                )
                              }
                              className="h-8 text-sm"
                              min={1}
                              disabled={isCoreLocked}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) =>
                                updateFormItem(
                                  idx,
                                  "unit_price",
                                  Number(e.target.value),
                                )
                              }
                              className="h-8 text-sm"
                              min={0}
                              disabled={isCoreLocked}
                            />
                          </TableCell>
                          <TableCell className="text-sm font-medium text-muted-foreground">
                            {formatMoney(item.total_price)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              disabled={isCoreLocked}
                              onClick={() => {
                                const items = (form.items || []).filter(
                                  (_, i) => i !== idx,
                                );
                                setForm({
                                  ...form,
                                  items,
                                  amount: recalcContractItems(items),
                                });
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}))
                    }
                    {(form.items || []).length > 0 && (
                      <TableRow className="bg-muted/20">
                        <TableCell
                          colSpan={5}
                          className="text-right text-sm font-semibold"
                        >
                          合计：
                        </TableCell>
                        <TableCell className="text-sm font-bold text-primary">
                          {formatMoney(form.amount || 0)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 合同条款 */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">合同条款</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={isCompleted}
                    onClick={() => {
                      const clauses = getDefaultClauses(
                        form.contract_type || "domestic",
                        form.customer_level || "normal",
                        store.contractTemplates,
                      );
                      setForm({ ...form, clauses });
                      toast.success("已从模板填入条款");
                    }}
                  >
                    <BookTemplate className="h-3 w-3" /> 从模板填入
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    disabled={isCompleted}
                    onClick={() => {
                      setForm({
                        ...form,
                        clauses: [
                          ...(form.clauses || []),
                          {
                            type: "custom",
                            content: "",
                            sort_order: (form.clauses?.length || 0) + 1,
                          },
                        ],
                      });
                    }}
                  >
                    <Plus className="h-3 w-3" /> 添加条款
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(form.clauses || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  暂无条款，可从模板填入或手动添加
                </p>
              ) : (
                (form.clauses || []).map((clause, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <Select
                      value={clause.type}
                      onValueChange={(v) => updateClause(idx, "type", v)}
                      disabled={isCompleted}
                    >
                      <SelectTrigger className="h-8 w-28 text-xs shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          ["payment", "付款"],
                          ["delivery", "交货"],
                          ["quality", "质量"],
                          ["liability", "违约"],
                          ["confidential", "保密"],
                          ["custom", "自定义"],
                        ].map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={clause.content}
                      onChange={(e) =>
                        updateClause(idx, "content", e.target.value)
                      }
                      disabled={isCompleted}
                      rows={2}
                      className="text-sm resize-none flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive shrink-0"
                      disabled={isCompleted}
                      onClick={() => {
                        setForm({
                          ...form,
                          clauses: (form.clauses || []).filter(
                            (_, i) => i !== idx,
                          ),
                        });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setActiveTab("list")}>
              取消
            </Button>
            {(!editingId ||
              form.status === "draft" ||
              form.status === "pending" ||
              form.status === "effective" ||
              form.status === "executing") && (
              <Button
                className="bg-primary text-primary-foreground"
                onClick={handleSave}
              >
                保存合同
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ==================== 合同详情 ==================== */}
        <TabsContent value="detail" className="mt-4">
          {!detailContract ? (
            <div className="text-center py-12 text-muted-foreground">
              合同不存在
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailId(null);
                      setActiveTab("list");
                      setSearchParams({}, { replace: true });
                    }}
                    className="gap-1"
                  >
                    <ArrowLeft className="h-4 w-4" /> 返回
                  </Button>
                  <StatusBadge
                    status={detailContract.status}
                    options={CONTRACT_STATUS}
                  />
                  <span className="font-mono font-semibold">
                    {detailContract.contract_no}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(detailContract.status === "effective" ||
                    detailContract.status === "executing") &&
                    !detailContract.sales_order_id && (
                      <Button
                        size="sm"
                        className="bg-[#4A6A7F] text-white hover:bg-[#3A5569] gap-1"
                        onClick={() =>
                          handleConvertToSalesOrder(detailContract)
                        }
                      >
                        <ShoppingCart className="h-4 w-4" /> 生成销售订单
                      </Button>
                    )}
                  {detailContract.sales_order_no && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => navigate(`/marketing?tab=orders`)}
                    >
                      <ShoppingCart className="h-4 w-4" /> 销售订单{" "}
                      {detailContract.sales_order_no}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">合同信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <DetailRow label="合同编号" value={detailContract.contract_no} />
                    {detailContract.original_contract_no && (
                      <DetailRow
                        label="原合同编号"
                        value={detailContract.original_contract_no}
                      />
                    )}
                    <DetailRow label="合同标题" value={detailContract.title} />
                    <DetailRow
                      label="客户名称"
                      value={detailContract.customer_name}
                    />
                    <DetailRow
                      label="联系人"
                      value={detailContract.contact_name}
                    />
                    <DetailRow
                      label="联系电话"
                      value={detailContract.contact_phone}
                    />
                    <DetailRow
                      label="合同类型"
                      value={
                        CONTRACT_TYPES.find(
                          (t) => t.value === detailContract.contract_type,
                        )?.label || ""
                      }
                    />
                    <DetailRow
                      label="合同金额"
                      value={formatMoney(detailContract.amount)}
                    />
                    <DetailRow
                      label="付款条件"
                      value={detailContract.payment_terms}
                    />
                    <DetailRow
                      label="签订日期"
                      value={fmt(detailContract.sign_date)}
                    />
                    <DetailRow
                      label="生效日期"
                      value={fmt(detailContract.effective_date)}
                    />
                    <DetailRow
                      label="交货日期"
                      value={fmt(detailContract.delivery_date)}
                    />
                    {detailContract.delivery_term && (
                      <DetailRow
                        label="交货期限"
                        value={detailContract.delivery_term}
                      />
                    )}
                    {detailContract.quotation_no && (
                      <DetailRow
                        label="关联报价单"
                        value={detailContract.quotation_no}
                        link
                        onClick={() =>
                          navigate(
                            `/quotation?detailId=${detailContract.quotation_id}`,
                          )
                        }
                      />
                    )}
                    {detailContract.sales_order_no && (
                      <DetailRow
                        label="关联销售订单"
                        value={detailContract.sales_order_no}
                        link
                        onClick={() =>
                          navigate(
                            `/marketing?tab=orders&detailId=${detailContract.sales_order_id}`,
                          )
                        }
                      />
                    )}
                    {detailContract.remark && (
                      <DetailRow label="备注" value={detailContract.remark} />
                    )}
                  </CardContent>
                </Card>

                <div className="flex flex-wrap gap-2">
                  {detailContract.status === "draft" && (
                    <Button
                      size="sm"
                      className="text-xs gap-1 bg-primary text-primary-foreground"
                      onClick={() =>
                        handleSubmitApproval(detailContract.id)
                      }
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> 提交审批
                    </Button>
                  )}
                  {detailContract.status === "pending" && (
                    <Button
                      size="sm"
                      className="text-xs gap-1 bg-primary text-primary-foreground"
                      onClick={() =>
                        setApprovalContractId(detailContract.id)
                      }
                    >
                      <Layers className="h-3.5 w-3.5" /> 审批操作
                    </Button>
                  )}
                </div>
              </div>

              {/* 产品明细 */}
              {detailContract.items.length > 0 && (
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">产品明细</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="whitespace-nowrap">
                              产品名称
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              规格
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              颜色
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              数量
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              单价
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              总价
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailContract_itemsPaginated.map((item) => {
                            const skuColor =
                              item.color ||
                              store.products
                                .find((p) => p.id === item.product_id)
                                ?.skus?.find((s) =>
                                  s.barcode === item.specification ||
                                  s.size === item.specification ||
                                  s.specification === item.specification,
                                )
                                ?.color ||
                              "-";
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="whitespace-nowrap text-sm">
                                  <button
                                    onClick={() =>
                                      navigate(
                                        `/products/${item.product_id}?contractId=${detailId}`,
                                      )
                                    }
                                    className="text-primary hover:underline"
                                  >
                                    {item.product_name}
                                  </button>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {item.specification}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {skuColor}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {item.quantity}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {formatMoney(item.unit_price)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm font-medium">
                                  {formatMoney(item.total_price)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <Pagination
                        currentPage={detailContract_itemsCurrentPage}
                        totalPages={detailContract_itemsTotalPages}
                        pageSize={detailContract_itemsPageSize}
                        totalItems={detailContract_itemsTotalItems}
                        onPageChange={setDetailContract_itemsPage}
                        onPageSizeChange={setDetailContract_itemsPageSize}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 关联生产工单 */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">关联生产工单</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {relatedWorkOrders.length === 0 ? (
                    <div className="px-6 py-6 text-center text-muted-foreground text-sm">
                      暂无关联生产工单
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="whitespace-nowrap">
                              工单编号
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              产品名称
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              计划数量
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              完成进度
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              状态
                            </TableHead>
                            <TableHead className="whitespace-nowrap w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {relatedWorkOrders.map((wo) => (
                            <TableRow
                              key={wo.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => { setWODetailData(wo); setWODetailOpen(true); }}
                            >
                              <TableCell className="whitespace-nowrap text-sm font-medium text-primary">
                                {wo.work_no}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {wo.product_name}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {wo.plan_quantity}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={wo.progress}
                                    className="h-2 w-24"
                                  />
                                  <span className="text-xs text-muted-foreground w-9">
                                    {wo.progress}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <StatusBadge
                                  status={wo.status}
                                  options={[
                                    { value: 'pending', label: '待开工', color: 'bg-gray-500' },
                                    { value: 'issued', label: '已下发', color: 'bg-blue-500' },
                                    { value: 'producing', label: '生产中', color: 'bg-amber-500' },
                                    { value: 'paused', label: '已暂停', color: 'bg-gray-500' },
                                    { value: 'qc', label: '质检中', color: 'bg-purple-500' },
                                    { value: 'pending_inbound', label: '待入库', color: 'bg-blue-500' },
                                    { value: 'inbound', label: '已入库', color: 'bg-cyan-500' },
                                    { value: 'completed', label: '已完成', color: 'bg-green-500' },
                                    { value: 'closed', label: '已关闭', color: 'bg-gray-500' },
                                  ]}
                                />
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 合同条款 */}
              {detailContract.clauses.length > 0 && (
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">合同条款</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {detailContract.clauses.map((clause, idx) => (
                      <div
                        key={idx}
                        className="text-sm border-b border-border pb-2 last:border-0"
                      >
                        <span className="font-medium text-muted-foreground mr-2">
                          [{clause.type}]
                        </span>
                        {clause.content}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 审批记录 */}
              {(detailContract?.approval_logs || []).length > 0 && (
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">审批记录</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="whitespace-nowrap">
                              审批人
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              节点
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              结果
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              意见
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              时间
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailContract_approval_logsPaginated.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="whitespace-nowrap text-sm">
                                {log.approver}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {log.node}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {log.result === "approved" ? (
                                  <Badge className="bg-green-500 text-white text-xs">
                                    通过
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-500 text-white text-xs">
                                    驳回
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {log.opinion}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                {fmt(log.created_at)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <Pagination
                        currentPage={detailContract_approval_logsCurrentPage}
                        totalPages={detailContract_approval_logsTotalPages}
                        pageSize={detailContract_approval_logsPageSize}
                        totalItems={detailContract_approval_logsTotalItems}
                        onPageChange={setDetailContract_approval_logsPage}
                        onPageSizeChange={
                          setDetailContract_approval_logsPageSize
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 关联销售订单 */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" /> 关联销售订单
                    <Badge variant="secondary" className="ml-1">
                      {relatedSalesOrders.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="whitespace-nowrap">订单编号</TableHead>
                        <TableHead className="whitespace-nowrap">客户</TableHead>
                        <TableHead className="whitespace-nowrap">订单金额</TableHead>
                        <TableHead className="whitespace-nowrap">交货日期</TableHead>
                        <TableHead className="whitespace-nowrap">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatedSalesOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                            暂无关联销售订单
                          </TableCell>
                        </TableRow>
                      ) : (
                        relatedSalesOrders.map((o) => (
                          <TableRow key={o.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => { setSODetailData(o); setSODetailOpen(true); }}>                            <TableCell className="whitespace-nowrap font-medium text-primary">
                              {o.order_no}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {o.customer_name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {formatMoney(o.total_amount)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {fmt(o.delivery_date)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {o.status}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* 关联采购订单 */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" /> 关联采购订单
                    <Badge variant="secondary" className="ml-1">
                      {relatedPurchaseOrders.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="whitespace-nowrap">采购单号</TableHead>
                        <TableHead className="whitespace-nowrap">供应商</TableHead>
                        <TableHead className="whitespace-nowrap">采购金额</TableHead>
                        <TableHead className="whitespace-nowrap">下达采购日期</TableHead>
                        <TableHead className="whitespace-nowrap">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatedPurchaseOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                            暂无关联采购订单
                          </TableCell>
                        </TableRow>
                      ) : (
                        relatedPurchaseOrders.map((p) => (
                          <TableRow key={p.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => { setPoDetailData(p); setPoDetailOpen(true); }}>                            <TableCell className="whitespace-nowrap font-medium text-primary">
                              {p.order_no}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {p.supplier_name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {formatMoney(p.total_amount)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {fmt(p.issued_date)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {p.status}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* 关联加工款 */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-primary" /> 关联加工款
                    <Badge variant="secondary" className="ml-1">
                      {relatedProcessingPayments.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="whitespace-nowrap">姓名</TableHead>
                        <TableHead className="whitespace-nowrap">货号</TableHead>
                        <TableHead className="whitespace-nowrap">颜色</TableHead>
                        <TableHead className="whitespace-nowrap">规格</TableHead>
                        <TableHead className="whitespace-nowrap">工序</TableHead>
                        <TableHead className="whitespace-nowrap">工序来源</TableHead>
                        <TableHead className="whitespace-nowrap text-right">数量</TableHead>
                        <TableHead className="whitespace-nowrap text-right">单价</TableHead>
                        <TableHead className="whitespace-nowrap text-right">金额</TableHead>
                        <TableHead className="whitespace-nowrap text-right">预支款</TableHead>
                        <TableHead className="whitespace-nowrap text-right">修补费</TableHead>
                        <TableHead className="whitespace-nowrap text-right">剪线头</TableHead>
                        <TableHead className="whitespace-nowrap text-right">扣废被</TableHead>
                        <TableHead className="whitespace-nowrap text-right">买材料</TableHead>
                        <TableHead className="whitespace-nowrap text-right">应扣合计</TableHead>
                        <TableHead className="whitespace-nowrap text-right">工资金额</TableHead>
                        <TableHead className="whitespace-nowrap">备注</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatedProcessingPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={17} className="text-center py-6 text-muted-foreground text-sm">
                            暂无关联加工款
                          </TableCell>
                        </TableRow>
                      ) : (
                        relatedProcessingPayments.map((r) => (
                          <TableRow key={r.id} className="hover:bg-muted/20">
                            <TableCell className="whitespace-nowrap font-medium text-sm">{r.employee_name}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{r.product_code}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{r.color || '-'}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{r.specification || '-'}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{r.operation_name}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              <Badge
                                variant="secondary"
                                className={r.process_source === 'internal' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'}
                              >
                                {r.process_source === 'internal' ? '内部' : '外协'}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-sm">{r.quantity}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-sm">{formatMoney(r.unit_price)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-sm font-medium">{formatMoney(r.amount)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-sm">{formatMoney(r.advance_payment)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-sm">{formatMoney(r.repair_fee)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-sm">{formatMoney(r.thread_cutting)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-sm">{formatMoney(r.waste_deduction)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-sm">{formatMoney(r.material_purchase)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-sm text-destructive">{formatMoney(r.total_deduction)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-sm font-semibold text-primary">{formatMoney(r.salary_amount)}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{r.remark || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {relatedProcessingPayments.length > 0 && (
                    <div className="px-4 py-2 text-right text-xs text-muted-foreground border-t border-border">
                      工资金额合计：
                      <span className="font-semibold text-foreground ml-1">
                        {formatMoney(relatedProcessingPayments.reduce((s, r) => s + (r.salary_amount || 0), 0))}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ==================== 合同模板 ==================== */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookTemplate className="h-4 w-4 text-primary" /> 合同模板管理
                </CardTitle>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1 bg-primary text-primary-foreground"
                  onClick={() => {
                    setTemplateEditId(null);
                    setTemplateForm({
                      contract_type: "domestic",
                      customer_level: "normal",
                      clauses: [],
                      status: "active",
                    });
                    setTemplateDialogOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> 新建模板
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="whitespace-nowrap font-semibold">
                        模板名称
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">
                        合同类型
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">
                        客户等级
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">
                        条款数
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-semibold">
                        状态
                      </TableHead>
                      <TableHead className="whitespace-nowrap font-semibold text-right">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {store.contractTemplates.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-10 text-muted-foreground"
                        >
                          暂无模板
                        </TableCell>
                      </TableRow>
                    ) : (
                      store.contractTemplates.map((tpl) => (
                        <TableRow key={tpl.id} className="hover:bg-muted/20">
                          <TableCell className="whitespace-nowrap text-sm font-medium">
                            {tpl.name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {
                              CONTRACT_TYPES.find(
                                (t) => t.value === tpl.contract_type,
                              )?.label
                            }
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {
                              CONTRACT_CUSTOMER_LEVELS.find(
                                (l) => l.value === tpl.customer_level,
                              )?.label
                            }
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {tpl.clauses.length}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              className={
                                tpl.status === "active"
                                  ? "bg-green-500 text-white"
                                  : "bg-muted text-muted-foreground"
                              }
                            >
                              {tpl.status === "active" ? "启用" : "停用"}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => {
                                  setTemplateEditId(tpl.id);
                                  setTemplateForm({
                                    ...tpl,
                                    clauses: tpl.clauses.map((c) => ({ ...c })),
                                  });
                                  setTemplateDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive"
                                onClick={() => {
                                  store.deleteContractTemplate(tpl.id);
                                  toast.success("模板已删除");
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </ControlledTabs>

      {/* ==================== 导入错误弹窗 ==================== */}
      <Dialog open={importErrors.length > 0} onOpenChange={(v) => !v && setImportErrors([])}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              导入校验失败
            </DialogTitle>
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

      {/* ==================== 从报价单选择弹窗 ==================== */}
      <Dialog open={quotationPickerOpen} onOpenChange={setQuotationPickerOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>选择报价单</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            仅显示已审批通过的报价单
          </p>
          <div className="overflow-x-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="whitespace-nowrap">报价单号</TableHead>
                  <TableHead className="whitespace-nowrap">客户</TableHead>
                  <TableHead className="whitespace-nowrap">产品</TableHead>
                  <TableHead className="whitespace-nowrap">金额</TableHead>
                  <TableHead className="whitespace-nowrap"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {store.quotations.filter((q) => q.status === "approved")
                  .length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground text-sm"
                    >
                      暂无已审批的报价单
                    </TableCell>
                  </TableRow>
                ) : (
                  store.quotations
                    .filter((q) => q.status === "approved")
                    .map((q) => (
                      <TableRow key={q.id} className="hover:bg-muted/20">
                        <TableCell className="whitespace-nowrap font-mono text-sm">
                          {q.quotation_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {q.customer_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {q.product_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatMoney(q.suggested_price)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-primary text-primary-foreground"
                            onClick={() => handleFromQuotation(q.id)}
                          >
                            转合同
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
      {/* ==================== 审批弹窗 ==================== */}
      <Dialog
        open={!!approvalContractId}
        onOpenChange={(o) => {
          if (!o) setApprovalContractId(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              合同审批 — {approvalContract?.contract_no}
            </DialogTitle>
          </DialogHeader>
          {approvalContract && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">客户：</span>
                  {approvalContract.customer_name}
                </p>
                <p>
                  <span className="text-muted-foreground">金额：</span>
                  {formatMoney(approvalContract.amount)}
                </p>
                <p>
                  <span className="text-muted-foreground">交货日期：</span>
                  {fmt(approvalContract.delivery_date)}
                </p>
                <p>
                  <span className="text-muted-foreground">付款条件：</span>
                  {approvalContract.payment_terms}
                </p>
              </div>
              <div>
                <Label className="text-sm">审批意见</Label>
                <Textarea
                  value={approvalOpinion}
                  onChange={(e) => setApprovalOpinion(e.target.value)}
                  placeholder="请输入审批意见（可选）"
                  rows={3}
                  className="text-sm resize-none mt-1"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setApprovalContractId(null)}
                >
                  取消
                </Button>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 gap-1"
                  onClick={() => handleApprove(approvalContractId!, "rejected")}
                >
                  <XCircle className="h-4 w-4" /> 驳回
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white gap-1"
                  onClick={() => handleApprove(approvalContractId!, "approved")}
                >
                  <CheckCircle className="h-4 w-4" /> 审批通过
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* ==================== 履约节点更新弹窗 ==================== */}
      <Dialog
        open={!!perfContractId}
        onOpenChange={(o) => {
          if (!o) {
            setPerfContractId(null);
            setPerfNode(null);
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              更新履约进度 — {perfContract?.contract_no}
            </DialogTitle>
          </DialogHeader>
          {perfContract && (
            <div className="space-y-3">
              {perfContract.performance_nodes.map((node) => {
                const cfg = PERFORMANCE_NODE_TYPES.find(
                  (t) => t.value === node.node_type,
                );
                const isSelected = perfNode?.id === node.id;
                return (
                  <div
                    key={node.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20"}`}
                    onClick={() => setPerfNode({ ...node })}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{cfg?.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {node.status}
                      </Badge>
                    </div>
                    {isSelected && cfg && (
                      <div className="mt-2 space-y-2">
                        <Label className="text-xs">状态</Label>
                        <div className="flex flex-wrap gap-2">
                          {cfg.statuses.map((s) => (
                            <Button
                              key={s}
                              size="sm"
                              variant={
                                perfNode?.status === s ? "default" : "outline"
                              }
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPerfNode({ ...perfNode!, status: s });
                              }}
                            >
                              {s}
                            </Button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">计划日期</Label>
                            <Input
                              type="date"
                              className="h-8 text-xs"
                              value={perfNode?.scheduled_date || ""}
                              onChange={(e) =>
                                setPerfNode({
                                  ...perfNode!,
                                  scheduled_date: e.target.value,
                                })
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">实际日期</Label>
                            <Input
                              type="date"
                              className="h-8 text-xs"
                              value={perfNode?.actual_date || ""}
                              onChange={(e) =>
                                setPerfNode({
                                  ...perfNode!,
                                  actual_date: e.target.value,
                                })
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">备注</Label>
                          <Input
                            className="h-8 text-xs"
                            value={perfNode?.remark || ""}
                            onChange={(e) =>
                              setPerfNode({
                                ...perfNode!,
                                remark: e.target.value,
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPerfContractId(null);
                    setPerfNode(null);
                  }}
                >
                  取消
                </Button>
                <Button
                  className="bg-primary text-primary-foreground"
                  disabled={!perfNode}
                  onClick={() => handleUpdatePerfNode(perfContractId!)}
                >
                  保存进度
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* ==================== 模板编辑弹窗 ==================== */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {templateEditId ? "编辑模板" : "新建模板"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">模板名称 *</Label>
              <Input
                value={templateForm.name || ""}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, name: e.target.value })
                }
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">合同类型</Label>
                <Select
                  value={templateForm.contract_type || "domestic"}
                  onValueChange={(v) =>
                    setTemplateForm({
                      ...templateForm,
                      contract_type: v as any,
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">客户等级</Label>
                <Select
                  value={templateForm.customer_level || "normal"}
                  onValueChange={(v) =>
                    setTemplateForm({
                      ...templateForm,
                      customer_level: v as any,
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_CUSTOMER_LEVELS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">条款列表</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs gap-1"
                  onClick={() => {
                    setTemplateForm({
                      ...templateForm,
                      clauses: [
                        ...(templateForm.clauses || []),
                        {
                          type: "custom",
                          content: "",
                          sort_order: (templateForm.clauses?.length || 0) + 1,
                        },
                      ],
                    });
                  }}
                >
                  <Plus className="h-3 w-3" /> 添加
                </Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(templateForm.clauses || []).map((clause, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <Select
                      value={clause.type}
                      onValueChange={(v) => {
                        const clauses = [...(templateForm.clauses || [])];
                        clauses[idx] = { ...clauses[idx], type: v };
                        setTemplateForm({ ...templateForm, clauses });
                      }}
                    >
                      <SelectTrigger className="h-8 w-24 text-xs shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          ["payment", "付款"],
                          ["delivery", "交货"],
                          ["quality", "质量"],
                          ["liability", "违约"],
                          ["custom", "自定义"],
                        ].map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={clause.content}
                      onChange={(e) => {
                        const clauses = [...(templateForm.clauses || [])];
                        clauses[idx] = {
                          ...clauses[idx],
                          content: e.target.value,
                        };
                        setTemplateForm({ ...templateForm, clauses });
                      }}
                      rows={2}
                      className="text-xs resize-none flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => {
                        setTemplateForm({
                          ...templateForm,
                          clauses: (templateForm.clauses || []).filter(
                            (_, i) => i !== idx,
                          ),
                        });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setTemplateDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                className="bg-primary text-primary-foreground"
                onClick={handleSaveTemplate}
              >
                保存模板
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 生产工艺单详情模态框 */}
      <Dialog
        open={!!selectedCraftSheet}
        onOpenChange={(open) => {
          if (!open) setSelectedCraftSheet(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base">生产工艺单详情</DialogTitle>
          </DialogHeader>
          {selectedCraftSheet && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="space-y-1 min-w-[8rem]">
                  <div>
                    <span className="text-muted-foreground">序号：</span>
                    {selectedCraftSheet.seq_no}
                  </div>
                  <div>
                    <span className="text-muted-foreground">标题：</span>
                    {selectedCraftSheet.title || '生产工艺单'}
                  </div>
                  {selectedCraftSheet.customer_contract_no && (
                    <div>
                      <span className="text-muted-foreground">客户合同号：</span>
                      {selectedCraftSheet.customer_contract_no}
                    </div>
                  )}
                  {selectedCraftSheet.finish_date && (
                    <div>
                      <span className="text-muted-foreground">完成日期：</span>
                      {selectedCraftSheet.finish_date}
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="whitespace-nowrap">货号</TableHead>
                      <TableHead className="whitespace-nowrap">尺寸</TableHead>
                      {(selectedCraftSheet.colors || []).map((color) => (
                        <TableHead key={color} className="whitespace-nowrap">
                          {color}
                        </TableHead>
                      ))}
                      <TableHead className="whitespace-nowrap">小计</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedCraftSheet.rows || []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {row.product_code}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {row.size}
                        </TableCell>
                        {(selectedCraftSheet.colors || []).map((color) => (
                          <TableCell key={color} className="whitespace-nowrap">
                            {row.color_quantities[color] || 0}
                          </TableCell>
                        ))}
                        <TableCell className="whitespace-nowrap font-medium">
                          {row.total_quantity}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell className="whitespace-nowrap" colSpan={2}>
                        TOTAL
                      </TableCell>
                      {(selectedCraftSheet.colors || []).map((color) => (
                        <TableCell key={color} className="whitespace-nowrap">
                          {(selectedCraftSheet.rows || []).reduce(
                            (sum, r) => sum + (r.color_quantities[color] || 0),
                            0,
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="whitespace-nowrap">
                        {(selectedCraftSheet.rows || []).reduce(
                          (sum, r) => sum + (r.total_quantity || 0),
                          0,
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-1">
                <div className="text-muted-foreground">工艺要求</div>
                <div className="p-3 rounded border border-border bg-muted/20 leading-relaxed">
                  {selectedCraftSheet.process_requirements}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <CraftSheetMaintenanceDialog
        open={craftSheetDialogOpen}
        onOpenChange={setCraftSheetDialogOpen}
        draft={craftSheetDraft}
        onDraftChange={setCraftSheetDraft}
        onSave={handleSaveCraftSheet}
      />

      {/* 生产工单详情弹窗 */}
      <Dialog open={woDetailOpen} onOpenChange={(v) => { setWODetailOpen(v); if (!v) setWODetailData(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>生产工单详情</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">工单编号</div>
                <div className="font-medium">{woDetailData?.work_no}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">产品名称</div>
                <div className="font-medium">{woDetailData?.product_name}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">货号</div>
                <div className="font-medium">{woDetailData?.product_code}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">规格</div>
                <div className="font-medium">{woDetailData?.sku_summary || '-'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">计划数量</div>
                <div className="font-medium">{woDetailData?.plan_quantity}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">完成数量</div>
                <div className="font-medium">{woDetailData?.completed_quantity}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">开始日期</div>
                <div className="font-medium">{woDetailData?.start_date ? fmt(woDetailData.start_date) : '-'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">结束日期</div>
                <div className="font-medium">{woDetailData?.end_date ? fmt(woDetailData.end_date) : '-'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">完成进度</div>
                <div className="flex items-center gap-2">
                  <Progress value={woDetailData?.progress ?? 0} className="h-2 w-24" />
                  <span className="text-xs text-muted-foreground">{woDetailData?.progress ?? 0}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">状态</div>
                <div className="font-medium">
                  {woDetailData?.status === 'pending' ? '待开工' : woDetailData?.status === 'issued' ? '已下发' : woDetailData?.status === 'producing' ? '生产中' : woDetailData?.status === 'paused' ? '已暂停' : woDetailData?.status === 'qc' ? '质检中' : woDetailData?.status === 'pending_inbound' ? '待入库' : woDetailData?.status === 'inbound' ? '已入库' : woDetailData?.status === 'completed' ? '已完成' : woDetailData?.status === 'closed' ? '已关闭' : woDetailData?.status}
                </div>
              </div>
            </div>
            {(woDetailData?.operations ?? []).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">工序列表</div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="whitespace-nowrap">序号</TableHead>
                        <TableHead className="whitespace-nowrap">工序名称</TableHead>
                        <TableHead className="whitespace-nowrap">计划数量</TableHead>
                        <TableHead className="whitespace-nowrap">完成数量</TableHead>
                        <TableHead className="whitespace-nowrap">类型</TableHead>
                        <TableHead className="whitespace-nowrap">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(woDetailData?.operations ?? []).map((op, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{op.seq}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{op.name}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{op.plan_qty}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{op.completed_qty}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            <Badge variant="secondary" className={op.category === 'outsourcing' ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}>
                              {op.category === 'outsourcing' ? '外协' : '内部'}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{op.completed ? '已完成' : '进行中'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {woDetailData?.remark && (
              <div className="text-sm text-muted-foreground">备注：{woDetailData.remark}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 销售订单详情弹窗 */}
      <Dialog open={soDetailOpen} onOpenChange={(v) => { setSODetailOpen(v); if (!v) setSODetailData(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>销售订单详情</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">订单编号</div>
                <div className="font-medium">{soDetailData?.order_no}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">客户</div>
                <div className="font-medium">{soDetailData?.customer_name}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">订单类型</div>
                <div className="font-medium">{soDetailData?.order_type}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">渠道</div>
                <div className="font-medium">{soDetailData?.channel || '-'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">实际交货日期</div>
                <div className="font-medium">{soDetailData && ["shipped", "completed"].includes(soDetailData.status) && soDetailData.delivery_date ? fmt(soDetailData.delivery_date) : '-'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">目的地</div>
                <div className="font-medium">{soDetailData?.destination || '-'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">贸易条款</div>
                <div className="font-medium">{soDetailData?.trade_term || '-'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">币种</div>
                <div className="font-medium">{soDetailData?.currency || '-'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">订单金额</div>
                <div className="font-medium text-primary">{formatMoney(soDetailData?.total_amount ?? 0)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">状态</div>
                <div className="font-medium">{soDetailData?.status}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">订单明细</div>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="whitespace-nowrap">货号</TableHead>
                      <TableHead className="whitespace-nowrap">品名</TableHead>
                      <TableHead className="whitespace-nowrap">颜色</TableHead>
                      <TableHead className="whitespace-nowrap">数量</TableHead>
                      <TableHead className="whitespace-nowrap">单价</TableHead>
                      <TableHead className="whitespace-nowrap">金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(soDetailData?.items ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground text-sm">暂无明细</TableCell>
                      </TableRow>
                    ) : (
                      (soDetailData?.items ?? []).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap text-sm font-medium">{item.product_code}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{item.product_name}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{item.color || '-'}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatMoney(item.unit_price)}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatMoney(item.amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 采购订单详情弹窗 */}
      <Dialog open={poDetailOpen} onOpenChange={(v) => { setPoDetailOpen(v); if (!v) setPoDetailData(null); }}>        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>采购订单详情</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">采购单号</div>
                <div className="font-medium">{poDetailData?.order_no}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">供应商</div>
                <div className="font-medium">{poDetailData?.supplier_name}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">下达采购日期</div>
                <div className="font-medium">{poDetailData?.issued_date}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">金额</div>
                <div className="font-medium">{formatMoney(poDetailData?.total_amount ?? 0)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">状态</div>
                <div className="font-medium">
                  {poDetailData?.status === 'approved' ? '已批准' : poDetailData?.status === 'partial' ? '部分到货' : poDetailData?.status}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">付款状态</div>
                <div className="font-medium">
                  {poDetailData?.payment_status === 'unpaid' ? '未付款' : poDetailData?.payment_status === 'partial' ? '部分付款' : '已付款'}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">采购物料</div>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="whitespace-nowrap">物料编码</TableHead>
                      <TableHead className="whitespace-nowrap">物料名称</TableHead>
                      <TableHead className="whitespace-nowrap">规格</TableHead>
                      <TableHead className="whitespace-nowrap">数量</TableHead>
                      <TableHead className="whitespace-nowrap">单价</TableHead>
                      <TableHead className="whitespace-nowrap">金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(poDetailData?.items ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground text-sm">暂无物料</TableCell>
                      </TableRow>
                    ) : (
                      (poDetailData?.items ?? []).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap text-sm">{item.material_code}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{item.material_name}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{item.specification}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatMoney(item.unit_price)}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatMoney(item.amount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- 辅助组件 ----------
function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: number;
  sub: string;
  icon: string;
  color?: string;
}) {
  return (
    <Card className="border-border bg-card hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
              className={`text-2xl font-bold mt-0.5 ${color || "text-foreground"}`}
            >
              {value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
          <span className="text-2xl opacity-50">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  value,
  link,
  onClick,
}: {
  label: string;
  value: string;
  link?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0 w-20">{label}</span>
      {link && onClick ? (
        <button
          onClick={onClick}
          className="font-medium text-primary hover:underline"
        >
          {value}
        </button>
      ) : (
        <span className="font-medium">{value}</span>
      )}
    </div>
  );
}

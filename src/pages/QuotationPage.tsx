import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppStore, type AppState } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
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
import { useVisibleTabs } from "@/lib/moduleVisibility";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  generateContractNo,
  createContractFromQuotation,
  getDefaultClauses,
} from "@/lib/contract";
import { createSalesOrderFromQuotation } from "@/lib/salesOrder";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
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
  Calculator,
  FileText,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Printer,
  Download,
  Mail,
  History,
  ArrowLeft,
  AlertTriangle,
  Send,
  FileCheck,
  ShoppingCart,
} from "lucide-react";
import { QUOTATION_STATUS, formatMoney } from "@/lib/data";
import {
  nanoid,
  cn,
  getProductBomsBySku,
  formatBeijingTime,
  extractSkuColor,
  resolveColorMaterial,
} from "@/lib/utils";
import {
  calculateQuotationCosts,
  calculateQuotationCostsFromItems,
  recalcQuotationTotals,
  createEmptyQuotation,
  getDefaultMaterialPrice,
  SUBJECT_META,
  buildQuotationCostDetails,
  recalcQuotationCostDetails,
} from "@/lib/quotation";
import type {
  Quotation,
  QuotationItem,
  QuotationCostItem,
  QuotationCostDetails,
  QuotationMaterialRow,
  QuotationProcessRow,
  QuotationPackagingRow,
  Customer,
  Product,
  ProductSku,
  ProductBom,
  Material,
  MaterialSupplierPrice,
  ProcessRoute,
} from "@/types";

type TabKey = "list" | "create" | "detail" | "approval" | "history";

const PROFIT_RATES = [
  { value: 0.15, label: "15%" },
  { value: 0.2, label: "20%" },
  { value: 0.25, label: "25%" },
  { value: 0.3, label: "30%" },
];

const LOSS_RATES = [
  { value: 0.03, label: "3%" },
  { value: 0.05, label: "5%" },
  { value: 0.08, label: "8%" },
  { value: 0.1, label: "10%" },
];

const BATCH_FACTORS = [
  { value: 0, label: "0%" },
  { value: 0.02, label: "2%" },
  { value: 0.04, label: "4%" },
  { value: 0.06, label: "6%" },
  { value: 0.08, label: "8%" },
];

function formatDateTime(iso?: string) {
  return formatBeijingTime(iso);
}

function formatDateOnly(iso?: string) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "—";
}

function generateQuotationNo() {
  const now = new Date();
  const prefix = "BJ";
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}${date}${seq}`;
}

function exportQuotationToCSV(q: Quotation) {
  const rows = [
    ["报价单号", q.quotation_no],
    ["客户", q.customer_name],
    ["币种", q.currency || "CNY"],
    ["产品", `${q.product_code} ${q.product_name}`],
    ["订货数量", q.quantity],
    ["预计交货日期", q.estimated_delivery_date || "-"],
    ["目标利润率", `${(q.target_profit_rate * 100).toFixed(0)}%`],
    ["面料损耗率", `${(q.fabric_loss_rate * 100).toFixed(0)}%`],
    ["批量系数", `${(q.batch_factor * 100).toFixed(0)}%`],
    ["总成本", q.total_cost],
    ["建议报价", q.suggested_price],
    ["预估利润", q.estimated_profit],
    ["实际利润率", `${(q.actual_profit_rate * 100).toFixed(2)}%`],
    [
      "状态",
      QUOTATION_STATUS.find((s) => s.value === q.status)?.label || q.status,
    ],
    [],
    ["报价明细"],
    ["产品编码", "产品名称", "规格", "数量", "单价", "小计"],
    ...(q.items || []).map((it) => [
      it.product_code,
      it.product_name,
      it.sku_specification || it.product_spec || "",
      it.quantity,
      it.unit_price,
      it.subtotal,
    ]),
    [],
    [
      "成本科目",
      "自动计算值",
      "手动调整值",
      "最终值",
      "是否手动调整",
      "调整人",
      "调整时间",
    ],
    ...((q.cost_items || []).map((c) => [
      c.subject_name,
      c.auto_value,
      c.manual_value ?? "-",
      c.final_value,
      c.is_manual ? "是" : "否",
      c.adjusted_by,
      formatDateTime(c.adjusted_at),
    ])),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${q.quotation_no}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

interface BaseLibraryPanelProps {
  selectedProduct: Product | undefined;
  selectedSku: ProductSku | undefined;
  currentBoms: ProductBom[];
  selectedRoute: ProcessRoute | undefined;
  materials: Material[];
  materialSupplierPrices: MaterialSupplierPrice[];
}

interface MultiBaseLibraryPanelProps {
  groups: {
    product: Product;
    sku: ProductSku;
    boms: ProductBom[];
    route: ProcessRoute | undefined;
  }[];
  materials: Material[];
  materialSupplierPrices: MaterialSupplierPrice[];
}

function resolveBomMaterialForDisplay(
  bom: { material_id: string; material_name: string; material_code?: string },
  color: string,
  materials: Material[],
): { id: string; name: string; code?: string; isColorMatched: boolean } {
  const { material } = resolveColorMaterial(bom.material_name, color, materials);
  return {
    id: material?.id || bom.material_id,
    name: material?.name || bom.material_name,
    code: material?.code || bom.material_code,
    isColorMatched: !!material,
  };
}

function BaseLibraryPanel({
  selectedProduct,
  selectedSku,
  currentBoms,
  selectedRoute,
  materials,
  materialSupplierPrices,
}: BaseLibraryPanelProps) {
  if (!selectedProduct) return null;
  const skuColor = extractSkuColor(selectedSku);
  return (
    <Card className="border border-[#C4B5A5] bg-[#FAF7F2]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[#3D2E1E]">基础数据联动</CardTitle>
        <CardDescription className="text-[#8A7E72]">
          当前报价引用的产品、物料、工艺实时数据
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-md border border-[#C4B5A5] bg-[#F5F0E8] p-3">
            <div className="mb-2 text-sm font-medium text-[#3D2E1E]">
              产品信息
            </div>
            <div className="space-y-1 text-sm text-[#8A7E72]">
              <div>
                <span className="text-[#3D2E1E]">款号：</span>
                {selectedProduct.code}
              </div>
              <div>
                <span className="text-[#3D2E1E]">名称：</span>
                {selectedProduct.name}
              </div>
              <div>
                <span className="text-[#3D2E1E]">规格：</span>
                {[selectedProduct.category, selectedSku?.specification]
                  .filter(Boolean)
                  .join(" / ")}
              </div>
              <div>
                <span className="text-[#3D2E1E]">BOM 版本：</span>V1
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[#C4B5A5] bg-[#F5F0E8] p-3 md:col-span-2">
            <div className="mb-2 text-sm font-medium text-[#3D2E1E]">
              物料信息
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#C4B5A5] hover:bg-transparent">
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      物料编号
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      物料名称
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      规格
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      颜色
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      类别
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      用量
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      最新采购价
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      供应商
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentBoms.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-[#8A7E72] py-3"
                      >
                        暂无 BOM 数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentBoms.map((bom, idx) => {
                      const resolved = resolveBomMaterialForDisplay(
                        bom,
                        skuColor,
                        materials,
                      );
                      const m = materials.find((x) => x.id === resolved.id);
                      const sp = getDefaultMaterialPrice(
                        resolved.id,
                        materialSupplierPrices,
                      );
                      return (
                        <TableRow
                          key={idx}
                          className="border-b border-[#EDE8E0] hover:bg-[#FAF7F2]"
                        >
                          <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                            {resolved.code || bom.material_code}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                            {resolved.name}
                            {resolved.isColorMatched && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {selectedSku?.color}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                            {m?.specification ||
                              bom.specification ||
                              bom.cutting_specification ||
                              "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                            {m?.color || selectedSku?.color || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                            {bom.category}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                            {bom.dosage} {bom.unit}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                            {sp.price > 0 ? formatMoney(sp.price) : "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                            {sp.supplier_name || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-[#C4B5A5] bg-[#F5F0E8] p-3">
          <div className="mb-2 text-sm font-medium text-[#3D2E1E]">
            工艺路线信息
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#C4B5A5] hover:bg-transparent">
                  <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                    工序顺序
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                    工序名称
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                    标准工时
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                    工价
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                    单件加工费
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                    所需设备
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                    技能等级
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const steps = selectedRoute?.steps?.length
                    ? selectedRoute.steps
                    : selectedProduct.process_steps || [];
                  if (steps.length === 0) {
                    return (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-[#8A7E72] py-3"
                        >
                          未关联工艺路线
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return steps.map((step) => (
                    <TableRow
                      key={step.seq}
                      className="border-b border-[#EDE8E0] hover:bg-[#FAF7F2]"
                    >
                      <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                        {step.seq}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                        {step.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                        {step.hours} 分
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                        {formatMoney(step.price || 0)}/分
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                        {formatMoney((step.hours || 0) * (step.price || 0))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                        {step.device}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                        {step.skill}
                      </TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MultiBaseLibraryPanel({
  groups,
  materials,
  materialSupplierPrices,
}: MultiBaseLibraryPanelProps) {
  if (groups.length === 0) return null;
  return (
    <Card className="border border-[#C4B5A5] bg-[#FAF7F2]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[#3D2E1E]">基础数据引用</CardTitle>
        <CardDescription className="text-[#8A7E72]">
          当前报价明细关联的产品、SKU、BOM 与工艺实时数据
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map((g, idx) => (
          <div
            key={`${g.product.id}-${g.sku.id}-${idx}`}
            className="space-y-3 rounded-md border border-[#C4B5A5] bg-[#F5F0E8] p-3"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1 text-sm text-[#8A7E72]">
                <div className="font-medium text-[#3D2E1E]">产品信息</div>
                <div>
                  <span className="text-[#3D2E1E]">款号：</span>
                  {g.product.code}
                </div>
                <div>
                  <span className="text-[#3D2E1E]">名称：</span>
                  {g.product.name}
                </div>
                <div>
                  <span className="text-[#3D2E1E]">规格：</span>
                  {g.sku.barcode || g.sku.size || g.sku.specification || "-"}
                </div>
                <div>
                  <span className="text-[#3D2E1E]">BOM 版本：</span>V1
                </div>
              </div>
              <div className="space-y-1 text-sm text-[#8A7E72]">
                <div className="font-medium text-[#3D2E1E]">工艺信息</div>
                <div>
                  <span className="text-[#3D2E1E]">工艺路线：</span>
                  {g.route?.name || "未关联"}
                </div>
                <div>
                  <span className="text-[#3D2E1E]">工序数：</span>
                  {g.route?.steps?.length || g.product.process_steps?.length || 0}
                </div>
                <div>
                  <span className="text-[#3D2E1E]">核心工序：</span>
                  {(g.route?.steps?.length
                    ? g.route.steps
                    : g.product.process_steps || []
                  )
                    .map((s) => s.name)
                    .join(" → ") || "-"}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-[#3D2E1E]">物料信息</div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#C4B5A5] hover:bg-transparent">
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        物料编号
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        物料名称
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        规格
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        颜色
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        类别
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        用量
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        最新采购价
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        供应商
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.boms.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-[#8A7E72] py-3"
                        >
                          暂无 BOM 数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      g.boms.map((bom, bidx) => {
                        const skuColor = extractSkuColor(g.sku);
                        const resolved = resolveBomMaterialForDisplay(
                          bom,
                          skuColor,
                          materials,
                        );
                        const m = materials.find((x) => x.id === resolved.id);
                        const sp = getDefaultMaterialPrice(
                          resolved.id,
                          materialSupplierPrices,
                        );
                        return (
                          <TableRow
                            key={bidx}
                            className="border-b border-[#EDE8E0] hover:bg-[#FAF7F2]"
                          >
                            <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                              {resolved.code || bom.material_code}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                              {resolved.name}
                              {resolved.isColorMatched && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {g.sku.color}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                              {m?.specification ||
                                bom.specification ||
                                bom.cutting_specification ||
                                "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                              {m?.color || g.sku.color || "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                              {bom.category}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                              {bom.dosage} {bom.unit}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                              {sp.price > 0 ? formatMoney(sp.price) : "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                              {sp.supplier_name || "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface CreateEditViewContext {
  form: Quotation;
  setForm: React.Dispatch<React.SetStateAction<Quotation>>;
  store: AppState;
  handleParamChange: (key: keyof Quotation, value: unknown) => void;
  handleCostChange: (
    subject: QuotationCostItem["subject"],
    rawValue: string,
  ) => void;
  runSmartCalc: () => void;
  saveDraft: () => void;
  submitApproval: () => void;
  resetForm: (initial?: Quotation) => void;
  setActiveTab: (tab: TabKey) => void;
  editingId: string | null;
  hasBaseDataWarning: boolean;
  selectedProduct: Product | undefined;
  selectedRoute: ProcessRoute | undefined;
  selectedSku: ProductSku | undefined;
  currentBoms: ProductBom[];
  handleProductSelect: (productId: string) => void;
  updateCostDetails: (updater: (prev: QuotationCostDetails) => QuotationCostDetails) => void;
  addMaterialRow: () => void;
  removeMaterialRow: (id: string) => void;
  updateMaterialRow: (id: string, patch: Partial<QuotationMaterialRow>) => void;
  addProcessRow: () => void;
  removeProcessRow: (id: string) => void;
  updateProcessRow: (id: string, patch: Partial<QuotationProcessRow>) => void;
  addPackagingRow: () => void;
  removePackagingRow: (id: string) => void;
  updatePackagingRow: (id: string, patch: Partial<QuotationPackagingRow>) => void;
}

export function QuotationPage() {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const { activeTab, setActiveTab } = useVisibleTabs("/quotation", "list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Quotation>(createEmptyQuotation());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDetailId = searchParams.get("detailId");
  const [detailId, setDetailId] = useState<string | null>(initialDetailId);
  const [historyCompareIds, setHistoryCompareIds] = useState<string[]>([]);
  const [approvalOpen, setApprovalOpen] = useState(false);
  useEffect(() => {
    if (initialDetailId) {
      setDetailId(initialDetailId);
      setActiveTab("detail");
    }
  }, [initialDetailId, setActiveTab]);

  // 当报价明细变更时，自动同步顶层 product_id/sku_id 与第一条明细保持一致
  useEffect(() => {
    const next = normalizeQuotationForm(form);
    if (
      next.product_id !== form.product_id ||
      next.sku_id !== form.sku_id ||
      next.product_code !== form.product_code ||
      next.product_name !== form.product_name ||
      next.product_spec !== form.product_spec ||
      next.sku_specification !== form.sku_specification ||
      next.quantity !== form.quantity
    ) {
      setForm(next);
    }
  }, [form.items]);

  const [approvalAction, setApprovalAction] = useState<"approved" | "rejected">(
    "approved",
  );
  const [approvalOpinion, setApprovalOpinion] = useState("");
  const [approvalProfitRate, setApprovalProfitRate] = useState<number>(0.2);
  const [printOpen, setPrintOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [contractQuotation, setContractQuotation] = useState<Quotation | null>(
    null,
  );

  const selectedProduct = useMemo(
    () => store.products.find((p) => p.id === form.product_id),
    [store.products, form.product_id],
  );

  const selectedRoute = useMemo<ProcessRoute | undefined>(() => {
    if (!selectedProduct?.route_binding?.route_id) return undefined;
    return store.processRoutes.find(
      (r) => r.id === selectedProduct.route_binding?.route_id,
    );
  }, [store.processRoutes, selectedProduct]);

  const selectedCustomer = useMemo(
    () => store.customers.find((c) => c.id === form.customer_id),
    [store.customers, form.customer_id],
  );

  const filteredQuotations = useMemo(() => {
    return store.quotations
      .filter((q) => {
        const matchSearch =
          !search ||
          (q.quotation_no || "").includes(search) ||
          (q.customer_name || "").includes(search) ||
          (q.product_code || "").includes(search) ||
          (q.product_name || "").includes(search) ||
          (q.contract_no || "").includes(search) ||
          (q.items || []).some(
            (it) =>
              (it.product_code || "").includes(search) ||
              (it.product_name || "").includes(search),
          );
        const matchStatus = statusFilter === "all" || q.status === statusFilter;
        const matchCustomer =
          customerFilter === "all" || q.customer_id === customerFilter;
        const matchProduct =
          productFilter === "all" || q.product_id === productFilter;
        return matchSearch && matchStatus && matchCustomer && matchProduct;
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [store.quotations, search, statusFilter, customerFilter, productFilter]);

  const {
    paginatedItems: filteredQuotationsPaginated,
    currentPage: filteredQuotationsCurrentPage,
    pageSize: filteredQuotationsPageSize,
    totalPages: filteredQuotationsTotalPages,
    totalItems: filteredQuotationsTotalItems,
    setPage: setFilteredQuotationsPage,
    setPageSize: setFilteredQuotationsPageSize,
  } = usePagination(filteredQuotations);

  function refreshTotals(nextCostItems?: QuotationCostItem[]) {
    const items = nextCostItems ?? form.cost_items;
    const totals = recalcQuotationTotals(items, form.target_profit_rate);
    setForm((prev) => ({ ...prev, ...totals }));
  }

  function runSmartCalc() {
    setForm((prev) => {
      const items = prev.items || [];
      if (items.length === 0) {
        toast.warning("请先添加报价明细");
        return prev;
      }
      const costItems = calculateQuotationCostsFromItems(
        items,
        store.products,
        store.materials,
        store.materialSupplierPrices,
        store.processRoutes,
        prev.fabric_loss_rate,
        prev.batch_factor,
        "系统",
      );
      const totals = recalcQuotationTotals(costItems, prev.target_profit_rate);
      toast.success("智能核算完成");
      return { ...prev, cost_items: costItems, ...totals };
    });
  }

  function handleParamChange(key: keyof Quotation, value: unknown) {
    setForm((prev) => {
      const next = { ...prev, [key]: value } as Quotation;
      if (key === "target_profit_rate") {
        if (next.cost_details) {
          const total = next.total_cost;
          const rate = next.target_profit_rate;
          next.suggested_price = Math.round(total * (1 + rate) * 100) / 100;
          next.estimated_profit = Math.round(total * rate * 100) / 100;
          next.actual_profit_rate = total > 0 ? Math.round(rate * 10000) / 10000 : 0;
        } else {
          const totals = recalcQuotationTotals(
            next.cost_items,
            next.target_profit_rate,
          );
          Object.assign(next, totals);
        }
      }
      if (key === "quantity" && next.cost_details) {
        const qty = (next.quantity as number) || 1;
        const lineTotal = [...next.cost_details.materials, ...next.cost_details.processes, ...next.cost_details.packaging]
          .reduce((sum, r) => sum + (r.amount || 0), 0);
        const total = Math.round(lineTotal * qty * 100) / 100;
        const rate = next.target_profit_rate;
        next.total_cost = total;
        next.suggested_price = Math.round(total * (1 + rate) * 100) / 100;
        next.estimated_profit = Math.round(total * rate * 100) / 100;
        next.actual_profit_rate = total > 0 ? Math.round((rate * 10000)) / 10000 : 0;
      }
      return next;
    });
  }

  function handleProductSelect(productId: string) {
    const p = store.products.find((x) => x.id === productId);
    if (!p) return;
    const sku = p.skus?.[0];
    const route = p.route_binding?.route_id
      ? store.processRoutes.find((r) => r.id === p.route_binding?.route_id)
      : undefined;
    const details = buildQuotationCostDetails(
      p,
      sku?.id,
      store.materials,
      store.materialSupplierPrices,
      route,
    );
    const { total } = recalcQuotationCostDetails(details);
    setForm((prev) => ({
      ...prev,
      product_id: p.id,
      product_code: p.code,
      product_name: p.name,
      product_spec: p.specification || [p.category, sku?.specification].filter(Boolean).join(" / ") || "",
      sku_id: sku?.id,
      sku_specification: sku?.barcode || sku?.size || sku?.specification || "",
      quantity: 1,
      cost_details: details,
      total_cost: total,
      suggested_price: Math.round(total * (1 + prev.target_profit_rate) * 100) / 100,
      estimated_profit: Math.round(total * prev.target_profit_rate * 100) / 100,
      actual_profit_rate: total > 0 ? Math.round(prev.target_profit_rate * 10000) / 10000 : 0,
      items: sku
        ? [
            {
              id: nanoid(),
              product_id: p.id,
              product_code: p.code,
              product_name: p.name,
              product_spec: p.specification || [p.category, sku.specification].filter(Boolean).join(" / ") || "",
              sku_id: sku.id,
              sku_specification: sku.barcode || sku.size || sku.specification,
              color: sku.color,
              quantity: 1,
              unit_price: sku.suggested_price || 0,
              subtotal: sku.suggested_price || 0,
            },
          ]
        : [],
    }));
  }

  function updateCostDetails(updater: (prev: QuotationCostDetails) => QuotationCostDetails) {
    setForm((prev) => {
      const prevDetails = prev.cost_details || { materials: [], processes: [], packaging: [] };
      const nextDetails = updater(prevDetails);
      const { details, total: lineTotal } = recalcQuotationCostDetails(nextDetails);
      const quantity = prev.quantity || 1;
      const total = Math.round(lineTotal * quantity * 100) / 100;
      const profit = Math.round(total * prev.target_profit_rate * 100) / 100;
      return {
        ...prev,
        cost_details: details,
        total_cost: total,
        suggested_price: Math.round(total * (1 + prev.target_profit_rate) * 100) / 100,
        estimated_profit: profit,
        actual_profit_rate: total > 0 ? Math.round((profit / total) * 10000) / 10000 : 0,
      };
    });
  }

  function addMaterialRow() {
    updateCostDetails((prev) => ({
      ...prev,
      materials: [...prev.materials, { id: nanoid(), name: "", unit: "米", size: "", width: "", dosage: 0, unit_price: 0, amount: 0, remark: "" }],
    }));
  }

  function removeMaterialRow(id: string) {
    updateCostDetails((prev) => ({
      ...prev,
      materials: prev.materials.filter((r) => r.id !== id),
    }));
  }

  function updateMaterialRow(id: string, patch: Partial<QuotationMaterialRow>) {
    updateCostDetails((prev) => ({
      ...prev,
      materials: prev.materials.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }

  function addProcessRow() {
    updateCostDetails((prev) => ({
      ...prev,
      processes: [...prev.processes, { id: nanoid(), name: "", unit_price: 0, dosage: 1, amount: 0, category: "internal" }],
    }));
  }

  function removeProcessRow(id: string) {
    updateCostDetails((prev) => ({
      ...prev,
      processes: prev.processes.filter((r) => r.id !== id),
    }));
  }

  function updateProcessRow(id: string, patch: Partial<QuotationProcessRow>) {
    updateCostDetails((prev) => ({
      ...prev,
      processes: prev.processes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }

  function addPackagingRow() {
    updateCostDetails((prev) => ({
      ...prev,
      packaging: [...prev.packaging, { id: nanoid(), name: "", unit_price: 0, quantity: 1, amount: 0 }],
    }));
  }

  function removePackagingRow(id: string) {
    updateCostDetails((prev) => ({
      ...prev,
      packaging: prev.packaging.filter((r) => r.id !== id),
    }));
  }

  function updatePackagingRow(id: string, patch: Partial<QuotationPackagingRow>) {
    updateCostDetails((prev) => ({
      ...prev,
      packaging: prev.packaging.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }

  function handleCostChange(
    subject: QuotationCostItem["subject"],
    rawValue: string,
  ) {
    const value = Math.max(0, parseFloat(rawValue) || 0);
    setForm((prev) => {
      const items = prev.cost_items.map((item) => {
        if (item.subject !== subject) return item;
        return {
          ...item,
          manual_value: value,
          final_value: value,
          is_manual: true,
          adjusted_by: currentUserName,
          adjusted_at: new Date().toISOString(),
        };
      });
      const totals = recalcQuotationTotals(items, prev.target_profit_rate);
      return { ...prev, cost_items: items, ...totals };
    });
  }

  function resetForm(initial?: Quotation) {
    if (initial) {
      let next: Quotation = { ...initial };
      if (!next.cost_details) {
        // 兼容旧数据：从 cost_items 自动生成新版成本明细结构
        next.cost_details = { materials: [], processes: [], packaging: [] };
        const fabric = next.cost_items.find((c) => c.subject === "fabric");
        const accessory = next.cost_items.find((c) => c.subject === "accessory");
        const processing = next.cost_items.find((c) => c.subject === "processing");
        const packaging = next.cost_items.find((c) => c.subject === "packaging");
        const other = next.cost_items.find((c) => c.subject === "other");
        if (fabric) {
          next.cost_details.materials.push({
            id: nanoid(), name: "面料", unit: "米", size: "", width: "", dosage: 1,
            unit_price: fabric.final_value, amount: fabric.final_value, remark: "",
          });
        }
        if (accessory) {
          next.cost_details.materials.push({
            id: nanoid(), name: "辅料", unit: "米", size: "", width: "", dosage: 1,
            unit_price: accessory.final_value, amount: accessory.final_value, remark: "",
          });
        }
        if (processing) {
          next.cost_details.processes.push({
            id: nanoid(), name: "加工费", unit_price: processing.final_value,
            dosage: 1, amount: processing.final_value, category: "internal",
          });
        }
        if (packaging) {
          next.cost_details.packaging.push({
            id: nanoid(), name: "包装物流费", unit_price: packaging.final_value,
            quantity: 1, amount: packaging.final_value,
          });
        }
        if (other) {
          next.cost_details.packaging.push({
            id: nanoid(), name: "其他费用", unit_price: other.final_value,
            quantity: 1, amount: other.final_value,
          });
        }
      }
      next.quotation_date = next.quotation_date || new Date().toISOString().slice(0, 10);
      setForm(next);
      setEditingId(initial.id);
    } else {
      setForm({ ...createEmptyQuotation(), creator: currentUserName });
      setEditingId(null);
    }
  }

  function validate() {
    const errors: string[] = [];
    if (!form.customer_id) errors.push("请选择客户");
    if (!form.product_id) errors.push("请选择品名");
    if (!form.product_spec?.trim()) errors.push("请填写规格");
    if (!form.quotation_date) errors.push("请选择报价日期");
    if (!form.currency) errors.push("请选择币种");
    if (!form.quantity || form.quantity <= 0) errors.push("数量必须大于 0");
    const hasNewDetails = form.cost_details && (
      form.cost_details.materials.length > 0 ||
      form.cost_details.processes.length > 0 ||
      form.cost_details.packaging.length > 0
    );
    if (!hasNewDetails && (!form.items || form.items.length === 0)) {
      errors.push("请至少添加一条报价明细或成本明细");
    }
    if (!hasNewDetails) {
      if (form.items?.some((i) => !i.product_id || !i.sku_id))
        errors.push("报价明细中存在未选择产品或规格的行");
      if (form.items?.some((i) => !i.quantity || i.quantity <= 0))
        errors.push("报价明细中数量必须大于 0");
      if (form.cost_items.length === 0) errors.push("请先进行智能核算");
    }
    return errors;
  }

  function normalizeQuotationForm(prev: Quotation): Quotation {
    const items = prev.items || [];
    const first = items[0];
    const totalQuantity = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const next: Quotation = {
      ...prev,
      product_id: first?.product_id || prev.product_id || "",
      product_code: first?.product_code || prev.product_code || "",
      product_name: first?.product_name || prev.product_name || "",
      product_spec: first?.product_spec || prev.product_spec || "",
      sku_id: first?.sku_id || prev.sku_id,
      sku_specification: first?.sku_specification || prev.sku_specification,
      quantity: totalQuantity || prev.quantity || 0,
    };
    // 若使用新版纸质报价单结构，同步旧版 cost_items 以便历史视图兼容（按数量累计）
    if (next.cost_details) {
      const qty = next.quantity || 1;
      const materialTotal = next.cost_details.materials.reduce((s, r) => s + (r.amount || 0), 0) * qty;
      const processTotal = next.cost_details.processes.reduce((s, r) => s + (r.amount || 0), 0) * qty;
      const packagingTotal = next.cost_details.packaging.reduce((s, r) => s + (r.amount || 0), 0) * qty;
      next.cost_items = [
        { subject: "fabric", subject_name: "面料成本", auto_value: materialTotal, manual_value: null, final_value: materialTotal, is_manual: false, adjusted_by: "", adjusted_at: "" },
        { subject: "accessory", subject_name: "辅料成本", auto_value: 0, manual_value: null, final_value: 0, is_manual: false, adjusted_by: "", adjusted_at: "" },
        { subject: "processing", subject_name: "加工费", auto_value: processTotal, manual_value: null, final_value: processTotal, is_manual: false, adjusted_by: "", adjusted_at: "" },
        { subject: "packaging", subject_name: "包装物流费", auto_value: packagingTotal, manual_value: null, final_value: packagingTotal, is_manual: false, adjusted_by: "", adjusted_at: "" },
        { subject: "other", subject_name: "其他费用", auto_value: 0, manual_value: null, final_value: 0, is_manual: false, adjusted_by: "", adjusted_at: "" },
      ];
    }
    return next;
  }

  function pushVersionLog(prev: Quotation): Quotation {
    const versionLogs = prev.version_logs || [];
    const nextVersion =
      versionLogs.length > 0
        ? Math.max(...versionLogs.map((v) => v.version)) + 1
        : 1;
    const log = {
      version: nextVersion,
      operator: currentUserName,
      time: new Date().toISOString(),
      snapshot: JSON.parse(JSON.stringify(prev)) as Quotation,
    };
    return { ...prev, version_logs: [...versionLogs, log] };
  }

  function saveDraft() {
    const errors = validate();
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    const isNew = !editingId;
    const saved: Quotation = {
      ...normalizeQuotationForm(form),
      status: form.status === "rejected" ? "draft" : form.status || "draft",
      updated_at: new Date().toISOString(),
    };
    if (isNew) {
      saved.id = nanoid();
      saved.quotation_no = generateQuotationNo();
      saved.creator = currentUserName;
      saved.created_at = new Date().toISOString();
    }
    const withVersion = pushVersionLog(saved);
    if (isNew) store.addQuotation(withVersion);
    else store.updateQuotation(withVersion);
    toast.success("草稿已保存");
    setActiveTab("list");
    resetForm();
  }

  function submitApproval() {
    const errors = validate();
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    const saved: Quotation = {
      ...normalizeQuotationForm(form),
      status: "pending",
      updated_at: new Date().toISOString(),
    };
    if (!editingId) {
      saved.id = nanoid();
      saved.quotation_no = generateQuotationNo();
      saved.creator = currentUserName;
      saved.created_at = new Date().toISOString();
    }
    const withVersion = pushVersionLog(saved);
    if (editingId) {
      store.updateQuotation(withVersion);
    } else {
      store.addQuotation(withVersion);
    }
    toast.success("报价单已提交审批");
    setActiveTab("list");
    resetForm();
  }

  function openApproval(action: "approved" | "rejected", q: Quotation) {
    setApprovalAction(action);
    setApprovalOpinion(action === "approved" ? "同意" : "需调整");
    setApprovalProfitRate(q.target_profit_rate);
    setDetailId(q.id);
    setApprovalOpen(true);
  }

  async function confirmApproval() {
    if (!detailId) {
      toast.error("未选择报价单");
      return;
    }
    const q = store.quotations.find((x) => x.id === detailId);
    if (!q) {
      toast.error("未找到该报价单");
      return;
    }
    try {
      const nextStatus =
        approvalAction === "approved" ? "approved" : "rejected";
      const opinion =
        approvalOpinion.trim() ||
        (approvalAction === "approved" ? "同意" : "需调整");
      const totalCost = q.total_cost || 0;
      const suggestedPrice = approvalAction === "approved"
        ? Math.round(totalCost * (1 + approvalProfitRate) * 100) / 100
        : q.suggested_price;
      const estimatedProfit = approvalAction === "approved"
        ? Math.round(totalCost * approvalProfitRate * 100) / 100
        : q.estimated_profit;
      const actualRate = approvalAction === "approved" && totalCost > 0
        ? Math.round((estimatedProfit / totalCost) * 10000) / 10000
        : q.actual_profit_rate;
      const updated: Quotation = {
        ...q,
        status: nextStatus,
        target_profit_rate: approvalAction === "approved" ? approvalProfitRate : q.target_profit_rate,
        total_cost: totalCost,
        suggested_price: suggestedPrice,
        estimated_profit: estimatedProfit,
        actual_profit_rate: actualRate,
        approval_logs: [
          ...(q.approval_logs || []),
          {
            approver: currentUserName,
            result: approvalAction,
            opinion,
            time: new Date().toISOString(),
          },
        ],
        updated_at: new Date().toISOString(),
      };
      await store.updateQuotation(updated);
      setApprovalOpen(false);
      setApprovalOpinion("");
      toast.success(
        `报价单已${approvalAction === "approved" ? "审批通过" : "驳回"}`,
      );
    } catch (err) {
      console.error("[confirmApproval] error", err);
      toast.error("审批操作失败，请检查数据是否完整");
    }
  }

  function handleDelete(id: string) {
    store.deleteQuotation(id);
    toast.success("报价单已删除");
  }

  function handleEdit(id: string) {
    const q = store.quotations.find((x) => x.id === id);
    if (!q) return;
    if (q.status !== "draft" && q.status !== "rejected") {
      toast.error("仅草稿或需调整状态可编辑");
      return;
    }
    resetForm(q);
    setActiveTab("create");
  }

  function handleView(id: string) {
    setDetailId(id);
    setSearchParams({ detailId: id });
    setActiveTab("detail");
  }

  const navigate = useNavigate();

  function handleContract(q: Quotation) {
    if (q.status !== "approved") {
      toast.error("仅已审批的报价单可转合同");
      return;
    }
    const contract = createContractFromQuotation(q);
    contract.contract_no = generateContractNo(store.contracts);
    contract.clauses = getDefaultClauses(
      contract.contract_type,
      contract.customer_level,
      store.contractTemplates,
    );
    store.addContract(contract);
    store.updateQuotation({
      ...q,
      status: "converted",
      contract_no: contract.contract_no,
    });
    toast.success(
      `已为报价单 ${q.quotation_no} 生成合同 ${contract.contract_no}`,
    );
    navigate(`/contract?contractId=${contract.id}`);
  }

  function handleSalesOrder(q: Quotation) {
    if (q.status !== "approved") {
      toast.error("仅已审批的报价单可转销售订单");
      return;
    }
    const order = createSalesOrderFromQuotation(q, store.salesOrders);
    store.addSalesOrder(order);
    store.updateQuotation({ ...q, status: "converted", sales_order_no: order.order_no });
    toast.success(
      `已为报价单 ${q.quotation_no} 生成销售订单 ${order.order_no}`,
    );
    navigate(`/marketing?tab=orders`);
  }

  function handlePrint(q: Quotation) {
    setDetailId(q.id);
    setPrintOpen(true);
  }

  function getQuotation(): Quotation | undefined {
    return store.quotations.find((q) => q.id === detailId);
  }

  useEffect(() => {
    if (
      activeTab === "create" &&
      !editingId &&
      !form.product_id &&
      store.products.length > 0
    ) {
      // 新建时默认不选产品，等待用户选择
    }
  }, [activeTab, editingId, form.product_id, store.products.length]);

  const selectedSku = useMemo(
    () => selectedProduct?.skus?.find((s) => s.id === form.sku_id),
    [selectedProduct, form.sku_id],
  );
  const currentBoms = useMemo(
    () => getProductBomsBySku(selectedProduct, form.sku_id),
    [selectedProduct, form.sku_id],
  );

  const hasBaseDataWarning = useMemo(() => {
    const items = form.items || [];
    if (items.length === 0) return false;
    return items.some((item) => {
      const p = store.products.find((x) => x.id === item.product_id);
      if (!p) return false;
      const boms = getProductBomsBySku(p, item.sku_id);
      const hasProcessSteps =
        (p.process_steps?.length || 0) > 0 ||
        (p.route_binding?.route_id &&
          store.processRoutes.some((r) => r.id === p.route_binding?.route_id));
      return boms.length === 0 || !hasProcessSteps;
    });
  }, [form.items, store.products, store.processRoutes]);

  // ---------- 列表视图 ----------
  function ListView() {
    return (
      <div className="space-y-4">
        <Card className="border border-[#C4B5A5] bg-[#FAF7F2]">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#8A7E72]" />
                <Input
                  placeholder="搜索报价单号/客户/产品/合同编号"
                  className="pl-9 border-[#C4B5A5] bg-[#F5F0E8]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="border-[#C4B5A5] bg-[#F5F0E8]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {QUOTATION_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="border-[#C4B5A5] bg-[#F5F0E8]">
                  <SelectValue placeholder="客户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部客户</SelectItem>
                  {store.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="border-[#C4B5A5] bg-[#F5F0E8]">
                  <SelectValue placeholder="产品" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部产品</SelectItem>
                  {store.products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="border-[#C4B5A5] text-[#3D2E1E] hover:bg-[#EDE8E0]"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setCustomerFilter("all");
                  setProductFilter("all");
                }}
              >
                重置
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#C4B5A5] bg-[#FAF7F2]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#C4B5A5] hover:bg-transparent">
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      报价单号
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      合同编号
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      客户
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      产品
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      数量
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      总成本
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      建议报价
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      利润率
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      状态
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      创建时间
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotations.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="text-center text-[#8A7E72] py-8"
                      >
                        暂无报价单
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQuotationsPaginated.map((q) => (
                      <TableRow
                        key={q.id}
                        className="border-b border-[#EDE8E0] hover:bg-[#F5F0E8]"
                      >
                        <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                          {q.quotation_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {q.contract_no || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {q.customer_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {q.product_name || (q.items || []).map((i) => i.product_name).join(", ")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {q.quantity || (q.items || []).reduce((sum, i) => sum + i.quantity, 0)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {formatMoney(q.total_cost)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {formatMoney(q.suggested_price)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {(q.actual_profit_rate * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <StatusBadge
                            status={q.status}
                            options={QUOTATION_STATUS}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#8A7E72]">
                          {formatDateOnly(q.created_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(q.id)}
                            >
                              <Eye className="h-4 w-4 text-[#4A6A7F]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(q.id)}
                            >
                              <Pencil className="h-4 w-4 text-[#4A6A7F]" />
                            </Button>
                            {q.status === "approved" &&
                              !q.contract_no &&
                              !q.sales_order_no && (
                                <>
                                  <Button
                                    size="sm"
                                    className="bg-[#C47D5A] text-white hover:bg-[#A86442] h-8 text-xs"
                                    onClick={() => handleContract(q)}
                                  >
                                    <FileCheck className="h-3.5 w-3.5 mr-1" />{" "}
                                    转合同
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-[#4A6A7F] text-white hover:bg-[#3A5569] h-8 text-xs"
                                    onClick={() => handleSalesOrder(q)}
                                  >
                                    <ShoppingCart className="h-3.5 w-3.5 mr-1" />{" "}
                                    转销售订单
                                  </Button>
                                </>
                              )}
                            {q.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-green-600 text-white hover:bg-green-700 h-8 text-xs"
                                  onClick={() => openApproval("approved", q)}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />{" "}
                                  通过
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-500 text-red-600 hover:bg-red-50 h-8 text-xs"
                                  onClick={() => openApproval("rejected", q)}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" /> 驳回
                                </Button>
                              </>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-[#C47D5A]" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-[#FAF7F2] border-[#C4B5A5] max-w-[calc(100%-2rem)] md:max-w-lg">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-[#3D2E1E]">
                                    删除报价单
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-[#8A7E72]">
                                    确定删除报价单 {q.quotation_no}{" "}
                                    吗？删除后不可恢复。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="border-[#C4B5A5] text-[#3D2E1E]">
                                    取消
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-[#C47D5A] text-white hover:bg-[#A86442]"
                                    onClick={() => handleDelete(q.id)}
                                  >
                                    删除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <Pagination
                currentPage={filteredQuotationsCurrentPage}
                totalPages={filteredQuotationsTotalPages}
                pageSize={filteredQuotationsPageSize}
                totalItems={filteredQuotationsTotalItems}
                onPageChange={setFilteredQuotationsPage}
                onPageSizeChange={setFilteredQuotationsPageSize}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- 新建/编辑视图 ----------
  const createEditRef = useRef<CreateEditViewContext | null>(null);
  createEditRef.current = {
    form,
    setForm,
    store,
    handleParamChange,
    handleCostChange,
    runSmartCalc,
    saveDraft,
    submitApproval,
    resetForm,
    setActiveTab,
    editingId,
    hasBaseDataWarning,
    selectedProduct,
    selectedRoute,
    selectedSku,
    currentBoms,
    handleProductSelect,
    updateCostDetails,
    addMaterialRow,
    removeMaterialRow,
    updateMaterialRow,
    addProcessRow,
    removeProcessRow,
    updateProcessRow,
    addPackagingRow,
    removePackagingRow,
    updatePackagingRow,
  };
  const CreateEditView = useMemo(() => {
    return function CreateEditView() {
      const ctx = createEditRef.current!;
      const {
        form,
        setForm,
        store,
        handleParamChange,
        saveDraft,
        submitApproval,
        resetForm,
        setActiveTab,
        editingId,
        hasBaseDataWarning,
        handleProductSelect,
        addMaterialRow,
        removeMaterialRow,
        updateMaterialRow,
        addProcessRow,
        removeProcessRow,
        updateProcessRow,
        addPackagingRow,
        removePackagingRow,
        updatePackagingRow,
      } = ctx;
      const details = form.cost_details || { materials: [], processes: [], packaging: [] };
      const [customerOpen, setCustomerOpen] = useState(false);
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                setActiveTab("list");
                setDetailId(null);
                setSearchParams({}, { replace: true });
                resetForm();
              }}
            >
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
            <span className="text-lg font-semibold text-[#3D2E1E]">
              {editingId ? "编辑报价单" : "新建报价单"}
            </span>
          </div>

          {hasBaseDataWarning && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="text-sm">
                当前产品缺少 BOM
                或关联工艺路线，智能核算结果可能不完整。请先在成品档案或工艺管理中维护基础数据。
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* 左侧基础信息 */}
              <Card className="lg:col-span-4 border border-[#C4B5A5] bg-[#FAF7F2]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-[#3D2E1E]">
                    基础信息
                  </CardTitle>
                  <CardDescription className="text-[#8A7E72]">
                    选择客户与成品档案，系统自动带出成本明细
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[#3D2E1E]">客户名称</Label>
                    <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={customerOpen}
                          className="w-full justify-between border-[#C4B5A5] bg-[#F5F0E8] font-normal text-[#3D2E1E]"
                        >
                          {form.customer_id
                            ? store.customers.find((c) => c.id === form.customer_id)?.name
                            : "请选择客户"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="搜索客户名称" />
                          <CommandList>
                            <CommandEmpty>未找到客户</CommandEmpty>
                            <CommandGroup>
                              {store.customers.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={c.id}
                                  keywords={[c.name, c.contact || ""]}
                                  onPointerDown={(e) => e.preventDefault()}
                                  onSelect={() => {
                                    handleParamChange("customer_id", c.id);
                                    handleParamChange("customer_name", c.name);
                                    setCustomerOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      form.customer_id === c.id ? "text-primary" : "text-transparent"
                                    )}
                                  />
                                  {c.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[#3D2E1E]">品名</Label>
                    <Select
                      value={form.product_id || "empty"}
                      onValueChange={(v) => handleProductSelect(v === "empty" ? "" : v)}
                    >
                      <SelectTrigger className="border-[#C4B5A5] bg-[#F5F0E8]">
                        <SelectValue placeholder="从成品档案中选择" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empty">请选择</SelectItem>
                        {store.products
                          .filter((p) => p.status === "active")
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}（{p.code}）
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[#3D2E1E]">规格</Label>
                    <Input
                      value={form.product_spec || ""}
                      onChange={(e) => handleParamChange("product_spec", e.target.value)}
                      placeholder="填写规格"
                      className="border-[#C4B5A5] bg-[#F5F0E8]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[#3D2E1E]">数量</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.quantity || ""}
                      onChange={(e) => handleParamChange("quantity", parseInt(e.target.value, 10) || 0)}
                      placeholder="填写数量"
                      className="border-[#C4B5A5] bg-[#F5F0E8]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[#3D2E1E]">报价日期</Label>
                    <Input
                      type="date"
                      value={form.quotation_date || ""}
                      onChange={(e) => handleParamChange("quotation_date", e.target.value)}
                      className="border-[#C4B5A5] bg-[#F5F0E8]"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[#3D2E1E]">币种</Label>
                    <Select
                      value={form.currency || "CNY"}
                      onValueChange={(v) => handleParamChange("currency", v)}
                    >
                      <SelectTrigger className="border-[#C4B5A5] bg-[#F5F0E8]">
                        <SelectValue placeholder="选择币种" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CNY">人民币 CNY</SelectItem>
                        <SelectItem value="USD">美元 USD</SelectItem>
                        <SelectItem value="EUR">欧元 EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[#3D2E1E]">目标利润率</Label>
                    <Select
                      value={String(form.target_profit_rate)}
                      onValueChange={(v) =>
                        handleParamChange("target_profit_rate", parseFloat(v))
                      }
                    >
                      <SelectTrigger className="border-[#C4B5A5] bg-[#F5F0E8]">
                        <SelectValue placeholder="选择利润率" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFIT_RATES.map((r) => (
                          <SelectItem key={r.value} value={String(r.value)}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[#3D2E1E]">备注</Label>
                    <Textarea
                      value={form.remark}
                      onChange={(e) => handleParamChange("remark", e.target.value)}
                      placeholder="填写特殊工艺要求或备注"
                      className="min-h-[80px] border-[#C4B5A5] bg-[#F5F0E8]"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 右侧成本明细 */}
              <div className="lg:col-span-8 space-y-4">
                <Card className="border border-[#C4B5A5] bg-[#FAF7F2]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-[#3D2E1E]">
                      成本明细
                    </CardTitle>
                    <CardDescription className="text-[#8A7E72]">
                      修改单价、单耗或数量后，金额与小计将自动重新计算
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* 分区A：主辅料区 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-[#3D2E1E]">
                          分区 A：主辅料区（面料、填充料、包装物）
                        </h4>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 border-[#4A6A7F] text-[#4A6A7F] hover:bg-[#4A6A7F]/10"
                          onClick={addMaterialRow}
                        >
                          <Plus className="mr-1 h-4 w-4" /> 新增行
                        </Button>
                      </div>
                      <div className="overflow-x-auto rounded-md border border-[#C4B5A5]">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[#F5F0E8] hover:bg-[#F5F0E8]">
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">材料名称</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">单位</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">用料尺寸/米</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">门幅</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">单耗</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">单价(元)</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">金额(元)</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">备注</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {details.materials.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={9} className="text-center text-[#8A7E72] py-4">
                                  请选择品名以自动带出 BOM 主辅料
                                </TableCell>
                              </TableRow>
                            ) : (
                              details.materials.map((row) => (
                                <TableRow key={row.id} className="hover:bg-[#FAF7F2]">
                                  <TableCell className="min-w-[8rem]">
                                    <Input
                                      value={row.name}
                                      onChange={(e) => updateMaterialRow(row.id, { name: e.target.value })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="min-w-[5rem]">
                                    <Input
                                      value={row.unit}
                                      onChange={(e) => updateMaterialRow(row.id, { unit: e.target.value })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="min-w-[7rem]">
                                    <Input
                                      value={row.size}
                                      onChange={(e) => updateMaterialRow(row.id, { size: e.target.value })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="min-w-[5rem]">
                                    <Input
                                      value={row.width}
                                      onChange={(e) => updateMaterialRow(row.id, { width: e.target.value })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="min-w-[5rem]">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={row.dosage}
                                      onChange={(e) => updateMaterialRow(row.id, { dosage: parseFloat(e.target.value) || 0 })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="min-w-[5rem]">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={row.unit_price}
                                      onChange={(e) => updateMaterialRow(row.id, { unit_price: parseFloat(e.target.value) || 0 })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E] min-w-[5rem]">
                                    {formatMoney(row.amount)}
                                  </TableCell>
                                  <TableCell className="min-w-[6rem]">
                                    <Input
                                      value={row.remark}
                                      onChange={(e) => updateMaterialRow(row.id, { remark: e.target.value })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => removeMaterialRow(row.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* 分区B：加工费用区 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-[#3D2E1E]">
                          分区 B：加工费用区（内协+外协工序）
                        </h4>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 border-[#4A6A7F] text-[#4A6A7F] hover:bg-[#4A6A7F]/10"
                          onClick={addProcessRow}
                        >
                          <Plus className="mr-1 h-4 w-4" /> 新增行
                        </Button>
                      </div>
                      <div className="overflow-x-auto rounded-md border border-[#C4B5A5]">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[#F5F0E8] hover:bg-[#F5F0E8]">
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">工序名称</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">类型</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">计件/外协单价</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">单耗/次数</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">金额</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {details.processes.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-[#8A7E72] py-4">
                                  请选择品名以自动带出工艺路线工序
                                </TableCell>
                              </TableRow>
                            ) : (
                              details.processes.map((row) => (
                                <TableRow key={row.id} className="hover:bg-[#FAF7F2]">
                                  <TableCell className="min-w-[10rem]">
                                    <Input
                                      value={row.name}
                                      onChange={(e) => updateProcessRow(row.id, { name: e.target.value })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="min-w-[6rem]">
                                    <Select
                                      value={row.category}
                                      onValueChange={(v) => updateProcessRow(row.id, { category: v as 'internal' | 'outsourcing' })}
                                    >
                                      <SelectTrigger className="border-[#C4B5A5] bg-background">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="internal">内部</SelectItem>
                                        <SelectItem value="outsourcing">外协</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="min-w-[7rem]">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={row.unit_price}
                                      onChange={(e) => updateProcessRow(row.id, { unit_price: parseFloat(e.target.value) || 0 })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="min-w-[6rem]">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={row.dosage}
                                      onChange={(e) => updateProcessRow(row.id, { dosage: parseFloat(e.target.value) || 0 })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E] min-w-[5rem]">
                                    {formatMoney(row.amount)}
                                  </TableCell>
                                  <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => removeProcessRow(row.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* 分区C：包装与其它 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-[#3D2E1E]">
                          分区 C：包装与其它
                        </h4>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 border-[#4A6A7F] text-[#4A6A7F] hover:bg-[#4A6A7F]/10"
                          onClick={addPackagingRow}
                        >
                          <Plus className="mr-1 h-4 w-4" /> 新增行
                        </Button>
                      </div>
                      <div className="overflow-x-auto rounded-md border border-[#C4B5A5]">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-[#F5F0E8] hover:bg-[#F5F0E8]">
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">项目名称</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">单价</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">数量</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">金额</TableHead>
                              <TableHead className="whitespace-nowrap text-[#3D2E1E]">操作</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {details.packaging.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-[#8A7E72] py-4">
                                  可手动添加标签、纸箱、运费等临时费用
                                </TableCell>
                              </TableRow>
                            ) : (
                              details.packaging.map((row) => (
                                <TableRow key={row.id} className="hover:bg-[#FAF7F2]">
                                  <TableCell className="min-w-[12rem]">
                                    <Input
                                      value={row.name}
                                      onChange={(e) => updatePackagingRow(row.id, { name: e.target.value })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="min-w-[6rem]">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={row.unit_price}
                                      onChange={(e) => updatePackagingRow(row.id, { unit_price: parseFloat(e.target.value) || 0 })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="min-w-[5rem]">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={row.quantity}
                                      onChange={(e) => updatePackagingRow(row.id, { quantity: parseFloat(e.target.value) || 0 })}
                                      className="border-[#C4B5A5] bg-background"
                                    />
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E] min-w-[5rem]">
                                    {formatMoney(row.amount)}
                                  </TableCell>
                                  <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => removePackagingRow(row.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-[#C4B5A5] bg-[#FAF7F2]">
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm text-[#8A7E72]">报价全部费用小计</div>
                        <div className="text-2xl font-bold text-[#C47D5A]">
                          {formatMoney(form.total_cost)}
                        </div>
                      </div>
                      <div className="text-sm text-[#8A7E72]">
                        目标利润率 {(form.target_profit_rate * 100).toFixed(0)}% / 建议报价{" "}
                        <span className="font-semibold text-[#4A6A7F]">{formatMoney(form.suggested_price)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="border-[#C4B5A5] text-[#3D2E1E] hover:bg-[#EDE8E0]"
                    onClick={saveDraft}
                  >
                    保存草稿
                  </Button>
                  <Button
                    className="bg-[#4A6A7F] text-white hover:bg-[#3A586B]"
                    onClick={submitApproval}
                  >
                    <Send className="h-4 w-4 mr-2" /> 提交审批
                  </Button>
                </div>
              </div>
            </div>

          {/* 底部三大基础库联动展示 */}
          <BaseLibraryPanel
            selectedProduct={selectedProduct}
            selectedSku={selectedSku}
            currentBoms={currentBoms}
            selectedRoute={selectedRoute}
            materials={store.materials}
            materialSupplierPrices={store.materialSupplierPrices}
          />
        </div>
      );
    };
  }, []);

  // ---------- 详情视图 ----------
  function DetailView() {
    const q = getQuotation();
    if (!q) return <div className="text-[#8A7E72]">未找到报价单</div>;
    const product = store.products.find((p) => p.id === q.product_id);
    const route = product?.route_binding?.route_id
      ? store.processRoutes.find(
          (r) => r.id === product.route_binding?.route_id,
        )
      : undefined;

    const baseLibraryGroups = useMemo(() => {
      const groups: MultiBaseLibraryPanelProps["groups"] = [];
      const items = q.items?.length ? q.items : [];
      if (items.length === 0 && q.product_id) {
        const p = product;
        if (p) {
          const sku = p.skus?.find((s) => s.id === q.sku_id) || p.skus?.[0];
          if (sku) {
            groups.push({
              product: p,
              sku,
              boms: getProductBomsBySku(p, sku.id),
              route: p.route_binding?.route_id
                ? store.processRoutes.find(
                    (r) => r.id === p.route_binding?.route_id,
                  )
                : undefined,
            });
          }
        }
        return groups;
      }
      const seen = new Set<string>();
      items.forEach((item) => {
        const p = store.products.find((x) => x.id === item.product_id);
        if (!p) return;
        const sku = p.skus?.find((s) => s.id === item.sku_id) || p.skus?.[0];
        if (!sku) return;
        const key = `${p.id}-${sku.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        groups.push({
          product: p,
          sku,
          boms: getProductBomsBySku(p, sku.id),
          route: p.route_binding?.route_id
            ? store.processRoutes.find(
                (r) => r.id === p.route_binding?.route_id,
              )
            : undefined,
        });
      });
      return groups;
    }, [q, product, store.products, store.processRoutes]);

    const {
      paginatedItems: qCostItemsPaginated,
      currentPage: qCostItemsCurrentPage,
      pageSize: qCostItemsPageSize,
      totalPages: qCostItemsTotalPages,
      totalItems: qCostItemsTotalItems,
      setPage: setQCostItemsPage,
      setPageSize: setQCostItemsPageSize,
    } = usePagination(q.cost_items || []);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#C4B5A5] text-[#3D2E1E] hover:bg-[#EDE8E0]"
              onClick={() => handlePrint(q)}
            >
              <Printer className="h-4 w-4 mr-1" /> 打印/PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-[#C4B5A5] text-[#3D2E1E] hover:bg-[#EDE8E0]"
              onClick={() => exportQuotationToCSV(q)}
            >
              <Download className="h-4 w-4 mr-1" /> 导出Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-[#C4B5A5] text-[#3D2E1E] hover:bg-[#EDE8E0]"
              onClick={() => {
                const subject = `报价单 ${q.quotation_no}`;
                const productNames = q.product_name || (q.items || []).map((i) => i.product_name).join("、");
                const body = `您好，${q.customer_name}：\n附件为产品 ${productNames} 的报价单，总报价 ${formatMoney(q.suggested_price)}，请查收。`;
                window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              }}
            >
              <Mail className="h-4 w-4 mr-1" /> 发送邮件
            </Button>
            {q.status === "approved" &&
              !q.contract_no &&
              !q.sales_order_no && (
                <>
                  <Button
                    size="sm"
                    className="bg-[#C47D5A] text-white hover:bg-[#A86442]"
                    onClick={() => handleContract(q)}
                  >
                    <FileCheck className="h-4 w-4 mr-1" /> 转合同
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#4A6A7F] text-white hover:bg-[#3A5569]"
                    onClick={() => handleSalesOrder(q)}
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" /> 转销售订单
                  </Button>
                </>
              )}
          </div>
        </div>
        <Card className="border border-[#C4B5A5] bg-[#FAF7F2]">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg text-[#3D2E1E]">
                  报价单 {q.quotation_no}
                </CardTitle>
                <CardDescription className="text-[#8A7E72]">
                  创建人：{q.creator} | 创建时间：{formatDateTime(q.created_at)}
                </CardDescription>
              </div>
              <StatusBadge status={q.status} options={QUOTATION_STATUS} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="text-sm text-[#8A7E72]">客户</div>
                <div className="font-medium text-[#3D2E1E]">
                  {q.customer_name}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">币种</div>
                <div className="font-medium text-[#3D2E1E]">
                  {q.currency || "CNY"}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">产品</div>
                <div className="font-medium text-[#3D2E1E]">
                  {q.product_name || (q.items || []).map((i) => i.product_name).join(", ")}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">规格</div>
                <div className="font-medium text-[#3D2E1E]">
                  {q.product_spec || "-"}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">数量</div>
                <div className="font-medium text-[#3D2E1E]">
                  {q.quantity || (q.items || []).reduce((sum, i) => sum + i.quantity, 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">报价日期</div>
                <div className="font-medium text-[#3D2E1E]">
                  {q.quotation_date || "-"}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">预计交货日期</div>
                <div className="font-medium text-[#3D2E1E]">
                  {q.estimated_delivery_date || "-"}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">目标利润率</div>
                <div className="font-medium text-[#3D2E1E]">
                  {(q.target_profit_rate * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">面料损耗率</div>
                <div className="font-medium text-[#3D2E1E]">
                  {(q.fabric_loss_rate * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">批量系数</div>
                <div className="font-medium text-[#3D2E1E]">
                  {(q.batch_factor * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">总成本</div>
                <div className="font-medium text-[#3D2E1E]">
                  {formatMoney(q.total_cost)}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">建议报价</div>
                <div className="font-medium text-[#4A6A7F]">
                  {formatMoney(q.suggested_price)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 rounded-md border border-[#C4B5A5] bg-[#F5F0E8] p-4">
              <div>
                <div className="text-sm text-[#8A7E72]">预估利润</div>
                <div className="text-xl font-bold text-[#C47D5A]">
                  {formatMoney(q.estimated_profit)}
                </div>
              </div>
              <div>
                <div className="text-sm text-[#8A7E72]">实际利润率</div>
                <div className="text-xl font-bold text-[#3D2E1E]">
                  {(q.actual_profit_rate * 100).toFixed(2)}%
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium text-[#3D2E1E]">
                报价明细
              </h4>
              <div className="overflow-x-auto rounded-md border border-[#C4B5A5]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F5F0E8] hover:bg-transparent">
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">产品编码</TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">产品名称</TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">规格</TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">数量</TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">单价</TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">小计</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(q.items || []).map((item) => (
                      <TableRow key={item.id} className="hover:bg-[#FAF7F2]">
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">{item.product_code || item.sku || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">{item.product_name}</TableCell>
                        <TableCell className="whitespace-nowrap text-[#8A7E72]">{item.sku_specification || item.spec || item.specification || item.product_spec || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">{item.quantity}</TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">{formatMoney(item.unit_price)}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-[#3D2E1E]">{formatMoney(item.subtotal ?? item.amount ?? item.quantity * item.unit_price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium text-[#3D2E1E]">
                成本明细
              </h4>
              <div className="overflow-x-auto rounded-md border border-[#C4B5A5]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F5F0E8] hover:bg-transparent">
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        科目
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        自动计算值
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        手动调整值
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        最终值
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        是否手动调整
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        调整人/时间
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qCostItemsPaginated.map((item) => (
                      <TableRow
                        key={item.subject}
                        className="hover:bg-[#FAF7F2]"
                      >
                        <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                          {item.subject_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#8A7E72]">
                          {formatMoney(item.auto_value)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {item.manual_value !== null
                            ? formatMoney(item.manual_value)
                            : "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-[#3D2E1E]">
                          {formatMoney(item.final_value)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.is_manual ? (
                            <Badge className="bg-[#D4A84B] text-white">
                              是
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-[#EDE8E0] text-[#8A7E72]"
                            >
                              否
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-[#8A7E72]">
                          <div>{item.adjusted_by}</div>
                          <div>{formatDateTime(item.adjusted_at)}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination
                  currentPage={qCostItemsCurrentPage}
                  totalPages={qCostItemsTotalPages}
                  pageSize={qCostItemsPageSize}
                  totalItems={qCostItemsTotalItems}
                  onPageChange={setQCostItemsPage}
                  onPageSizeChange={setQCostItemsPageSize}
                />
              </div>
            </div>

            {q.cost_details && (
              <div className="space-y-4">
                <h4 className="mb-2 text-sm font-medium text-[#3D2E1E]">
                  纸质报价单明细
                </h4>
                {q.cost_details.materials.length > 0 && (
                  <div className="overflow-x-auto rounded-md border border-[#C4B5A5]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#F5F0E8] hover:bg-transparent">
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">材料名称</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">单位</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">用料尺寸/米</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">门幅</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">单耗</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">单价</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">金额</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">备注</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {q.cost_details.materials.map((row) => (
                          <TableRow key={row.id} className="hover:bg-[#FAF7F2]">
                            <TableCell className="whitespace-nowrap text-[#3D2E1E]">{row.name}</TableCell>
                            <TableCell className="whitespace-nowrap text-[#8A7E72]">{row.unit}</TableCell>
                            <TableCell className="whitespace-nowrap text-[#8A7E72]">{row.size || "-"}</TableCell>
                            <TableCell className="whitespace-nowrap text-[#8A7E72]">{row.width || "-"}</TableCell>
                            <TableCell className="whitespace-nowrap text-[#8A7E72]">{row.dosage}</TableCell>
                            <TableCell className="whitespace-nowrap text-[#8A7E72]">{formatMoney(row.unit_price)}</TableCell>
                            <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">{formatMoney(row.amount)}</TableCell>
                            <TableCell className="whitespace-nowrap text-[#8A7E72]">{row.remark || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {q.cost_details.processes.length > 0 && (
                  <div className="overflow-x-auto rounded-md border border-[#C4B5A5]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#F5F0E8] hover:bg-transparent">
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">工序名称</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">类型</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">单价</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">单耗/次数</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">金额</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {q.cost_details.processes.map((row) => (
                          <TableRow key={row.id} className="hover:bg-[#FAF7F2]">
                            <TableCell className="whitespace-nowrap text-[#3D2E1E]">{row.name}</TableCell>
                            <TableCell className="whitespace-nowrap text-[#8A7E72]">{row.category === "outsourcing" ? "外协" : "内部"}</TableCell>
                            <TableCell className="whitespace-nowrap text-[#8A7E72]">{formatMoney(row.unit_price)}</TableCell>
                            <TableCell className="whitespace-nowrap text-[#8A7E72]">{row.dosage}</TableCell>
                            <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">{formatMoney(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {q.cost_details.packaging.length > 0 && (
                  <div className="overflow-x-auto rounded-md border border-[#C4B5A5]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#F5F0E8] hover:bg-transparent">
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">项目名称</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">单价</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">数量</TableHead>
                          <TableHead className="whitespace-nowrap text-[#3D2E1E]">金额</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {q.cost_details.packaging.map((row) => (
                          <TableRow key={row.id} className="hover:bg-[#FAF7F2]">
                            <TableCell className="whitespace-nowrap text-[#3D2E1E]">{row.name}</TableCell>
                            <TableCell className="whitespace-nowrap text-[#8A7E72]">{formatMoney(row.unit_price)}</TableCell>
                            <TableCell className="whitespace-nowrap text-[#8A7E72]">{row.quantity}</TableCell>
                            <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">{formatMoney(row.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex justify-end text-base font-semibold text-[#3D2E1E]">
                  报价全部费用小计：{formatMoney(q.total_cost)}
                </div>
              </div>
            )}

            {((q.approval_logs || []).length > 0) && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-[#3D2E1E]">
                  审批记录
                </h4>
                <div className="space-y-2">
                  {q.approval_logs.map((log, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-[#C4B5A5] bg-[#F5F0E8] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.result === "approved" ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium text-[#3D2E1E]">
                            {log.result === "approved" ? "审批通过" : "驳回"}
                          </span>
                        </div>
                        <span className="text-xs text-[#8A7E72]">
                          {formatDateTime(log.time)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-[#8A7E72]">
                        审批人：{log.approver}
                      </div>
                      <div className="mt-1 text-sm text-[#3D2E1E]">
                        {log.opinion}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <MultiBaseLibraryPanel
                groups={baseLibraryGroups}
                materials={store.materials}
                materialSupplierPrices={store.materialSupplierPrices}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- 审批视图 ----------
  function ApprovalView() {
    const pendingList = store.quotations.filter((q) => q.status === "pending");
    return (
      <div className="space-y-4">
        <Card className="border border-[#C4B5A5] bg-[#FAF7F2]">
          <CardHeader>
            <CardTitle className="text-base text-[#3D2E1E]">
              待审批报价单
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#C4B5A5] hover:bg-transparent">
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      报价单号
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      客户
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      产品
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      预计交货日期
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      总成本
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      建议报价
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      利润率
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      创建人
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingList.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-[#8A7E72] py-8"
                      >
                        暂无待审批报价单
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingList.map((q) => (
                      <TableRow
                        key={q.id}
                        className="border-b border-[#EDE8E0] hover:bg-[#F5F0E8]"
                      >
                        <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                          {q.quotation_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {q.customer_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {q.product_name || (q.items || []).map((i) => i.product_name).join(", ")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {q.estimated_delivery_date || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {formatMoney(q.total_cost)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {formatMoney(q.suggested_price)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {(q.actual_profit_rate * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#8A7E72]">
                          {q.creator}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(q.id)}
                            >
                              <Eye className="h-4 w-4 text-[#4A6A7F]" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 text-white hover:bg-green-700"
                              onClick={() => openApproval("approved", q)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" /> 通过
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500 text-red-600 hover:bg-red-50"
                              onClick={() => openApproval("rejected", q)}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> 驳回
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
      </div>
    );
  }

  // ---------- 历史视图 ----------
  function HistoryView() {
    const compareList = store.quotations.filter((q) =>
      historyCompareIds.includes(q.id),
    );

    const {
      paginatedItems: compareListPaginated,
      currentPage: compareListCurrentPage,
      pageSize: compareListPageSize,
      totalPages: compareListTotalPages,
      totalItems: compareListTotalItems,
      setPage: setCompareListPage,
      setPageSize: setCompareListPageSize,
    } = usePagination(compareList);

    return (
      <div className="space-y-4">
        <Card className="border border-[#C4B5A5] bg-[#FAF7F2]">
          <CardHeader>
            <CardTitle className="text-base text-[#3D2E1E]">
              历史报价查询
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#C4B5A5] hover:bg-transparent">
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      选择对比
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      报价单号
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      客户
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      产品
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      预计交货日期
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      总成本
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      建议报价
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      利润率
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      状态
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      创建时间
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {store.quotations.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="text-center text-[#8A7E72] py-8"
                      >
                        暂无历史报价
                      </TableCell>
                    </TableRow>
                  ) : (
                    store.quotations.map((q) => (
                      <TableRow
                        key={q.id}
                        className="border-b border-[#EDE8E0] hover:bg-[#F5F0E8]"
                      >
                        <TableCell className="whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={historyCompareIds.includes(q.id)}
                            onChange={(e) => {
                              setHistoryCompareIds((prev) =>
                                e.target.checked
                                  ? [...prev, q.id]
                                  : prev.filter((id) => id !== q.id),
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                          {q.quotation_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {q.customer_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {q.product_name || (q.items || []).map((i) => i.product_name).join(", ")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {q.estimated_delivery_date || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {formatMoney(q.total_cost)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {formatMoney(q.suggested_price)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#3D2E1E]">
                          {(q.actual_profit_rate * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <StatusBadge
                            status={q.status}
                            options={QUOTATION_STATUS}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[#8A7E72]">
                          {formatDateOnly(q.created_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleView(q.id)}
                          >
                            <Eye className="h-4 w-4 text-[#4A6A7F]" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        {compareList.length > 0 && (
          <Card className="border border-[#C4B5A5] bg-[#FAF7F2]">
            <CardHeader>
              <CardTitle className="text-base text-[#3D2E1E]">
                报价对比
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[#C4B5A5] hover:bg-transparent">
                      <TableHead className="whitespace-nowrap text-[#3D2E1E]">
                        对比项
                      </TableHead>
                      {compareList.map((q) => (
                        <TableHead
                          key={q.id}
                          className="whitespace-nowrap text-[#3D2E1E]"
                        >
                          {q.quotation_no}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="hover:bg-[#F5F0E8]">
                      <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                        客户
                      </TableCell>
                      {compareListPaginated.map((q) => (
                        <TableCell
                          key={q.id}
                          className="whitespace-nowrap text-[#3D2E1E]"
                        >
                          {q.customer_name}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="hover:bg-[#F5F0E8]">
                      <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                        产品
                      </TableCell>
                      {compareList.map((q) => (
                        <TableCell
                          key={q.id}
                          className="whitespace-nowrap text-[#3D2E1E]"
                        >
                          {q.product_name || (q.items || []).map((i) => i.product_name).join(", ")}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="hover:bg-[#F5F0E8]">
                      <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                        订货数量
                      </TableCell>
                      {compareList.map((q) => (
                        <TableCell
                          key={q.id}
                          className="whitespace-nowrap text-[#3D2E1E]"
                        >
                          {q.quantity || (q.items || []).reduce((sum, i) => sum + i.quantity, 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="hover:bg-[#F5F0E8]">
                      <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                        预计交货日期
                      </TableCell>
                      {compareList.map((q) => (
                        <TableCell
                          key={q.id}
                          className="whitespace-nowrap text-[#3D2E1E]"
                        >
                          {q.estimated_delivery_date || "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="hover:bg-[#F5F0E8]">
                      <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                        总成本
                      </TableCell>
                      {compareList.map((q) => (
                        <TableCell
                          key={q.id}
                          className="whitespace-nowrap text-[#3D2E1E]"
                        >
                          {formatMoney(q.total_cost)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="hover:bg-[#F5F0E8]">
                      <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                        建议报价
                      </TableCell>
                      {compareList.map((q) => (
                        <TableCell
                          key={q.id}
                          className="whitespace-nowrap text-[#3D2E1E]"
                        >
                          {formatMoney(q.suggested_price)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="hover:bg-[#F5F0E8]">
                      <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                        预估利润
                      </TableCell>
                      {compareList.map((q) => (
                        <TableCell
                          key={q.id}
                          className="whitespace-nowrap text-[#3D2E1E]"
                        >
                          {formatMoney(q.estimated_profit)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="hover:bg-[#F5F0E8]">
                      <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                        利润率
                      </TableCell>
                      {compareList.map((q) => (
                        <TableCell
                          key={q.id}
                          className="whitespace-nowrap text-[#3D2E1E]"
                        >
                          {(q.actual_profit_rate * 100).toFixed(2)}%
                        </TableCell>
                      ))}
                    </TableRow>
                    {(
                      [
                        "fabric",
                        "accessory",
                        "processing",
                        "packaging",
                        "other",
                      ] as const
                    ).map((subject) => (
                      <TableRow key={subject} className="hover:bg-[#F5F0E8]">
                        <TableCell className="whitespace-nowrap font-medium text-[#3D2E1E]">
                          {SUBJECT_META[subject].name}
                        </TableCell>
                        {compareList.map((q) => {
                          const item = (q.cost_items || []).find(
                            (c) => c.subject === subject,
                          );
                          return (
                            <TableCell
                              key={q.id}
                              className="whitespace-nowrap text-[#3D2E1E]"
                            >
                              {item ? formatMoney(item.final_value) : "-"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination
                  currentPage={compareListCurrentPage}
                  totalPages={compareListTotalPages}
                  pageSize={compareListPageSize}
                  totalItems={compareListTotalItems}
                  onPageChange={setCompareListPage}
                  onPageSizeChange={setCompareListPageSize}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ---------- 打印弹窗 ----------
  function PrintDialog() {
    const q = getQuotation();
    if (!q) return null;

    const {
      paginatedItems: qCostItemsPaginated,
      currentPage: qCostItemsCurrentPage,
      pageSize: qCostItemsPageSize,
      totalPages: qCostItemsTotalPages,
      totalItems: qCostItemsTotalItems,
      setPage: setQCostItemsPage,
      setPageSize: setQCostItemsPageSize,
    } = usePagination(q.cost_items || []);

    return (
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl bg-[#FAF7F2] border-[#C4B5A5]">
          <DialogHeader>
            <DialogTitle className="text-[#3D2E1E]">报价单打印预览</DialogTitle>
          </DialogHeader>
          <div id="quotation-print" className="space-y-4 p-4 text-[#3D2E1E]">
            <div className="text-center">
              <h2 className="text-2xl font-bold">浦江家纺智造管理平台</h2>
              <p className="text-[#8A7E72]">报价单</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>报价单号：{q.quotation_no}</div>
              <div>合同编号：{q.contract_no || "-"}</div>
              <div>客户：{q.customer_name}</div>
              <div>币种：{q.currency || "CNY"}</div>
              <div>产品：{q.product_name || (q.items || []).map((i) => i.product_name).join(", ")}</div>
              <div>订货数量：{q.quantity || (q.items || []).reduce((sum, i) => sum + i.quantity, 0)}</div>
              <div>预计交货日期：{q.estimated_delivery_date || "-"}</div>
              <div>目标利润率：{(q.target_profit_rate * 100).toFixed(0)}%</div>
              <div>创建时间：{formatDateTime(q.created_at)}</div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>成本科目</TableHead>
                  <TableHead>金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qCostItemsPaginated.map((item) => (
                  <TableRow key={item.subject}>
                    <TableCell>{item.subject_name}</TableCell>
                    <TableCell>{formatMoney(item.final_value)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-bold">总成本</TableCell>
                  <TableCell className="font-bold">
                    {formatMoney(q.total_cost)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">建议报价</TableCell>
                  <TableCell className="font-bold">
                    {formatMoney(q.suggested_price)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">预估利润</TableCell>
                  <TableCell className="font-bold">
                    {formatMoney(q.estimated_profit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Pagination
              currentPage={qCostItemsCurrentPage}
              totalPages={qCostItemsTotalPages}
              pageSize={qCostItemsPageSize}
              totalItems={qCostItemsTotalItems}
              onPageChange={setQCostItemsPage}
              onPageSizeChange={setQCostItemsPageSize}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="border-[#C4B5A5]"
              onClick={() => setPrintOpen(false)}
            >
              关闭
            </Button>
            <Button
              className="bg-[#4A6A7F] text-white"
              onClick={() => {
                const printContents =
                  document.getElementById("quotation-print")?.innerHTML || "";
                const w = window.open("", "_blank");
                if (w) {
                  w.document.write(`
                    <html><head><title>报价单 ${q.quotation_no}</title>
                    <style>body{font-family:sans-serif;padding:24px;color:#3D2E1E}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #C4B5A5;padding:8px;text-align:left}th{background:#F5F0E8}</style>
                    </head><body>${printContents}</body></html>
                  `);
                  w.document.close();
                  w.focus();
                  w.print();
                  w.close();
                }
              }}
            >
              <Printer className="h-4 w-4 mr-2" /> 打印
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ---------- 合同草稿弹窗 ----------
  function ContractDialog() {
    if (!contractQuotation) return null;
    const q = contractQuotation;
    return (
      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl bg-[#FAF7F2] border-[#C4B5A5]">
          <DialogHeader>
            <DialogTitle className="text-[#3D2E1E]">合同草稿</DialogTitle>
          </DialogHeader>
          <div
            id="contract-print"
            className="space-y-4 p-4 text-[#3D2E1E] leading-relaxed"
          >
            <h2 className="text-center text-xl font-bold">
              产品购销合同（草稿）
            </h2>
            <p>
              <strong>甲方（供方）：</strong>浦江家纺智造有限公司
            </p>
            <p>
              <strong>乙方（需方）：</strong>
              {q.customer_name}
            </p>
            <p>
              经双方友好协商，就乙方向甲方采购 {(q.items || []).map((i) => i.product_name).join("、") || q.product_name}{" "}
              事宜达成如下条款：
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>产品名称：{(q.items || []).map((i) => i.product_name).join("、") || q.product_name}</li>
              <li>产品款号：{(q.items || []).map((i) => i.product_code).join("、") || q.product_code}</li>
              <li>订货数量：{q.quantity || (q.items || []).reduce((sum, i) => sum + i.quantity, 0)} 件</li>
              <li>合同总金额：{formatMoney(q.suggested_price)}</li>
              <li>
                交货期：
                {q.estimated_delivery_date || "按双方后续确认的交货计划执行"}
              </li>
              <li>付款方式：按双方确认的信用额度与账期执行</li>
            </ul>
            <p>
              本合同为报价单 {q.quotation_no}{" "}
              一键转换生成的草稿，具体条款以正式签署版本为准。
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="border-[#C4B5A5]"
              onClick={() => setContractOpen(false)}
            >
              关闭
            </Button>
            <Button
              className="bg-[#4A6A7F] text-white"
              onClick={() => {
                const printContents =
                  document.getElementById("contract-print")?.innerHTML || "";
                const w = window.open("", "_blank");
                if (w) {
                  w.document.write(`
                    <html><head><title>合同草稿 ${q.quotation_no}</title>
                    <style>body{font-family:sans-serif;padding:24px;color:#3D2E1E}ul{margin-left:20px}</style>
                    </head><body>${printContents}</body></html>
                  `);
                  w.document.close();
                  w.focus();
                  w.print();
                  w.close();
                }
              }}
            >
              <Printer className="h-4 w-4 mr-2" /> 打印合同
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="智能报价管理"
        description="基于产品库、物料库、工艺库的智能报价与审批"
        onAdd={() => {
          resetForm();
          setActiveTab("create");
        }}
      />

      <ControlledTabs
        modulePath="/quotation"
        defaultTab="list"
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="bg-[#EDE8E0]">
          <TabsTrigger
            value="list"
            className="gap-2 data-[state=active]:bg-[#4A6A7F] data-[state=active]:text-white"
          >
            <FileText className="h-4 w-4" /> 报价单列表
          </TabsTrigger>
          <TabsTrigger
            value="create"
            className="gap-2 data-[state=active]:bg-[#4A6A7F] data-[state=active]:text-white"
          >
            <Plus className="h-4 w-4" /> 新建报价
          </TabsTrigger>
          <TabsTrigger
            value="approval"
            className="gap-2 data-[state=active]:bg-[#4A6A7F] data-[state=active]:text-white"
          >
            <CheckCircle className="h-4 w-4" /> 报价审批
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="gap-2 data-[state=active]:bg-[#4A6A7F] data-[state=active]:text-white"
          >
            <History className="h-4 w-4" /> 历史报价
          </TabsTrigger>
          <TabsTrigger value="detail" className="hidden" />
        </TabsList>
        <div className="mt-4">
          {activeTab === "list" && <ListView />}
          {activeTab === "create" && <CreateEditView />}
          {activeTab === "detail" && <DetailView />}
          {activeTab === "approval" && <ApprovalView />}
          {activeTab === "history" && <HistoryView />}
        </div>
      </ControlledTabs>

      {/* 审批弹窗 */}
      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-[#FAF7F2] border-[#C4B5A5]">
          <DialogHeader>
            <DialogTitle className="text-[#3D2E1E]">
              {approvalAction === "approved" ? "审批通过" : "驳回报价单"}
            </DialogTitle>
          </DialogHeader>
          {detailId && (
            <div className="rounded-md border border-[#C4B5A5] bg-[#F5F0E8] p-3 text-sm space-y-2">
              {(() => {
                const q = store.quotations.find((x) => x.id === detailId);
                if (!q) return null;
                return (
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground whitespace-nowrap">
                        报价单号
                      </span>
                      <span className="font-medium text-right">
                        {q.quotation_no}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground whitespace-nowrap">
                        合同编号
                      </span>
                      <span className="font-medium text-right">
                        {q.contract_no || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground whitespace-nowrap">
                        客户
                      </span>
                      <span className="font-medium text-right">
                        {q.customer_name}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground whitespace-nowrap">
                        总成本
                      </span>
                      <span className="font-medium text-right">
                        {formatMoney(q.total_cost)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground whitespace-nowrap">
                        建议售价
                      </span>
                      <span className="font-medium text-right">
                        {formatMoney(q.suggested_price)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground whitespace-nowrap">
                        状态
                      </span>
                      <span className="font-medium text-right">
                        {QUOTATION_STATUS.find((s) => s.value === q.status)
                          ?.label || q.status}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            请确认是否{approvalAction === "approved" ? "审批通过" : "驳回"}
            该报价单。确认后状态将更新，且审批意见将被记录。
          </p>
          {approvalAction === "approved" && detailId && (
            <div className="space-y-3 py-2">
              {(() => {
                const q = store.quotations.find((x) => x.id === detailId);
                const totalCost = q?.total_cost || 0;
                return (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[#3D2E1E]">目标利润率</Label>
                      <Select
                        value={String(approvalProfitRate)}
                        onValueChange={(v) => setApprovalProfitRate(parseFloat(v))}
                      >
                        <SelectTrigger className="border-[#C4B5A5] bg-[#F5F0E8]">
                          <SelectValue placeholder="选择利润率" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROFIT_RATES.map((r) => (
                            <SelectItem key={r.value} value={String(r.value)}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-between gap-4 rounded-md border border-[#C4B5A5] bg-[#F5F0E8] p-3">
                      <span className="text-muted-foreground whitespace-nowrap">审批后建议报价</span>
                      <span className="font-semibold text-right text-[#4A6A7F]">
                        {formatMoney(Math.round(totalCost * (1 + approvalProfitRate) * 100) / 100)}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          <div className="space-y-3 py-2">
            <Label className="text-[#3D2E1E]">审批意见</Label>
            <Textarea
              value={approvalOpinion}
              onChange={(e) => setApprovalOpinion(e.target.value)}
              placeholder="请输入审批意见"
              className="min-h-[100px] border-[#C4B5A5] bg-[#F5F0E8]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="border-[#C4B5A5]"
              onClick={() => setApprovalOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className={
                approvalAction === "approved"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-red-600 text-white hover:bg-red-700"
              }
              onClick={() => confirmApproval()}
            >
              {approvalAction === "approved" ? "确认通过" : "确认驳回"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PrintDialog />
      <ContractDialog />
    </div>
  );
}

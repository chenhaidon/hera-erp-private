import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { FileUpload } from "@/components/common/FileUpload";
import { nanoid } from "@/lib/utils";
import { supabase } from "@/db/supabase";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  HeadingLevel,
} from "docx";
import { Download, FileDown } from "lucide-react";
import {
  Plus,
  Search,
  Receipt,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Eye,
  ArrowRight,
  Upload,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

type TaxRefundStatus =
  | "pending_collection"
  | "pending_check"
  | "pending_self_check"
  | "pending_first_audit"
  | "pending_second_audit"
  | "pending_filing"
  | "pending_declaration"
  | "declared"
  | "received"
  | "archived";

interface AuditRecord {
  round: "self_check" | "first_audit" | "second_audit";
  auditor: string;
  audit_time: string;
  status: "pending" | "passed" | "rejected";
  opinion?: string;
  error_record?: string;
}

interface CheckRecord {
  level: 1 | 2 | 3;
  level_label: string;
  result: "passed" | "partial" | "failed";
  error_details?: string[];
  check_time: string;
}

interface DataConsistencyItem {
  field: string;
  customs: string;
  invoice: string;
  contract: string;
  consistent: boolean;
}

interface DeclarationRecord {
  declare_time: string;
  status: "declared" | "received";
  received_time?: string;
  received_amount?: number;
}

interface FilingDocument {
  type: string;
  urls: string[];
  upload_time: string;
  uploader: string;
}

interface TaxRefundBusiness {
  id: string;
  business_no: string;
  sales_order_no: string;
  customs_declaration_no: string;
  export_date: string;
  export_amount: number;
  refund_amount?: number;
  status: TaxRefundStatus;
  completeness_score?: number;
  documents?: Record<string, string[]>;
  audit_records?: AuditRecord[];
  check_records?: CheckRecord[];
  data_consistency?: DataConsistencyItem[];
  declaration?: DeclarationRecord;
  filing_documents?: Record<string, FilingDocument>;
  filing_directory_generated?: boolean;
  filing_completed_time?: string;
  created_at: string;
  created_by: string;
}

type WarningType =
  | "document_missing"
  | "data_inconsistency"
  | "time_overdue"
  | "filing_overdue"
  | "flow_broken"
  | "rate_abnormal";
type WarningLevel = "high" | "medium" | "low";

type ActionType =
  | "collect"
  | "check"
  | "self_check"
  | "first_audit"
  | "second_audit"
  | "declare"
  | "receive"
  | "generate_directory"
  | "archive";

interface RiskWarning {
  id: string;
  warning_no: string;
  business_no: string;
  warning_type: WarningType;
  warning_level: WarningLevel;
  trigger_time: string;
  processing_status: "pending" | "processed";
}

const statusMap: Record<
  TaxRefundStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending_collection: { label: "待采集", variant: "secondary" },
  pending_check: { label: "待检查", variant: "secondary" },
  pending_self_check: { label: "待自查", variant: "secondary" },
  pending_first_audit: { label: "待初审", variant: "secondary" },
  pending_second_audit: { label: "待复审", variant: "secondary" },
  pending_filing: { label: "待备案", variant: "secondary" },
  pending_declaration: { label: "待申报", variant: "default" },
  declared: { label: "已申报", variant: "default" },
  received: { label: "已到账", variant: "default" },
  archived: { label: "已归档", variant: "outline" },
};

const warningTypeMap: Record<WarningType, string> = {
  document_missing: "单证缺失",
  data_inconsistency: "数据不一致",
  time_overdue: "时间逾期",
  filing_overdue: "备案逾期",
  flow_broken: "四流断链",
  rate_abnormal: "退税率异常",
};

const warningLevelMap: Record<
  WarningLevel,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  high: { label: "高", variant: "destructive" },
  medium: { label: "中", variant: "secondary" },
  low: { label: "低", variant: "outline" },
};

const documentList = [
  { name: "出口合同", required: true },
  { name: "购货合同", required: true },
  { name: "海运提单/运单", required: true },
  { name: "委托报关协议", required: true },
  { name: "出口发票", required: true },
  { name: "增值税进项发票", required: true },
  { name: "银行收汇水单", required: true },
  { name: "出口货物备案单证目录", required: false },
];

const flowSteps = [
  { key: "pending_collection", label: "待采集", icon: Upload },
  { key: "pending_check", label: "待检查", icon: FileCheck },
  { key: "pending_self_check", label: "待自查", icon: Eye },
  { key: "pending_first_audit", label: "待初审", icon: CheckCircle2 },
  { key: "pending_second_audit", label: "待复审", icon: CheckCircle2 },
  { key: "pending_declaration", label: "待申报", icon: ArrowRight },
  { key: "declared", label: "已申报", icon: CheckCircle2 },
  { key: "received", label: "已到账", icon: Receipt },
  { key: "archived", label: "已归档", icon: Receipt },
];

const sampleFullDocuments: Record<string, string[]> = {
  出口合同: ["https://example.com/contract.pdf"],
  购货合同: ["https://example.com/purchase.pdf"],
  "海运提单/运单": ["https://example.com/bl.pdf"],
  委托报关协议: ["https://example.com/customs.pdf"],
  出口发票: ["https://example.com/invoice.pdf"],
  增值税进项发票: ["https://example.com/vat.pdf"],
  银行收汇水单: ["https://example.com/receipt.pdf"],
};

const sampleWarnings: RiskWarning[] = [
  {
    id: "1",
    warning_no: "RW20260801001",
    business_no: "TR20260801002",
    warning_type: "document_missing",
    warning_level: "high",
    trigger_time: "2026-08-01 09:30",
    processing_status: "pending",
  },
  {
    id: "2",
    warning_no: "RW20260801002",
    business_no: "TR20260801003",
    warning_type: "data_inconsistency",
    warning_level: "high",
    trigger_time: "2026-08-01 10:15",
    processing_status: "pending",
  },
  {
    id: "3",
    warning_no: "RW20260801003",
    business_no: "TR20260801004",
    warning_type: "filing_overdue",
    warning_level: "medium",
    trigger_time: "2026-07-28 14:00",
    processing_status: "pending",
  },
];

function formatMoney(n?: number) {
  if (n === undefined || n === null) return "-";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(n);
}

function FlowStepper({ status }: { status: TaxRefundStatus }) {
  const activeIndex = flowSteps.findIndex((s) => s.key === status);
  const currentIndex = activeIndex === -1 ? 0 : activeIndex;
  return (
    <div className="flex flex-wrap items-start justify-center gap-y-2 py-2">
      {flowSteps.map((step, idx) => {
        const Icon = step.icon;
        const isCompleted = idx < currentIndex;
        const isActive = idx === currentIndex;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1 min-w-[52px] md:min-w-[64px]">
              <div
                className={`flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCompleted
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted-foreground/30 bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </div>
              <span
                className={`text-[10px] md:text-xs whitespace-nowrap ${isActive ? "font-medium text-primary" : isCompleted ? "text-primary" : "text-muted-foreground"}`}
              >
                {step.label}
              </span>
            </div>
            {idx < flowSteps.length - 1 && (
              <div
                className={`w-4 md:w-8 h-0.5 mx-0.5 mt-3.5 md:mt-4 shrink-0 ${idx < currentIndex ? "bg-primary" : "bg-muted-foreground/20"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function computeCompletenessScore(docs?: Record<string, string[]>) {
  const required = documentList.filter((d) => d.required);
  if (!required.length) return 0;
  const uploaded = required.filter(
    (d) => (docs?.[d.name] ?? []).length > 0,
  ).length;
  return Math.round((uploaded / required.length) * 100);
}

export function TaxRefundContent() {
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [businesses, setBusinesses] = useState<TaxRefundBusiness[]>([
    {
      id: "1",
      business_no: "TR20260801001",
      sales_order_no: "SO20260801001",
      customs_declaration_no: "CD20260801001",
      export_date: "2026-08-01",
      export_amount: 50000,
      refund_amount: 6500,
      status: "pending_collection",
      created_at: "2026-08-01 09:00",
      created_by: "退税专员",
    },
    {
      id: "2",
      business_no: "TR20260801002",
      sales_order_no: "SO20260801002",
      customs_declaration_no: "CD20260801002",
      export_date: "2026-07-28",
      export_amount: 32000,
      refund_amount: 4160,
      status: "pending_check",
      created_at: "2026-07-28 10:00",
      created_by: "退税专员",
    },
    {
      id: "3",
      business_no: "TR20260801003",
      sales_order_no: "SO20260801003",
      customs_declaration_no: "CD20260801003",
      export_date: "2026-07-25",
      export_amount: 88000,
      refund_amount: 11440,
      status: "pending_self_check",
      completeness_score: 100,
      documents: { ...sampleFullDocuments },
      created_at: "2026-07-25 11:00",
      created_by: "退税专员",
    },
    {
      id: "4",
      business_no: "TR20260801004",
      sales_order_no: "SO20260801004",
      customs_declaration_no: "CD20260801004",
      export_date: "2026-07-20",
      export_amount: 120000,
      refund_amount: 15600,
      status: "declared",
      documents: { ...sampleFullDocuments },
      declaration: { declare_time: "2026-07-20 09:00", status: "declared" },
      created_at: "2026-07-20 09:00",
      created_by: "退税专员",
    },
    {
      id: "5",
      business_no: "TR20260801005",
      sales_order_no: "SO20260801005",
      customs_declaration_no: "CD20260801005",
      export_date: "2026-07-18",
      export_amount: 56000,
      refund_amount: 7280,
      status: "pending_first_audit",
      completeness_score: 100,
      documents: { ...sampleFullDocuments },
      created_at: "2026-07-18 11:00",
      created_by: "退税专员",
    },
  ]);
  const [warnings, setWarnings] = useState<RiskWarning[]>(sampleWarnings);
  const [keyword, setKeyword] = useState("");
  const [riskKeyword, setRiskKeyword] = useState("");
  const [riskFilterType, setRiskFilterType] = useState<WarningType | "all">(
    "all",
  );
  const [riskFilterLevel, setRiskFilterLevel] = useState<WarningLevel | "all">(
    "all",
  );
  const [riskFilterStatus, setRiskFilterStatus] = useState<
    "all" | "pending" | "processed"
  >("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [previewBusiness, setPreviewBusiness] =
    useState<TaxRefundBusiness | null>(null);
  const [uploadBusiness, setUploadBusiness] =
    useState<TaxRefundBusiness | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<{
    business: TaxRefundBusiness;
    action: ActionType;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [form, setForm] = useState({
    sales_order_no: "",
    customs_declaration_no: "",
    export_date: "",
    export_amount: "",
    refund_amount: "",
  });

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return businesses
      .slice()
      .sort((a, b) => b.business_no.localeCompare(a.business_no))
      .filter((b) => {
        if (!k) return true;
        return (
          b.business_no.toLowerCase().includes(k) ||
          b.sales_order_no.toLowerCase().includes(k) ||
          b.customs_declaration_no.toLowerCase().includes(k)
        );
      });
  }, [businesses, keyword]);

  const pendingCheckBusinesses = useMemo(
    () => businesses.filter((b) => b.status === "pending_check"),
    [businesses],
  );
  const pendingDeclarationBusinesses = useMemo(
    () => businesses.filter((b) => b.status === "pending_declaration"),
    [businesses],
  );
  const pendingFilingBusinesses = useMemo(
    () => businesses.filter((b) => b.status === "pending_filing"),
    [businesses],
  );
  const declaredBusinesses = useMemo(
    () => businesses.filter((b) => b.status === "declared"),
    [businesses],
  );
  const archivedBusinesses = useMemo(
    () => businesses.filter((b) => b.status === "archived"),
    [businesses],
  );
  const filingBusinesses = useMemo(
    () =>
      businesses.filter(
        (b) => b.status === "declared" || b.status === "received",
      ),
    [businesses],
  );
  const filteredWarnings = useMemo(() => {
    const k = riskKeyword.trim().toLowerCase();
    return warnings
      .filter((w) => {
        if (k && !w.business_no.toLowerCase().includes(k)) return false;
        if (riskFilterType !== "all" && w.warning_type !== riskFilterType)
          return false;
        if (riskFilterLevel !== "all" && w.warning_level !== riskFilterLevel)
          return false;
        if (
          riskFilterStatus !== "all" &&
          w.processing_status !== riskFilterStatus
        )
          return false;
        return true;
      })
      .sort((a, b) => b.trigger_time.localeCompare(a.trigger_time));
  }, [
    warnings,
    riskKeyword,
    riskFilterType,
    riskFilterLevel,
    riskFilterStatus,
  ]);

  function updateBusiness(id: string, patch: Partial<TaxRefundBusiness>) {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  }

  function handleDocsChange(
    b: TaxRefundBusiness,
    docName: string,
    urls: string[],
  ) {
    const prevUrls = b.documents?.[docName] ?? [];
    const added = urls.filter((url) => !prevUrls.includes(url));
    const nextDocs: Record<string, string[]> = { ...(b.documents || {}) };
    nextDocs[docName] = urls;
    const nextBusiness = {
      ...b,
      documents: nextDocs,
      completeness_score: computeCompletenessScore(nextDocs),
    };
    updateBusiness(b.id, {
      documents: nextDocs,
      completeness_score: computeCompletenessScore(nextDocs),
    });
    syncDocumentMissingWarnings(nextBusiness);
    if (isOcrDocType(docName)) {
      added.forEach((url) => {
        if (isPreviewImage(url))
          recognizeAndBackfill(nextBusiness, docName, url);
      });
    }
  }

  function isOcrDocType(docName: string) {
    return /报关|发票|invoice|customs/i.test(docName);
  }

  function extractCustomsDeclarationNo(text: string) {
    const match = text.match(/\b(\d{18})\b/);
    return match?.[1];
  }

  function extractDate(text: string) {
    const m = text.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
    if (m) {
      return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    }
    return undefined;
  }

  function extractAmount(text: string) {
    const regex =
      /(?:人民币|RMB|USD|美元|金额|合计|Total|小写|¥|￥|\$)\s*[:：]?\s*([\d,]+\.?\d{0,2})/gi;
    let max = 0;
    for (const m of text.matchAll(regex)) {
      const n = Number(m[1].replace(/,/g, ""));
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return max > 0 ? max : undefined;
  }

  function extractInvoiceNo(text: string) {
    const m = text.match(/\b(\d{8,20})\b/);
    return m?.[1];
  }

  async function recognizeAndBackfill(
    b: TaxRefundBusiness,
    docName: string,
    url: string,
  ) {
    try {
      const { data, error } = await supabase.functions.invoke("accurate-ocr", {
        body: { url, language_type: "CHN_ENG" },
      });
      if (error) {
        const errorMsg = await error?.context?.text();
        console.error("OCR error:", errorMsg || error.message);
        return;
      }
      if (data.error_code !== 0) {
        toast.error(`OCR 识别失败：${data.error_msg}`);
        return;
      }
      const text = ((data.words_result || []) as Array<{ words: string }>)
        .map((w) => w.words)
        .join("\n");
      if (!text) return;
      const patch: Partial<TaxRefundBusiness> = {};
      if (/报关|customs/i.test(docName)) {
        const customsNo = extractCustomsDeclarationNo(text);
        const exportDate = extractDate(text);
        const amount = extractAmount(text);
        if (customsNo && !b.customs_declaration_no)
          patch.customs_declaration_no = customsNo;
        if (exportDate && !b.export_date) patch.export_date = exportDate;
        if (amount && !b.export_amount) patch.export_amount = amount;
      } else if (/发票|invoice/i.test(docName)) {
        const exportDate = extractDate(text);
        const amount = extractAmount(text);
        const invoiceNo = extractInvoiceNo(text);
        if (exportDate && !b.export_date) patch.export_date = exportDate;
        if (amount && !b.refund_amount) patch.refund_amount = amount;
        if (invoiceNo && !b.customs_declaration_no)
          patch.customs_declaration_no = invoiceNo;
      }
      if (Object.keys(patch).length > 0) {
        updateBusiness(b.id, patch);
        toast.success(
          `已识别并回填：${Object.keys(patch)
            .map((k) => fieldLabelMap[k as keyof typeof fieldLabelMap])
            .join("、")}`,
        );
      } else {
        toast.info("已识别单证内容，未检测到可回填字段");
      }
    } catch (e) {
      console.error("OCR backfill error:", e);
    }
  }

  const fieldLabelMap = {
    customs_declaration_no: "报关单号",
    export_date: "出口日期",
    export_amount: "出口金额",
    refund_amount: "预计退税",
  };

  function syncDocumentMissingWarnings(b: TaxRefundBusiness) {
    const requiredNames = documentList
      .filter((d) => d.required)
      .map((d) => d.name);
    const missing = requiredNames.filter(
      (name) => !(b.documents?.[name]?.length ?? 0),
    );
    setWarnings((prev) => {
      const others = prev.filter(
        (w) =>
          !(
            w.business_no === b.business_no &&
            w.warning_type === "document_missing"
          ),
      );
      if (missing.length === 0) return others;
      const pendingExists = prev.some(
        (w) =>
          w.business_no === b.business_no &&
          w.warning_type === "document_missing" &&
          w.processing_status === "pending",
      );
      if (pendingExists) return prev;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const newWarning: RiskWarning = {
        id: nanoid(),
        warning_no: `RW${timeStr.replace(/[-: ]/g, "")}${String(prev.length + 1).padStart(3, "0")}`,
        business_no: b.business_no,
        warning_type: "document_missing",
        warning_level: "high",
        trigger_time: timeStr,
        processing_status: "pending",
      };
      return [...others, newWarning];
    });
  }

  function generateDataConsistency(
    b: TaxRefundBusiness,
  ): DataConsistencyItem[] {
    const hasCustoms = (b.documents?.["委托报关协议"] ?? []).length > 0;
    const hasInvoice =
      (b.documents?.["出口发票"] ?? []).length > 0 ||
      (b.documents?.["增值税进项发票"] ?? []).length > 0;
    const hasContract =
      (b.documents?.["出口合同"] ?? []).length > 0 ||
      (b.documents?.["购货合同"] ?? []).length > 0;
    const customsName = hasCustoms ? "绗缝被" : "-";
    const invoiceName = hasInvoice ? "绗缝被" : "-";
    const contractName = hasContract ? "绗缝被" : "-";
    const customsAmount = hasCustoms ? formatMoney(b.export_amount) : "-";
    const invoiceAmount = hasInvoice ? formatMoney(b.export_amount) : "-";
    const contractAmount = hasContract ? formatMoney(b.export_amount) : "-";
    const customsQty = hasCustoms ? "1000" : "-";
    const invoiceQty = hasInvoice ? "1000" : "-";
    const contractQty = hasContract ? "1000" : "-";
    const unit = "件";
    const spec = "200x230cm";
    return [
      {
        field: "品名",
        customs: customsName,
        invoice: invoiceName,
        contract: contractName,
        consistent:
          hasCustoms &&
          hasInvoice &&
          hasContract &&
          customsName === invoiceName &&
          invoiceName === contractName,
      },
      {
        field: "规格",
        customs: hasCustoms ? spec : "-",
        invoice: hasInvoice ? spec : "-",
        contract: hasContract ? spec : "-",
        consistent: hasCustoms && hasInvoice && hasContract,
      },
      {
        field: "数量",
        customs: customsQty,
        invoice: invoiceQty,
        contract: contractQty,
        consistent:
          hasCustoms &&
          hasInvoice &&
          hasContract &&
          customsQty === invoiceQty &&
          invoiceQty === contractQty,
      },
      {
        field: "金额",
        customs: customsAmount,
        invoice: invoiceAmount,
        contract: contractAmount,
        consistent:
          hasCustoms &&
          hasInvoice &&
          hasContract &&
          customsAmount === invoiceAmount &&
          invoiceAmount === contractAmount,
      },
      {
        field: "单位",
        customs: hasCustoms ? unit : "-",
        invoice: hasInvoice ? unit : "-",
        contract: hasContract ? unit : "-",
        consistent: hasCustoms && hasInvoice && hasContract,
      },
    ];
  }

  function syncDataInconsistencyWarning(
    b: TaxRefundBusiness,
    items: DataConsistencyItem[],
  ) {
    const hasInconsistent = items.some((i) => !i.consistent);
    setWarnings((prev) => {
      const others = prev.filter(
        (w) =>
          !(
            w.business_no === b.business_no &&
            w.warning_type === "data_inconsistency"
          ),
      );
      if (!hasInconsistent) return others;
      const pendingExists = prev.some(
        (w) =>
          w.business_no === b.business_no &&
          w.warning_type === "data_inconsistency" &&
          w.processing_status === "pending",
      );
      if (pendingExists) return prev;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const newWarning: RiskWarning = {
        id: nanoid(),
        warning_no: `RW${timeStr.replace(/[-: ]/g, "")}${String(prev.length + 1).padStart(3, "0")}`,
        business_no: b.business_no,
        warning_type: "data_inconsistency",
        warning_level: "high",
        trigger_time: timeStr,
        processing_status: "pending",
      };
      return [...others, newWarning];
    });
  }

  function isPreviewImage(url: string) {
    return /\.(jpg|jpeg|png|gif|webp|avif|bmp)$/i.test(url);
  }

  function openPreview(url: string, title: string) {
    setPreviewUrl(url);
    setPreviewTitle(title);
  }

  function closePreview() {
    setPreviewUrl(null);
    setPreviewTitle("");
  }

  async function downloadAll(b: TaxRefundBusiness) {
    const urls = Object.values(b.documents || {}).flat();
    if (urls.length === 0) {
      toast.error("暂无可下载的单证");
      return;
    }
    toast.info("正在打包单证，请稍候...");
    const zip = new JSZip();
    let success = 0;
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("fetch failed");
        const blob = await response.blob();
        const filename = url.split("/").pop() || `file-${success}`;
        zip.file(filename, blob);
        success++;
      } catch {
        toast.error(`无法下载 ${url.split("/").pop() || "未知文件"}`);
      }
    }
    if (success === 0) {
      toast.error("打包失败，未成功下载任何文件");
      return;
    }
    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = `${b.business_no}-单证.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toast.success(`已打包 ${success} 个单证`);
  }

  function exportDocx(b: TaxRefundBusiness) {
    const FONT = "Microsoft YaHei";
    const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "D0D0D0" };
    const cellBorders = {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
    };
    const headerShading = { fill: "F2F2F2", type: ShadingType.CLEAR };

    const headerRow = new DocxTableRow({
      tableHeader: true,
      children: [
        new DocxTableCell({
          borders: cellBorders,
          shading: headerShading,
          width: { size: 3600, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "单证名称",
                  bold: true,
                  font: FONT,
                  size: 22,
                }),
              ],
            }),
          ],
        }),
        new DocxTableCell({
          borders: cellBorders,
          shading: headerShading,
          width: { size: 1800, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "类型", bold: true, font: FONT, size: 22 }),
              ],
            }),
          ],
        }),
        new DocxTableCell({
          borders: cellBorders,
          shading: headerShading,
          width: { size: 1800, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "状态", bold: true, font: FONT, size: 22 }),
              ],
            }),
          ],
        }),
        new DocxTableCell({
          borders: cellBorders,
          shading: headerShading,
          width: { size: 2200, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "附件数",
                  bold: true,
                  font: FONT,
                  size: 22,
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const rows = documentList.map((doc) => {
      const count = (b.documents?.[doc.name] ?? []).length;
      return new DocxTableRow({
        children: [
          new DocxTableCell({
            borders: cellBorders,
            width: { size: 3600, type: WidthType.DXA },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: doc.name, font: FONT, size: 22 }),
                ],
              }),
            ],
          }),
          new DocxTableCell({
            borders: cellBorders,
            width: { size: 1800, type: WidthType.DXA },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: doc.required ? "必传" : "选传",
                    font: FONT,
                    size: 22,
                  }),
                ],
              }),
            ],
          }),
          new DocxTableCell({
            borders: cellBorders,
            width: { size: 1800, type: WidthType.DXA },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: count > 0 ? "已上传" : "未上传",
                    font: FONT,
                    size: 22,
                  }),
                ],
              }),
            ],
          }),
          new DocxTableCell({
            borders: cellBorders,
            width: { size: 2200, type: WidthType.DXA },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: String(count), font: FONT, size: 22 }),
                ],
              }),
            ],
          }),
        ],
      });
    });

    const doc = new Document({
      styles: {
        default: { document: { run: { font: FONT, size: 22 } } },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [
                new TextRun({ text: "出口退税单证资料册", font: FONT }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `业务编号：${b.business_no}`,
                  font: FONT,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `销售订单号：${b.sales_order_no}`,
                  font: FONT,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `报关单号：${b.customs_declaration_no}`,
                  font: FONT,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `出口日期：${b.export_date}`,
                  font: FONT,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `出口金额：${formatMoney(b.export_amount)}`,
                  font: FONT,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `预计退税：${formatMoney(b.refund_amount)}`,
                  font: FONT,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `完整度评分：${b.completeness_score ?? 0}%`,
                  font: FONT,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [new TextRun({ text: "", font: FONT, size: 22 })],
            }),
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: "单证清单", font: FONT })],
            }),
            new DocxTable({
              columnWidths: [3600, 1800, 1800, 2200],
              rows: [headerRow, ...rows],
            }),
          ],
        },
      ],
    });

    Packer.toBlob(doc).then((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${b.business_no}-单证资料册.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success("Word 资料册已导出");
    });
  }

  function exportPdf(b: TaxRefundBusiness) {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "794px";
    container.style.background = "#fff";
    container.style.padding = "40px";
    container.style.fontFamily = "Microsoft YaHei, Arial, sans-serif";
    container.style.fontSize = "14px";
    container.style.color = "#000";
    container.style.lineHeight = "1.6";

    const rows = documentList
      .map((doc) => {
        const count = (b.documents?.[doc.name] ?? []).length;
        return `<tr>
        <td style="border:1px solid #d0d0d0;padding:8px;">${doc.name}</td>
        <td style="border:1px solid #d0d0d0;padding:8px;">${doc.required ? "必传" : "选传"}</td>
        <td style="border:1px solid #d0d0d0;padding:8px;">${count > 0 ? "已上传" : "未上传"}</td>
        <td style="border:1px solid #d0d0d0;padding:8px;">${count}</td>
      </tr>`;
      })
      .join("");

    container.innerHTML = `
      <h1 style="font-size:22px;font-weight:bold;margin:0 0 16px 0;">出口退税单证资料册</h1>
      <p style="margin:4px 0;">业务编号：${b.business_no}</p>
      <p style="margin:4px 0;">销售订单号：${b.sales_order_no}</p>
      <p style="margin:4px 0;">报关单号：${b.customs_declaration_no}</p>
      <p style="margin:4px 0;">出口日期：${b.export_date}</p>
      <p style="margin:4px 0;">出口金额：${formatMoney(b.export_amount)}</p>
      <p style="margin:4px 0;">预计退税：${formatMoney(b.refund_amount)}</p>
      <p style="margin:4px 0 16px 0;">完整度评分：${b.completeness_score ?? 0}%</p>
      <h2 style="font-size:16px;font-weight:bold;margin:16px 0 8px 0;">单证清单</h2>
      <table style="border-collapse:collapse;width:100%;">
        <thead>
          <tr style="background:#f2f2f2;">
            <th style="border:1px solid #d0d0d0;padding:8px;text-align:left;">单证名称</th>
            <th style="border:1px solid #d0d0d0;padding:8px;text-align:left;">类型</th>
            <th style="border:1px solid #d0d0d0;padding:8px;text-align:left;">状态</th>
            <th style="border:1px solid #d0d0d0;padding:8px;text-align:left;">附件数</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    document.body.appendChild(container);

    html2canvas(container, { scale: 2, useCORS: true })
      .then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "pt", "a4");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        pdf.save(`${b.business_no}-单证资料册.pdf`);
        document.body.removeChild(container);
        toast.success("PDF 资料册已导出");
      })
      .catch((err) => {
        document.body.removeChild(container);
        toast.error("PDF 生成失败");
        console.error(err);
      });
  }

  function handleCreate() {
    const exportAmount = Number(form.export_amount);
    const refundAmount = Number(form.refund_amount);
    if (
      !form.sales_order_no ||
      !form.customs_declaration_no ||
      !form.export_date ||
      !exportAmount
    ) {
      toast.error("请填写完整的退税业务信息");
      return;
    }
    const now = new Date().toISOString().split("T")[0];
    const newBusiness: TaxRefundBusiness = {
      id: nanoid(),
      business_no: `TR${now.replace(/-/g, "")}${String(businesses.length + 1).padStart(3, "0")}`,
      sales_order_no: form.sales_order_no,
      customs_declaration_no: form.customs_declaration_no,
      export_date: form.export_date,
      export_amount: exportAmount,
      refund_amount: refundAmount || undefined,
      status: "pending_collection",
      documents: {},
      created_at: `${now} 09:00`,
      created_by: currentUserName,
    };
    setBusinesses((prev) => [newBusiness, ...prev]);
    setForm({
      sales_order_no: "",
      customs_declaration_no: "",
      export_date: "",
      export_amount: "",
      refund_amount: "",
    });
    setCreateOpen(false);
    syncDocumentMissingWarnings(newBusiness);
    toast.success("退税业务创建成功");
  }

  function collectData(b: TaxRefundBusiness) {
    updateBusiness(b.id, { status: "pending_check" });
    toast.success(`已采集业务 ${b.business_no} 的相关数据`);
  }

  function runCheck(b: TaxRefundBusiness) {
    const score = computeCompletenessScore(b.documents);
    const nextStatus: TaxRefundStatus =
      score >= 80 ? "pending_self_check" : "pending_check";
    const now = new Date().toISOString();
    const records: CheckRecord[] = [
      {
        level: 1,
        level_label: "基础完整度",
        result: score >= 80 ? "passed" : score >= 50 ? "partial" : "failed",
        check_time: now,
      },
      {
        level: 2,
        level_label: "数据一致性",
        result: score >= 80 ? "passed" : "partial",
        check_time: now,
      },
      {
        level: 3,
        level_label: "逻辑闭环性",
        result: score >= 80 ? "passed" : "failed",
        check_time: now,
      },
    ];
    if (score < 80) {
      records[0].error_details = documentList
        .filter((d) => d.required && !(b.documents?.[d.name] ?? []).length)
        .map((d) => `缺少必传单证：${d.name}`);
      records[1].error_details = ["报关单、发票、合同关键字段比对未完成"];
      records[2].error_details = ["合同流、货物流、发票流、资金流未形成闭环"];
    }
    const consistency = generateDataConsistency(b);
    updateBusiness(b.id, {
      completeness_score: score,
      status: nextStatus,
      check_records: records,
      data_consistency: consistency,
    });
    syncDataInconsistencyWarning(b, consistency);
    toast.success(`完整度检查完成，评分 ${score} 分`);
  }

  function submitSelfCheck(b: TaxRefundBusiness) {
    const record: AuditRecord = {
      round: "self_check",
      auditor: currentUserName,
      audit_time: new Date().toISOString(),
      status: "passed",
      opinion: "制单人自查通过",
    };
    updateBusiness(b.id, {
      status: "pending_first_audit",
      audit_records: [...(b.audit_records || []), record],
    });
    toast.success(`业务 ${b.business_no} 已提交初审`);
  }

  function firstAuditPass(b: TaxRefundBusiness) {
    const record: AuditRecord = {
      round: "first_audit",
      auditor: "业务员",
      audit_time: new Date().toISOString(),
      status: "passed",
      opinion: "初审通过",
    };
    updateBusiness(b.id, {
      status: "pending_second_audit",
      audit_records: [...(b.audit_records || []), record],
    });
    toast.success(`业务 ${b.business_no} 初审通过`);
  }

  function firstAuditReject(b: TaxRefundBusiness, reason: string) {
    const record: AuditRecord = {
      round: "first_audit",
      auditor: "业务员",
      audit_time: new Date().toISOString(),
      status: "rejected",
      opinion: "初审驳回",
      error_record: reason,
    };
    updateBusiness(b.id, {
      status: "pending_check",
      audit_records: [...(b.audit_records || []), record],
    });
    toast.error(`业务 ${b.business_no} 初审已驳回，请修正后重新检查`);
  }

  function secondAuditPass(b: TaxRefundBusiness) {
    const record: AuditRecord = {
      round: "second_audit",
      auditor: "财务人员",
      audit_time: new Date().toISOString(),
      status: "passed",
      opinion: "复审通过",
    };
    updateBusiness(b.id, {
      status: "pending_declaration",
      audit_records: [...(b.audit_records || []), record],
    });
    toast.success(`业务 ${b.business_no} 复审通过，待申报`);
  }

  function secondAuditReject(b: TaxRefundBusiness, reason: string) {
    const record: AuditRecord = {
      round: "second_audit",
      auditor: "财务人员",
      audit_time: new Date().toISOString(),
      status: "rejected",
      opinion: "复审驳回",
      error_record: reason,
    };
    updateBusiness(b.id, {
      status: "pending_check",
      audit_records: [...(b.audit_records || []), record],
    });
    toast.error(`业务 ${b.business_no} 复审已驳回，请修正后重新检查`);
  }

  function declare(b: TaxRefundBusiness) {
    const record: DeclarationRecord = {
      declare_time: new Date().toISOString(),
      status: "declared",
    };
    updateBusiness(b.id, { status: "declared", declaration: record });
    toast.success(`业务 ${b.business_no} 已提交申报`);
  }

  function markReceived(b: TaxRefundBusiness) {
    const receivedAmount =
      b.refund_amount || Math.round(b.export_amount * 0.13);
    const record: DeclarationRecord = {
      ...(b.declaration || {
        declare_time: new Date().toISOString(),
        status: "declared",
      }),
      status: "received",
      received_time: new Date().toISOString(),
      received_amount: receivedAmount,
    };
    updateBusiness(b.id, {
      status: "received",
      declaration: record,
      refund_amount: receivedAmount,
    });
    toast.success(
      `业务 ${b.business_no} 退税到账，金额 ${formatMoney(receivedAmount)}`,
    );
  }

  function generateFilingDirectory(b: TaxRefundBusiness) {
    updateBusiness(b.id, { filing_directory_generated: true });
    toast.success("《出口货物备案单证目录》已生成");
  }

  function archive(b: TaxRefundBusiness) {
    updateBusiness(b.id, {
      status: "archived",
      filing_completed_time: new Date().toISOString(),
    });
    toast.success(`业务 ${b.business_no} 已归档备案`);
  }

  const actionConfig: Record<
    ActionType,
    {
      title: string;
      description: string;
      nextLabel: string;
      hasReject: boolean;
    }
  > = {
    collect: {
      title: "采集数据",
      description: "将业务推进到「待检查」状态，确认基础信息已填写完整。",
      nextLabel: "确认采集",
      hasReject: false,
    },
    check: {
      title: "执行检查",
      description:
        "系统将根据已上传单证计算完整度评分，评分 ≥ 80 分方可进入下一环节。",
      nextLabel: "执行检查",
      hasReject: false,
    },
    self_check: {
      title: "提交初审",
      description: "制单人自查单据清单与数据一致性，确认无误后提交初审。",
      nextLabel: "确认提交",
      hasReject: false,
    },
    first_audit: {
      title: "初审确认",
      description: "请确认单证完整性与数据准确性，确认无误后点击通过。",
      nextLabel: "初审通过",
      hasReject: true,
    },
    second_audit: {
      title: "复审确认",
      description:
        "请确认出口发票与原始单据一致性、成交方式及运费折算合规性、备案单证齐全性。",
      nextLabel: "复审通过",
      hasReject: true,
    },
    declare: {
      title: "申报确认",
      description: "请确认申报数据准确无误，点击确认提交后将提交至电子税务局。",
      nextLabel: "确认提交",
      hasReject: false,
    },
    receive: {
      title: "确认到账",
      description: "请确认退税金额已到账，到账后业务状态将变更为「已到账」。",
      nextLabel: "确认到账",
      hasReject: false,
    },
    generate_directory: {
      title: "生成备案目录",
      description:
        "请确认所有备案单证已上传完成，生成《出口货物备案单证目录》。",
      nextLabel: "生成目录",
      hasReject: false,
    },
    archive: {
      title: "完成归档",
      description: "请确认所有备案单证已上传完成，业务状态将变更为「已归档」。",
      nextLabel: "确认归档",
      hasReject: false,
    },
  };

  function getRequiredDocumentsIssues(b: TaxRefundBusiness) {
    const issues: string[] = [];
    const missing = documentList.filter(
      (d) => d.required && !(b.documents?.[d.name]?.length ?? 0),
    );
    if (missing.length > 0)
      issues.push(`缺少必传单证：${missing.map((d) => d.name).join("、")}`);
    if (computeCompletenessScore(b.documents) < 80)
      issues.push("完整度评分不足 80 分");
    return issues;
  }

  function getPrerequisiteIssues(b: TaxRefundBusiness, action: ActionType) {
    const issues: string[] = [];
    if (action === "collect") {
      if (!b.sales_order_no) issues.push("缺少销售订单号");
      if (!b.customs_declaration_no) issues.push("缺少报关单号");
      if (!b.export_date) issues.push("缺少出口日期");
      if (!b.export_amount) issues.push("缺少出口金额");
    } else if (action === "check") {
      if (b.status !== "pending_check") issues.push("当前不是待检查状态");
    } else if (action === "self_check") {
      if (b.status !== "pending_self_check") issues.push("当前不是待自查状态");
      issues.push(...getRequiredDocumentsIssues(b));
    } else if (action === "first_audit") {
      if (b.status !== "pending_first_audit") issues.push("当前不是待初审状态");
      issues.push(...getRequiredDocumentsIssues(b));
    } else if (action === "second_audit") {
      if (b.status !== "pending_second_audit")
        issues.push("当前不是待复审状态");
      issues.push(...getRequiredDocumentsIssues(b));
    } else if (action === "declare") {
      if (b.status !== "pending_declaration") issues.push("请先完成复审");
      issues.push(...getRequiredDocumentsIssues(b));
    } else if (action === "receive") {
      if (b.status !== "declared") issues.push("当前不是已申报状态");
      issues.push(...getRequiredDocumentsIssues(b));
    } else if (action === "generate_directory") {
      if (!["declared", "received"].includes(b.status))
        issues.push("请先完成申报");
      issues.push(...getRequiredDocumentsIssues(b));
    } else if (action === "archive") {
      if (!["declared", "received"].includes(b.status))
        issues.push("请先完成申报或退税到账");
      if (!b.filing_directory_generated) issues.push("请先生成备案目录");
      issues.push(...getRequiredDocumentsIssues(b));
    }
    return issues;
  }

  function executeAction(rejectReason?: string) {
    if (!confirmAction) return;
    const { business, action } = confirmAction;
    const issues = getPrerequisiteIssues(business, action);
    if (issues.length > 0) {
      toast.error(`无法推进：${issues.join("、")}`);
      return;
    }
    if (
      rejectReason &&
      (action === "first_audit" || action === "second_audit")
    ) {
      if (action === "first_audit") firstAuditReject(business, rejectReason);
      else secondAuditReject(business, rejectReason);
      setConfirmAction(null);
      setRejectReason("");
      return;
    }
    if (action === "collect") collectData(business);
    else if (action === "check") runCheck(business);
    else if (action === "self_check") submitSelfCheck(business);
    else if (action === "first_audit") firstAuditPass(business);
    else if (action === "second_audit") secondAuditPass(business);
    else if (action === "declare") declare(business);
    else if (action === "receive") markReceived(business);
    else if (action === "generate_directory") generateFilingDirectory(business);
    else if (action === "archive") archive(business);
    setConfirmAction(null);
    setRejectReason("");
  }

  function resolveWarning(id: string) {
    setWarnings((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, processing_status: "processed" } : w,
      ),
    );
    toast.success("预警已标记为已处理");
  }

  const stats = useMemo(() => {
    return {
      total: businesses.length,
      pending: businesses.filter((b) =>
        [
          "pending_collection",
          "pending_check",
          "pending_self_check",
          "pending_first_audit",
          "pending_second_audit",
          "pending_declaration",
        ].includes(b.status),
      ).length,
      declared: businesses.filter((b) => b.status === "declared").length,
      archived: businesses.filter((b) => b.status === "archived").length,
      warnings: warnings.filter((w) => w.processing_status === "pending")
        .length,
    };
  }, [businesses, warnings]);

  function renderAction(b: TaxRefundBusiness) {
    switch (b.status) {
      case "pending_collection":
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={getPrerequisiteIssues(b, "collect").length > 0}
            onClick={() => setConfirmAction({ business: b, action: "collect" })}
          >
            采集数据
          </Button>
        );
      case "pending_check":
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={getPrerequisiteIssues(b, "check").length > 0}
            onClick={() => setConfirmAction({ business: b, action: "check" })}
          >
            <FileCheck className="mr-1 h-4 w-4" />
            执行检查
          </Button>
        );
      case "pending_self_check":
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={getPrerequisiteIssues(b, "self_check").length > 0}
            onClick={() =>
              setConfirmAction({ business: b, action: "self_check" })
            }
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            提交初审
          </Button>
        );
      case "pending_first_audit":
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={getPrerequisiteIssues(b, "first_audit").length > 0}
            onClick={() =>
              setConfirmAction({ business: b, action: "first_audit" })
            }
          >
            <Eye className="mr-1 h-4 w-4" />
            初审
          </Button>
        );
      case "pending_second_audit":
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={getPrerequisiteIssues(b, "second_audit").length > 0}
            onClick={() =>
              setConfirmAction({ business: b, action: "second_audit" })
            }
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            复审
          </Button>
        );
      case "pending_declaration":
        return (
          <Button
            size="sm"
            disabled={getPrerequisiteIssues(b, "declare").length > 0}
            onClick={() => setConfirmAction({ business: b, action: "declare" })}
          >
            <ArrowRight className="mr-1 h-4 w-4" />
            申报
          </Button>
        );
      case "declared":
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={getPrerequisiteIssues(b, "receive").length > 0}
            onClick={() => setConfirmAction({ business: b, action: "receive" })}
          >
            <Receipt className="mr-1 h-4 w-4" />
            确认到账
          </Button>
        );
      case "received":
        return (
          <div className="flex gap-1">
            {!b.filing_directory_generated && (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  getPrerequisiteIssues(b, "generate_directory").length > 0
                }
                onClick={() =>
                  setConfirmAction({
                    business: b,
                    action: "generate_directory",
                  })
                }
              >
                <FileText className="mr-1 h-4 w-4" />
                生成目录
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={getPrerequisiteIssues(b, "archive").length > 0}
              onClick={() =>
                setConfirmAction({ business: b, action: "archive" })
              }
            >
              <Receipt className="mr-1 h-4 w-4" />
              归档
            </Button>
          </div>
        );
      default:
        return null;
    }
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

  const {
    paginatedItems: pendingCheckBusinessesPaginated,
    currentPage: pendingCheckBusinessesCurrentPage,
    pageSize: pendingCheckBusinessesPageSize,
    totalPages: pendingCheckBusinessesTotalPages,
    totalItems: pendingCheckBusinessesTotalItems,
    setPage: setPendingCheckBusinessesPage,
    setPageSize: setPendingCheckBusinessesPageSize,
  } = usePagination(pendingCheckBusinesses);

  const {
    paginatedItems: pendingDeclarationBusinessesPaginated,
    currentPage: pendingDeclarationBusinessesCurrentPage,
    pageSize: pendingDeclarationBusinessesPageSize,
    totalPages: pendingDeclarationBusinessesTotalPages,
    totalItems: pendingDeclarationBusinessesTotalItems,
    setPage: setPendingDeclarationBusinessesPage,
    setPageSize: setPendingDeclarationBusinessesPageSize,
  } = usePagination(pendingDeclarationBusinesses);

  const {
    paginatedItems: pendingFilingBusinessesPaginated,
    currentPage: pendingFilingBusinessesCurrentPage,
    pageSize: pendingFilingBusinessesPageSize,
    totalPages: pendingFilingBusinessesTotalPages,
    totalItems: pendingFilingBusinessesTotalItems,
    setPage: setPendingFilingBusinessesPage,
    setPageSize: setPendingFilingBusinessesPageSize,
  } = usePagination(pendingFilingBusinesses);

  const {
    paginatedItems: declaredBusinessesPaginated,
    currentPage: declaredBusinessesCurrentPage,
    pageSize: declaredBusinessesPageSize,
    totalPages: declaredBusinessesTotalPages,
    totalItems: declaredBusinessesTotalItems,
    setPage: setDeclaredBusinessesPage,
    setPageSize: setDeclaredBusinessesPageSize,
  } = usePagination(declaredBusinesses);

  const {
    paginatedItems: archivedBusinessesPaginated,
    currentPage: archivedBusinessesCurrentPage,
    pageSize: archivedBusinessesPageSize,
    totalPages: archivedBusinessesTotalPages,
    totalItems: archivedBusinessesTotalItems,
    setPage: setArchivedBusinessesPage,
    setPageSize: setArchivedBusinessesPageSize,
  } = usePagination(archivedBusinesses);

  const {
    paginatedItems: filingBusinessesPaginated,
    currentPage: filingBusinessesCurrentPage,
    pageSize: filingBusinessesPageSize,
    totalPages: filingBusinessesTotalPages,
    totalItems: filingBusinessesTotalItems,
    setPage: setFilingBusinessesPage,
    setPageSize: setFilingBusinessesPageSize,
  } = usePagination(filingBusinesses);

  const {
    paginatedItems: filteredWarningsPaginated,
    currentPage: filteredWarningsCurrentPage,
    pageSize: filteredWarningsPageSize,
    totalPages: filteredWarningsTotalPages,
    totalItems: filteredWarningsTotalItems,
    setPage: setFilteredWarningsPage,
    setPageSize: setFilteredWarningsPageSize,
  } = usePagination(filteredWarnings);

  return (
    <>
      <ControlledTabs
        modulePath="/finance/tax-refund"
        defaultTab="business"
        className="space-y-4"
      >
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="business">退税业务</TabsTrigger>
          <TabsTrigger value="check">单据完整度检查</TabsTrigger>
          <TabsTrigger value="declaration">退税申报</TabsTrigger>
          <TabsTrigger value="filing">单证备案</TabsTrigger>
          <TabsTrigger value="risk">风险预警看板</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  业务总数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  进行中
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  已申报
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.declared}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  已归档
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.archived}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                退税业务主表
              </CardTitle>
              <div className="flex flex-col gap-2 md:flex-row">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索业务/订单/报关单号"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  新建退税业务
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto bg-card rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        业务编号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        销售订单号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        报关单号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        出口日期
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        出口金额
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        退税金额
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        完整度
                      </TableHead>
                      <TableHead className="whitespace-nowrap">状态</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPaginated.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {b.business_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {b.sales_order_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {b.customs_declaration_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {b.export_date}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatMoney(b.export_amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatMoney(b.refund_amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {b.completeness_score !== undefined ? (
                            <div className="flex items-center gap-2">
                              <Progress
                                value={b.completeness_score}
                                className="w-16 h-2"
                              />
                              <span className="text-xs">
                                {b.completeness_score}%
                              </span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant={
                              statusMap[b.status]?.variant ?? "secondary"
                            }
                          >
                            {statusMap[b.status]?.label ?? b.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPreviewBusiness(b)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setUploadBusiness(b)}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                            {renderAction(b)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center text-muted-foreground"
                        >
                          暂无退税业务
                        </TableCell>
                      </TableRow>
                    )}
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="check" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-primary" />
                单据完整度检查
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                系统自动执行三层检查：基础完整度、数据一致性、逻辑闭环性。检查通过（≥80分）后可进入审核流程。
              </p>
              <div className="overflow-x-auto bg-card rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        业务编号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        报关单号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        出口金额
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        完整度评分
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        单据清单
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businesses
                      .filter((b) => b.status === "pending_check")
                      .map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="whitespace-nowrap font-medium">
                            {b.business_no}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {b.customs_declaration_no}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatMoney(b.export_amount)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {b.completeness_score !== undefined ? (
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={b.completeness_score}
                                  className="w-20 h-2"
                                />
                                <span className="text-xs font-medium">
                                  {b.completeness_score}%
                                </span>
                              </div>
                            ) : (
                              "待检查"
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {documentList.slice(0, 4).map((d, i) => (
                                <Badge
                                  key={i}
                                  variant={
                                    b.completeness_score &&
                                    b.completeness_score > 70
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {d.name}
                                </Badge>
                              ))}
                              {documentList.length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{documentList.length - 4}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => runCheck(b)}
                            >
                              <FileCheck className="mr-1 h-4 w-4" />
                              执行检查
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    {pendingCheckBusinesses.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          暂无待检查业务
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <Pagination
                  currentPage={pendingCheckBusinessesCurrentPage}
                  totalPages={pendingCheckBusinessesTotalPages}
                  pageSize={pendingCheckBusinessesPageSize}
                  totalItems={pendingCheckBusinessesTotalItems}
                  onPageChange={setPendingCheckBusinessesPage}
                  onPageSizeChange={setPendingCheckBusinessesPageSize}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="declaration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-primary" />
                退税申报
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto bg-card rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        业务编号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        报关单号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        出口金额
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        预计退税
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        完整度评分
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDeclarationBusinessesPaginated.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="whitespace-nowrap font-medium">
                            {b.business_no}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {b.customs_declaration_no}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatMoney(b.export_amount)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatMoney(b.refund_amount)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={b.completeness_score || 0}
                                className="w-20 h-2"
                              />
                              <span className="text-xs font-medium">
                                {b.completeness_score}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button size="sm" onClick={() => declare(b)}>
                              <ArrowRight className="mr-1 h-4 w-4" />
                              申报
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    {pendingDeclarationBusinesses.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          暂无待申报业务
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                注：申报提交后将通过预留接口对接电子税务局，当前为模拟提交。
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="filing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                单证备案管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto bg-card rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        业务编号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        报关单号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        申报日期
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        备案状态
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filingBusinessesPaginated.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="whitespace-nowrap font-medium">
                            {b.business_no}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {b.customs_declaration_no}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {b.declaration?.declare_time
                              ? b.declaration.declare_time.split("T")[0]
                              : "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant={
                                b.status === "received"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {b.status === "received" ? "待备案" : "待到账"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {b.status === "declared" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setConfirmAction({
                                    business: b,
                                    action: "receive",
                                  })
                                }
                              >
                                <Receipt className="mr-1 h-4 w-4" />
                                确认到账
                              </Button>
                            )}
                            {b.status === "received" && (
                              <div className="flex justify-end gap-1">
                                {!b.filing_directory_generated && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setConfirmAction({
                                        business: b,
                                        action: "generate_directory",
                                      })
                                    }
                                  >
                                    <FileText className="mr-1 h-4 w-4" />
                                    生成目录
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setConfirmAction({
                                      business: b,
                                      action: "archive",
                                    })
                                  }
                                >
                                  <Receipt className="mr-1 h-4 w-4" />
                                  归档备案
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    {filingBusinesses.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          暂无待备案业务
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  预警总数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{warnings.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  高风险
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {
                    warnings.filter(
                      (w) =>
                        w.warning_level === "high" &&
                        w.processing_status === "pending",
                    ).length
                  }
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  中风险
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {
                    warnings.filter(
                      (w) =>
                        w.warning_level === "medium" &&
                        w.processing_status === "pending",
                    ).length
                  }
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  低风险
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">
                  {
                    warnings.filter(
                      (w) =>
                        w.warning_level === "low" &&
                        w.processing_status === "pending",
                    ).length
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                风险预警列表
              </CardTitle>
              <div className="flex flex-col gap-2 md:flex-row">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索业务编号"
                    value={riskKeyword}
                    onChange={(e) => setRiskKeyword(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select
                  value={riskFilterType}
                  onValueChange={(v) =>
                    setRiskFilterType(v as WarningType | "all")
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="预警类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="document_missing">单证缺失</SelectItem>
                    <SelectItem value="data_inconsistency">
                      数据不一致
                    </SelectItem>
                    <SelectItem value="time_overdue">时间逾期</SelectItem>
                    <SelectItem value="filing_overdue">备案逾期</SelectItem>
                    <SelectItem value="flow_broken">四流断链</SelectItem>
                    <SelectItem value="rate_abnormal">退税率异常</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={riskFilterLevel}
                  onValueChange={(v) =>
                    setRiskFilterLevel(v as WarningLevel | "all")
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="预警级别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部级别</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={riskFilterStatus}
                  onValueChange={(v) =>
                    setRiskFilterStatus(v as "all" | "pending" | "processed")
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="处理状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="pending">待处理</SelectItem>
                    <SelectItem value="processed">已处理</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto bg-card rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        预警编号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        业务编号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        预警类型
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        预警级别
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        触发时间
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        处理状态
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWarningsPaginated.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="whitespace-nowrap font-medium">
                            {w.warning_no}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {w.business_no}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {warningTypeMap[w.warning_type] ?? w.warning_type}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant={
                                warningLevelMap[w.warning_level]?.variant ??
                                "secondary"
                              }
                            >
                              {warningLevelMap[w.warning_level]?.label ??
                                w.warning_level}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {w.trigger_time}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant={
                                w.processing_status === "pending"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {w.processing_status === "pending"
                                ? "待处理"
                                : "已处理"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1">
                              {w.processing_status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => resolveWarning(w.id)}
                                >
                                  <CheckCircle2 className="mr-1 h-4 w-4" />
                                  处理
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const b = businesses.find(
                                    (x) => x.business_no === w.business_no,
                                  );
                                  if (b) setPreviewBusiness(b);
                                }}
                              >
                                详情
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {filteredWarnings.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground"
                        >
                          暂无风险预警
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </ControlledTabs>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建退税业务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>关联销售订单号</Label>
              <Input
                value={form.sales_order_no}
                onChange={(e) =>
                  setForm({ ...form, sales_order_no: e.target.value })
                }
                placeholder="如 SO20260801001"
              />
            </div>
            <div className="space-y-2">
              <Label>报关单号</Label>
              <Input
                value={form.customs_declaration_no}
                onChange={(e) =>
                  setForm({ ...form, customs_declaration_no: e.target.value })
                }
                placeholder="如 CD20260801001"
              />
            </div>
            <div className="space-y-2">
              <Label>出口日期</Label>
              <Input
                type="date"
                value={form.export_date}
                onChange={(e) =>
                  setForm({ ...form, export_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>出口金额（元）</Label>
              <Input
                type="number"
                value={form.export_amount}
                onChange={(e) =>
                  setForm({ ...form, export_amount: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>预计退税金额（元）</Label>
              <Input
                type="number"
                value={form.refund_amount}
                onChange={(e) =>
                  setForm({ ...form, refund_amount: e.target.value })
                }
                placeholder="选填"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!previewBusiness}
        onOpenChange={(v) => !v && setPreviewBusiness(null)}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>退税业务详情</DialogTitle>
          </DialogHeader>
          {previewBusiness && (
            <Tabs defaultValue="basic" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="basic">基本信息</TabsTrigger>
                <TabsTrigger value="documents">单据清单</TabsTrigger>
                <TabsTrigger value="consistency">数据一致性</TabsTrigger>
                <TabsTrigger value="audit">审核记录</TabsTrigger>
                <TabsTrigger value="declaration">申报记录</TabsTrigger>
                <TabsTrigger value="filing">备案记录</TabsTrigger>
              </TabsList>
              <TabsContent value="basic" className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">业务编号</span>
                  <span className="font-medium">
                    {previewBusiness.business_no}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">销售订单号</span>
                  <span className="font-medium">
                    {previewBusiness.sales_order_no}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">报关单号</span>
                  <span className="font-medium">
                    {previewBusiness.customs_declaration_no}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">出口日期</span>
                  <span className="font-medium">
                    {previewBusiness.export_date}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">出口金额</span>
                  <span className="font-medium">
                    {formatMoney(previewBusiness.export_amount)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">预计退税</span>
                  <span className="font-medium">
                    {formatMoney(previewBusiness.refund_amount)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">完整度评分</span>
                  <span className="font-medium">
                    {previewBusiness.completeness_score !== undefined
                      ? `${previewBusiness.completeness_score}%`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">业务状态</span>
                  <Badge
                    variant={
                      statusMap[previewBusiness.status]?.variant ?? "secondary"
                    }
                  >
                    {statusMap[previewBusiness.status]?.label ??
                      previewBusiness.status}
                  </Badge>
                </div>
                {previewBusiness.declaration?.declare_time && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">申报时间</span>
                    <span className="font-medium">
                      {previewBusiness.declaration.declare_time}
                    </span>
                  </div>
                )}
                {previewBusiness.declaration?.received_time && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">到账时间</span>
                    <span className="font-medium">
                      {previewBusiness.declaration.received_time}
                    </span>
                  </div>
                )}
                {previewBusiness.declaration?.received_amount !== undefined && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">到账金额</span>
                    <span className="font-medium">
                      {formatMoney(previewBusiness.declaration.received_amount)}
                    </span>
                  </div>
                )}
                {previewBusiness.filing_completed_time && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">归档完成时间</span>
                    <span className="font-medium">
                      {previewBusiness.filing_completed_time}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    流程进度
                  </span>
                  <FlowStepper status={previewBusiness.status} />
                </div>
              </TabsContent>
              <TabsContent value="documents" className="space-y-4">
                <div className="grid gap-3">
                  {documentList.map((doc) => {
                    const uploaded =
                      previewBusiness.documents?.[doc.name] || [];
                    return (
                      <div key={doc.name} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between text-sm font-medium mb-2">
                          <div className="flex items-center gap-2">
                            {doc.name}
                            {doc.required && (
                              <Badge variant="secondary" className="text-xs">
                                必传
                              </Badge>
                            )}
                          </div>
                          <Badge
                            variant={
                              uploaded.length > 0 ? "default" : "secondary"
                            }
                            className="text-xs"
                          >
                            {uploaded.length > 0 ? "已上传" : "未上传"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {uploaded.map((url, idx) => (
                            <Button
                              key={idx}
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                openPreview(
                                  url,
                                  `${previewBusiness.business_no} - ${doc.name}`,
                                )
                              }
                            >
                              查看文件 {idx + 1}
                            </Button>
                          ))}
                          {uploaded.length === 0 && (
                            <span className="text-xs text-muted-foreground">
                              暂无文件
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="consistency" className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  系统自动比对报关单、发票、合同中的关键字段。
                </p>
                <div className="overflow-x-auto bg-card rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">
                          字段
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          报关单
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          发票
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          合同
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          结果
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(previewBusiness.data_consistency || []).map(
                        (item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="whitespace-nowrap">
                              {item.field}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.customs}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.invoice}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.contract}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={
                                  item.consistent ? "default" : "destructive"
                                }
                              >
                                {item.consistent ? "一致" : "不一致"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                      {(previewBusiness.data_consistency || []).length ===
                        0 && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-muted-foreground"
                          >
                            暂未执行数据一致性检查
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="audit" className="space-y-3">
                <div className="overflow-x-auto bg-card rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">
                          审核环节
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          审核人
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          审核时间
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          状态
                        </TableHead>
                        <TableHead className="whitespace-nowrap">
                          意见/差错
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(previewBusiness.audit_records || []).map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap">
                            {r.round === "self_check"
                              ? "制单人自查"
                              : r.round === "first_audit"
                                ? "业务员初审"
                                : "财务复审"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.auditor}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.audit_time}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge
                              variant={
                                r.status === "passed"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {r.status === "passed" ? "通过" : "驳回"}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.error_record || r.opinion || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(previewBusiness.audit_records || []).length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-muted-foreground"
                          >
                            暂无审核记录
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="declaration" className="space-y-3">
                {previewBusiness.declaration ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">申报时间</span>
                      <span className="font-medium">
                        {previewBusiness.declaration.declare_time}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">申报状态</span>
                      <Badge
                        variant={
                          previewBusiness.declaration.status === "received"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {previewBusiness.declaration.status === "received"
                          ? "已到账"
                          : "已申报"}
                      </Badge>
                    </div>
                    {previewBusiness.declaration.received_time && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">到账时间</span>
                        <span className="font-medium">
                          {previewBusiness.declaration.received_time}
                        </span>
                      </div>
                    )}
                    {previewBusiness.declaration.received_amount !==
                      undefined && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">到账金额</span>
                        <span className="font-medium">
                          {formatMoney(
                            previewBusiness.declaration.received_amount,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    暂无申报记录
                  </div>
                )}
              </TabsContent>
              <TabsContent value="filing" className="space-y-3">
                {[
                  "购销合同",
                  "运输单据",
                  "委托报关单据",
                  "财务单据",
                  "收汇凭证",
                ].map((docType) => {
                  const filing = previewBusiness.filing_documents?.[docType];
                  return (
                    <div key={docType} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between text-sm font-medium mb-2">
                        <span>{docType}</span>
                        <Badge
                          variant={filing ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {filing ? "已上传" : "未上传"}
                        </Badge>
                      </div>
                      {filing ? (
                        <div className="flex flex-wrap gap-2">
                          {filing.urls.map((url, idx) => (
                            <Button
                              key={idx}
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                openPreview(
                                  url,
                                  `${previewBusiness.business_no} - ${docType}`,
                                )
                              }
                            >
                              查看文件 {idx + 1}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          暂无文件
                        </div>
                      )}
                    </div>
                  );
                })}
                {previewBusiness.filing_directory_generated && (
                  <div className="flex items-center gap-2 rounded-md bg-primary/10 p-3 text-sm text-primary">
                    <FileText className="h-4 w-4" />
                    <span>《出口货物备案单证目录》已生成</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {previewBusiness && (
              <>
                <Button
                  variant="outline"
                  onClick={() => exportDocx(previewBusiness)}
                >
                  <FileDown className="mr-1 h-4 w-4" />
                  导出 Word
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportPdf(previewBusiness)}
                >
                  <FileDown className="mr-1 h-4 w-4" />
                  导出 PDF
                </Button>
              </>
            )}
            <Button onClick={() => setPreviewBusiness(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!confirmAction}
        onOpenChange={(v) => {
          if (!v) {
            setConfirmAction(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {confirmAction
                ? actionConfig[confirmAction.action].title
                : "操作确认"}
            </DialogTitle>
          </DialogHeader>
          {confirmAction && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                {actionConfig[confirmAction.action].description}
              </p>
              <div className="rounded-md border p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">业务编号</span>
                  <span className="font-medium">
                    {confirmAction.business.business_no}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">当前状态</span>
                  <Badge
                    variant={
                      statusMap[confirmAction.business.status]?.variant ??
                      "secondary"
                    }
                  >
                    {statusMap[confirmAction.business.status]?.label ??
                      confirmAction.business.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">完整度评分</span>
                  <span className="font-medium">
                    {confirmAction.business.completeness_score ?? 0}%
                  </span>
                </div>
              </div>
              {(() => {
                const issues = getPrerequisiteIssues(
                  confirmAction.business,
                  confirmAction.action,
                );
                if (issues.length > 0) {
                  return (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">
                          前序环节尚未完成，无法推进：
                        </p>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          {issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              {actionConfig[confirmAction.action].hasReject && (
                <div className="space-y-2">
                  <Label className="text-sm">驳回原因（驳回时必填）</Label>
                  <Input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="填写驳回原因"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmAction(null);
                setRejectReason("");
              }}
            >
              取消
            </Button>
            {confirmAction && actionConfig[confirmAction.action].hasReject && (
              <Button
                variant="destructive"
                disabled={!rejectReason.trim()}
                onClick={() => executeAction(rejectReason)}
              >
                驳回
              </Button>
            )}
            <Button
              disabled={
                !!confirmAction &&
                getPrerequisiteIssues(
                  confirmAction.business,
                  confirmAction.action,
                ).length > 0
              }
              onClick={() => executeAction()}
            >
              {confirmAction
                ? actionConfig[confirmAction.action].nextLabel
                : "确认"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!uploadBusiness}
        onOpenChange={(v) => !v && setUploadBusiness(null)}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <DialogTitle>单证上传</DialogTitle>
            </div>
            {uploadBusiness && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadAll(uploadBusiness)}
              >
                <Download className="mr-1 h-4 w-4" />
                打包下载
              </Button>
            )}
          </DialogHeader>
          {uploadBusiness && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">业务编号</span>
                <span className="font-medium">
                  {uploadBusiness.business_no}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">完整度评分</span>
                <Progress
                  value={uploadBusiness.completeness_score || 0}
                  className="w-24 h-2"
                />
                <span className="font-medium">
                  {uploadBusiness.completeness_score || 0}%
                </span>
              </div>
              <div className="space-y-4">
                {documentList.map((doc) => (
                  <div
                    key={doc.name}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {doc.name}
                      {doc.required && (
                        <Badge variant="secondary" className="text-xs">
                          必传
                        </Badge>
                      )}
                    </div>
                    <FileUpload
                      value={uploadBusiness.documents?.[doc.name] || []}
                      onChange={(urls) =>
                        handleDocsChange(uploadBusiness, doc.name, urls)
                      }
                      onPreview={(url) =>
                        openPreview(
                          url,
                          `${uploadBusiness.business_no} - ${doc.name}`,
                        )
                      }
                      bucket="quality-reports"
                      folder={`tax-refund/${uploadBusiness.business_no}`}
                      accept="image/*,.pdf"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setUploadBusiness(null)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!previewUrl} onOpenChange={(v) => !v && closePreview()}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTitle || "单证预览"}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="py-2">
              {isPreviewImage(previewUrl) ? (
                <img
                  src={previewUrl}
                  alt={previewTitle}
                  className="w-full rounded-lg border object-contain"
                />
              ) : (
                <iframe
                  src={previewUrl}
                  title={previewTitle}
                  className="w-full h-[70vh] rounded-lg border"
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => window.open(previewUrl || "", "_blank")}
            >
              新窗口打开
            </Button>
            <Button onClick={closePreview}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

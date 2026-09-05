import * as XLSX from "xlsx";
import type { Contract } from "@/types/contract";
import { createEmptyContract } from "@/lib/contract";

export interface ContractImportError {
  row: number;
  message: string;
}

export interface ContractImportRow {
  contract_no: string;
  original_contract_no: string;
  customer_name: string;
  amount: number;
  sign_date: string;
  delivery_term: string;
  delivery_date: string;
  status: string;
  remark: string;
}

export interface ContractImportResult {
  success: boolean;
  /** 需要新增的合同 */
  contracts: ContractImportRow[];
  /** 需要更新的合同 */
  updates: { row: ContractImportRow; existing: Contract }[];
  /** 校验错误 */
  errors: ContractImportError[];
}

export interface ContractImportOptions {
  /** 遇到已存在合同编号时是跳过还是更新 */
  onDuplicate?: "error" | "skip" | "update";
}

const TEMPLATE_TITLE = "合同信息表";
const TEMPLATE_NOTE = "来源：订购合同图片；合同号由图片手写标注。";
const TEMPLATE_HEADERS = [
  "合同编号",
  "原合同编号",
  "客户名称",
  "合同金额（元/美元）",
  "签订日期",
  "交货期限",
  "合同状态",
  "备注",
];

const TEMPLATE_EXAMPLE = [
  ["HT-2026-001", "HF20260601-03-JLGY", "厦门美锦贸易有限公司", 281204, "2026-06-01", "45天", "执行中", "被子9项，合计1406套"],
  ["HT-2026-002", "HF20260605-01-AB", "大客户A", 120000, "2026-07-05", "30天", "生效中", ""],
];

const STATUS_MAP: Record<string, string> = {
  草稿: "draft",
  审批中: "pending",
  生效中: "effective",
  执行中: "executing",
  已完结: "completed",
  已终止: "terminated",
};

function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    const str = value.toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
  }
  const str = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(str)) {
    try {
      const date = XLSX.SSF.parse_date_code(Number(str));
      if (date && date.y) {
        const month = String(date.m).padStart(2, "0");
        const day = String(date.d).padStart(2, "0");
        return `${date.y}-${month}-${day}`;
      }
    } catch {
      // ignore
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) return str.replace(/\//g, "-");
  return null;
}

function isPositiveNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const num = Number(value);
  return !Number.isNaN(num) && num > 0;
}

/** 解析交货期限（如 "45天"）为天数 */
function termToDays(term: string): number | null {
  const m = term.match(/(\d+)\s*天/);
  return m ? Number(m[1]) : null;
}

/** 解析交货期限（如 "2026-04-10前"）为日期 */
function termToDate(term: string): string | null {
  const m = term.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
  if (!m) return null;
  const d = m[1].replace(/\//g, "-");
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** 在签订日期基础上加天数，返回 YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function downloadContractTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    [TEMPLATE_TITLE],
    [TEMPLATE_NOTE],
    TEMPLATE_HEADERS,
    ...TEMPLATE_EXAMPLE,
  ]);
  ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "合同信息表");
  XLSX.writeFile(wb, "合同信息表.xlsx");
}

export function parseContractExcel(
  file: File,
  existingContracts: Contract[],
  options?: ContractImportOptions,
): Promise<ContractImportResult> {
  const onDuplicate = options?.onDuplicate ?? "error";
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          resolve({ success: false, contracts: [], updates: [], errors: [{ row: 0, message: "文件读取失败，请重新上传" }] });
          return;
        }
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
          blankrows: false,
        });
        resolve(validateContractRows(rows, existingContracts, onDuplicate));
      } catch (err) {
        resolve({
          success: false,
          contracts: [],
          updates: [],
          errors: [{ row: 0, message: `文件解析失败：${err instanceof Error ? err.message : "未知错误"}` }],
        });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, contracts: [], updates: [], errors: [{ row: 0, message: "文件读取失败，请重新上传" }] });
    };
    reader.readAsArrayBuffer(file);
  });
}

function validateContractRows(
  rows: unknown[][],
  existingContracts: Contract[],
  onDuplicate: ContractImportOptions["onDuplicate"] = "error",
): ContractImportResult {
  const errors: ContractImportError[] = [];

  if (rows.length === 0) {
    return { success: false, contracts: [], updates: [], errors: [{ row: 0, message: "Excel文件无有效数据，请检查后重新上传" }] };
  }

  // 查找表头行（包含"合同编号"的行）
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some((c) => String(c).trim() === "合同编号")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return { success: false, contracts: [], updates: [], errors: [{ row: 0, message: "未找到表头行（需包含「合同编号」列）" }] };
  }

  const colMap: Record<string, number> = {};
  rows[headerIdx].forEach((c, i) => {
    const t = String(c).trim();
    if (t) colMap[t] = i;
  });

  // 兼容「合同金额（元）」和「合同金额（元/美元）」两种表头
  const amountCol = colMap["合同金额（元/美元）"] ?? colMap["合同金额（元）"];

  const dataRows = rows.slice(headerIdx + 1).filter((row) =>
    row.some((cell) => cell !== "" && cell !== null && cell !== undefined),
  );

  if (dataRows.length === 0) {
    return { success: false, contracts: [], updates: [], errors: [{ row: 0, message: "Excel文件无有效数据，请检查后重新上传" }] };
  }

  const existingMap = new Map(existingContracts.map((c) => [c.contract_no, c]));
  const seenNos = new Set<string>();
  const contracts: ContractImportRow[] = [];
  const updates: { row: ContractImportRow; existing: Contract }[] = [];

  dataRows.forEach((row, idx) => {
    const rowNum = headerIdx + idx + 2;
    const get = (name: string) => {
      const ci = colMap[name];
      return ci === undefined ? "" : String(row[ci] ?? "").trim();
    };
    const contractNo = get("合同编号");
    const originalNo = get("原合同编号");
    const customerName = get("客户名称");
    const amountRaw = amountCol === undefined ? "" : row[amountCol];
    const signDate = normalizeDate(get("签订日期") || row[colMap["签订日期"]]);
    const deliveryTerm = get("交货期限");
    const statusText = get("合同状态");
    const remark = get("备注");

    if (!contractNo) {
      errors.push({ row: rowNum, message: "合同编号不能为空" });
    } else if (seenNos.has(contractNo)) {
      errors.push({ row: rowNum, message: `合同编号重复：${contractNo}` });
    } else {
      seenNos.add(contractNo);
      const existing = existingMap.get(contractNo);
      if (existing) {
        if (onDuplicate === "error") {
          errors.push({ row: rowNum, message: `合同编号已存在：${contractNo}` });
        } else if (onDuplicate === "update") {
          // 继续校验，校验通过加入 updates
        }
      }
    }

    if (!customerName) {
      errors.push({ row: rowNum, message: "客户名称不能为空" });
    }
    if (!isPositiveNumber(amountRaw)) {
      errors.push({ row: rowNum, message: "合同金额必须大于0" });
    }
    if (!signDate) {
      errors.push({ row: rowNum, message: "签订日期格式错误（需 YYYY-MM-DD）" });
    }
    if (!statusText || !STATUS_MAP[statusText]) {
      errors.push({ row: rowNum, message: `合同状态无效：${statusText}（可选：草稿/审批中/生效中/执行中/已完结/已终止）` });
    }

    if (
      contractNo &&
      customerName &&
      isPositiveNumber(amountRaw) &&
      signDate &&
      STATUS_MAP[statusText]
    ) {
      const days = termToDays(deliveryTerm);
      const importRow: ContractImportRow = {
        contract_no: contractNo,
        original_contract_no: originalNo,
        customer_name: customerName,
        amount: Number(Number(amountRaw).toFixed(2)),
        sign_date: signDate,
        delivery_term: deliveryTerm,
        delivery_date: termToDate(deliveryTerm) || (days ? addDays(signDate, days) : ""),
        status: STATUS_MAP[statusText],
        remark,
      };
      const existing = existingMap.get(contractNo);
      if (existing && onDuplicate === "update") {
        updates.push({ row: importRow, existing });
      } else if (!existing) {
        contracts.push(importRow);
      }
    }
  });

  if (errors.length > 0) {
    return { success: false, contracts: [], updates: [], errors };
  }

  return { success: true, contracts, updates, errors: [] };
}

export function applyContractImportRow(existing: Contract, row: ContractImportRow): Contract {
  const isActive = row.status === "effective" || row.status === "executing";
  return {
    ...existing,
    original_contract_no: row.original_contract_no || existing.original_contract_no,
    title: `${row.customer_name}合同`,
    customer_name: row.customer_name,
    amount: row.amount,
    sign_date: row.sign_date,
    effective_date: isActive ? row.sign_date : existing.effective_date,
    delivery_date: row.delivery_date || existing.delivery_date,
    delivery_term: row.delivery_term || existing.delivery_term,
    status: row.status as Contract["status"],
    remark: row.remark,
    updated_at: new Date().toISOString(),
  };
}

export function buildContractFromImport(row: ContractImportRow): Contract {
  const base = createEmptyContract();
  const now = new Date().toISOString();
  const isActive = row.status === "effective" || row.status === "executing";
  return {
    ...base,
    contract_no: row.contract_no,
    original_contract_no: row.original_contract_no || undefined,
    title: `${row.customer_name}合同`,
    customer_name: row.customer_name,
    amount: row.amount,
    sign_date: row.sign_date,
    effective_date: isActive ? row.sign_date : undefined,
    delivery_date: row.delivery_date || undefined,
    delivery_term: row.delivery_term || undefined,
    status: row.status as Contract["status"],
    remark: row.remark,
    created_at: now,
    updated_at: now,
  };
}
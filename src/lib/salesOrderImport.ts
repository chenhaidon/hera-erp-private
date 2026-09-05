import * as XLSX from "xlsx";
import type { Contract } from "@/types/contract";
import type { Customer, Product, ProductSku, SalesOrderItem } from "@/types";

export interface ImportError {
  row: number;
  message: string;
}

export interface PrefillOrderData {
  group: string;
  customerId?: string;
  /** 若客户不存在，由外部根据名称自动创建后回填 */
  customerName?: string;
  orderDate?: string;
  deliveryDate?: string;
  contractId?: string;
  remark?: string;
  items?: SalesOrderItem[];
}

export interface ImportResult {
  success: boolean;
  customerId?: string;
  customerName?: string;
  orderDate?: string;
  deliveryDate?: string;
  remark?: string;
  items?: SalesOrderItem[];
  orders: PrefillOrderData[];
  errors: ImportError[];
}

const TEMPLATE_TITLE = "销售订单明细表";
const TEMPLATE_HEADERS = [
  "序号",
  "货号",
  "尺码",
  "颜色",
  "尺寸/规格",
  "数量（套）",
  "单价（元/套）",
  "金额（元）",
  "交货期",
];

const TEMPLATE_SUMMARY = "客户：示例客户　|　订单日期：2026-06-01　|　合同编号：HT-2026-001";

const TEMPLATE_EXAMPLE = [
  [1, "BD01", "XL", "摩卡棕", "300×270cm / 50×91cm×2", 100, 210, 21000, "45天"],
  [2, "BD01", "3XL", "摩卡棕", "330×300cm / 50×91cm×2", 200, 220, 44000, "45天"],
  [3, "BD02", "XL", "#灰", "300×270cm / 50×91cm×2", 100, 210, 21000, "45天"],
];

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

function isPositiveInt(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
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

/** 在日期基础上加天数 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function downloadSalesOrderTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    [TEMPLATE_TITLE],
    [TEMPLATE_SUMMARY],
    TEMPLATE_HEADERS,
    ...TEMPLATE_EXAMPLE,
  ]);
  ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "销售订单明细表");
  XLSX.writeFile(wb, "销售订单明细表.xlsx");
}

export function parseSalesOrderExcel(
  file: File,
  customers: Customer[],
  products: Product[],
  contracts: Contract[],
): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          resolve({ success: false, orders: [], errors: [{ row: 0, message: "文件读取失败，请重新上传" }] });
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
        resolve(validateImportRows(rows, customers, products, contracts));
      } catch (err) {
        resolve({
          success: false,
          orders: [],
          errors: [{ row: 0, message: `文件解析失败：${err instanceof Error ? err.message : "未知错误"}` }],
        });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, orders: [], errors: [{ row: 0, message: "文件读取失败，请重新上传" }] });
    };
    reader.readAsArrayBuffer(file);
  });
}

function validateImportRows(
  rows: unknown[][],
  customers: Customer[],
  products: Product[],
  contracts: Contract[],
): ImportResult {
  const errors: ImportError[] = [];

  if (rows.length === 0) {
    return { success: false, orders: [], errors: [{ row: 0, message: "Excel文件无有效数据，请检查后重新上传" }] };
  }

  // 查找汇总行（包含"客户"且包含"合同编号"或"订单日期"）
  let summaryIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].map((c) => String(c)).join("");
    if (joined.includes("客户") && (joined.includes("合同编号") || joined.includes("订单日期"))) {
      summaryIdx = i;
      break;
    }
  }

  let customerName = "";
  let orderDate = "";
  let contractNo = "";
  if (summaryIdx !== -1) {
    const summaryText = rows[summaryIdx].map((c) => String(c)).join("");
    const customerMatch = summaryText.match(/客户[：:]\s*([^|｜\n]+)/);
    const dateMatch = summaryText.match(/订单日期[：:]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
    const contractMatch = summaryText.match(/合同编号[：:]\s*([^\s|｜\n]+)/);
    customerName = customerMatch ? customerMatch[1].trim() : "";
    orderDate = normalizeDate(dateMatch ? dateMatch[1] : "") || "";
    contractNo = contractMatch ? contractMatch[1].trim() : "";
  }

  // 查找表头行（包含"货号"的行）
  let headerIdx = -1;
  const startScan = summaryIdx !== -1 ? summaryIdx + 1 : 0;
  for (let i = startScan; i < rows.length; i++) {
    if (rows[i].some((c) => String(c).trim() === "货号")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return { success: false, orders: [], errors: [{ row: 0, message: "未找到表头行（需包含「货号」列）" }] };
  }

  const colMap: Record<string, number> = {};
  rows[headerIdx].forEach((c, i) => {
    const t = String(c).trim();
    if (t) colMap[t] = i;
  });

  const dataRows = rows.slice(headerIdx + 1).filter((row) =>
    row.some((cell) => cell !== "" && cell !== null && cell !== undefined),
  );

  if (dataRows.length === 0) {
    return { success: false, orders: [], errors: [{ row: 0, message: "Excel文件无有效明细数据" }] };
  }

  // 校验客户：存在则直接取ID，不存在则返回名称供外部自动创建
  let customerId = "";
  let missingCustomer = false;
  if (customerName) {
    const customer = customers.find((c) => c.name === customerName);
    if (customer) {
      customerId = customer.id;
    } else {
      missingCustomer = true;
    }
  } else {
    errors.push({ row: summaryIdx + 1, message: "汇总行缺少客户名称" });
  }

  if (!orderDate) {
    errors.push({ row: summaryIdx + 1, message: "汇总行缺少订单日期或格式错误" });
  }

  // 校验合同
  let contractId = "";
  if (contractNo) {
    const contract = contracts.find((c) => c.contract_no === contractNo);
    if (!contract) {
      errors.push({ row: summaryIdx + 1, message: `合同编号不存在：${contractNo}` });
    } else {
      contractId = contract.id;
    }
  }

  const items: SalesOrderItem[] = [];
  const keys = new Set<string>();

  dataRows.forEach((row, idx) => {
    const rowNum = headerIdx + idx + 2;
    const get = (name: string) => {
      const ci = colMap[name];
      return ci === undefined ? "" : String(row[ci] ?? "").trim();
    };
    const productCode = get("货号");
    const skuSpec = get("尺寸/规格");
    const quantityRaw = colMap["数量（套）"] === undefined ? "" : row[colMap["数量（套）"]];
    const priceRaw = colMap["单价（元/套）"] === undefined ? "" : row[colMap["单价（元/套）"]];
    const deliveryTerm = get("交货期");

    if (!productCode) {
      errors.push({ row: rowNum, message: "货号不能为空" });
    }
    if (!skuSpec) {
      errors.push({ row: rowNum, message: "尺寸/规格不能为空" });
    }
    if (!isPositiveInt(quantityRaw)) {
      errors.push({ row: rowNum, message: "数量必须为正整数" });
    }
    if (!isPositiveNumber(priceRaw)) {
      errors.push({ row: rowNum, message: "单价必须大于0" });
    }

    // 先精确匹配，再按货号前缀匹配（如 BD01 对应 product.code "BD"）
    const product = products.find(
      (p) => p.code === productCode || productCode.startsWith(p.code),
    );
    if (productCode && !product) {
      errors.push({ row: rowNum, message: `货号不存在：${productCode}` });
    }

    let sku: ProductSku | undefined;
    if (product && skuSpec) {
      sku = product.skus.find((s) => s.specification.trim() === skuSpec);
      if (!sku) {
        errors.push({ row: rowNum, message: `尺寸/规格不存在：${skuSpec}` });
      }
    }

    if (product && sku && isPositiveInt(quantityRaw) && isPositiveNumber(priceRaw) && productCode) {
      const key = `${product.id}-${sku.id}`;
      if (keys.has(key)) {
        errors.push({ row: rowNum, message: `货号 ${product.name} 的规格 ${skuSpec} 重复` });
      } else {
        keys.add(key);
        const quantity = Math.floor(Number(quantityRaw));
        const unitPrice = Number(Number(priceRaw).toFixed(2));
        const summary = skuSpec || sku.specification || `${sku.size || ''} ${sku.color || ''} ${sku.pattern || ''}`.trim();
        items.push({
          product_id: product.id,
          sku_id: sku.id,
          product_code: product.code,
          product_name: product.name,
          sku_summary: summary,
          specification: skuSpec,
          quantity,
          unit: sku.unit || "套",
          unit_price: unitPrice,
          amount: Number((quantity * unitPrice).toFixed(2)),
        });
      }
    }
  });

  if (errors.length > 0) {
    return { success: false, orders: [], errors };
  }

  const days = termToDays(dataRows[0] && colMap["交货期"] !== undefined ? String(dataRows[0][colMap["交货期"]] ?? "") : "");
  const deliveryDate = orderDate && days ? addDays(orderDate, days) : "";

  const order: PrefillOrderData = {
    group: contractNo || orderDate,
    customerId,
    customerName: missingCustomer ? customerName : undefined,
    orderDate,
    deliveryDate,
    contractId,
    items,
  };

  return {
    success: true,
    customerId,
    customerName: missingCustomer ? customerName : undefined,
    orderDate,
    deliveryDate,
    items,
    orders: [order],
    errors: [],
  };
}
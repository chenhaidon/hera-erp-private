import * as XLSX from "xlsx";
import type { Contract } from "@/types/contract";
import type { Material, Supplier } from "@/types";

export interface PurchaseImportError {
  row: number;
  message: string;
}

export interface PurchaseImportRow {
  supplier_id: string;
  supplier_name: string;
  material_id: string;
  material_code: string;
  material_name: string;
  specification: string;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
  order_date: string;
  /** 下达采购日期 */
  issued_date: string;
  contract_no: string;
  contract_id: string;
  remark: string;
}

export interface PurchaseImportResult {
  success: boolean;
  rows: PurchaseImportRow[];
  errors: PurchaseImportError[];
}

const TEMPLATE_HEADERS = [
  "供应商名称（必填）",
  "物料编码（必填）",
  "采购数量（必填）",
  "采购单价（必填）",
  "订单日期（必填，YYYY-MM-DD）",
  "下达采购日期（必填，YYYY-MM-DD）",
  "合同编号（选填）",
  "备注（选填）",
];

const TEMPLATE_EXAMPLE = [
  ["示例供应商", "MAT001", 1000, 5.5, "2026-07-03", "2026-07-05", "HT-2026-001", "首批采购"],
  ["大供应商B", "MAT002", 500, 12, "2026-07-03", "2026-07-05", "", ""],
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

function isPositiveNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const num = Number(value);
  return !Number.isNaN(num) && num > 0;
}

export function downloadPurchaseTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE]);
  ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "采购导入模板");
  XLSX.writeFile(wb, "采购导入模板.xlsx");
}

export function parsePurchaseExcel(
  file: File,
  suppliers: Supplier[],
  materials: Material[],
  contracts: Contract[],
): Promise<PurchaseImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          resolve({ success: false, rows: [], errors: [{ row: 0, message: "文件读取失败，请重新上传" }] });
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
        resolve(validatePurchaseRows(rows, suppliers, materials, contracts));
      } catch (err) {
        resolve({
          success: false,
          rows: [],
          errors: [{ row: 0, message: `文件解析失败：${err instanceof Error ? err.message : "未知错误"}` }],
        });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, rows: [], errors: [{ row: 0, message: "文件读取失败，请重新上传" }] });
    };
    reader.readAsArrayBuffer(file);
  });
}

function validatePurchaseRows(
  rows: unknown[][],
  suppliers: Supplier[],
  materials: Material[],
  contracts: Contract[],
): PurchaseImportResult {
  const errors: PurchaseImportError[] = [];

  if (rows.length < 2) {
    return { success: false, rows: [], errors: [{ row: 0, message: "Excel文件无有效数据，请检查后重新上传" }] };
  }

  const dataRows = rows.slice(1).filter((row) =>
    row.some((cell) => cell !== "" && cell !== null && cell !== undefined),
  );

  if (dataRows.length === 0) {
    return { success: false, rows: [], errors: [{ row: 0, message: "Excel文件无有效数据，请检查后重新上传" }] };
  }

  const result: PurchaseImportRow[] = [];

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const supplierName = String(row[0] ?? "").trim();
    const materialCode = String(row[1] ?? "").trim();
    const quantityRaw = row[2];
    const priceRaw = row[3];
    const orderDate = normalizeDate(row[4]);
    const issuedDate = normalizeDate(row[5]);
    const contractNo = String(row[6] ?? "").trim();
    const remark = String(row[7] ?? "").trim();

    if (!supplierName) {
      errors.push({ row: rowNum, message: "供应商名称不能为空" });
    }
    const supplier = suppliers.find((s) => s.name === supplierName);
    if (supplierName && !supplier) {
      errors.push({ row: rowNum, message: `供应商不存在：${supplierName}` });
    }

    if (!materialCode) {
      errors.push({ row: rowNum, message: "物料编码不能为空" });
    }
    const material = materials.find((m) => m.code === materialCode);
    if (materialCode && !material) {
      errors.push({ row: rowNum, message: `物料不存在：${materialCode}` });
    }

    if (!isPositiveNumber(quantityRaw)) {
      errors.push({ row: rowNum, message: "采购数量必须大于0" });
    }
    if (!isPositiveNumber(priceRaw)) {
      errors.push({ row: rowNum, message: "采购单价必须大于0" });
    }
    if (!orderDate) {
      errors.push({ row: rowNum, message: "订单日期格式错误" });
    }
    if (!issuedDate) {
      errors.push({ row: rowNum, message: "下达采购日期格式错误" });
    }
    if (orderDate && issuedDate && issuedDate < orderDate) {
      errors.push({ row: rowNum, message: "下达采购日期不能早于订单日期" });
    }

    let contractId = "";
    if (contractNo) {
      const contract = contracts.find((c) => c.contract_no === contractNo);
      if (!contract) {
        errors.push({ row: rowNum, message: `合同编号不存在：${contractNo}` });
      } else {
        contractId = contract.id;
      }
    }

    if (
      supplier &&
      material &&
      isPositiveNumber(quantityRaw) &&
      isPositiveNumber(priceRaw) &&
      orderDate &&
      issuedDate &&
      (!contractNo || contractId)
    ) {
      const quantity = Number(Number(quantityRaw).toFixed(2));
      const unitPrice = Number(Number(priceRaw).toFixed(2));
      result.push({
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        material_id: material.id,
        material_code: material.code,
        material_name: material.name,
        specification: material.specification,
        unit: material.unit,
        quantity,
        unit_price: unitPrice,
        amount: Number((quantity * unitPrice).toFixed(2)),
        order_date: orderDate,
        issued_date: issuedDate,
        contract_no: contractNo,
        contract_id: contractId,
        remark,
      });
    }
  });

  if (errors.length > 0) {
    return { success: false, rows: [], errors };
  }

  return { success: true, rows: result, errors: [] };
}
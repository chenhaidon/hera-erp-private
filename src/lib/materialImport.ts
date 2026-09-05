import * as XLSX from "xlsx";
import type { Material } from "@/types";

export interface MaterialImportError {
  row: number;
  message: string;
}

export interface MaterialImportResult {
  success: boolean;
  materials: Material[];
  errors: MaterialImportError[];
}

const TEMPLATE_HEADERS = [
  "物料编码（必填，唯一）",
  "物料名称（必填）",
  "类别（必填，如：面料/辅料/填充物）",
  "规格（必填）",
  "单位（必填）",
  "默认供应商（选填）",
  "颜色（选填）",
  "花号（选填）",
  "成分（选填）",
  "克重(g/m²)（选填）",
  "回弹性等级（选填）",
  "安全库存（选填，默认0）",
  "当前库存（选填，默认0）",
  "门幅（选填）",
  "布号（选填）",
  "单件尺寸（选填）",
  "备注（选填）",
  "状态（选填：active/inactive，默认active）",
];

const TEMPLATE_EXAMPLE = [
  [
    "M001",
    "全棉磨毛布",
    "面料",
    "133*72/40S*40S",
    "米",
    "默认供应商A",
    "本白",
    "H001",
    "100%棉",
    120,
    "高",
    100,
    0,
    "250cm",
    "FB001",
    "200x230cm",
    "主面料",
    "active",
  ],
  [
    "M002",
    "聚酯纤维棉",
    "填充物",
    "仿丝棉 150g/m²",
    "公斤",
    "",
    "白色",
    "",
    "100%聚酯纤维",
    150,
    "中",
    50,
    0,
    "",
    "",
    "",
    "",
    "active",
  ],
];

export function downloadMaterialTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ...TEMPLATE_EXAMPLE,
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "物料导入模板");
  XLSX.writeFile(wb, `物料导入模板_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === "number" && !Number.isNaN(value) && value >= 0;
}

function normalizeStatus(value: unknown): string {
  const v = String(value || "").trim().toLowerCase();
  if (v === "inactive" || v === "停用" || v === "0") return "inactive";
  return "active";
}

function parseRows(rows: unknown[][]): { dataRows: unknown[][]; header: unknown[] } {
  const header = rows[0] || [];
  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((cell) => cell !== "" && cell !== null && cell !== undefined));
  return { dataRows, header };
}

function safeString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export async function parseMaterialExcel(
  file: File,
  existingMaterials: Material[],
): Promise<MaterialImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          resolve({
            success: false,
            materials: [],
            errors: [{ row: 0, message: "文件读取失败，请重新上传" }],
          });
          return;
        }
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
        const { dataRows } = parseRows(json as unknown[][]);

        if (dataRows.length === 0) {
          resolve({
            success: false,
            materials: [],
            errors: [{ row: 0, message: "Excel文件无有效数据，请检查后重新上传" }],
          });
          return;
        }

        const errors: MaterialImportError[] = [];
        const materials: Material[] = [];
        const existingCodes = new Set(existingMaterials.map((m) => m.code));
        const usedCodes = new Set<string>();

        dataRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const code = safeString(row[0]);
          const name = safeString(row[1]);
          const category = safeString(row[2]);
          const specification = safeString(row[3]);
          const unit = safeString(row[4]);
          const defaultSupplier = safeString(row[5]);
          const color = safeString(row[6]);
          const patternCode = safeString(row[7]);
          const composition = safeString(row[8]);
          const weight = row[9];
          const resilienceLevel = safeString(row[10]);
          const safetyStock = row[11];
          const stock = row[12];
          const width = safeString(row[13]);
          const fabricNo = safeString(row[14]);
          const pieceSize = safeString(row[15]);
          const remark = safeString(row[16]);
          const status = normalizeStatus(row[17]);

          if (!code) errors.push({ row: rowNum, message: "物料编码不能为空" });
          if (!name) errors.push({ row: rowNum, message: "物料名称不能为空" });
          if (!category) errors.push({ row: rowNum, message: "类别不能为空" });
          if (!specification) errors.push({ row: rowNum, message: "规格不能为空" });
          if (!unit) errors.push({ row: rowNum, message: "单位不能为空" });

          if (weight !== "" && weight !== undefined && weight !== null && !isNonNegativeNumber(weight)) {
            errors.push({ row: rowNum, message: "克重必须为非负数" });
          }
          if (safetyStock !== "" && safetyStock !== undefined && safetyStock !== null && !isNonNegativeNumber(safetyStock)) {
            errors.push({ row: rowNum, message: "安全库存必须为非负数" });
          }
          if (stock !== "" && stock !== undefined && stock !== null && !isNonNegativeNumber(stock)) {
            errors.push({ row: rowNum, message: "当前库存必须为非负数" });
          }

          if (code && existingCodes.has(code)) {
            errors.push({ row: rowNum, message: `物料编码已存在：${code}` });
          }
          if (code && usedCodes.has(code)) {
            errors.push({ row: rowNum, message: `Excel中物料编码重复：${code}` });
          }

          if (errors.length > 0) return;

          usedCodes.add(code);
          materials.push({
            id: "",
            code,
            name,
            category,
            specification,
            unit,
            default_supplier: defaultSupplier,
            color,
            pattern_code: patternCode,
            composition,
            weight: safeNumber(weight),
            resilience_level: resilienceLevel,
            safety_stock: safeNumber(safetyStock),
            stock: safeNumber(stock),
            status,
            width: width || undefined,
            fabric_no: fabricNo || undefined,
            piece_size: pieceSize || undefined,
            remark: remark || undefined,
          });
        });

        if (errors.length > 0) {
          resolve({ success: false, materials: [], errors });
          return;
        }

        if (materials.length === 0) {
          resolve({
            success: false,
            materials: [],
            errors: [{ row: 0, message: "未解析到有效物料数据" }],
          });
          return;
        }

        resolve({ success: true, materials, errors: [] });
      } catch (err) {
        resolve({
          success: false,
          materials: [],
          errors: [
            {
              row: 0,
              message: `文件解析失败：${err instanceof Error ? err.message : "未知错误"}`,
            },
          ],
        });
      }
    };
    reader.onerror = () => {
      resolve({
        success: false,
        materials: [],
        errors: [{ row: 0, message: "文件读取失败，请重新上传" }],
      });
    };
  });
}

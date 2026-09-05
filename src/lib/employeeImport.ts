import * as XLSX from "xlsx";
import type { Employee } from "@/types";

export interface EmployeeImportError {
  row: number;
  message: string;
}

export interface EmployeeImportResult {
  success: boolean;
  employees: Employee[];
  errors: EmployeeImportError[];
}

const TEMPLATE_HEADERS = [
  "工号（必填，唯一）",
  "姓名（必填）",
  "部门（选填）",
  "岗位（必填）",
  "技能等级（必填：初级/中级/高级）",
  "技能标签（选填，多个用逗号分隔）",
  "入职日期（必填，格式：YYYY-MM-DD）",
  "联系方式（必填）",
  "状态（选填：在职/离职，默认在职）",
  "身份证号（选填）",
  "紧急联系人（选填）",
];

const TEMPLATE_EXAMPLE = [
  [
    "E001",
    "张三",
    "生产部",
    "缝纫工",
    "中级",
    "缝纫,质检",
    "2023-05-10",
    "13800138000",
    "在职",
    "",
    "",
  ],
  [
    "E002",
    "李四",
    "质检部",
    "质检员",
    "高级",
    "质检",
    "2022-08-15",
    "13900139000",
    "在职",
    "",
    "",
  ],
];

export function downloadEmployeeTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ...TEMPLATE_EXAMPLE,
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "员工导入模板");
  XLSX.writeFile(wb, `员工导入模板_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function safeString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseDate(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-");
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  const date = new Date(s);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }
  return s;
}

function normalizeStatus(value: unknown): "active" | "inactive" {
  const v = String(value || "").trim();
  if (v === "离职" || v === "inactive" || v === "0") return "inactive";
  return "active";
}

function normalizeSkillLevel(value: unknown): string {
  const v = String(value || "").trim();
  if (v === "初级" || v === "高级") return v;
  return "中级";
}

function parseSkillTags(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  return String(value)
    .split(/[,，;；、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseRows(rows: unknown[][]): { dataRows: unknown[][]; header: unknown[] } {
  const header = rows[0] || [];
  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((cell) => cell !== "" && cell !== null && cell !== undefined));
  return { dataRows, header };
}

export async function parseEmployeeExcel(
  file: File,
  existingEmployees: Employee[],
): Promise<EmployeeImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          resolve({
            success: false,
            employees: [],
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
            employees: [],
            errors: [{ row: 0, message: "Excel文件无有效数据，请检查后重新上传" }],
          });
          return;
        }

        const errors: EmployeeImportError[] = [];
        const employees: Employee[] = [];
        const existingCodes = new Set(existingEmployees.map((e) => e.code));
        const usedCodes = new Set<string>();

        dataRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const code = safeString(row[0]);
          const name = safeString(row[1]);
          const department = safeString(row[2]);
          const position = safeString(row[3]);
          const skillLevel = normalizeSkillLevel(row[4]);
          const skillTags = parseSkillTags(row[5]);
          const hireDate = parseDate(row[6]);
          const phone = safeString(row[7]);
          const status = normalizeStatus(row[8]);
          const idCard = safeString(row[9]);
          const emergencyContact = safeString(row[10]);

          if (!code) errors.push({ row: rowNum, message: "工号不能为空" });
          if (!name) errors.push({ row: rowNum, message: "姓名不能为空" });
          if (!position) errors.push({ row: rowNum, message: "岗位不能为空" });
          if (!hireDate) errors.push({ row: rowNum, message: "入职日期不能为空" });
          if (hireDate && !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
            errors.push({ row: rowNum, message: "入职日期格式不正确，应为 YYYY-MM-DD" });
          }
          if (!phone) errors.push({ row: rowNum, message: "联系方式不能为空" });

          if (code && existingCodes.has(code)) {
            errors.push({ row: rowNum, message: `工号已存在：${code}` });
          }
          if (code && usedCodes.has(code)) {
            errors.push({ row: rowNum, message: `Excel中工号重复：${code}` });
          }

          if (errors.length > 0) return;

          usedCodes.add(code);
          employees.push({
            id: "",
            code,
            name,
            department: department || undefined,
            position,
            skill_level: skillLevel,
            skill_tags: skillTags,
            hire_date: hireDate,
            phone,
            status,
            id_card: idCard || undefined,
            emergency_contact: emergencyContact || undefined,
          });
        });

        if (errors.length > 0) {
          resolve({ success: false, employees: [], errors });
          return;
        }

        if (employees.length === 0) {
          resolve({
            success: false,
            employees: [],
            errors: [{ row: 0, message: "未解析到有效员工数据" }],
          });
          return;
        }

        resolve({ success: true, employees, errors: [] });
      } catch (err) {
        resolve({
          success: false,
          employees: [],
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
        employees: [],
        errors: [{ row: 0, message: "文件读取失败，请重新上传" }],
      });
    };
  });
}

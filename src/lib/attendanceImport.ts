import * as XLSX from "xlsx";
import type { AttendanceRecord } from "@/types";

export interface AttendanceImportError {
  row: number;
  message: string;
}

export interface AttendanceImportResult {
  success: boolean;
  records: AttendanceRecord[];
  errors: AttendanceImportError[];
}

const TEMPLATE_HEADERS = [
  "员工姓名（必填）",
  "日期（必填，格式：YYYY-MM-DD）",
  "上班打卡时间（选填，HH:MM）",
  "下班打卡时间（选填，HH:MM）",
  "状态（选填，正常/迟到/缺勤；为空时自动计算）",
];

const TEMPLATE_EXAMPLE = [
  ["张三", "2026-07-01", "07:35", "17:15", ""],
  ["李四", "2026-07-01", "08:10", "17:30", ""],
  ["王五", "2026-07-01", "", "", ""],
];

export function downloadAttendanceTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "考勤导入模板");
  XLSX.writeFile(
    wb,
    `考勤导入模板_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
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

function parseTime(value: unknown): string {
  const s = safeString(value);
  if (!s) return "";
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  if (/^\d{4}$/.test(s)) {
    const h = Number(s.slice(0, 2));
    const m = Number(s.slice(2, 4));
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  return s;
}

function calculateStatus(
  checkIn: string,
  checkOut: string,
  inputStatus: string,
): AttendanceRecord["status"] {
  const validStatus: AttendanceRecord["status"][] = [
    "normal",
    "late",
    "absent",
  ];
  if (validStatus.includes(inputStatus as AttendanceRecord["status"])) {
    return inputStatus as AttendanceRecord["status"];
  }
  if (!checkIn && !checkOut) return "absent";
  if (checkIn) {
    const [hourStr] = checkIn.split(":");
    const hour = Number(hourStr);
    if (hour >= 8) return "late";
    if (checkOut && checkOut >= "17:00") return "normal";
  }
  return "late";
}

function parseRows(rows: unknown[][]): { dataRows: unknown[][]; header: unknown[] } {
  const header = rows[0] || [];
  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((cell) => cell !== "" && cell !== null && cell !== undefined));
  return { dataRows, header };
}

export async function parseAttendanceExcel(
  file: File,
  employees: { id: string; name: string }[],
): Promise<AttendanceImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          resolve({
            success: false,
            records: [],
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
            records: [],
            errors: [{ row: 0, message: "Excel/CSV 文件无有效数据，请检查后重新上传" }],
          });
          return;
        }

        const errors: AttendanceImportError[] = [];
        const records: AttendanceRecord[] = [];
        const keySet = new Set<string>();
        const employeeMap = new Map(employees.map((e) => [e.name, e.id]));

        dataRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const name = safeString(row[0]);
          const recordDate = parseDate(row[1]);
          const checkIn = parseTime(row[2]);
          const checkOut = parseTime(row[3]);
          const inputStatus = safeString(row[4]);

          if (!name) errors.push({ row: rowNum, message: "员工姓名不能为空" });
          if (!recordDate) errors.push({ row: rowNum, message: "日期不能为空" });
          if (recordDate && !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
            errors.push({ row: rowNum, message: "日期格式不正确，应为 YYYY-MM-DD" });
          }
          if (checkIn && !/^\d{2}:\d{2}$/.test(checkIn)) {
            errors.push({ row: rowNum, message: "上班打卡时间格式不正确，应为 HH:MM" });
          }
          if (checkOut && !/^\d{2}:\d{2}$/.test(checkOut)) {
            errors.push({ row: rowNum, message: "下班打卡时间格式不正确，应为 HH:MM" });
          }

          const employeeId = employeeMap.get(name);
          if (name && !employeeId) {
            errors.push({ row: rowNum, message: `未找到员工：${name}` });
          }

          const key = `${employeeId}_${recordDate}`;
          if (employeeId && recordDate) {
            if (keySet.has(key)) {
              errors.push({ row: rowNum, message: `员工 ${name} 在 ${recordDate} 存在重复记录` });
            } else {
              keySet.add(key);
            }
          }

          if (errors.length > 0) return;

          const status = calculateStatus(checkIn, checkOut, inputStatus);
          records.push({
            id: "",
            employee_id: employeeId as string,
            employee_name: name,
            record_date: recordDate,
            check_in: checkIn || undefined,
            check_out: checkOut || undefined,
            status,
          });
        });

        if (errors.length > 0) {
          resolve({ success: false, records: [], errors });
          return;
        }

        if (records.length === 0) {
          resolve({
            success: false,
            records: [],
            errors: [{ row: 0, message: "未解析到有效考勤数据" }],
          });
          return;
        }

        resolve({ success: true, records, errors: [] });
      } catch (err) {
        resolve({
          success: false,
          records: [],
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
        records: [],
        errors: [{ row: 0, message: "文件读取失败，请重新上传" }],
      });
    };
  });
}

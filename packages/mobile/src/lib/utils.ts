import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { secureStorage } from "./storage";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(date?: string | null) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDate(date?: string | null) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatMoney(amount?: number | null) {
  if (amount === undefined || amount === null) return "-";
  return `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CURRENT_EMPLOYEE_KEY = "jinlong_current_employee";

export interface CurrentEmployee {
  id: string;
  code: string;
  name: string;
  department?: string;
  position?: string;
}

export async function getCurrentEmployee(): Promise<CurrentEmployee | null> {
  const raw = await secureStorage.getItem(CURRENT_EMPLOYEE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentEmployee;
  } catch {
    return null;
  }
}

export async function setCurrentEmployee(employee: CurrentEmployee | null) {
  if (employee) {
    await secureStorage.setItem(CURRENT_EMPLOYEE_KEY, JSON.stringify(employee));
  } else {
    await secureStorage.setItem(CURRENT_EMPLOYEE_KEY, "");
  }
}

export function parseEmployeeCode(data: string): string | null {
  const prefix = "jinlong:employee:";
  if (data.startsWith(prefix)) {
    return data.slice(prefix.length).trim();
  }
  return null;
}

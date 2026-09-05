import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Product, ProductSku, Material } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 校验设备保养/维修时间格式；record_date 格式为 yyyy-MM-dd HH:mm */
export function validateEquipmentRecordTime(recordDate: string): {
  valid: boolean;
  message?: string;
} {
  const date = new Date(recordDate.replace(" ", "T"));
  if (isNaN(date.getTime())) {
    return { valid: false, message: "时间格式不正确" };
  }
  return { valid: true };
}

/** 获取指定 SKU 对应的 BOM 清单；只返回属于该 SKU 的 BOM，互不影响 */
export function getProductBomsBySku(product: Product | undefined, skuId?: string) {
  if (!product) return [];
  if (!skuId) return [];
  return (product.boms || []).filter((b) => b.sku_id === skuId);
}

/** 从 SKU 信息中提取颜色：优先使用显式 color 字段，再尝试从 SKU 编码/条码解析 */
export function extractSkuColor(sku?: ProductSku): string {
  if (!sku) return "";
  if (sku.color?.trim()) return sku.color.trim();
  const source = (sku.barcode || sku.sku_code || sku.specification || sku.size || "").trim();
  if (!source) return "";
  // 常见 SKU 格式：SZ98729-2-white-200x230 / VTA-Q-230240-white
  const parts = source.split(/[-_]/);
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    // 排除纯数字、尺寸表达式（如 200x230, 230×240）
    if (/^\d+$/.test(p)) continue;
    if (/^\d+\s*[xX×*]\s*\d+/.test(p)) continue;
    if (/^\d+\s*cm$/i.test(p)) continue;
    if (/^\d+/i.test(p) && /[a-zA-Z]/.test(p) && !/[\u4e00-\u9fa5]/.test(p)) continue;
    return p;
  }
  return "";
}

/** 在物料档案中按 BOM 统称 + 工单颜色匹配具体物料；
 *  若 SKU 无颜色则直接匹配统称；
 *  返回匹配到的物料，以及缺失时需要提示的物料名称 */
export function resolveColorMaterial(
  baseName: string,
  color: string,
  materials: Material[],
  baseCode?: string,
): { material?: Material; missingName?: string } {
  const normalized = baseName.trim();
  if (!normalized) return {};
  const lowerColor = color.trim().toLowerCase();
  const upperColor = color.trim().toUpperCase();
  if (lowerColor) {
    const colorName = `${normalized}-${lowerColor}`;
    const found = materials.find(
      (m) =>
        m.name === colorName ||
        m.code === colorName ||
        m.name === `${normalized}${lowerColor}` ||
        m.name === `${normalized}-${upperColor}` ||
        m.name === `${normalized}${upperColor}` ||
        (baseCode &&
          (m.code === `${baseCode}-${upperColor}` ||
            m.code === `${baseCode}-${lowerColor}` ||
            m.code === `${baseCode}${upperColor}` ||
            m.code === `${baseCode}${lowerColor}`)),
    );
    if (found) return { material: found };
    return { missingName: colorName };
  }
  const found = materials.find((m) => m.name === normalized || m.code === normalized);
  if (found) return { material: found };
  return { missingName: normalized };
}

export type Params = Partial<
  Record<keyof URLSearchParams, string | number | null | undefined>
>;

export function createQueryString(
  params: Params,
  searchParams: URLSearchParams
) {
  const newSearchParams = new URLSearchParams(searchParams?.toString());

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      newSearchParams.delete(key);
    } else {
      newSearchParams.set(key, String(value));
    }
  }

  return newSearchParams.toString();
}

export function formatDate(
  date: Date | string | number,
  opts: Intl.DateTimeFormatOptions = {}
) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: opts.month ?? "long",
    day: opts.day ?? "numeric",
    year: opts.year ?? "numeric",
    ...opts,
  }).format(new Date(date));
}

/** 将时间字符串或日期转为北京时间 'YYYY-MM-DD HH:mm:ss' */
export function formatBeijingTime(date: Date | string | number | undefined) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const parts = new Intl.DateTimeFormat("zh-CN", options).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value.padStart(2, "0") || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function formatBeijingDate(date: Date | string | number | undefined) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  const parts = new Intl.DateTimeFormat("zh-CN", options).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value.padStart(2, "0") || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 获取当前北京时间，格式为 'YYYY-MM-DD HH:mm:ss' */
export function beijingNow(): string {
  return formatBeijingTime(new Date());
}

export function nanoid(size = 12) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < size; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 降级实现：UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

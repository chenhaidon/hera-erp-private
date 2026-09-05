import * as XLSX from "xlsx";
import type { Product, ProductSku } from "@/types";

export interface ProductImportError {
  row: number;
  message: string;
}

export interface ProductImportResult {
  success: boolean;
  products: Product[];
  errors: ProductImportError[];
  /** 需要从本地上传的图片文件名（Excel 中填写了文件名而非 URL） */
  pendingImages: string[];
}

const TEMPLATE_TITLE = "成品导入模板";
const TEMPLATE_HEADERS = [
  "款号（必填，唯一）",
  "品名（必填）",
  "类别（必填）",
  "单位（必填）",
  "描述（选填）",
  "产品图片（选填）",
  "SKU规格（必填）",
  "尺寸（必填）",
  "花色（必填）",
  "颜色（必填）",
  "填充克重(g)（必填）",
  "花型（必填）",
  "绗缝工艺（必填）",
  "重量(g)（选填，图片未提供）",
  "条形码（选填，图片未提供）",
  "建议售价（必填）",
  "SKU状态（选填：active/inactive）",
];

const TEMPLATE_EXAMPLE = [
  ["BD01", "波浪形拼接被", "被子", "套", "BD波浪+小波浪夹边被", "", "XL 300×270cm / 50×91cm×2", "300×270cm / 50×91cm×2", "09花型", "摩卡棕", 120, "09花型", "中心10cm绗缝", "", "", 210, "active"],
  ["BD01", "波浪形拼接被", "被子", "套", "BD波浪+小波浪夹边被", "", "3XL 330×300cm / 50×91cm×2", "330×300cm / 50×91cm×2", "09花型", "摩卡棕", 120, "09花型", "中心10cm绗缝", "", "", 220, "active"],
  ["BD02", "波浪形拼接被", "被子", "套", "BD波浪+小波浪夹边被", "", "XL 300×270cm / 50×91cm×2", "300×270cm / 50×91cm×2", "09花型", "#灰", 120, "09花型", "中心10cm绗缝", "", "", 210, "active"],
  ["BL05", "波浪形拼接被", "被子", "套", "BD波浪+小波浪夹边被", "", "QU 230×245cm / 50×71cm×2", "230×245cm / 50×71cm×2", "09花型", "黑色", 120, "09花型", "中心10cm绗缝", "", "", 130, "active"],
];

// 列名别名映射
const COL_ALIASES: Record<string, string[]> = {
  code: ["货号", "款号"],
  name: ["品名", "产品名称"],
  category: ["类别", "分类"],
  unit: ["单位"],
  description: ["描述", "备注"],
  images: ["产品图片", "图片"],
  specification: ["SKU规格", "尺寸/规格", "规格"],
  size: ["尺寸", "尺码"],
  pattern: ["花色", "款式"],
  color: ["颜色"],
  fillingWeight: ["填充克重"],
  quiltPattern: ["花型"],
  quiltProcess: ["绗缝工艺"],
  weight: ["重量", "成品重量"],
  barcode: ["条形码", "条码"],
  suggestedPrice: ["建议售价", "单价"],
  skuStatus: ["SKU状态"],
};

function isPositiveNumber(value: unknown): boolean {
  const num = Number(value);
  return !Number.isNaN(num) && num > 0;
}

function isNonNegativeNumber(value: unknown): boolean {
  const num = Number(value);
  return !Number.isNaN(num) && num >= 0;
}

function normalizeSkuStatus(value: unknown): "active" | "inactive" {
  const v = String(value || "").trim().toLowerCase();
  if (v === "inactive" || v === "停用" || v === "0") return "inactive";
  return "active";
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseImages(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function downloadProductTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    [TEMPLATE_TITLE],
    TEMPLATE_HEADERS,
    ...TEMPLATE_EXAMPLE,
  ]);
  ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 26 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "成品导入模板");
  XLSX.writeFile(wb, `成品导入模板_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function parseProductExcel(
  file: File,
  existingProducts: Product[],
  validCategories: string[],
): Promise<ProductImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          resolve({
            success: false,
            products: [],
            errors: [{ row: 0, message: "文件读取失败，请重新上传" }],
            pendingImages: [],
          });
          return;
        }
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          blankrows: false,
        }) as unknown[][];

        if (rows.length === 0) {
          resolve({
            success: false,
            products: [],
            errors: [{ row: 0, message: "Excel文件无有效数据，请检查后重新上传" }],
            pendingImages: [],
          });
          return;
        }

        // 查找表头行（包含"货号"或"款号"的行）
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
          const cells = rows[i].map((c) => String(c).trim());
          if (cells.includes("货号") || cells.includes("款号")) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) {
          resolve({
            success: false,
            products: [],
            errors: [{ row: 0, message: "未找到表头行（需包含「货号」或「款号」列）" }],
            pendingImages: [],
          });
          return;
        }

        // 构建列名 -> 列索引映射
        const colMap: Record<string, number> = {};
        rows[headerIdx].forEach((c, i) => {
          const t = String(c).trim();
          if (t) colMap[t] = i;
        });
        const findCol = (field: string): number => {
          const aliases = COL_ALIASES[field] || [];
          // 1. 精确匹配
          for (const alias of aliases) {
            if (colMap[alias] !== undefined) return colMap[alias];
          }
          // 2. 包含匹配（兼容表头带括号后缀，如「尺寸（必填）」）
          for (const alias of aliases) {
            const hit = Object.keys(colMap).find((h) => h.includes(alias));
            if (hit !== undefined) return colMap[hit];
          }
          return -1;
        };

        const dataRows = rows
          .slice(headerIdx + 1)
          .filter((row) => row.some((cell) => cell !== "" && cell !== null && cell !== undefined));

        if (dataRows.length === 0) {
          resolve({
            success: false,
            products: [],
            errors: [{ row: 0, message: "Excel文件无有效数据，请检查后重新上传" }],
            pendingImages: [],
          });
          return;
        }

        const errors: ProductImportError[] = [];
        const productMap = new Map<string, Product>();
        const usedSkuCodes = new Set<string>();
        const usedBarcodes = new Set<string>();
        const existingCodes = new Set(existingProducts.map((p) => p.code));
        const existingBarcodes = new Set(
          existingProducts.flatMap((p) => p.skus?.map((s) => s.barcode) || []),
        );
        const pendingImages = new Set<string>();
        const productImages = new Map<string, string[]>();

        const ciCode = findCol("code");
        const ciName = findCol("name");
        const ciCategory = findCol("category");
        const ciUnit = findCol("unit");
        const ciDesc = findCol("description");
        const ciImages = findCol("images");
        const ciSpec = findCol("specification");
        const ciSize = findCol("size");
        const ciPattern = findCol("pattern");
        const ciColor = findCol("color");
        const ciFill = findCol("fillingWeight");
        const ciQuiltPattern = findCol("quiltPattern");
        const ciQuiltProcess = findCol("quiltProcess");
        const ciWeight = findCol("weight");
        const ciBarcode = findCol("barcode");
        const ciPrice = findCol("suggestedPrice");
        const ciSkuStatus = findCol("skuStatus");

        dataRows.forEach((row, idx) => {
          const rowNum = headerIdx + idx + 2;
          const get = (ci: number) => (ci === -1 ? "" : String(row[ci] ?? "").trim());
          const code = get(ciCode);
          // 同前缀（如 BD01/BD02/BD06 均为 "BD"）视为同一成品
          const productCode = (code.match(/^[A-Za-z]+/) || [code])[0];
          const name = get(ciName);
          const category = get(ciCategory) || "绗缝被";
          const unit = get(ciUnit) || "套";
          const description = get(ciDesc);
          const rawImages = ciImages === -1 ? [] : parseImages(row[ciImages]);
          const specification = get(ciSpec);
          const size = get(ciSize);
          const pattern = get(ciPattern);
          const color = get(ciColor);
          const fillingWeight = ciFill === -1 ? 0 : row[ciFill];
          const quiltPattern = get(ciQuiltPattern) || pattern;
          const quiltProcess = get(ciQuiltProcess);
          const weight = ciWeight === -1 ? 0 : row[ciWeight];
          let barcode = get(ciBarcode);
          const suggestedPrice = ciPrice === -1 ? "" : row[ciPrice];
          const skuStatus = normalizeSkuStatus(ciSkuStatus === -1 ? "" : row[ciSkuStatus]);

          if (!code) errors.push({ row: rowNum, message: "货号不能为空" });
          if (!name) errors.push({ row: rowNum, message: "品名不能为空" });
          if (category && validCategories.length > 0 && !validCategories.includes(category)) {
            errors.push({ row: rowNum, message: `类别不存在：${category}` });
          }
          rawImages.forEach((img) => {
            if (!looksLikeUrl(img)) pendingImages.add(img);
          });
          if (!specification) errors.push({ row: rowNum, message: "尺寸/规格不能为空" });
          if (ciFill !== -1 && fillingWeight !== "" && !isNonNegativeNumber(fillingWeight)) {
            errors.push({ row: rowNum, message: "填充克重必须为非负数" });
          }
          if (ciWeight !== -1 && weight !== "" && !isNonNegativeNumber(weight)) {
            errors.push({ row: rowNum, message: "重量必须为非负数" });
          }
          if (barcode && existingBarcodes.has(barcode)) {
            errors.push({ row: rowNum, message: `条形码已存在：${barcode}` });
          }
          if (barcode && usedBarcodes.has(barcode)) {
            errors.push({ row: rowNum, message: `Excel中条形码重复：${barcode}` });
          }
          if (!isPositiveNumber(suggestedPrice)) {
            errors.push({ row: rowNum, message: "单价必须大于0" });
          }
          if (code && existingCodes.has(productCode)) {
            errors.push({ row: rowNum, message: `成品货号已存在：${productCode}` });
          }

          if (errors.length > 0) return;

          // 条形码缺失时自动生成
          if (!barcode) {
            barcode = `SKU-${code}-${size}`.replace(/\s+/g, "");
          }
          usedBarcodes.add(barcode);

          // SKU编码使用完整货号+尺码，保证同成品下不同货号唯一
          const skuCode = `${code}-${size}`;
          if (usedSkuCodes.has(skuCode)) {
            errors.push({
              row: rowNum,
              message: `货号 ${code}（${size}）重复`,
            });
            return;
          }
          usedSkuCodes.add(skuCode);

          const sku: ProductSku = {
            id: "",
            sku_code: skuCode,
            specification,
            size,
            pattern,
            color,
            filling_weight: Number(fillingWeight) || 0,
            quilt_pattern: quiltPattern,
            quilt_process: quiltProcess,
            weight: Number(weight) || 0,
            barcode,
            suggested_price: Number(Number(suggestedPrice).toFixed(2)),
            currency: "CNY",
            unit,
            status: skuStatus,
            stock: 0,
          };

          let product = productMap.get(productCode);
          if (!product) {
            product = {
              id: "",
              code: productCode,
              name,
              category,
              unit,
              description,
              images: rawImages.filter(looksLikeUrl),
              process_list: [],
              status: "active",
              skus: [sku],
              boms: [],
              pricing_strategy: {
                markup_rate: 0,
                target_profit_rate: 0,
                min_price: 0,
                suggested_price: sku.suggested_price,
              },
            };
            productMap.set(productCode, product);
            productImages.set(productCode, rawImages);
          } else {
            if (product.name !== name) {
              errors.push({
                row: rowNum,
                message: `成品 ${productCode} 品名不一致，请保持同一成品品名相同`,
              });
            }
            if (product.category !== category) {
              errors.push({
                row: rowNum,
                message: `成品 ${productCode} 类别不一致，请保持同一成品类别相同`,
              });
            }
            if (product.unit !== unit) {
              errors.push({
                row: rowNum,
                message: `成品 ${productCode} 单位不一致，请保持同一成品单位相同`,
              });
            }
            product.skus.push(sku);
          }

          const imagesForCode = productImages.get(productCode) || [];
          if (imagesForCode.length === 0) {
            productImages.set(productCode, rawImages);
          }
        });

        if (errors.length > 0) {
          resolve({
            success: false,
            products: [],
            errors,
            pendingImages: Array.from(pendingImages),
          });
          return;
        }

        if (productMap.size === 0) {
          resolve({
            success: false,
            products: [],
            errors: [{ row: 0, message: "未解析到有效成品数据" }],
            pendingImages: Array.from(pendingImages),
          });
          return;
        }

        const finalProducts = Array.from(productMap.values()).map((p) => ({
          ...p,
          images: p.images.length > 0 ? p.images : [],
        }));

        resolve({
          success: true,
          products: finalProducts,
          errors: [],
          pendingImages: Array.from(pendingImages),
        });
      } catch (err) {
        resolve({
          success: false,
          products: [],
          errors: [
            {
              row: 0,
              message: `文件解析失败：${err instanceof Error ? err.message : "未知错误"}`,
            },
          ],
          pendingImages: [],
        });
      }
    };
    reader.onerror = () => {
      resolve({
        success: false,
        products: [],
        errors: [{ row: 0, message: "文件读取失败，请重新上传" }],
        pendingImages: [],
      });
    };
  });
}

export function sanitizeFileName(name: string) {
  const base = name.replace(/[^a-zA-Z0-9.]/g, "_").replace(/_+/g, "_");
  const ext = base.split(".").pop() || "bin";
  const stem = base.slice(0, base.lastIndexOf(".")) || "file";
  return `${stem.slice(0, 40)}_${Date.now()}.${ext}`;
}

export function compressImage(
  file: File,
  maxWidth = 1080,
  quality = 0.8,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法创建 canvas 上下文"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("压缩失败"))),
        "image/webp",
        quality,
      );
    };
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = URL.createObjectURL(file);
  });
}
import * as XLSX from "xlsx";
import type { Product, ProductBom, ProductSku, Material } from "@/types";
import { nanoid } from "@/lib/utils";
import { MATERIAL_CATEGORIES } from "@/lib/data";

export interface BomImportError {
  row: number;
  sheet: string;
  message: string;
}

export interface BomImportUnmatchedSpec {
  /** Excel 中的成品规格文本 */
  spec: string;
  /** 出现该规格的数据行号（用于提示） */
  rows: number[];
  /** 原始 sheet 名 */
  sheet: string;
}

export interface BomImportResult {
  success: boolean;
  /** 解析出的 BOM 行（包含 sku_id 待填充） */
  boms: ProductBom[];
  /** 需要新建的物料 */
  newMaterials: Material[];
  /** 需要更新的物料（导入的布号/布色/门幅/规格补充到档案） */
  updatedMaterials: Material[];
  errors: BomImportError[];
  /** 自动匹配失败的规格列表 */
  unmatchedSpecs: BomImportUnmatchedSpec[];
  /** 是否从汇总 sheet 解析 */
  fromSummary: boolean;
}

export type SpecMapping = Record<string, string>;

const SUMMARY_SHEET_NAMES = ["BOM汇总", "BOM汇总表", "BOM", "汇总"];

// 汇总表表头别名
const SUMMARY_COL_ALIASES: Record<string, string[]> = {
  productStyle: ["款式", "产品款式", "成品款式"],
  productSpec: ["成品规格", "产品规格", "规格", "尺寸"],
  materialCode: ["物料编码", "物料代码", "材料编码"],
  materialName: ["物料名称", "材料名称", "物料"],
  fabricNo: ["布号", "物料布号"],
  color: ["布色", "颜色", "物料颜色"],
  unit: ["单位"],
  dosage: ["单套用量", "用量", "单套定额", "定额"],
  sourceProcessOrder: ["来源工艺单", "工艺单", "来源"],
  remark: ["备注"],
};

// 明细表表头别名
const DETAIL_COL_ALIASES: Record<string, string[]> = {
  materialName: ["物料名称", "材料名称", "物料"],
  component: ["部件", "部位"],
  fabricWidth: ["门幅", "幅宽"],
  cuttingSpecification: ["裁剪规格", "裁剪尺寸", "规格"],
  unit: ["单位"],
  dosage: ["单套用量", "用量", "单套定额", "定额"],
  processRemark: ["工艺备注", "备注", "工艺说明"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeMaterialKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[0-9gGmMkKcC²/\.]+/g, "")
    .replace(/[（(].*?[）)]/g, "");
}

function findHeader(headers: string[], aliases: string[]): string | undefined {
  // 精确匹配
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h === alias);
    if (idx !== -1) return headers[idx];
  }
  // 包含匹配（兼容「物料名称（必填）」等）
  for (const alias of aliases) {
    const hit = headers.find((h) => h.includes(alias));
    if (hit) return hit;
  }
  return undefined;
}

function parseNumber(value: unknown): number {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function extractSizeNumbers(text: string): string {
  // 提取类似 300×270、300x300、330*300 的尺寸
  return text
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[×xX*]/g, "×")
    .replace(/[cCｍm]$/, "")
    .replace(/[cCｍm]$/g, "");
}

function findSkuForSpec(
  product: Product,
  specText: string,
): ProductSku | undefined {
  const normalized = specText.replace(/\s+/g, "").replace(/[cCｍm]$/, "");
  const normalizedNums = extractSizeNumbers(specText);

  return (product.skus || []).find((sku) => {
    const candidates = [
      sku.size,
      sku.specification,
      sku.barcode,
      sku.sku_code,
    ].filter(Boolean) as string[];

    for (const raw of candidates) {
      const candidate = raw.replace(/\s+/g, "").replace(/[cCｍm]$/, "");
      if (
        candidate === normalized ||
        candidate.includes(normalized) ||
        normalized.includes(candidate)
      ) {
        return true;
      }
      // 数字尺寸匹配：如 300×270
      const candidateNums = extractSizeNumbers(raw);
      if (
        candidateNums === normalizedNums &&
        normalizedNums.length > 0 &&
        /\d+×\d+/.test(normalizedNums)
      ) {
        return true;
      }
    }
    return false;
  });
}

function findMaterialByCodeOrName(
  materials: Material[],
  code: string,
  name: string,
): Material | undefined {
  if (code) {
    const byCode = materials.find((m) => m.code === code);
    if (byCode) return byCode;
  }
  if (name) {
    const byName = materials.find((m) => m.name === name);
    if (byName) return byName;
  }
  return undefined;
}

function guessMaterialCategory(materialName: string): string {
  const name = materialName.toLowerCase();
  if (name.includes("棉") || name.includes("绒") || name.includes("布")) {
    return "面料";
  }
  if (name.includes("无胶棉") || name.includes("棉") || name.includes("填充")) {
    return "填充物";
  }
  if (name.includes("线") || name.includes("拉链") || name.includes("包边")) {
    return "辅料";
  }
  return "面料";
}

function buildMaterialFromRow(
  code: string,
  name: string,
  unit: string,
  fabricWidth?: string,
  cuttingSpec?: string,
  color?: string,
  fabricNo?: string,
): Material {
  return {
    id: nanoid(),
    code: code || `MAT-${nanoid().slice(0, 8).toUpperCase()}`,
    name,
    category: guessMaterialCategory(name),
    specification: cuttingSpec || "",
    unit: unit || "米",
    default_supplier: "",
    color: color || "",
    pattern_code: "",
    composition: "",
    weight: 0,
    resilience_level: "",
    safety_stock: 0,
    stock: 0,
    status: "active",
    width: fabricWidth,
    fabric_no: fabricNo,
  };
}

function buildBomRow(
  sku: ProductSku,
  material: Material,
  dosage: number,
  unit: string,
  extra: Partial<ProductBom> = {},
): ProductBom {
  return {
    id: nanoid(),
    sku_id: sku.id,
    sku_specification: sku.specification || sku.size || "",
    material_id: material.id,
    material_code: material.code,
    material_name: material.name,
    category: material.category,
    specification: material.specification || "",
    dosage,
    unit: unit || material.unit,
    ...extra,
  };
}

function addUnmatchedSpec(
  list: BomImportUnmatchedSpec[],
  spec: string,
  row: number,
  sheet: string,
) {
  const existing = list.find((item) => item.spec === spec && item.sheet === sheet);
  if (existing) {
    existing.rows.push(row);
  } else {
    list.push({ spec, rows: [row], sheet });
  }
}

type DetailBomInfo = {
  component?: string;
  fabric_width?: string;
  cutting_specification?: string;
  process_remark?: string;
};

function parseSummarySheet(
  sheet: XLSX.WorkSheet,
  product: Product,
  materials: Material[],
  sheetName: string,
  unmatchedSpecs: BomImportUnmatchedSpec[],
  detailMap: Map<string, DetailBomInfo>,
): Pick<BomImportResult, "boms" | "newMaterials" | "updatedMaterials" | "errors"> {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  const errors: BomImportError[] = [];
  const boms: ProductBom[] = [];
  const newMaterials: Material[] = [];
  const updatedMaterials: Material[] = [];

  if (rows.length === 0) {
    return { boms, newMaterials, updatedMaterials, errors };
  }

  // 查找表头行
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => normalizeHeader(c));
    if (findHeader(cells, SUMMARY_COL_ALIASES.materialName)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    errors.push({ row: 0, sheet: sheetName, message: "未找到有效表头" });
    return { boms, newMaterials, updatedMaterials, errors };
  }

  const headers = rows[headerIdx].map((c) => normalizeHeader(c));
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h) colMap[h] = i;
  });

  const getCol = (field: keyof typeof SUMMARY_COL_ALIASES): number => {
    const headerKey = findHeader(headers, SUMMARY_COL_ALIASES[field]);
    return headerKey ? colMap[headerKey] : -1;
  };

  const ciProductStyle = getCol("productStyle");
  const ciProductSpec = getCol("productSpec");
  const ciMaterialCode = getCol("materialCode");
  const ciMaterialName = getCol("materialName");
  const ciFabricNo = getCol("fabricNo");
  const ciColor = getCol("color");
  const ciUnit = getCol("unit");
  const ciDosage = getCol("dosage");
  const ciSourceProcessOrder = getCol("sourceProcessOrder");
  const ciRemark = getCol("remark");

  const dataRows = rows
    .slice(headerIdx + 1)
    .filter((row) => row.some((c) => c !== "" && c !== null && c !== undefined));

  dataRows.forEach((row, idx) => {
    const rowNum = headerIdx + idx + 2;
    const get = (ci: number) => (ci === -1 ? "" : String(row[ci] ?? "").trim());
    const getNum = (ci: number) => (ci === -1 ? 0 : parseNumber(row[ci]));

    const materialName = get(ciMaterialName);
    if (!materialName) {
      // 空行跳过
      return;
    }
    const materialCode = get(ciMaterialCode);
    const productSpec = get(ciProductSpec);
    const fabricNo = get(ciFabricNo);
    const color = get(ciColor);
    const unit = get(ciUnit);
    const dosage = getNum(ciDosage);
    const sourceProcessOrder = get(ciSourceProcessOrder);
    const remark = get(ciRemark);

    if (!productSpec) {
      errors.push({ row: rowNum, sheet: sheetName, message: "成品规格不能为空" });
      return;
    }
    if (dosage <= 0) {
      errors.push({ row: rowNum, sheet: sheetName, message: "单套用量必须大于0" });
      return;
    }

    // 尝试从同文件的明细表中补充门幅/裁剪规格/部件/工艺备注
    const detailKey = `${productSpec.replace(/\s+/g, "")}|${normalizeMaterialKey(materialName)}`;
    const detailInfo = detailMap.get(detailKey);

    // 先查找/创建物料，未匹配规格时也需要物料信息生成占位 BOM
    let material = findMaterialByCodeOrName(materials, materialCode, materialName);
    let isNewMaterial = false;
    if (material) {
      // 物料已存在：用 Excel 中的布号/布色/门幅/规格补充档案缺失字段
      const nextMaterial = { ...material };
      if (!nextMaterial.fabric_no && fabricNo) nextMaterial.fabric_no = fabricNo;
      if (!nextMaterial.color && color) nextMaterial.color = color;
      if (!nextMaterial.width && detailInfo?.fabric_width)
        nextMaterial.width = detailInfo.fabric_width;
      if (!nextMaterial.specification && detailInfo?.cutting_specification)
        nextMaterial.specification = detailInfo.cutting_specification;
      if (
        nextMaterial.fabric_no !== material.fabric_no ||
        nextMaterial.color !== material.color ||
        nextMaterial.width !== material.width ||
        nextMaterial.specification !== material.specification
      ) {
        material = nextMaterial;
        if (!updatedMaterials.some((m) => m.id === material!.id)) {
          updatedMaterials.push(material);
        }
      }
    } else {
      // 尝试从已解析的新物料中查找
      material = findMaterialByCodeOrName(
        newMaterials,
        materialCode,
        materialName,
      );
      if (!material) {
        material = buildMaterialFromRow(
          materialCode,
          materialName,
          unit,
          detailInfo?.fabric_width,
          detailInfo?.cutting_specification,
          color,
          fabricNo,
        );
        newMaterials.push(material);
        isNewMaterial = true;
      }
    }

    const sku = findSkuForSpec(product, productSpec);
    if (!sku) {
      addUnmatchedSpec(unmatchedSpecs, productSpec, rowNum, sheetName);
      // 仍生成占位 BOM，便于后续规格映射
      const placeholderSku: ProductSku = {
        id: `__UNMATCHED__${productSpec}`,
        specification: productSpec,
        size: productSpec,
        pattern: "",
        color: "",
        filling_weight: 0,
        quilt_pattern: "",
        quilt_process: "",
        weight: 0,
        barcode: "",
        suggested_price: 0,
      };
      boms.push(
        buildBomRow(placeholderSku, material, dosage, unit, {
          source_process_order: sourceProcessOrder,
          remark,
        }),
      );
      return;
    }
    // 避免同一 SKU 下重复物料
    if (
      boms.some(
        (b) => b.sku_id === sku.id && b.material_code === material!.code,
      ) &&
      !isNewMaterial
    ) {
      // 同一物料出现多次，累加用量，并补充缺失的字段
      const existing = boms.find(
        (b) => b.sku_id === sku.id && b.material_code === material!.code,
      )!;
      existing.dosage = Number((existing.dosage + dosage).toFixed(4));
      if (!existing.fabric_width)
        existing.fabric_width =
          detailInfo?.fabric_width || material!.width || "";
      if (!existing.cutting_specification)
        existing.cutting_specification =
          detailInfo?.cutting_specification || material!.specification || "";
      if (!existing.component)
        existing.component = detailInfo?.component || "";
      if (!existing.process_remark)
        existing.process_remark = detailInfo?.process_remark || "";
      return;
    }

    boms.push(
      buildBomRow(sku, material, dosage, unit, {
        source_process_order: sourceProcessOrder,
        remark,
        component: detailInfo?.component || "",
        fabric_width:
          detailInfo?.fabric_width || material.width || "",
        cutting_specification:
          detailInfo?.cutting_specification ||
          material.specification ||
          "",
        process_remark: detailInfo?.process_remark || "",
      }),
    );
  });

  return { boms, newMaterials, updatedMaterials, errors };
}

function parseDetailSheet(
  sheet: XLSX.WorkSheet,
  product: Product,
  materials: Material[],
  newMaterials: Material[],
  sheetName: string,
  unmatchedSpecs: BomImportUnmatchedSpec[],
): Pick<BomImportResult, "boms" | "errors"> {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  const errors: BomImportError[] = [];
  const boms: ProductBom[] = [];

  if (rows.length === 0) return { boms, errors };

  // 查找表头行
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => normalizeHeader(c));
    if (findHeader(cells, DETAIL_COL_ALIASES.materialName)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    errors.push({ row: 0, sheet: sheetName, message: "未找到有效表头" });
    return { boms, errors };
  }

  const headers = rows[headerIdx].map((c) => normalizeHeader(c));
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h) colMap[h] = i;
  });

  const getCol = (field: keyof typeof DETAIL_COL_ALIASES): number => {
    const headerKey = findHeader(headers, DETAIL_COL_ALIASES[field]);
    return headerKey ? colMap[headerKey] : -1;
  };

  const ciMaterialName = getCol("materialName");
  const ciComponent = getCol("component");
  const ciFabricWidth = getCol("fabricWidth");
  const ciCuttingSpec = getCol("cuttingSpecification");
  const ciUnit = getCol("unit");
  const ciDosage = getCol("dosage");
  const ciProcessRemark = getCol("processRemark");

  // 从 sheet 名解析规格，如 BOM_300x270 -> 300×270cm
  let specFromSheet = "";
  const match = sheetName.match(/BOM_(\d+)x(\d+)/i);
  if (match) {
    specFromSheet = `${match[1]}×${match[2]}cm`;
  }
  // 也可以从第一行标题解析
  const titleRow = rows[0].map((c) => String(c ?? ""));
  const title = titleRow.join("");
  const titleMatch = title.match(/(\d+\s*[×xX]\s*\d+)\s*[cCｍm]/);
  if (titleMatch) {
    specFromSheet = titleMatch[1].replace(/\s*/g, "") + "cm";
  }

  const dataRows = rows
    .slice(headerIdx + 1)
    .filter((row) => row.some((c) => c !== "" && c !== null && c !== undefined));

  dataRows.forEach((row, idx) => {
    const rowNum = headerIdx + idx + 2;
    const get = (ci: number) => (ci === -1 ? "" : String(row[ci] ?? "").trim());
    const getNum = (ci: number) => (ci === -1 ? 0 : parseNumber(row[ci]));

    const materialName = get(ciMaterialName);
    if (!materialName) return;

    const component = get(ciComponent);
    const fabricWidth = get(ciFabricWidth);
    const cuttingSpecification = get(ciCuttingSpec);
    const unit = get(ciUnit);
    const dosage = getNum(ciDosage);
    const processRemark = get(ciProcessRemark);

    if (dosage <= 0) {
      errors.push({ row: rowNum, sheet: sheetName, message: "单套用量必须大于0" });
      return;
    }

    // 先查找/创建物料
    let material = findMaterialByCodeOrName(materials, "", materialName);
    if (!material) {
      material = findMaterialByCodeOrName(newMaterials, "", materialName);
    }
    if (!material) {
      material = buildMaterialFromRow(
        "",
        materialName,
        unit,
        fabricWidth,
        cuttingSpecification,
      );
      newMaterials.push(material);
    }

    // 匹配 SKU：优先使用 sheet 名解析的规格
    const sku = specFromSheet
      ? findSkuForSpec(product, specFromSheet)
      : undefined;
    if (!sku) {
      addUnmatchedSpec(unmatchedSpecs, specFromSheet || "未知", rowNum, sheetName);
      const placeholderSku: ProductSku = {
        id: `__UNMATCHED__${specFromSheet}`,
        specification: specFromSheet || "",
        size: specFromSheet || "",
        pattern: "",
        color: "",
        filling_weight: 0,
        quilt_pattern: "",
        quilt_process: "",
        weight: 0,
        barcode: "",
        suggested_price: 0,
      };
      boms.push(
        buildBomRow(placeholderSku, material, dosage, unit, {
          component,
          fabric_width: fabricWidth,
          cutting_specification: cuttingSpecification,
          process_remark: processRemark,
        }),
      );
      return;
    }

    boms.push(
      buildBomRow(sku, material, dosage, unit, {
        component,
        fabric_width: fabricWidth,
        cutting_specification: cuttingSpecification,
        process_remark: processRemark,
      }),
    );
  });

  return { boms, errors };
}

export async function parseBomExcel(
  file: File,
  product: Product,
  materials: Material[],
): Promise<BomImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          resolve({
            success: false,
            boms: [],
            newMaterials: [],
            updatedMaterials: [],
            errors: [{ row: 0, sheet: "", message: "文件读取失败" }],
            unmatchedSpecs: [],
            fromSummary: false,
          });
          return;
        }

        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        if (workbook.SheetNames.length === 0) {
          resolve({
            success: false,
            boms: [],
            newMaterials: [],
            updatedMaterials: [],
            errors: [{ row: 0, sheet: "", message: "Excel文件无工作表" }],
            unmatchedSpecs: [],
            fromSummary: false,
          });
          return;
        }

        const allBoms: ProductBom[] = [];
        const allNewMaterials: Material[] = [];
        const allUpdatedMaterials: Material[] = [];
        const allErrors: BomImportError[] = [];
        const allUnmatchedSpecs: BomImportUnmatchedSpec[] = [];

        // 优先查找汇总表
        const summarySheetName = workbook.SheetNames.find((n) =>
          SUMMARY_SHEET_NAMES.includes(n),
        );
        const fromSummary = !!summarySheetName;

        // 无论是否有汇总表，先解析明细表，用于补充门幅/裁剪规格等字段
        const detailMap = new Map<string, DetailBomInfo>();
        const detailSheets = workbook.SheetNames.filter((n) =>
          n.toLowerCase().startsWith("bom_"),
        );
        detailSheets.forEach((sheetName) => {
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            header: 1,
            defval: "",
            blankrows: false,
          }) as unknown[][];

          // 从 sheet 名或标题解析规格
          let specFromSheet = "";
          const match = sheetName.match(/BOM_(\d+)x(\d+)/i);
          if (match) specFromSheet = `${match[1]}×${match[2]}cm`;
          const titleRow = rows[0]?.map((c) => String(c ?? "")) || [];
          const title = titleRow.join("");
          const titleMatch = title.match(/(\d+\s*[×xX]\s*\d+)\s*[cCｍm]/);
          if (titleMatch) {
            specFromSheet = titleMatch[1].replace(/\s*/g, "") + "cm";
          }

          // 查找表头
          let headerIdx = -1;
          for (let i = 0; i < rows.length; i++) {
            const cells = rows[i].map((c) => normalizeHeader(c));
            if (findHeader(cells, DETAIL_COL_ALIASES.materialName)) {
              headerIdx = i;
              break;
            }
          }
          if (headerIdx === -1) return;

          const headers = rows[headerIdx].map((c) => normalizeHeader(c));
          const colMap: Record<string, number> = {};
          headers.forEach((h, i) => {
            if (h) colMap[h] = i;
          });
          const getCol = (field: keyof typeof DETAIL_COL_ALIASES): number => {
            const headerKey = findHeader(headers, DETAIL_COL_ALIASES[field]);
            return headerKey ? colMap[headerKey] : -1;
          };
          const ciMaterialName = getCol("materialName");
          const ciComponent = getCol("component");
          const ciFabricWidth = getCol("fabricWidth");
          const ciCuttingSpec = getCol("cuttingSpecification");
          const ciProcessRemark = getCol("processRemark");

          const dataRows = rows
            .slice(headerIdx + 1)
            .filter((row) =>
              row.some((c) => c !== "" && c !== null && c !== undefined),
            );
          dataRows.forEach((row) => {
            const get = (ci: number) =>
              ci === -1 ? "" : String(row[ci] ?? "").trim();
            const materialName = get(ciMaterialName);
            if (!materialName) return;
            const key = `${specFromSheet.replace(/\s+/g, "")}|${normalizeMaterialKey(materialName)}`;
            detailMap.set(key, {
              component: get(ciComponent),
              fabric_width: get(ciFabricWidth),
              cutting_specification: get(ciCuttingSpec),
              process_remark: get(ciProcessRemark),
            });
          });
        });

        if (summarySheetName) {
          const result = parseSummarySheet(
            workbook.Sheets[summarySheetName],
            product,
            materials,
            summarySheetName,
            allUnmatchedSpecs,
            detailMap,
          );
          allBoms.push(...result.boms);
          allNewMaterials.push(...result.newMaterials);
          allUpdatedMaterials.push(...result.updatedMaterials);
          allErrors.push(...result.errors);
        } else {
          // 解析所有 BOM_ 开头的明细表
          const detailSheets = workbook.SheetNames.filter((n) =>
            n.toLowerCase().startsWith("bom_"),
          );
          if (detailSheets.length === 0) {
            resolve({
              success: false,
              boms: [],
              newMaterials: [],
              updatedMaterials: [],
              errors: [{ row: 0, sheet: "", message: "未找到 BOM 工作表（需以 BOM_ 开头或包含 BOM汇总）" }],
              unmatchedSpecs: [],
              fromSummary: false,
            });
            return;
          }
          detailSheets.forEach((sheetName) => {
            const result = parseDetailSheet(
              workbook.Sheets[sheetName],
              product,
              materials,
              allNewMaterials,
              sheetName,
              allUnmatchedSpecs,
            );
            allBoms.push(...result.boms);
            allErrors.push(...result.errors);
          });
        }

        if (allErrors.length > 0) {
          resolve({
            success: false,
            boms: [],
            newMaterials: [],
            updatedMaterials: [],
            errors: allErrors,
            unmatchedSpecs: allUnmatchedSpecs,
            fromSummary,
          });
          return;
        }

        if (allBoms.length === 0 && allUnmatchedSpecs.length === 0) {
          resolve({
            success: false,
            boms: [],
            newMaterials: [],
            updatedMaterials: [],
            errors: [{ row: 0, sheet: "", message: "未解析到有效 BOM 数据" }],
            unmatchedSpecs: [],
            fromSummary,
          });
          return;
        }

        resolve({
          success: allUnmatchedSpecs.length === 0,
          boms: allBoms,
          newMaterials: allNewMaterials,
          updatedMaterials: allUpdatedMaterials,
          errors: [],
          unmatchedSpecs: allUnmatchedSpecs,
          fromSummary,
        });
      } catch (err) {
        resolve({
          success: false,
          boms: [],
          newMaterials: [],
          updatedMaterials: [],
          errors: [
            {
              row: 0,
              sheet: "",
              message: `文件解析失败：${err instanceof Error ? err.message : "未知错误"}`,
            },
          ],
          unmatchedSpecs: [],
          fromSummary: false,
        });
      }
    };
    reader.onerror = () => {
      resolve({
        success: false,
        boms: [],
        newMaterials: [],
        updatedMaterials: [],
        errors: [{ row: 0, sheet: "", message: "文件读取失败" }],
        unmatchedSpecs: [],
        fromSummary: false,
      });
    };
  });
}

export function applySpecMapping(
  boms: ProductBom[],
  product: Product,
  mapping: SpecMapping,
): ProductBom[] {
  return boms.map((bom) => {
    if (!bom.sku_id.startsWith("__UNMATCHED__")) return bom;
    const spec = bom.sku_id.replace("__UNMATCHED__", "");
    const skuId = mapping[spec];
    if (!skuId) return bom;
    const sku = product.skus?.find((s) => s.id === skuId);
    if (!sku) return bom;
    return {
      ...bom,
      sku_id: sku.id,
      sku_specification: sku.specification || sku.size || "",
    };
  });
}

export function downloadBomTemplate() {
  const summaryHeaders = [
    "款式",
    "成品规格",
    "物料编码",
    "物料名称",
    "布号",
    "布色",
    "单位",
    "单套用量",
    "来源工艺单",
    "备注",
  ];
  const summaryExample = [
    [
      "BD波浪+小波浪夹边被",
      "300×270cm",
      "MAT-A220",
      "A# 220g希腊绒（含包边、压条、面中心、面边框）",
      "",
      "",
      "米",
      4.13,
      "25JLMJ030（同款工艺单）",
      "A面布合计",
    ],
    [
      "BD波浪+小波浪夹边被",
      "300×270cm",
      "MAT-B085",
      "B# 85g磨毛布（底中心、底边框）",
      "",
      "",
      "米",
      3.93,
      "25JLMJ030（同款工艺单）",
      "B底布合计",
    ],
    [
      "BD波浪+小波浪夹边被",
      "300×270cm",
      "MAT-C120",
      "120g/m²无胶棉",
      "",
      "",
      "kg",
      1.13,
      "25JLMJ030（同款工艺单）",
      "按工艺单整套用量",
    ],
  ];

  const detailHeaders = [
    "物料名称",
    "部件",
    "门幅",
    "裁剪规格",
    "单位",
    "单套用量",
    "工艺备注",
  ];
  const detailExample = [
    ["A#希腊绒", "包边", "2.6m", "0.045×12m，直开", "米", 0.21, "四周包边"],
    ["A#希腊绒", "压条", "2.6m", "0.03×12m，直开", "米", 0.14, "压条"],
    ["A#希腊绒", "面-中心块", "2.6m", "2.35×2.53m连续", "米", 2.38, "斜料取包边"],
  ];

  const wb = XLSX.utils.book_new();

  const summaryWs = XLSX.utils.aoa_to_sheet([
    ["BOM汇总"],
    summaryHeaders,
    ...summaryExample,
  ]);
  summaryWs["!cols"] = summaryHeaders.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, summaryWs, "BOM汇总");

  const detailWs = XLSX.utils.aoa_to_sheet([
    ["BOM明细：BD波浪+小波浪夹边被（300×270cm）"],
    detailHeaders,
    ...detailExample,
  ]);
  detailWs["!cols"] = detailHeaders.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, detailWs, "BOM_300x270");

  XLSX.writeFile(wb, `BOM导入模板_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

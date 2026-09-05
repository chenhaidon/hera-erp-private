import type { Product, Material, ProcessRoute, Quotation, QuotationCostDetails, QuotationCostItem, QuotationItem, QuotationMaterialRow, QuotationPackagingRow, QuotationProcessRow } from '@/types';
import { MaterialSupplierPrice } from '@/types/material';
import { getProductBomsBySku, extractSkuColor, resolveColorMaterial, nanoid } from '@/lib/utils';

export const SUBJECT_META: Record<QuotationCostItem['subject'], { name: string; unit: string }> = {
  fabric: { name: '面料成本', unit: '元' },
  accessory: { name: '辅料成本', unit: '元' },
  processing: { name: '加工费', unit: '元' },
  packaging: { name: '包装物流费', unit: '元' },
  other: { name: '其他费用', unit: '元' },
};

export function getDefaultMaterialPrice(
  materialId: string,
  supplierPrices: MaterialSupplierPrice[]
): { price: number; supplier_name: string } {
  const active = supplierPrices.filter((p) => p.material_id === materialId && p.status === 'active');
  const def = active.find((p) => p.is_default) || active[0];
  if (def) return { price: def.price, supplier_name: def.supplier_name };
  return { price: 0, supplier_name: '' };
}

export interface QuotationCostInput {
  quantity: number;
  fabric_loss_rate: number;
  batch_factor: number;
  sku_id: string;
}

function resolveBomMaterial(
  bom: { material_id: string; material_name: string; material_code?: string },
  color: string,
  materials: Material[],
): { id: string; name: string; code?: string } {
  const { material } = resolveColorMaterial(bom.material_name, color, materials);
  return {
    id: material?.id || bom.material_id,
    name: material?.name || bom.material_name,
    code: material?.code || bom.material_code,
  };
}

function calculateItemCost(
  item: Pick<QuotationItem, 'product_id' | 'sku_id' | 'quantity'>,
  products: Product[],
  materials: Material[],
  supplierPrices: MaterialSupplierPrice[],
  processRoutes: ProcessRoute[],
  lossRate: number,
  batchFactor: number
): Record<QuotationCostItem['subject'], number> {
  const product = products.find((p) => p.id === item.product_id);
  const sku = product?.skus?.find((s) => s.id === item.sku_id);
  const color = extractSkuColor(sku);
  const q = Math.max(1, item.quantity || 1);

  let fabricCost = 0;
  let accessoryCost = 0;
  getProductBomsBySku(product, item.sku_id).forEach((bom) => {
    const resolved = resolveBomMaterial(bom, color, materials);
    const unitPrice = getDefaultMaterialPrice(resolved.id, supplierPrices).price;
    const isFabric = ['面料', '里料', '填充物'].includes(bom.category);
    if (isFabric) {
      fabricCost += bom.dosage * (1 + lossRate) * unitPrice * q;
    } else {
      accessoryCost += bom.dosage * unitPrice * q;
    }
  });

  const route = processRoutes.find((r) => r.id === product?.route_binding?.route_id);
  const processSteps = route?.steps?.length ? route.steps : (product?.process_steps || []);
  let processingCost = 0;
  processSteps.forEach((step) => {
    processingCost += (step.hours || 0) * (step.price || 0) * q * (1 + batchFactor);
  });

  const packagingCost = (product?.packaging_cost_per_unit || 0) * q;
  const otherCost = (product?.other_cost_per_unit || 0) * q;

  return {
    fabric: fabricCost,
    accessory: accessoryCost,
    processing: processingCost,
    packaging: packagingCost,
    other: otherCost,
  };
}

export function calculateQuotationCosts(
  form: Pick<Quotation, 'quantity' | 'fabric_loss_rate' | 'batch_factor' | 'sku_id'> & { items?: QuotationItem[] },
  product: Product | undefined,
  materials: Material[],
  supplierPrices: MaterialSupplierPrice[],
  processRoute: ProcessRoute | undefined,
  operator = '系统'
): QuotationCostItem[] {
  const lossRate = form.fabric_loss_rate ?? 0.05;
  const batchFactor = form.batch_factor ?? 0;

  // 兼容旧版单 SKU 模式
  if (!form.items || form.items.length === 0) {
    const q = Math.max(1, form.quantity || 1);
    const sku = product?.skus?.find((s) => s.id === form.sku_id);
    const color = extractSkuColor(sku);
    let fabricCost = 0;
    let accessoryCost = 0;
    getProductBomsBySku(product, form.sku_id).forEach((bom) => {
      const resolved = resolveBomMaterial(bom, color, materials);
      const unitPrice = getDefaultMaterialPrice(resolved.id, supplierPrices).price;
      const isFabric = ['面料', '里料', '填充物'].includes(bom.category);
      if (isFabric) {
        fabricCost += bom.dosage * (1 + lossRate) * unitPrice * q;
      } else {
        accessoryCost += bom.dosage * unitPrice * q;
      }
    });

    const processSteps =
      processRoute?.steps?.length
        ? processRoute.steps
        : (product?.process_steps || []);
    let processingCost = 0;
    processSteps.forEach((step) => {
      processingCost += (step.hours || 0) * (step.price || 0) * q * (1 + batchFactor);
    });

    const packagingCost = (product?.packaging_cost_per_unit || 0) * q;
    const otherCost = (product?.other_cost_per_unit || 0) * q;

    const now = new Date().toISOString();
    const subjects: QuotationCostItem['subject'][] = ['fabric', 'accessory', 'processing', 'packaging', 'other'];
    const values: Record<QuotationCostItem['subject'], number> = {
      fabric: fabricCost,
      accessory: accessoryCost,
      processing: processingCost,
      packaging: packagingCost,
      other: otherCost,
    };

    return subjects.map((subject) => {
      const meta = SUBJECT_META[subject];
      const auto = Math.round(values[subject] * 100) / 100;
      return {
        subject,
        subject_name: meta.name,
        auto_value: auto,
        manual_value: null,
        final_value: auto,
        is_manual: false,
        adjusted_by: operator,
        adjusted_at: now,
      };
    });
  }

  // 新版多 SKU 明细汇总：需要传入所有产品和工艺路线
  // 当使用新版 items 时，调用方应传入 product 为 undefined，并通过 productLookup / routeLookup 计算
  return calculateQuotationCostsFromItems(
    form.items,
    [],
    materials,
    supplierPrices,
    [],
    lossRate,
    batchFactor,
    operator
  );
}

export function calculateQuotationCostsFromItems(
  items: QuotationItem[],
  products: Product[],
  materials: Material[],
  supplierPrices: MaterialSupplierPrice[],
  processRoutes: ProcessRoute[],
  lossRate: number,
  batchFactor: number,
  operator = '系统'
): QuotationCostItem[] {
  const totals: Record<QuotationCostItem['subject'], number> = {
    fabric: 0,
    accessory: 0,
    processing: 0,
    packaging: 0,
    other: 0,
  };

  items.forEach((item) => {
    const cost = calculateItemCost(item, products, materials, supplierPrices, processRoutes, lossRate, batchFactor);
    (Object.keys(totals) as QuotationCostItem['subject'][]).forEach((subject) => {
      totals[subject] += cost[subject];
    });
  });

  const now = new Date().toISOString();
  const subjects: QuotationCostItem['subject'][] = ['fabric', 'accessory', 'processing', 'packaging', 'other'];

  return subjects.map((subject) => {
    const meta = SUBJECT_META[subject];
    const auto = Math.round(totals[subject] * 100) / 100;
    return {
      subject,
      subject_name: meta.name,
      auto_value: auto,
      manual_value: null,
      final_value: auto,
      is_manual: false,
      adjusted_by: operator,
      adjusted_at: now,
    };
  });
}

export function recalcQuotationTotals(
  costItems: QuotationCostItem[],
  targetProfitRate: number
): Pick<Quotation, 'total_cost' | 'suggested_price' | 'estimated_profit' | 'actual_profit_rate'> {
  const totalCost = Math.round(costItems.reduce((sum, item) => sum + (item.final_value || 0), 0) * 100) / 100;
  const rate = Math.min(0.9999, Math.max(0, targetProfitRate || 0));
  const suggestedPrice = rate >= 1 ? 0 : Math.round((totalCost / (1 - rate)) * 100) / 100;
  const estimatedProfit = Math.round((suggestedPrice - totalCost) * 100) / 100;
  const actualProfitRate = suggestedPrice > 0 ? Math.round((estimatedProfit / suggestedPrice) * 10000) / 10000 : 0;
  return { total_cost: totalCost, suggested_price: suggestedPrice, estimated_profit: estimatedProfit, actual_profit_rate: actualProfitRate };
}

/** 根据产品 BOM 与工艺路线生成纸质报价单格式的成本明细 */
export function buildQuotationCostDetails(
  product: Product | undefined,
  skuId: string | undefined,
  materials: Material[],
  supplierPrices: MaterialSupplierPrice[],
  processRoute: ProcessRoute | undefined,
): QuotationCostDetails {
  const color = extractSkuColor(product?.skus?.find((s) => s.id === skuId));
  const materialRows: QuotationMaterialRow[] = [];

  getProductBomsBySku(product, skuId).forEach((bom) => {
    const resolved = resolveBomMaterial(bom, color, materials);
    const supplier = getDefaultMaterialPrice(resolved.id, supplierPrices);
    materialRows.push({
      id: nanoid(),
      name: resolved.name,
      unit: bom.unit,
      size: bom.cutting_specification || '',
      width: bom.fabric_width || '',
      dosage: bom.dosage,
      unit_price: supplier.price,
      amount: Math.round(bom.dosage * supplier.price * 100) / 100,
      remark: bom.remark || '',
      source_bom_id: bom.id,
      category: bom.category,
    });
  });

  const processSteps = processRoute?.steps?.length
    ? processRoute.steps
    : (product?.process_steps || []);
  const processRows: QuotationProcessRow[] = processSteps.map((step) => {
    const unitPrice = step.category === 'outsourcing'
      ? (step.outsourcing_price ?? step.price ?? 0)
      : (step.piece_price ?? step.price ?? 0);
    const dosage = step.hours || 1;
    return {
      id: nanoid(),
      name: step.name,
      unit_price: unitPrice,
      dosage,
      amount: Math.round(unitPrice * dosage * 100) / 100,
      category: step.category || 'internal',
      source_process_id:
        'process_id' in step ? (step.process_id || step.code) : step.code,
    };
  });

  const packagingRows: QuotationPackagingRow[] = [];

  return { materials: materialRows, processes: processRows, packaging: packagingRows };
}

/** 重新计算纸质报价单成本明细的金额与小计 */
export function recalcQuotationCostDetails(
  details: QuotationCostDetails,
): { details: QuotationCostDetails; total: number } {
  const next: QuotationCostDetails = {
    materials: details.materials.map((row) => ({
      ...row,
      amount: Math.round(row.dosage * row.unit_price * 100) / 100,
    })),
    processes: details.processes.map((row) => ({
      ...row,
      amount: Math.round(row.dosage * row.unit_price * 100) / 100,
    })),
    packaging: details.packaging.map((row) => ({
      ...row,
      amount: Math.round(row.quantity * row.unit_price * 100) / 100,
    })),
  };
  const total = [...next.materials, ...next.processes, ...next.packaging].reduce(
    (sum, row) => sum + (row.amount || 0),
    0,
  );
  return { details: next, total: Math.round(total * 100) / 100 };
}

export function createEmptyQuotation(): Quotation {
  const now = new Date().toISOString();
  return {
    id: '',
    quotation_no: '',
    customer_id: '',
    customer_name: '',
    currency: 'CNY',
    product_id: '',
    product_code: '',
    product_name: '',
    product_spec: '',
    quotation_date: new Date().toISOString().slice(0, 10),
    quantity: 1,
    estimated_delivery_date: '',
    delivery_days: undefined,
    target_profit_rate: 0.2,
    fabric_loss_rate: 0.05,
    batch_factor: 0,
    remark: '',
    status: 'draft',
    cost_items: [],
    cost_details: { materials: [], processes: [], packaging: [] },
    total_cost: 0,
    suggested_price: 0,
    estimated_profit: 0,
    actual_profit_rate: 0,
    creator: '当前用户',
    created_at: now,
    updated_at: now,
    approval_logs: [],
    version_logs: [],
    items: [],
  };
}

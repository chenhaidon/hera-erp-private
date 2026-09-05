import { useEffect, useState } from 'react';
import { useAppStore, type AppState } from '@/store';
import { supabase } from '@/db/supabase';
import { fetchAllEntities, seedEntities, updateEntity, insertEntity } from '@/lib/api';
import { syncSalesOrderStatusFromProduction, recalcWorkOrderFromOperations, createPendingFinishedInspection } from '@/lib/production';
import {
  syncReceivablesFromSalesOrders,
  syncSalesOrderStatusFromReceivables,
} from '@/lib/finance';
import { syncContractStatusFromSalesOrders } from '@/lib/contract';
import { normalizeConfig } from '@/lib/moduleVisibility';
import type { ModuleVisibilityConfig } from '@/lib/moduleVisibility';
import { DEFAULT_GRADE_CONFIG } from '@/lib/performanceGrade';
import { ENTITY_CONFIG_ARRAY } from '@/store/entityMap';
import { PRODUCT_CATEGORIES, FABRIC_TYPES, FILLING_TYPES } from '@/lib/data';
import { getSeedData, seedSafetyRecords, seedOperationLogs, seedLoginLogs } from '@/lib/seedData';
import type {
  Product,
  ProductCategory,
  FabricType,
  FillingType,
  Customer,
  SalesOrder,
  Shipment,
  PriceList,
  CustomerDiscount,
  ExchangeRate,
  ProductionPlan,
  WorkOrder,
  ProcessRoute,
  ProcessParamTemplate,
  ProcessVersion,
  ProcessKnowledge,
  WorkOrderCost,
  ProductionException,
  QualityStandard,
  QualityStandardItem,
  QualityInspection,
  MaterialInspection,
  ProcessInspection,
  FinishedInspection,
  MaintenancePlan,
  Equipment,
  EquipmentRecord,
  SafetyRecord,
  Material,
  Inventory,
  WarehouseLocation,
  StockRecord,
  Supplier,
  PurchaseRequest,
  PurchaseOrder,
  PurchaseArrival,
  PurchaseReturn,
  PaymentRecord,
  FinanceRecord,
  Employee,
  AttendanceRecord,
  LeaveRecord,
  PerformanceRecord,
  TrainingRecord,
  EvaluationItem,
  InventoryTurnover,
  SafetyPatrolPlan,
  SafetyPatrolTask,
  AlertNotification,
  MaterialSupplierPrice,
  Quotation,
  Contract,
  ContractTemplate,
} from '@/types';

// 将 DB 返回的 entity_type 维度数据设置到 Zustand 状态字段
function applyData(raw: Record<string, unknown[]>, store: ReturnType<typeof useAppStore>) {
  for (const config of ENTITY_CONFIG_ARRAY) {
    let list = raw[config.entityType] || [];
    // 报价单：兼容历史/外部写入的精简结构，补齐必填字段，避免页面空值崩溃
    if (config.field === 'quotations') {
      list = (list as Quotation[]).map(normalizeQuotation);
    }
    const setter = (store as Record<string, unknown>)[config.setAction] as (data: unknown[]) => void;
    if (setter) setter(list);
  }
}

/** 补齐 Quotation 必填字段，容忍缺失字段的历史数据 */
function normalizeQuotation(q: Partial<Quotation>): Quotation {
  const firstItem = (q.items || [])[0];
  const items = q.items || [];
  return {
    ...q,
    quotation_no: q.quotation_no || (q as { quote_no?: string }).quote_no || '',
    customer_name: q.customer_name || '',
    currency: q.currency || 'CNY',
    product_id: q.product_id || firstItem?.product_id || '',
    product_code: q.product_code || firstItem?.product_code || '',
    product_name: q.product_name || firstItem?.product_name || '',
    sku_id: q.sku_id || '',
    sku_specification: q.sku_specification || '',
    target_profit_rate: q.target_profit_rate ?? 0.2,
    fabric_loss_rate: q.fabric_loss_rate ?? 0.05,
    batch_factor: q.batch_factor ?? 0,
    remark: q.remark || '',
    status: q.status || 'draft',
    quantity: q.quantity || items.reduce((sum, it) => sum + (it?.quantity || 0), 0),
    cost_items: q.cost_items || [],
    approval_logs: q.approval_logs || [],
    version_logs: q.version_logs || [],
    items,
    total_cost: q.total_cost ?? (q as { total_amount?: number }).total_amount ?? 0,
    suggested_price: q.suggested_price ?? (q as { total_amount?: number }).total_amount ?? 0,
    estimated_profit: q.estimated_profit ?? 0,
    actual_profit_rate: q.actual_profit_rate ?? 0,
    creator: q.creator || '系统',
    created_at: q.created_at || new Date().toISOString(),
    updated_at: q.updated_at || q.created_at || new Date().toISOString(),
  } as Quotation;
}

function applyModuleVisibility(raw: Record<string, unknown[]>, store: AppState) {
  const rows = raw['module_visibility'] || [];
  if (rows.length) {
    store.setModuleVisibility(normalizeConfig(rows[0]) as ModuleVisibilityConfig);
  }
}

// 兼容：首次使用或缺少安全记录时，补充 7.1-8.25 全链路演示数据
async function ensureSeedSafetyRecords() {
  const { data: existingRows, error } = await supabase
    .from('entity_store')
    .select('data')
    .eq('entity_type', 'safety_records');
  if (error) {
    console.warn('[db] ensureSeedSafetyRecords query', error.message);
    return;
  }
  const existingIds = new Set((existingRows || []).map((r) => (r.data as { id?: string }).id));
  const existingDates = new Set((existingRows || []).map((r) => (r.data as { record_date?: string }).record_date));
  for (const record of seedSafetyRecords) {
    if (existingIds.has(record.id)) continue;
    // 若同日期已有同类型记录，跳过，避免重复填充
    if (existingDates.has(record.record_date)) continue;
    await insertEntity('safety_records', record as unknown as Record<string, unknown>);
  }
}

// 兼容：确保演示合同 26JLKXD007 及生产工艺单已存在
// 按 contract_no 去重，避免已有同号合同时重复插入
async function ensureSeedContracts() {
  const seed = getSeedData();
  const seedContracts = (seed.contracts || []) as Contract[];
  // 同时按 id 和 contract_no 查询已存在记录，任意命中均视为已存在
  const contractNos = seedContracts.map((c) => c.contract_no).filter(Boolean);
  const { data: existingRows, error } = await supabase
    .from('entity_store')
    .select('data')
    .eq('entity_type', 'contracts');
  if (error) {
    console.warn('[db] ensureSeedContracts query', error.message);
    return;
  }
  const existingIds = new Set((existingRows || []).map((r) => (r.data as { id?: string }).id));
  const existingNos = new Set((existingRows || []).map((r) => (r.data as { contract_no?: string }).contract_no));
  for (const contract of seedContracts) {
    // 已有同 id 或同 contract_no 的合同，跳过，避免重复插入
    if (existingIds.has(contract.id) || (contract.contract_no && existingNos.has(contract.contract_no))) continue;
    await insertEntity('contracts', contract as unknown as Record<string, unknown>);
  }
  // 若原始合同已存在但缺少 craft_sheets，则补写
  if (contractNos.length) {
    const missingSheets = (existingRows || []).filter((r) => {
      const d = r.data as { contract_no?: string; craft_sheets?: unknown[] };
      return contractNos.includes(d.contract_no || '') && (!d.craft_sheets || d.craft_sheets.length === 0);
    });
    for (const row of missingSheets) {
      const existing = row.data as Contract;
      const seed = seedContracts.find((c) => c.contract_no === existing.contract_no);
      if (!seed?.craft_sheets?.length) continue;
      await updateEntity('contracts', { ...existing, craft_sheets: seed.craft_sheets } as unknown as Record<string, unknown>);
    }
  }
}

// 数据加载后自动修复：所有工序已完工但无成品检验单的工单，补回待检验单
async function ensureSeedLogs() {
  // 若 entity_store 中尚无操作/登录日志，则写入示例数据，便于页面展示
  for (const [entityType, logs] of [
    ['operation_logs', seedOperationLogs] as const,
    ['login_logs', seedLoginLogs] as const,
  ]) {
    const { data: existing } = await supabase
      .from('entity_store')
      .select('id')
      .eq('entity_type', entityType)
      .limit(1);
    if (!existing || existing.length === 0) {
      await seedEntities(entityType, logs as unknown as Record<string, unknown>[]);
    }
  }
}

async function ensureMissingFinishedInspections(store: AppState) {
  const completedWOs = store.workOrders.filter((wo) =>
    wo.operations.length > 0 &&
    wo.operations.every((o) => o.status === 'completed' || o.status === 'closed')
  );
  for (const wo of completedWOs) {
    const hasInspection = store.finishedInspections.some(
      (f) => f.work_id === wo.id && (f.status === 'pending' || (f.status === 'inspected' && f.result === 'qualified'))
    );
    if (hasInspection) continue;
    const recalc = recalcWorkOrderFromOperations(wo);
    const finalWo = { ...wo, ...recalc };
    await store.updateWorkOrder(finalWo);
    await createPendingFinishedInspection(store, finalWo);
  }
}

// 把当前 store 中的非空数组一次性写入 entity_store，用于首次运行时的种子初始化
async function seedFromStore() {
  const state = useAppStore.getState();
  for (const config of ENTITY_CONFIG_ARRAY) {
    const items = ((state as unknown) as Record<string, unknown>)[config.field];
    if (Array.isArray(items) && items.length) {
      await seedEntities(config.entityType, items as Record<string, unknown>[]);
    }
  }
}

const fallbackProducts: Product[] = [
  {
    id: 'p1',
    code: 'JF-2026-001',
    name: '北欧风绗缝被',
    category: '绗缝被',
    process_list: ['面料检验', '裁剪', '拼接', '绗缝', '包边', '水洗', '整烫定型', '检验', '包装'],
    images: [
      'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_25862487-e450-4634-ae61-dc6a21f96d9a.jpg',
      'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_bf65d999-426a-49ba-ac54-8b059cb61589.jpg',
    ],
    status: 'active',
    skus: [
      { id: 'sku1', specification: '喷胶棉填充绗缝被，300g/㎡', size: '150×200cm', color: '米白', pattern: '波浪纹', filling_weight: 300, quilt_pattern: '波浪纹', quilt_process: '电脑绗缝', weight: 1200, barcode: '6931234567890', suggested_price: 158 },
      { id: 'sku2', specification: '喷胶棉填充绗缝被，300g/㎡', size: '180×220cm', color: '米白', pattern: '波浪纹', filling_weight: 300, quilt_pattern: '波浪纹', quilt_process: '电脑绗缝', weight: 1500, barcode: '6931234567891', suggested_price: 198 },
      { id: 'sku3', specification: '喷胶棉填充绗缝被，300g/㎡', size: '200×230cm', color: '米白', pattern: '波浪纹', filling_weight: 300, quilt_pattern: '波浪纹', quilt_process: '电脑绗缝', weight: 1800, barcode: '6931234567892', suggested_price: 238 },
    ],
    boms: [
      { id: 'bom-p1-1', sku_id: 'sku1', sku_specification: '喷胶棉填充绗缝被，300g/㎡', material_id: 'm1', material_code: 'MT-001', material_name: '纯棉面料', category: '面料', specification: '幅宽240cm 克重120g', dosage: 3.5, unit: '米' },
      { id: 'bom-p1-2', sku_id: 'sku1', sku_specification: '喷胶棉填充绗缝被，300g/㎡', material_id: 'm2', material_code: 'MT-003', material_name: '喷胶棉', category: '填充物', specification: '克重300g/㎡', dosage: 0.6, unit: 'kg' },
      { id: 'bom-p1-3', sku_id: 'sku2', sku_specification: '喷胶棉填充绗缝被，300g/㎡', material_id: 'm1', material_code: 'MT-001', material_name: '纯棉面料', category: '面料', specification: '幅宽240cm 克重120g', dosage: 4.2, unit: '米' },
      { id: 'bom-p1-4', sku_id: 'sku2', sku_specification: '喷胶棉填充绗缝被，300g/㎡', material_id: 'm2', material_code: 'MT-003', material_name: '喷胶棉', category: '填充物', specification: '克重300g/㎡', dosage: 0.75, unit: 'kg' },
    ],
    pricing_strategy: { markup_rate: 0.25, target_profit_rate: 0.15, min_price: 120, suggested_price: 158 },
    packaging_cost_per_unit: 5,
    logistics_cost_per_unit: 2,
    other_cost_per_unit: 2,
    route_binding: { route_id: 'pr1', route_name: '绗缝被标准工艺路线', route_code: 'ROU-2026-001', version_id: 'pr1', version_code: 'V1' },
  },
  {
    id: 'p2',
    code: 'JF-2026-002',
    name: '亲肤四件套',
    category: '四件套',
    process_list: ['面料检验', '裁剪', '缝制', '整烫', '包装'],
    images: ['https://miaoda-site-img.cdn.bcebos.com/images/MiaoTu_d830d123-4c83-4c21-9b36-cbc29a27b27d.jpg'],
    status: 'active',
    skus: [
      { id: 'sku4', specification: '60支长绒棉四件套', size: '1.5m床', color: '浅灰', pattern: '纯色', filling_weight: 0, quilt_pattern: '', quilt_process: '', weight: 1800, barcode: '6931234567893', suggested_price: 299 },
      { id: 'sku5', specification: '60支长绒棉四件套', size: '1.8m床', color: '浅灰', pattern: '纯色', filling_weight: 0, quilt_pattern: '', quilt_process: '', weight: 2200, barcode: '6931234567894', suggested_price: 399 },
    ],
    boms: [
      { id: 'bom-p2-1', sku_id: 'sku4', sku_specification: '60支长绒棉四件套', material_id: 'm1', material_code: 'MT-001', material_name: '纯棉面料', category: '面料', specification: '幅宽240cm 克重120g', dosage: 5, unit: '米' },
      { id: 'bom-p2-2', sku_id: 'sku5', sku_specification: '60支长绒棉四件套', material_id: 'm1', material_code: 'MT-001', material_name: '纯棉面料', category: '面料', specification: '幅宽240cm 克重120g', dosage: 6, unit: '米' },
    ],
    pricing_strategy: { markup_rate: 0.3, target_profit_rate: 0.18, min_price: 220, suggested_price: 299 },
    packaging_cost_per_unit: 8,
    logistics_cost_per_unit: 3,
    other_cost_per_unit: 3,
    route_binding: { route_id: 'pr1', route_name: '绗缝被标准工艺路线', route_code: 'ROU-2026-001', version_id: 'pr1', version_code: 'V1' },
  },
  {
    id: 'p3',
    code: 'JF-2026-003',
    name: '云朵沙发垫',
    category: '沙发垫',
    process_list: ['面料检验', '裁剪', '绗缝', '包边', '检验', '包装'],
    images: ['https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_ac3ea6fc-b63f-4036-bc6c-1eadd52cd78a.jpg'],
    status: 'active',
    skus: [
      { id: 'sku6', specification: '海绵填充防滑沙发垫', size: '70×70cm', color: '卡其', pattern: '方格', filling_weight: 500, quilt_pattern: '方格纹', quilt_process: '多针绗缝', weight: 800, barcode: '6931234567895', suggested_price: 88 },
      { id: 'sku7', specification: '海绵填充防滑沙发垫', size: '90×90cm', color: '卡其', pattern: '方格', filling_weight: 500, quilt_pattern: '方格纹', quilt_process: '多针绗缝', weight: 1200, barcode: '6931234567896', suggested_price: 128 },
    ],
    boms: [],
    pricing_strategy: { markup_rate: 0.35, target_profit_rate: 0.2, min_price: 60, suggested_price: 88 },
    packaging_cost_per_unit: 3,
    logistics_cost_per_unit: 1,
    other_cost_per_unit: 1,
    route_binding: undefined,
  },
  {
    id: 'p4',
    code: 'JF-2026-004',
    name: '儿童绗缝童被',
    category: '童被套件',
    process_list: ['面料检验', '裁剪', '拼接', '绣花', '绗缝', '包边', '水洗', '整烫', '检验', '包装'],
    images: ['https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_b22959d2-67cb-435c-9234-5f55fd8aa064.jpg'],
    status: 'active',
    skus: [
      { id: 'sku8', specification: '双层纱绗缝童被，200g/㎡聚酯纤维填充', size: '120×150cm', color: '粉蓝', pattern: '星星', filling_weight: 200, quilt_pattern: '星星纹', quilt_process: '电脑绗缝', weight: 700, barcode: '6931234567897', suggested_price: 168 },
    ],
    boms: [],
    pricing_strategy: { markup_rate: 0.28, target_profit_rate: 0.16, min_price: 130, suggested_price: 168 },
    packaging_cost_per_unit: 4,
    logistics_cost_per_unit: 1.5,
    other_cost_per_unit: 1.5,
    route_binding: undefined,
  },
];

export function DataProvider({ children }: { children: React.ReactNode }) {
  const store = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // 超时保护：防止某个 await 挂起导致永久“数据加载中”
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('[DataProvider] 加载超时，强制完成以避免卡死');
        setLoading(false);
      }
    }, 8000);
    async function load() {
      try {
        // 给数据请求加超时降级，挂起时返回空对象以走本地示例逻辑
        const data = await Promise.race([
          fetchAllEntities(),
          new Promise<Record<string, Record<string, unknown>[]>>((resolve) =>
            setTimeout(() => resolve({}), 7000),
          ),
        ]);
        if (!mounted) return;

        if (!store.products.length && !data.products?.length) {
          // 首次无数据时使用本地示例
          store.setProducts(fallbackProducts);
          store.setProductCategories(PRODUCT_CATEGORIES.map((name, idx) => ({ id: `cat-${idx}`, name, sort: idx, status: 'active' })));
          store.setFabricTypes(FABRIC_TYPES.map((name, idx) => ({ id: `fab-${idx}`, name, composition: '', weight: '', width: '', status: 'active' })));
          store.setFillingTypes(FILLING_TYPES.map((name, idx) => ({ id: `fill-${idx}`, name, composition: '', weight: '', resilience: '', status: 'active' })));
          store.setCustomers([
            { id: 'c1', name: '欧美家纺贸易公司', contact: 'Tom Brown', phone: '+1-555-0101', address: 'New York, USA', email: '', country: '美国', customer_type: '贸易商' },
            { id: 'c2', name: '东南亚家居品牌', contact: 'Lee Wei', phone: '+65-9012-3456', address: 'Singapore', email: '', country: '新加坡', customer_type: '品牌商' },
            { id: 'c3', name: '天猫旗舰店', contact: '张敏', phone: '13800138000', address: '杭州余杭', email: '', country: '中国', customer_type: '电商平台' },
          ]);
          store.setSalesOrders([
            {
              id: 's1',
              order_no: 'SO-2026-0001',
              order_type: '外贸',
              channel: '欧美',
              customer_id: 'c1',
              customer_name: '欧美家纺贸易公司',
              currency: 'USD',
              trade_term: 'FOB',
              destination: 'Los Angeles',
              delivery_date: '2026-07-20',
              created_at: '2026-07-01',
              total_amount: 25800,
              status: 'confirmed',
              items: [
                { product_id: 'p1', sku_id: 'sku1', product_code: 'JF-2026-001', product_name: '北欧风绗缝被', sku_summary: '150×200cm / 米白', quantity: 500, unit: '件', unit_price: 25.8, amount: 12900, image: fallbackProducts[0].images[0] },
                { product_id: 'p3', sku_id: 'sku6', product_code: 'JF-2026-003', product_name: '云朵沙发垫', sku_summary: '70×70cm / 卡其', quantity: 300, unit: '件', unit_price: 43, amount: 12900, image: fallbackProducts[2].images[0] },
              ],
              logs: [{ status: 'confirmed', operator: '系统', time: '2026-07-01 09:00', remark: '订单确认' }],
            },
            {
              id: 's2',
              order_no: 'SO-2026-0002',
              order_type: '电商',
              channel: '天猫',
              customer_id: 'c3',
              customer_name: '天猫旗舰店',
              currency: 'CNY',
              trade_term: '',
              destination: '',
              delivery_date: '2026-07-15',
              created_at: '2026-06-28',
              total_amount: 16800,
              status: 'producing',
              items: [
                { product_id: 'p2', sku_id: 'sku4', product_code: 'JF-2026-002', product_name: '亲肤四件套', sku_summary: '1.5m床 / 浅灰', quantity: 120, unit: '套', unit_price: 140, amount: 16800, image: fallbackProducts[1].images[0] },
              ],
              logs: [
                { status: 'confirmed', operator: '系统', time: '2026-06-28 10:00', remark: '订单确认' },
                { status: 'approved', operator: '系统', time: '2026-06-29 11:00', remark: '审批通过' },
                { status: 'producing', operator: '系统', time: '2026-06-30 08:00', remark: '开始生产' },
              ],
            },
          ]);
          store.setProductionPlans([
            { id: 'pl1', plan_no: 'PL-2026-001', cycle: 'week', product_id: 'p1', product_code: 'JF-2026-001', product_name: '北欧风绗缝被', category: '绗缝被', route_id: 'pr1', route_name: '绗缝被标准工艺路线', version_id: 'pv1', version_code: 'VER-2026-001', plan_quantity: 500, start_date: '2026-07-05', end_date: '2026-07-11', standard_hours: 2.8, workers: 45, devices: 12, work_hours: 40, load_rate: 78.5, status: 'published', operations: [], orders: [{ order_id: 'so1', order_no: 'SO-2026-0001', customer_name: '欧美家居', quantity: 500 }], creator: '系统', created_at: '2026-06-30 10:00', approver: '王主管', approved_at: '2026-06-30 11:00', work_orders: ['WO-2026-0001'] },
          ]);
          store.setWorkOrders([
            {
              id: 'w1',
              work_no: 'WO-2026-0001',
              plan_id: 'pl1',
              product_id: 'p1',
              product_code: 'JF-2026-001',
              product_name: '北欧风绗缝被',
              product_category: '绗缝被',
              product_images: fallbackProducts[0].images,
              plan_quantity: 500,
              completed_quantity: 320,
              progress: 64,
              status: 'producing',
              picking_status: 'picked',
              source: 'plan',
              priority: 'high',
              created_at: '2026-07-01 08:00',
              issued_at: '2026-07-01 09:00',
              operations: [
                { seq: 1, code: 'inspect', name: '面料检验', plan_qty: 500, completed_qty: 500, status: 'completed', completed: true, device: '检验台', skill: '裁剪/拼接',
                  reports: [
                    { id: 'r1', operator_id: 'emp3', operator_name: '刘小芳', qty: 500, unit_price: 0.2, amount: 100, report_time: '2026-07-01T08:00:00Z', work_no: 'WO-2026-0001', operation_name: '面料检验', operation_code: 'inspect' },
                  ] },
                { seq: 2, code: 'cut', name: '裁剪', plan_qty: 500, completed_qty: 500, status: 'completed', completed: true, device: '裁剪机', skill: '裁剪/拼接',
                  reports: [
                    { id: 'r2', operator_id: 'emp2', operator_name: '王建国', qty: 500, unit_price: 0.5, amount: 250, report_time: '2026-07-01T10:00:00Z', work_no: 'WO-2026-0001', operation_name: '裁剪', operation_code: 'cut' },
                  ] },
                { seq: 3, code: 'sew', name: '拼接', plan_qty: 500, completed_qty: 500, status: 'completed', completed: true, device: '平缝机', skill: '裁剪/拼接',
                  reports: [
                    { id: 'r3', operator_id: 'emp1', operator_name: '陈秀英', qty: 500, unit_price: 0.8, amount: 400, report_time: '2026-07-02T08:00:00Z', work_no: 'WO-2026-0001', operation_name: '拼接', operation_code: 'sew' },
                  ] },
                { seq: 5, code: 'quilt', name: '绗缝', plan_qty: 500, completed_qty: 320, status: 'running', completed: false, is_bottleneck: true, device: '绗缝机', skill: '绗缝',
                  reports: [
                    { id: 'r4', operator_id: 'emp1', operator_name: '陈秀英', qty: 320, unit_price: 1.2, amount: 384, report_time: '2026-07-03T14:00:00Z', work_no: 'WO-2026-0001', operation_name: '绗缝', operation_code: 'quilt' },
                  ] },
                { seq: 6, code: 'edge', name: '包边', plan_qty: 500, completed_qty: 0, status: 'pending', completed: false, device: '包边机', skill: '裁剪/拼接' },
                { seq: 7, code: 'wash', name: '水洗', plan_qty: 500, completed_qty: 0, status: 'pending', completed: false, device: '水洗机', skill: '水洗/整烫' },
                { seq: 8, code: 'iron', name: '整烫定型', plan_qty: 500, completed_qty: 0, status: 'pending', completed: false, device: '整烫机', skill: '水洗/整烫' },
                { seq: 9, code: 'qc', name: '检验', plan_qty: 500, completed_qty: 0, status: 'pending', completed: false, device: '检验台', skill: '检验/包装' },
                { seq: 10, code: 'pack', name: '包装', plan_qty: 500, completed_qty: 0, status: 'pending', completed: false, device: '包装线', skill: '检验/包装' },
              ],
            },
          ]);
          store.setWorkOrderCosts([
            { work_id: 'w1', fabric: 6000, lining: 1750, filling: 4000, accessory: 600, labor: 1600, overhead: 1050, planned: 14250 },
          ]);
          store.setProductionExceptions([
            { id: 'pe1', code: 'EX-2026-001', work_id: 'w1', work_no: 'WO-2026-0001', operation_name: '绗缝', type: '设备故障', description: '绗缝机3号出现跳针频繁', submitter: '王工', created_at: '2026-07-02 14:00', status: 'processing', device: '绗缝机3号' },
          ]);
          store.setEquipment([
            { id: 'e1', code: 'EQ-001', name: '电脑绗缝机 A', model: 'HF-2024A', purchase_date: '2024-03-15', status: 'idle', workshop: '绗缝车间', category: '绗缝设备', running_hours: 1850 },
            { id: 'e2', code: 'EQ-002', name: '多针绗缝机 B', model: 'DZ-3200', purchase_date: '2023-08-20', status: 'idle', workshop: '绗缝车间', category: '绗缝设备', running_hours: 2400 },
          ]);
          store.setMaterials([
            { id: 'm1', code: 'MT-001', name: '纯棉面料', category: '面料', specification: '幅宽240cm 克重120g', unit: '米', default_supplier: '华纺原料', color: '米白', pattern_code: 'P-001', composition: '100%棉', weight: 120, resilience_level: '', safety_stock: 500, stock: 1200, status: 'active' },
            { id: 'm2', code: 'MT-003', name: '喷胶棉', category: '填充物', specification: '克重300g/㎡', unit: 'kg', default_supplier: '新棉填充', color: '', pattern_code: '', composition: '聚酯纤维', weight: 300, resilience_level: '高', safety_stock: 200, stock: 380, status: 'active' },
          ]);
          store.setMaterialSupplierPrices([
            { id: 'msp1', material_id: 'm1', supplier_id: 's1', supplier_name: '华纺原料', price: 12, currency: 'CNY', lead_time: 7, moq: 100, status: 'active', is_default: true, effective_date: '2026-06-01', expiry_date: '2026-12-31' },
            { id: 'msp2', material_id: 'm2', supplier_id: 's2', supplier_name: '新棉填充', price: 20, currency: 'CNY', lead_time: 5, moq: 50, status: 'active', is_default: true, effective_date: '2026-06-01', expiry_date: '2026-12-31' },
          ]);
          store.setQuotations([
            {
              id: 'q1', quotation_no: 'BJ202607031001', customer_id: 'c-seed-1', customer_name: '德国睡眠之家',
              currency: 'CNY',
              product_id: 'p1', product_code: 'JF-2026-001', product_name: '北欧风绗缝被', product_spec: '绗缝被 / 棉 / 喷胶棉',
              sku_id: '', sku_specification: '',
              quantity: 100, target_profit_rate: 0.2, fabric_loss_rate: 0.05, batch_factor: 0, remark: '首批试单报价',
              total_cost: 6802, suggested_price: 8502.5, estimated_profit: 1700.5, actual_profit_rate: 0.2,
              status: 'approved', creator: '系统', created_at: '2026-07-03T08:00:00.000Z', updated_at: '2026-07-03T08:00:00.000Z',
              expiry_date: '2026-08-03',
              cost_items: [
                { subject: 'fabric', subject_name: '面料成本', auto_value: 4410, manual_value: null, final_value: 4410, is_manual: false, adjusted_by: '', adjusted_at: '' },
                { subject: 'accessory', subject_name: '辅料成本', auto_value: 1200, manual_value: null, final_value: 1200, is_manual: false, adjusted_by: '', adjusted_at: '' },
                { subject: 'processing', subject_name: '加工费', auto_value: 292, manual_value: null, final_value: 292, is_manual: false, adjusted_by: '', adjusted_at: '' },
                { subject: 'packaging', subject_name: '包装物流费', auto_value: 500, manual_value: null, final_value: 500, is_manual: false, adjusted_by: '', adjusted_at: '' },
                { subject: 'other', subject_name: '其他费用', auto_value: 400, manual_value: null, final_value: 400, is_manual: false, adjusted_by: '', adjusted_at: '' },
              ],
              approval_logs: [
                { approver: '销售主管', result: 'approved', opinion: '价格与交期可接受，同意审批', time: '2026-07-03T09:00:00.000Z' },
              ],
              version_logs: [],
              items: [
                { id: 'qi1', product_id: 'p1', product_code: 'JF-2026-001', product_name: '北欧风绗缝被', product_spec: '绗缝被 / 棉 / 喷胶棉', sku_id: '', sku_specification: '默认规格', quantity: 100, unit_price: 85.03, subtotal: 8503 },
              ],
            } as Quotation,
          ]);
          store.setContractTemplates([
            {
              id: 'ct1', name: '内销标准合同模板', contract_type: 'domestic', customer_level: 'normal',
              status: 'active',
              clauses: [
                { type: 'payment', content: '付款方式：款到发货。', sort_order: 1 },
                { type: 'delivery', content: '交货条款：按合同约定日期交货，逾期按日承担合同金额千分之三违约金。', sort_order: 2 },
                { type: 'quality', content: '质量标准：符合国家及行业相关标准，提供出厂检验报告。', sort_order: 3 },
                { type: 'liability', content: '违约责任：任何一方违约，应赔偿守约方因此遭受的直接损失。', sort_order: 4 },
              ],
            } as ContractTemplate,
            {
              id: 'ct2', name: '外贸合同模板（FOB）', contract_type: 'export', customer_level: 'vip',
              status: 'active',
              clauses: [
                { type: 'payment', content: 'Payment: 30% T/T in advance, 70% against copy of B/L.', sort_order: 1 },
                { type: 'delivery', content: 'Delivery: FOB Ningbo, within 45 days after order confirmation.', sort_order: 2 },
                { type: 'quality', content: 'Quality: Comply with contract samples and international standards.', sort_order: 3 },
                { type: 'liability', content: 'Liability: Either party breaching the contract shall compensate the other party.', sort_order: 4 },
              ],
            } as ContractTemplate,
          ]);
          store.setContracts([
            {
              id: 'c1', contract_no: 'HT-20260727-001', title: '上海锦华家纺贸易有限公司 - 北欧风绗缝被销售合同',
              customer_id: 'c-seed-2', customer_name: '上海锦华家纺贸易有限公司', contact_name: '李经理', contact_phone: '13800138001', customer_address: '上海市浦东新区',
              contract_type: 'domestic', customer_level: 'vip', quotation_id: 'q1', quotation_no: 'BJ202607031001',
              amount: 76800, currency: 'CNY', sign_date: '2026-07-27', effective_date: '2026-07-27', delivery_date: '2026-08-20',
              payment_terms: '30%预付款，70%出货前付清', status: 'effective', sign_method: 'paper', sign_date_record: '2026-07-27', signer: '张总',
              remark: '首批试单合同',
              version: 'V1.0',
              items: [
                { id: 'ci1', product_id: 'p1', product_code: 'JF-2026-001', product_name: '北欧风绗缝被', specification: '绗缝被 / 棉 / 喷胶棉', quantity: 800, unit_price: 96, total_price: 76800, remark: '' },
              ],
              clauses: [
                { type: 'payment', content: '付款方式：30%预付款，70%出货前付清。', sort_order: 1 },
                { type: 'delivery', content: '交货日期：2026-08-20，交货地点：上海浦东仓库。', sort_order: 2 },
                { type: 'quality', content: '质量标准：符合 GB/T 22796-2021。', sort_order: 3 },
              ],
              approval_logs: [
                { id: 'ca1', approver: '销售主管', node: '销售主管审批', result: 'approved', opinion: '同意签约', created_at: '2026-07-27T10:00:00.000Z' },
              ],
              performance_nodes: [
                { id: 'cp1', node_type: 'production', status: '生产中', scheduled_date: '2026-08-15' },
                { id: 'cp2', node_type: 'quality', status: '未检验' },
                { id: 'cp3', node_type: 'shipment', status: '待发货' },
                { id: 'cp4', node_type: 'invoice', status: '未开票' },
                { id: 'cp5', node_type: 'payment', status: '未回款' },
              ],
              version_logs: [],
              attachments: [],
              reminders: [],
              created_by: '系统', created_at: '2026-07-27T08:00:00.000Z', updated_at: '2026-07-27T08:00:00.000Z',
            } as Contract,
            {
              id: 'c2', contract_no: 'HT-20260726-002', title: '浙江雅居布艺有限公司 - 绗缝沙发垫销售合同',
              customer_id: 'c-seed-3', customer_name: '浙江雅居布艺有限公司', contact_name: '王经理', contact_phone: '13800138002', customer_address: '浙江省杭州市',
              contract_type: 'domestic', customer_level: 'normal', amount: 124500, currency: 'CNY',
              sign_date: '2026-07-26', effective_date: '2026-07-26', delivery_date: '2026-08-25',
              payment_terms: '月结30天', status: 'pending', remark: '',
              version: 'V1.0',
              items: [
                { id: 'ci2', product_id: 'p2', product_code: 'JF-2026-002', product_name: '绗缝沙发垫', specification: '沙发垫 / 棉 / 海绵', quantity: 500, unit_price: 249, total_price: 124500, remark: '' },
              ],
              clauses: [
                { type: 'payment', content: '付款方式：月结30天。', sort_order: 1 },
                { type: 'delivery', content: '交货日期：2026-08-25。', sort_order: 2 },
              ],
              approval_logs: [],
              performance_nodes: [
                { id: 'cp6', node_type: 'production', status: '未开始' },
                { id: 'cp7', node_type: 'quality', status: '未检验' },
                { id: 'cp8', node_type: 'shipment', status: '待发货' },
                { id: 'cp9', node_type: 'invoice', status: '未开票' },
                { id: 'cp10', node_type: 'payment', status: '未回款' },
              ],
              version_logs: [],
              attachments: [],
              reminders: [],
              created_by: '系统', created_at: '2026-07-26T08:00:00.000Z', updated_at: '2026-07-26T08:00:00.000Z',
            } as Contract,
          ]);
          const fallbackLocations: WarehouseLocation[] = [
            { id: 'loc-finished-1', code: 'A-01-01', warehouse: '成品仓', type: '成品仓', warehouse_type: 'finished_goods', capacity: 500, status: 'active', created_at: '2026-07-01', zone: 'A', row: '01', layer: '01' },
            { id: 'loc-finished-2', code: 'A-02-01', warehouse: '成品仓', type: '成品仓', warehouse_type: 'finished_goods', capacity: 300, status: 'active', created_at: '2026-07-01', zone: 'A', row: '02', layer: '01' },
            { id: 'loc-finished-3', code: 'A-03-01', warehouse: '成品仓', type: '成品仓', warehouse_type: 'finished_goods', capacity: 400, status: 'active', created_at: '2026-07-01', zone: 'A', row: '03', layer: '01' },
            { id: 'loc-fabric-1', code: 'B-01-01', warehouse: '面料仓', type: '面料仓', warehouse_type: 'raw_material', capacity: 2000, status: 'active', created_at: '2026-07-01', zone: 'B', row: '01', layer: '01' },
            { id: 'loc-fabric-2', code: 'B-02-01', warehouse: '面料仓', type: '面料仓', warehouse_type: 'raw_material', capacity: 1500, status: 'active', created_at: '2026-07-01', zone: 'B', row: '02', layer: '01' },
            { id: 'loc-fabric-3', code: 'B-03-01', warehouse: '面料仓', type: '面料仓', warehouse_type: 'raw_material', capacity: 1800, status: 'inactive', created_at: '2026-07-01', zone: 'B', row: '03', layer: '01' },
            { id: 'loc-filling-1', code: 'C-01-01', warehouse: '填充仓', type: '填充仓', warehouse_type: 'raw_material', capacity: 800, status: 'active', created_at: '2026-07-01', zone: 'C', row: '01', layer: '01' },
            { id: 'loc-filling-2', code: 'C-02-01', warehouse: '填充仓', type: '填充仓', warehouse_type: 'raw_material', capacity: 600, status: 'active', created_at: '2026-07-01', zone: 'C', row: '02', layer: '01' },
            { id: 'loc-accessory-1', code: 'D-01-01', warehouse: '辅料仓', type: '辅料仓', warehouse_type: 'raw_material', capacity: 1200, status: 'active', created_at: '2026-07-01', zone: 'D', row: '01', layer: '01' },
            { id: 'loc-accessory-2', code: 'D-02-01', warehouse: '辅料仓', type: '辅料仓', warehouse_type: 'raw_material', capacity: 900, status: 'active', created_at: '2026-07-01', zone: 'D', row: '02', layer: '01' },
            { id: 'loc-package-1', code: 'E-01-01', warehouse: '包材仓', type: '包材仓', warehouse_type: 'raw_material', capacity: 1000, status: 'active', created_at: '2026-07-01', zone: 'E', row: '01', layer: '01' },
            { id: 'loc-package-2', code: 'E-02-01', warehouse: '包材仓', type: '包材仓', warehouse_type: 'raw_material', capacity: 800, status: 'active', created_at: '2026-07-01', zone: 'E', row: '02', layer: '01' },
          ];
          store.setWarehouseLocations(fallbackLocations);
          store.setInventory([
            { id: 'i1', product_id: 'p1', type: 'product', quantity: 320, min_stock: 100, max_stock: 1000, warehouse: '成品仓', location_id: 'loc-finished-1' },
            { id: 'i2', product_id: 'p2', type: 'product', quantity: 85, min_stock: 50, max_stock: 500, warehouse: '成品仓', location_id: 'loc-finished-2' },
            { id: 'i3', material_id: 'm1', type: 'material', quantity: 1200, min_stock: 500, max_stock: 3000, warehouse: '面料仓', location_id: 'loc-fabric-1' },
            { id: 'i4', material_id: 'm2', type: 'material', quantity: 380, min_stock: 200, max_stock: 1000, warehouse: '填充仓', location_id: 'loc-filling-1' },
          ]);
          store.setEmployees([
            { id: 'emp1', code: 'E001', name: '陈秀英', department: '生产部', position: '绗缝工', skill_level: '高级', skill_tags: ['绗缝', '拼接'], hire_date: '2018-03-01', phone: '13900139001', status: 'active' },
            { id: 'emp2', code: 'E002', name: '王建国', department: '生产部', position: '裁剪工', skill_level: '中级', skill_tags: ['裁剪', '检验'], hire_date: '2019-06-15', phone: '13900139002', status: 'active' },
            { id: 'emp3', code: 'E003', name: '刘小芳', department: '质检部', position: '质检员', skill_level: '高级', skill_tags: ['质检', '包装'], hire_date: '2020-02-10', phone: '13900139003', status: 'active' },
            { id: 'emp4', code: 'E004', name: '赵强', department: '设备部', position: '维修工', skill_level: '中级', skill_tags: ['维修', '电工'], hire_date: '2017-08-22', phone: '13900139004', status: 'active' },
          ]);
          store.setSystemUsers([
            { id: 'admin', name: '邵常青', account: 'admin', role: '管理员', roles: ['管理员'], status: 'active', last_login: '2026-08-20 09:30', employee_id: 'dbb5918a-34b4-4bbe-a467-b91a002986f1' },
            { id: 'yujy', name: '于娟英', account: 'yujy', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 08:05', employee_id: '_3nf_nHKyXTAsCjPeefbk' },
            { id: 'yush', name: '于松灰', account: 'yush', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 07:58', employee_id: 'I_4oMg0Agq4VTa9_H_osG' },
            { id: 'yunj', name: '于能静', account: 'yunj', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-20 08:12', employee_id: '13c2579c-d49b-4f90-813e-e596bd1e7aee' },
            { id: 'yuym', name: '于裕民', account: 'yuym', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-19 08:30', employee_id: '6777c7c0-5655-4724-9f8e-df63c9586999' },
            { id: 'hegf', name: '何光丰', account: 'hegf', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 08:02', employee_id: '7bee1e5b-91cc-417c-9ae5-f3152c23d65b' },
            { id: 'liugl', name: '刘桂兰', account: 'liugl', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 08:15', employee_id: '22eed93d-9508-4adb-8c30-6bf1b54784a8' },
            { id: 'wudm', name: '吴德明', account: 'wudm', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-20 07:55', employee_id: '31d595c6-d6cf-4eee-a540-6ea38d03cc59' },
            { id: 'zhoufl', name: '周凤莲', account: 'zhoufl', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 08:08', employee_id: '2fc4629c-9ec1-4aa9-8354-3f0b60401b6b' },
            { id: 'suncg', name: '孙长贵', account: 'suncg', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-19 08:20', employee_id: '8626ded5-184b-46cc-8d22-b7851205f9c2' },
            { id: 'jixn', name: '季项农', account: 'jixn', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 08:01', employee_id: 'rl8ySRihZn21bStgzqu_N' },
            { id: 'yingqf', name: '应巧凤', account: 'yingqf', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-20 08:18', employee_id: 'akdQ7K_rdbMXSyaoVj7Zn' },
            { id: 'zhangwc', name: '张伟嫦', account: 'zhangwc', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 07:52', employee_id: '3392163e-016f-474c-8dd1-11f00b8e71cc' },
            { id: 'zhangwg', name: '张卫国', account: 'zhangwg', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 08:25', employee_id: '0ff9a248-2418-42db-92fd-28b2c60de100' },
            { id: 'zhangj', name: '张杰', account: 'zhangj', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-20 08:10', employee_id: '9117943d-6245-40a9-bca8-b7ba195fe4db' },
            { id: 'zhangmy', name: '张梦瑶', account: 'zhangmy', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-19 08:35', employee_id: '33cnBYuFzQHOWLEimPaC4' },
            { id: 'xubg', name: '徐宝根', account: 'xubg', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 08:00', employee_id: '237b6f20-dded-41c7-9817-762aa1934e26' },
            { id: 'fangzw', name: '方自伟', account: 'fangzw', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 08:22', employee_id: 'atPbI1NEQW2OD7smN9CiS' },
            { id: 'lixy', name: '李秀英', account: 'lixy', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-20 08:05', employee_id: 'a2d9377c-6b89-4e7e-9af3-435c03d38d9d' },
            { id: 'yangyy', name: '杨云岩', account: 'yangyy', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 07:59', employee_id: 'RZXCpMYdS7bP489wLlu1V' },
            { id: 'yangcy', name: '王芳', account: 'yangcy', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 08:16', employee_id: '4b368add-ceb1-4fb3-8955-7c64b93fb22d' },
            { id: 'wangjg', name: '王建国', account: 'wangjg', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-20 08:28', employee_id: '2d27fcc9-b23c-4da6-8d2f-455bbb55da9f' },
            { id: 'shengnl', name: '盛能镰', account: 'shengnl', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-19 08:10', employee_id: '7cd5997a-2c20-41a4-857d-03f18801977c' },
            { id: 'shengsl', name: '盛顺利', account: 'shengsl', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 08:03', employee_id: '59ee04e3-fb7e-4fe3-b5bb-cfaa9424104c' },
            { id: 'humc', name: '胡满仓', account: 'humc', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 08:20', employee_id: 'b07a5d97-149d-443e-9f81-3ff6add3136b' },
            { id: 'jiangjn', name: '蒋佳男', account: 'jiangjn', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-20 08:14', employee_id: '22b0376f-7966-4e29-a5ed-17cd1496fe53' },
            { id: 'zhaoyp', name: '赵燕萍', account: 'zhaoyp', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 07:56', employee_id: 'e9c1cbe5-eba2-414a-af7f-f1c60c9e4bea' },
            { id: 'zhaoxz', name: '赵秀珍', account: 'zhaoxz', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-19 08:45', employee_id: '5c0e0af0-919d-4a96-9df4-af0df93f7516' },
            { id: 'shaocq', name: '孙丽', account: 'shaocq', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 08:24', employee_id: 'dbb5918a-34b4-4bbe-a467-b91a002986f1' },
            { id: 'zhengqf', name: '周强', account: 'zhengqf', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 08:07', employee_id: 'a04382e0-981a-47c6-8589-cb7b9bebb2a2' },
            { id: 'zhengcd', name: '郑春娣', account: 'zhengcd', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 08:11', employee_id: '17019fd1-eed7-4502-84f5-b6b78aa5ac7a' },
            { id: 'jinjh', name: '金家华', account: 'jinjh', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-20 08:32', employee_id: 'kC5AeI6wNPrenBUaKgSap' },
            { id: 'jinlf', name: '金灵芳', account: 'jinlf', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-19 08:50', employee_id: 'dbf58973-8270-49b6-81e7-16adba416bb9' },
            { id: 'chenh', name: '陈恒', account: 'chenh', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 08:04', employee_id: 'PreTIjlu0-9Zn_ZOfS_26' },
            { id: 'chenht', name: '陈海涛', account: 'chenht', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 08:17', employee_id: 'cefb9e56-a0b0-4746-a6e5-82c3f50eb051' },
            { id: 'chenhx', name: '陈红星', account: 'chenhx', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-20 08:22', employee_id: '5a3lPWYtUAH55ftgZpvNI' },
            { id: 'mazq', name: '马志强', account: 'mazq', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 07:54', employee_id: 'fff9befe-ba47-4490-b010-1623b76b291f' },
            { id: 'gaoqy', name: '高巧云', account: 'gaoqy', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 08:08', employee_id: '4f2f42a3-c1eb-4f95-8ebb-e64e69ae18a3' },
            { id: 'huangmj', name: '黄美娟', account: 'huangmj', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-20 08:40', employee_id: 'fdc0eca8-c277-4880-93e9-4b6deeaada7b' },
            { id: 'huangcl', name: '黄超灵', account: 'huangcl', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-22 08:06', employee_id: 'ddf3cdfc-74ec-498d-a8b9-3562309b6307' },
            { id: 'huangrx', name: '黄闰壻', account: 'huangrx', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-19 08:55', employee_id: '1d4f67ba-a6d1-46b8-b386-014fa8a6c82c' },
            { id: 'longyy', name: '龙亚宇', account: 'longyy', role: '生产人员', roles: ['生产人员'], status: 'active', last_login: '2026-08-21 08:30', employee_id: '7190dcd4-c286-4f07-bed3-dd648b12927c' },
          ]);
          store.setAttendanceRecords([
            { id: 'att1', employee_id: 'emp1', employee_name: '陈秀英', record_date: '2026-07-01', check_in: '07:55', check_out: '17:05', status: 'normal' },
            { id: 'att2', employee_id: 'emp2', employee_name: '王建国', record_date: '2026-07-01', check_in: '08:05', check_out: '17:00', status: 'late' },
            { id: 'att3', employee_id: 'emp3', employee_name: '刘小芳', record_date: '2026-07-01', check_in: '07:50', check_out: '17:10', status: 'normal' },
          ]);
          store.setLeaveRecords([
            { id: 'l1', employee_id: 'emp2', employee_name: '王建国', leave_type: 'sick', start_date: '2026-07-02', end_date: '2026-07-03', days: 2, reason: '感冒发烧', status: 'approved' },
          ]);
          store.setPerformanceRecords([
            { id: 'p1', employee_id: 'emp1', employee_name: '陈秀英', period: '2026-06', productivity_score: 92, quality_score: 95, attendance_score: 90, safety_score: 88, total_score: 91, level: 'A', evaluator: '车间主任', comment: '产量稳定，质量优秀' },
            { id: 'p2', employee_id: 'emp2', employee_name: '王建国', period: '2026-06', productivity_score: 85, quality_score: 88, attendance_score: 82, safety_score: 90, total_score: 86, level: 'B', evaluator: '车间主任', comment: '待提高出勤' },
          ]);
          store.setTrainingRecords([
            { id: 'tr1', title: '新员工入职安全培训', type: 'safety', trainer: '安全主管', training_date: '2026-07-01', participants: ['emp1', 'emp2', 'emp3'], duration: 2, status: 'completed' },
            { id: 'tr2', title: '高级缝纫技能提升', type: 'skill', trainer: '陈师傅', training_date: '2026-07-10', participants: ['emp1'], duration: 4, status: 'planned' },
          ]);
          store.setFinanceRecords([
            { id: 'f1', type: '应收', counterparty: '欧美家纺贸易公司', currency: 'USD', amount: 25800, paid_amount: 10000, record_date: '2026-07-01', status: 'partial', related_order: 'SO-2026-0001' },
            { id: 'f2', type: '应收', counterparty: '天猫旗舰店', currency: 'CNY', amount: 16800, paid_amount: 16800, record_date: '2026-07-02', status: 'settled', related_order: 'SO-2026-0002' },
            { id: 'f3', type: '应付', counterparty: '华纺原料', currency: 'CNY', amount: 45000, paid_amount: 20000, record_date: '2026-07-01', status: 'partial', related_order: 'PO-2026-001' },
            { id: 'f4', type: 'cost', counterparty: '内部', currency: 'CNY', amount: 14250, paid_amount: 14250, work_order_id: 'w1', record_date: '2026-07-02', status: 'settled', cost_breakdown: { fabric: 6000, lining: 1750, filling: 4000, accessory: 600, labor: 1050, overhead: 850 } },
            { id: 'f5', type: 'salary', counterparty: '陈秀英', currency: 'CNY', amount: 4200, paid_amount: 4200, employee_id: 'emp1', month: '2026-06', record_date: '2026-06-30', status: 'settled' },
          ]);
          store.setSuppliers([
            { id: 's1', name: '华纺原料', contact: '张经理', phone: '0579-88880001', address: '浙江省浦江县纺织路1号', status: 'active', qualification_files: [] },
            { id: 's2', name: '新棉填充', contact: '李经理', phone: '0579-88880002', address: '浙江省浦江县填充路2号', status: 'active', qualification_files: [] },
            { id: 's3', name: '东振机械', contact: '王经理', phone: '0579-88880003', address: '浙江省浦江县机械路3号', status: 'active', qualification_files: [] },
          ]);
          store.setPurchaseRequests([
            { id: 'pr1', code: 'PR-2026-001', applicant: '生产部', department: '生产部', created_at: '2026-07-01', required_date: '2026-07-10', status: 'approved', items: [
              { material_code: 'MT-001', material_name: '纯棉面料', specification: '幅宽240cm 克重120g', quantity: 1000, unit: '米', required_date: '2026-07-10', reason: '生产工单 WO-2026-0001 用料' },
            ] },
          ]);
          store.setPurchaseOrders([
            { id: 'po1', order_no: 'PO-2026-001', supplier_id: 's1', supplier_name: '华纺原料', request_id: 'pr1', request_code: 'PR-2026-001', total_amount: 45000, currency: 'CNY', status: 'partial', payment_status: 'partial', issued_date: '2026-07-04', created_at: '2026-07-02', items: [
              { material_code: 'MT-001', material_name: '纯棉面料', specification: '幅宽240cm 克重120g', quantity: 1000, unit: '米', unit_price: 45, amount: 45000, arrival_qty: 500 },
            ] },
          ]);
          store.setPurchaseArrivals([
            { id: 'pa1', code: 'PA-2026-001', order_id: 'po1', order_no: 'PO-2026-001', supplier_name: '华纺原料', arrival_date: '2026-07-05', inspector: '李检', status: 'qualified', items: [
              { material_code: 'MT-001', material_name: '纯棉面料', specification: '幅宽240cm 克重120g', quantity: 500, unit: '米', unit_price: 45, amount: 22500 },
            ] },
          ]);
          store.setPaymentRecords([
            { id: 'pay1', code: 'PAY-2026-001', type: 'pay', order_id: 'po1', order_no: 'PO-2026-001', counterparty: '华纺原料', amount: 20000, currency: 'CNY', payment_date: '2026-07-06', payment_method: '银行转账', status: 'completed' },
          ]);
          store.setEvaluationItems([
            { id: 'ev1', scene: '工艺设计', level: 2, status: '达标', evidence_files: [] },
            { id: 'ev2', scene: '营销管理', level: 2, status: '达标', evidence_files: [] },
            { id: 'ev3', scene: '生产管控', level: 2, status: '达标', evidence_files: [] },
            { id: 'ev4', scene: '质量管理', level: 2, status: '达标', evidence_files: [] },
            { id: 'ev5', scene: '设备管理', level: 2, status: '达标', evidence_files: [] },
            { id: 'ev6', scene: '安全生产', level: 2, status: '达标', evidence_files: [] },
            { id: 'ev7', scene: '仓储物流', level: 2, status: '达标', evidence_files: [] },
            { id: 'ev8', scene: '财务管理', level: 2, status: '达标', evidence_files: [] },
            { id: 'ev9', scene: '计划排程', level: 2, status: '达标', evidence_files: [] },
            { id: 'ev10', scene: '采购管理', level: 2, status: '达标', evidence_files: [] },
          ]);
          store.setShipments([
            { id: 'sh1', shipment_no: 'SH-2026-0001', order_id: 's1', order_no: 'SO-2026-0001', customer_id: 'c1', customer_name: '欧美家纺贸易公司', shipment_date: '2026-07-18', logistics_company: 'COSCO', tracking_no: 'COS1234567', status: 'shipped', items: [{ product_id: 'p1', product_code: 'JF-2026-001', product_name: '北欧风绗缝被', quantity: 500 }] },
          ]);
          store.setFollowUps([
            { id: 'f1', customer_id: 'c1', time: '2026-07-01 10:00', operator: '李销售', content: '确认三季度订单意向', next_time: '2026-07-10' },
          ]);
          store.setPriceLists([
            { id: 'pr1', product_id: 'p1', product_code: 'JF-2026-001', product_name: '北欧风绗缝被', price: 158, effective_date: '2026-01-01', expiry_date: '2026-12-31' },
            { id: 'pr2', product_id: 'p2', product_code: 'JF-2026-002', product_name: '亲肤四件套', price: 299, effective_date: '2026-01-01', expiry_date: '2026-12-31' },
            { id: 'pr3', product_id: 'p3', product_code: 'JF-2026-003', product_name: '云朵沙发垫', price: 88, effective_date: '2026-01-01', expiry_date: '2026-12-31' },
            { id: 'pr4', product_id: 'p4', product_code: 'JF-2026-004', product_name: '儿童绗缝童被', price: 168, effective_date: '2026-01-01', expiry_date: '2026-12-31' },
            { id: 'pr5', product_id: 'p1', product_code: 'JF-2026-001', product_name: '北欧风绗缝被-2026大促', price: 138, effective_date: '2026-06-01', expiry_date: '2026-08-31' },
          ]);
          store.setCustomerDiscounts([
            { id: 'd1', level: '战略客户', discount: 0.9 },
            { id: 'd2', level: 'A级客户', discount: 0.95 },
            { id: 'd3', level: 'B级客户', discount: 0.98 },
            { id: 'd4', level: 'C级客户', discount: 1.0 },
            { id: 'd5', level: '零售客户', discount: 1.0 },
          ]);
          store.setExchangeRates([
            { id: 'r1', currency: 'USD', rate: 7.25, effective_date: '2026-07-01' },
            { id: 'r2', currency: 'EUR', rate: 7.85, effective_date: '2026-07-01' },
            { id: 'r3', currency: 'CNY', rate: 1, effective_date: '2026-07-01' },
            { id: 'r4', currency: 'GBP', rate: 9.35, effective_date: '2026-07-01' },
            { id: 'r5', currency: 'JPY', rate: 0.048, effective_date: '2026-07-01' },
          ]);

          // 追加模拟示例数据
          const seed = getSeedData();
          store.setCustomers([...store.customers, ...seed.customers]);
          store.setSalesOrders([...store.salesOrders, ...seed.salesOrders]);
          store.setShipments([...store.shipments, ...seed.shipments]);
          store.setFollowUps([...store.followUps, ...seed.followUps]);
          store.setMaterials([...store.materials, ...seed.materials]);
          store.setInventory([...store.inventory, ...seed.inventory]);
          store.setSuppliers([...store.suppliers, ...seed.suppliers]);
          store.setPurchaseRequests(
            [...store.purchaseRequests, ...seed.purchaseRequests].map((r) => {
              if (r.source) return r;
              const isMRP = r.items.some((it) =>
                it.reason?.includes("MRP"),
              );
              return {
                ...r,
                source: isMRP ? "MRP 自动生成" : "手工创建",
              };
            }),
          );
          store.setPurchaseOrders([...store.purchaseOrders, ...seed.purchaseOrders]);
          store.setPurchaseArrivals([...store.purchaseArrivals, ...seed.purchaseArrivals]);
          store.setWorkOrders([...store.workOrders, ...seed.workOrders]);
          store.setMaterialRequisitions([...store.materialRequisitions, ...seed.materialRequisitions]);
          store.setEquipment([...store.equipment, ...seed.equipment]);
          store.setMaintenancePlans([...store.maintenancePlans, ...seed.maintenancePlans]);
          store.setEquipmentRecords([...store.equipmentRecords, ...seed.equipmentRecords]);
          store.setEmployees([...store.employees, ...seed.employees]);
          store.setFinanceRecords([...store.financeRecords, ...seed.financeRecords]);
          store.setAfterSalesTickets([...store.afterSalesTickets, ...seed.afterSalesTickets]);
          store.setAfterSalesReturns([...store.afterSalesReturns, ...seed.afterSalesReturns]);
          store.setAfterSalesReshipments([...store.afterSalesReshipments, ...seed.afterSalesReshipments]);
          store.setQualityInspections([...store.qualityInspections, ...seed.qualityInspections]);
          store.setQualityStandards([...store.qualityStandards, ...(seed.qualityStandards || [])]);
          store.setProcessInspectionStandards([...store.processInspectionStandards, ...seed.processInspectionStandards]);
          store.setProductionExceptions([...store.productionExceptions, ...seed.productionExceptions]);
          store.setStockRecords([...store.stockRecords, ...seed.stockRecords]);
          store.setPaymentRecords([...store.paymentRecords, ...seed.paymentRecords]);
          store.setProcesses([...store.processes, ...seed.processes]);
          store.setProcessRoutes([...store.processRoutes, ...seed.processRoutes]);
          store.setProcessParamTemplates([...store.processParamTemplates, ...seed.processParamTemplates]);
          store.setProcessVersions([...store.processVersions, ...seed.processVersions]);
          store.setProcessKnowledge([...store.processKnowledge, ...seed.processKnowledge]);
          store.setContracts([...store.contracts, ...(seed.contracts || [])]);
          await seedFromStore();
          await ensureSeedContracts();
          await ensureSeedSafetyRecords();
          await ensureSeedLogs();
          const reloaded = await fetchAllEntities();
          applyData(reloaded, store);
          applyModuleVisibility(reloaded, store);
          syncSalesOrderStatusFromProduction(store);
          await syncReceivablesFromSalesOrders(
            store.salesOrders,
            store.financeRecords,
            store.addFinanceRecord,
            store.updateFinanceRecord,
          );
          // 兼容：已结清应收记录未回写销售订单时自动修复
          await syncSalesOrderStatusFromReceivables(
            store.salesOrders,
            store.financeRecords,
            store.updateSalesOrder,
          );
          // 兼容：销售订单已完成但合同未完结时自动修复
          await syncContractStatusFromSalesOrders(
            store.salesOrders,
            store.contracts,
            store.updateContract,
          );
        } else {
          applyData(data, store);
          applyModuleVisibility(data, store);
          syncSalesOrderStatusFromProduction(store);
          await ensureSeedContracts();
          await ensureSeedSafetyRecords();
          await ensureSeedLogs();
          // 兼容：已有销售订单但缺少对应应收记录时自动补齐
          await syncReceivablesFromSalesOrders(
            store.salesOrders,
            store.financeRecords,
            store.addFinanceRecord,
            store.updateFinanceRecord,
          );
          // 兼容：已结清应收记录未回写销售订单时自动修复
          await syncSalesOrderStatusFromReceivables(
            store.salesOrders,
            store.financeRecords,
            store.updateSalesOrder,
          );
          // 兼容：销售订单已完成但合同未完结时自动修复
          await syncContractStatusFromSalesOrders(
            store.salesOrders,
            store.contracts,
            store.updateContract,
          );
          // 兼容：全部工序已完工但缺少成品检验单的老数据，自动补回
          await ensureMissingFinishedInspections(store);
          // 兼容：已有数据的旧环境自动补齐库位信息
          if (store.warehouseLocations.length === 0 && !data.warehouse_locations?.length) {
            const defaultLocations: WarehouseLocation[] = [
              { id: 'loc-finished-1', code: 'A-01-01', warehouse: '成品仓', type: '成品仓', warehouse_type: 'finished_goods', capacity: 500, status: 'active', created_at: '2026-07-01', zone: 'A', row: '01', layer: '01' },
              { id: 'loc-finished-2', code: 'A-02-01', warehouse: '成品仓', type: '成品仓', warehouse_type: 'finished_goods', capacity: 300, status: 'active', created_at: '2026-07-01', zone: 'A', row: '02', layer: '01' },
              { id: 'loc-finished-3', code: 'A-03-01', warehouse: '成品仓', type: '成品仓', warehouse_type: 'finished_goods', capacity: 400, status: 'active', created_at: '2026-07-01', zone: 'A', row: '03', layer: '01' },
              { id: 'loc-fabric-1', code: 'B-01-01', warehouse: '面料仓', type: '面料仓', warehouse_type: 'raw_material', capacity: 2000, status: 'active', created_at: '2026-07-01', zone: 'B', row: '01', layer: '01' },
              { id: 'loc-fabric-2', code: 'B-02-01', warehouse: '面料仓', type: '面料仓', warehouse_type: 'raw_material', capacity: 1500, status: 'active', created_at: '2026-07-01', zone: 'B', row: '02', layer: '01' },
              { id: 'loc-fabric-3', code: 'B-03-01', warehouse: '面料仓', type: '面料仓', warehouse_type: 'raw_material', capacity: 1800, status: 'inactive', created_at: '2026-07-01', zone: 'B', row: '03', layer: '01' },
              { id: 'loc-filling-1', code: 'C-01-01', warehouse: '填充仓', type: '填充仓', warehouse_type: 'raw_material', capacity: 800, status: 'active', created_at: '2026-07-01', zone: 'C', row: '01', layer: '01' },
              { id: 'loc-filling-2', code: 'C-02-01', warehouse: '填充仓', type: '填充仓', warehouse_type: 'raw_material', capacity: 600, status: 'active', created_at: '2026-07-01', zone: 'C', row: '02', layer: '01' },
              { id: 'loc-accessory-1', code: 'D-01-01', warehouse: '辅料仓', type: '辅料仓', warehouse_type: 'raw_material', capacity: 1200, status: 'active', created_at: '2026-07-01', zone: 'D', row: '01', layer: '01' },
              { id: 'loc-accessory-2', code: 'D-02-01', warehouse: '辅料仓', type: '辅料仓', warehouse_type: 'raw_material', capacity: 900, status: 'active', created_at: '2026-07-01', zone: 'D', row: '02', layer: '01' },
              { id: 'loc-package-1', code: 'E-01-01', warehouse: '包材仓', type: '包材仓', warehouse_type: 'raw_material', capacity: 1000, status: 'active', created_at: '2026-07-01', zone: 'E', row: '01', layer: '01' },
              { id: 'loc-package-2', code: 'E-02-01', warehouse: '包材仓', type: '包材仓', warehouse_type: 'raw_material', capacity: 800, status: 'active', created_at: '2026-07-01', zone: 'E', row: '02', layer: '01' },
            ];
            const locationMap: Record<string, string> = {
              '成品仓': 'loc-finished-1',
              '面料仓': 'loc-fabric-1',
              '填充仓': 'loc-filling-1',
              '辅料仓': 'loc-accessory-1',
              '包材仓': 'loc-package-1',
            };
            const updatedInventory = store.inventory.map((i) => {
              if (i.location_id) return i;
              const locId = locationMap[i.warehouse];
              return locId ? { ...i, location_id: locId } : i;
            });
            store.setWarehouseLocations(defaultLocations);
            store.setInventory(updatedInventory);
            await seedEntities('warehouse_locations', defaultLocations as unknown as Record<string, unknown>[]);
            await Promise.all(updatedInventory.map((i) => updateEntity('inventory', i as unknown as Record<string, unknown>)));
          }
          // 兼容：旧环境无绩效等级配置时写入默认 A/B/C/D 区间
          if (store.performanceGradeConfig.length === 0 && !data.performance_grade_config?.length) {
            store.setPerformanceGradeConfig(DEFAULT_GRADE_CONFIG);
            await seedEntities('performance_grade_config', DEFAULT_GRADE_CONFIG as unknown as Record<string, unknown>[]);
          }
        }
      } catch (err) {
        console.error('[DataProvider] 加载数据失败:', err);
      } finally {
        clearTimeout(timeoutId);
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">数据加载中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

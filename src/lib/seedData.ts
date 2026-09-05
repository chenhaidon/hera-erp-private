import type {
  Customer,
  SalesOrder,
  Shipment,
  FollowUp,
  Material,
  Inventory,
  Supplier,
  PurchaseOrder,
  PurchaseArrival,
  PurchaseRequest,
  WorkOrder,
  WorkOrderOperation,
  MaterialRequisition,
  Equipment,
  MaintenancePlan,
  EquipmentRecord,
  SafetyRecord,
  Employee,
  FinanceRecord,
  PaymentRecord,
  AfterSalesTicket,
  AfterSalesReturn,
  AfterSalesReshipment,
  QualityInspection,
  QualityStandard,
  ProductionException,
  StockRecord,
  ProcessItem,
  ProcessRoute,
  ProcessParamTemplate,
  ProcessVersion,
  ProcessKnowledge,
  ProcessInspection,
  ProcessInspectionStandard,
  OutsourcingDispatch,
  OutsourcingReturnQC,
  Contract,
  ContractCraftSheet,
  OperationLog,
  LoginLog,
} from '@/types';

// 10 位客户
export const seedCustomers: Customer[] = [
  { id: 'c-seed-1', name: '德国睡眠之家', contact: 'Hans Mueller', phone: '+49-30-123456', address: 'Berlin, Germany', email: '', country: '德国', customer_type: '品牌商' },
  { id: 'c-seed-2', name: '法国柔软家居', contact: 'Sophie Dubois', phone: '+33-1-234567', address: 'Paris, France', email: '', country: '法国', customer_type: '品牌商' },
  { id: 'c-seed-3', name: '英国床品连锁', contact: 'James Smith', phone: '+44-20-345678', address: 'London, UK', email: '', country: '英国', customer_type: '零售商' },
  { id: 'c-seed-4', name: '日本寝具株式会社', contact: '田中太郎', phone: '+81-3-456789', address: 'Tokyo, Japan', email: '', country: '日本', customer_type: '品牌商' },
  { id: 'c-seed-5', name: '韩国生活美学', contact: 'Kim Minji', phone: '+82-2-567890', address: 'Seoul, Korea', email: '', country: '韩国', customer_type: '电商' },
  { id: 'c-seed-6', name: '澳洲家纺进口商', contact: 'Emma Wilson', phone: '+61-2-678901', address: 'Sydney, Australia', email: '', country: '澳大利亚', customer_type: '贸易商' },
  { id: 'c-seed-7', name: '加拿大北方家居', contact: 'David Chen', phone: '+1-416-789012', address: 'Toronto, Canada', email: '', country: '加拿大', customer_type: '零售商' },
  { id: 'c-seed-8', name: '东南亚家居集散', contact: 'Nguyen Van', phone: '+84-28-890123', address: 'Ho Chi Minh, Vietnam', email: '', country: '越南', customer_type: '贸易商' },
  { id: 'c-seed-9', name: '京东自营家纺', contact: '周经理', phone: '13500135000', address: '北京亦庄', email: '', country: '中国', customer_type: '电商平台' },
  { id: 'c-seed-10', name: '拼多多旗舰店', contact: '吴主管', phone: '13600136000', address: '上海浦东', email: '', country: '中国', customer_type: '电商' },
];

// 10 张销售订单（用于售后示例数据引用）
export const seedSalesOrders: SalesOrder[] = [
  {
    id: 'so-seed-1',
    order_no: 'SO-202607-0001',
    order_type: '外贸',
    channel: '独立站',
    customer_id: 'c-seed-1',
    customer_name: '德国睡眠之家',
    currency: 'EUR',
    trade_term: 'FOB',
    destination: 'Berlin, Germany',
    delivery_date: '2026-07-15',
    delivery_term: '30天',
    total_amount: 12800,
    status: 'completed',
    created_at: '2026-07-01 09:00',
    contract_no: 'SC-202607-0001',
    items: [
      { product_code: 'P-001', product_name: '亲肤四件套', quantity: 200, unit: '套', unit_price: 64, amount: 12800 },
    ],
    logs: [{ status: 'completed', operator: '系统', time: '2026-07-15 18:00', remark: '已发货' }],
  },
  {
    id: 'so-seed-2',
    order_no: 'SO-202607-0002',
    order_type: '电商',
    channel: '京东自营',
    customer_id: 'c-seed-9',
    customer_name: '京东自营家纺',
    currency: 'CNY',
    trade_term: 'EXW',
    destination: '北京亦庄',
    delivery_date: '2026-07-08',
    total_amount: 56000,
    status: 'completed',
    created_at: '2026-07-02 10:00',
    contract_no: 'SC-202607-0002',
    items: [
      { product_code: 'P-002', product_name: '乳胶护颈枕', quantity: 400, unit: '个', unit_price: 140, amount: 56000 },
    ],
    logs: [{ status: 'completed', operator: '系统', time: '2026-07-08 16:00', remark: '已发货' }],
  },
  {
    id: 'so-seed-3',
    order_no: 'SO-202607-0003',
    order_type: 'B2B',
    channel: '线下',
    customer_id: 'c-seed-3',
    customer_name: '英国床品连锁',
    currency: 'GBP',
    trade_term: 'CIF',
    destination: 'London, UK',
    delivery_date: '2026-07-20',
    total_amount: 9600,
    status: 'completed',
    created_at: '2026-07-03 11:00',
    contract_no: 'SC-202607-0003',
    items: [
      { product_code: 'P-003', product_name: '天丝夏凉被', quantity: 120, unit: '条', unit_price: 80, amount: 9600 },
    ],
    logs: [{ status: 'completed', operator: '系统', time: '2026-07-20 17:00', remark: '已发货' }],
  },
  {
    id: 'so-seed-4',
    order_no: 'SO-202607-0004',
    order_type: '外贸',
    channel: '展会',
    customer_id: 'c-seed-2',
    customer_name: '法国柔软家居',
    currency: 'EUR',
    trade_term: 'FOB',
    destination: 'Paris, France',
    delivery_date: '2026-07-10',
    total_amount: 18400,
    status: 'completed',
    created_at: '2026-07-05 14:00',
    contract_no: 'SC-202607-0004',
    items: [
      { product_code: 'P-004', product_name: '磨毛保暖四件套', quantity: 230, unit: '套', unit_price: 80, amount: 18400 },
    ],
    logs: [{ status: 'completed', operator: '系统', time: '2026-07-10 15:00', remark: '已发货' }],
  },
  {
    id: 'so-seed-5',
    order_no: 'SO-202607-0005',
    order_type: '电商',
    channel: '拼多多',
    customer_id: 'c-seed-10',
    customer_name: '拼多多旗舰店',
    currency: 'CNY',
    trade_term: 'EXW',
    destination: '上海浦东',
    delivery_date: '2026-07-12',
    total_amount: 32400,
    status: 'completed',
    created_at: '2026-07-06 16:00',
    contract_no: 'SC-202607-0005',
    items: [
      { product_code: 'P-005', product_name: '抗菌纤维被', quantity: 360, unit: '条', unit_price: 90, amount: 32400 },
    ],
    logs: [{ status: 'completed', operator: '系统', time: '2026-07-12 18:00', remark: '已发货' }],
  },
  {
    id: 'so-seed-6',
    order_no: 'SO-202607-0006',
    order_type: '外贸',
    channel: '阿里国际',
    customer_id: 'c-seed-6',
    customer_name: '澳洲家纺进口商',
    currency: 'AUD',
    trade_term: 'CIF',
    destination: 'Sydney, Australia',
    delivery_date: '2026-07-22',
    total_amount: 14200,
    status: 'completed',
    created_at: '2026-07-08 09:00',
    contract_no: 'SC-202607-0006',
    items: [
      { product_code: 'P-006', product_name: '凉感凉席三件套', quantity: 200, unit: '套', unit_price: 71, amount: 14200 },
    ],
    logs: [{ status: 'completed', operator: '系统', time: '2026-07-22 16:00', remark: '已发货' }],
  },
  {
    id: 'so-seed-7',
    order_no: 'SO-202607-0007',
    order_type: 'B2B',
    channel: '线下',
    customer_id: 'c-seed-7',
    customer_name: '加拿大北方家居',
    currency: 'CAD',
    trade_term: 'FOB',
    destination: 'Toronto, Canada',
    delivery_date: '2026-07-25',
    total_amount: 21000,
    status: 'completed',
    created_at: '2026-07-10 13:00',
    contract_no: 'SC-202607-0007',
    items: [
      { product_code: 'P-007', product_name: '鹅绒被', quantity: 100, unit: '条', unit_price: 210, amount: 21000 },
    ],
    logs: [{ status: 'completed', operator: '系统', time: '2026-07-25 15:00', remark: '已发货' }],
  },
  {
    id: 'so-seed-8',
    order_no: 'SO-202607-0008',
    order_type: '电商',
    channel: '抖音',
    customer_id: 'c-seed-5',
    customer_name: '韩国生活美学',
    currency: 'CNY',
    trade_term: 'EXW',
    destination: 'Seoul, Korea',
    delivery_date: '2026-07-14',
    total_amount: 28800,
    status: 'completed',
    created_at: '2026-07-11 10:00',
    contract_no: 'SC-202607-0008',
    items: [
      { product_code: 'P-008', product_name: '记忆棉枕', quantity: 240, unit: '个', unit_price: 120, amount: 28800 },
    ],
    logs: [{ status: 'completed', operator: '系统', time: '2026-07-14 17:00', remark: '已发货' }],
  },
];

// 10 条发货记录
export const seedShipments: Shipment[] = [
];


// 10 条客户跟进
export const seedFollowUps: FollowUp[] = [
];


// 10 种物料
export const seedMaterials: Material[] = [
  { id: 'm-seed-1', code: 'MT-010', name: '水洗棉面料', category: '面料', specification: '幅宽240cm 克重130g', unit: '米', default_supplier: '华纺原料', color: '浅灰', pattern_code: 'P-010', composition: '100%棉', weight: 130, resilience_level: '', safety_stock: 400, stock: 800, status: 'active' },
  { id: 'm-seed-2', code: 'MT-011', name: '磨毛面料', category: '面料', specification: '幅宽220cm 克重160g', unit: '米', default_supplier: '华纺原料', color: '卡其', pattern_code: 'P-011', composition: '100%棉', weight: 160, resilience_level: '', safety_stock: 300, stock: 650, status: 'active' },
  { id: 'm-seed-3', code: 'MT-012', name: '聚酯纤维棉', category: '填充物', specification: '克重200g/㎡', unit: 'kg', default_supplier: '新棉填充', color: '', pattern_code: '', composition: '聚酯纤维', weight: 200, resilience_level: '中', safety_stock: 150, stock: 420, status: 'active' },
  { id: 'm-seed-4', code: 'MT-013', name: '羽丝绒', category: '填充物', specification: '克重150g/㎡', unit: 'kg', default_supplier: '新棉填充', color: '', pattern_code: '', composition: '超细纤维', weight: 150, resilience_level: '高', safety_stock: 100, stock: 300, status: 'active' },
  { id: 'm-seed-5', code: 'MT-014', name: '包边条', category: '辅料', specification: '3cm宽 全棉斜纹', unit: '米', default_supplier: '辅料通', color: '米白', pattern_code: '', composition: '棉', weight: 0, resilience_level: '', safety_stock: 200, stock: 1200, status: 'active' },
  { id: 'm-seed-6', code: 'MT-015', name: '缝纫线', category: '辅料', specification: '402 涤纶高强线', unit: '卷', default_supplier: '辅料通', color: '白色', pattern_code: '', composition: '涤纶', weight: 0, resilience_level: '', safety_stock: 100, stock: 800, status: 'active' },
  { id: 'm-seed-7', code: 'MT-016', name: '水洗标', category: '辅料', specification: '尼龙带 印字', unit: '个', default_supplier: '辅料通', color: '', pattern_code: '', composition: '尼龙', weight: 0, resilience_level: '', safety_stock: 500, stock: 5000, status: 'active' },
  { id: 'm-seed-8', code: 'MT-017', name: '包装袋', category: '辅料', specification: 'PE透明袋 自封口', unit: '个', default_supplier: '包材厂', color: '', pattern_code: '', composition: 'PE', weight: 0, resilience_level: '', safety_stock: 300, stock: 3000, status: 'active' },
  { id: 'm-seed-9', code: 'MT-018', name: '纸箱', category: '辅料', specification: '60×40×30cm 五层瓦楞', unit: '个', default_supplier: '包材厂', color: '', pattern_code: '', composition: '纸', weight: 0, resilience_level: '', safety_stock: 100, stock: 800, status: 'active' },
  { id: 'm-seed-10', code: 'MT-019', name: '防滑底布', category: '面料', specification: '幅宽160cm 点塑无纺布', unit: '米', default_supplier: '华纺原料', color: '白色', pattern_code: '', composition: '聚酯纤维', weight: 80, resilience_level: '', safety_stock: 250, stock: 550, status: 'active' },
  { id: 'm-seed-11', code: 'MT-020', name: '包边布', category: '滚边料', specification: '门幅2.35m A#', unit: '米', default_supplier: '', color: '', pattern_code: '', composition: '', weight: 0, resilience_level: '', safety_stock: 0, stock: 0, status: 'active', width: '2.35m', fabric_no: 'A#', piece_size: '0.048×8m', remark: '复合包边使用' },
  { id: 'm-seed-12', code: 'MT-021', name: '面子（凉感布）', category: '面层面料', specification: '门幅2.35m A#', unit: '米', default_supplier: '', color: '', pattern_code: '', composition: '', weight: 0, resilience_level: '', safety_stock: 0, stock: 0, status: 'active', width: '2.35m', fabric_no: 'A#', piece_size: '2.34×1.81m', remark: '表层面料' },
  { id: 'm-seed-13', code: 'MT-022', name: '无纺衬', category: '衬布', specification: '门幅2.35m 20g无纺', unit: '米', default_supplier: '', color: '', pattern_code: '', composition: '', weight: 0, resilience_level: '', safety_stock: 0, stock: 0, status: 'active', width: '2.35m', fabric_no: '20g无纺', piece_size: '2.34×1.81m', remark: '和面布复合' },
  { id: 'm-seed-14', code: 'MT-023', name: '底布（涤点塑布）', category: '底层面料', specification: '门幅2.35m B#', unit: '米', default_supplier: '', color: '', pattern_code: '', composition: '', weight: 0, resilience_level: '', safety_stock: 0, stock: 0, status: 'active', width: '2.35m', fabric_no: 'B#', piece_size: '2.34×1.81m', remark: '底部防滑面料' },
  { id: 'm-seed-15', code: 'MT-024', name: '450g针刺棉(50%)', category: '填充棉', specification: '门幅2.32m 450g针刺棉', unit: '米', default_supplier: '', color: '', pattern_code: '', composition: '', weight: 450, resilience_level: '', safety_stock: 0, stock: 0, status: 'active', width: '2.32m', fabric_no: '—', piece_size: '2.32×1.79m', remark: '填充层，单条重量1.87kg' },
];

// 10 条库存记录
export const seedInventory: Inventory[] = [
  { id: 'i-seed-1', product_id: 'p1', type: 'product', quantity: 320, min_stock: 100, max_stock: 1000, warehouse: '成品仓' },
  { id: 'i-seed-2', product_id: 'p2', type: 'product', quantity: 85, min_stock: 50, max_stock: 500, warehouse: '成品仓' },
  { id: 'i-seed-3', product_id: 'p3', type: 'product', quantity: 150, min_stock: 80, max_stock: 600, warehouse: '成品仓' },
  { id: 'i-seed-4', product_id: 'p4', type: 'product', quantity: 60, min_stock: 30, max_stock: 300, warehouse: '成品仓' },
  { id: 'i-seed-5', material_id: 'm1', type: 'material', quantity: 1200, min_stock: 500, max_stock: 3000, warehouse: '面料仓' },
  { id: 'i-seed-6', material_id: 'm2', type: 'material', quantity: 380, min_stock: 200, max_stock: 1000, warehouse: '填充仓' },
  { id: 'i-seed-7', material_id: 'm-seed-1', type: 'material', quantity: 800, min_stock: 400, max_stock: 2000, warehouse: '面料仓' },
  { id: 'i-seed-8', material_id: 'm-seed-2', type: 'material', quantity: 650, min_stock: 300, max_stock: 1500, warehouse: '面料仓' },
  { id: 'i-seed-9', material_id: 'm-seed-3', type: 'material', quantity: 420, min_stock: 150, max_stock: 800, warehouse: '填充仓' },
  { id: 'i-seed-10', material_id: 'm-seed-5', type: 'material', quantity: 1200, min_stock: 200, max_stock: 2000, warehouse: '辅料仓' },
];

// 10 个供应商
export const seedSuppliers: Supplier[] = [
  { id: 's-seed-1', name: '江苏华纺原料', contact: '张经理', phone: '0512-88880001', address: '江苏省苏州市纺织路1号', status: 'active', qualification_files: [] },
  { id: 's-seed-2', name: '浙江新棉填充', contact: '李经理', phone: '0579-88880002', address: '浙江省浦江县填充路2号', status: 'active', qualification_files: [] },
  { id: 's-seed-3', name: '广东辅料通', contact: '王主管', phone: '020-88880003', address: '广东省广州市辅料街3号', status: 'active', qualification_files: [] },
  { id: 's-seed-4', name: '山东包材厂', contact: '赵经理', phone: '0531-88880004', address: '山东省济南市包装路4号', status: 'active', qualification_files: [] },
  { id: 's-seed-5', name: '上海东振机械', contact: '孙经理', phone: '021-88880005', address: '上海市浦东新区机械路5号', status: 'active', qualification_files: [] },
  { id: 's-seed-6', name: '河北面料集团', contact: '周经理', phone: '0311-88880006', address: '河北省石家庄市面料路6号', status: 'active', qualification_files: [] },
  { id: 's-seed-7', name: '福建填充科技', contact: '吴主管', phone: '0591-88880007', address: '福建省福州市科技路7号', status: 'active', qualification_files: [] },
  { id: 's-seed-8', name: '湖北纺织配件', contact: '郑经理', phone: '027-88880008', address: '湖北省武汉市配件路8号', status: 'active', qualification_files: [] },
  { id: 's-seed-9', name: '安徽染料化工', contact: '钱主管', phone: '0551-88880009', address: '安徽省合肥市化工路9号', status: 'active', qualification_files: [] },
  { id: 's-seed-10', name: '江西线带厂', contact: '冯经理', phone: '0791-88880010', address: '江西省南昌市线带路10号', status: 'active', qualification_files: [] },
];

// 10 条采购申请
export const seedPurchaseRequests: PurchaseRequest[] = [
];


// 10 条采购订单
export const seedPurchaseOrders: PurchaseOrder[] = [
];


// 10 条采购到货
export const seedPurchaseArrivals: PurchaseArrival[] = [
];


// 10 个工单
// 生产工单种子数据已清空：所有工单须关联现有合同，通过 entity_store 管理
export const seedWorkOrders: WorkOrder[] = [];

// 示例合同及生产工艺单（合同 26JLKXD007），数据来源于生产工艺单图片 OCR
const craftSheetImage26JLKXD007 = 'https://miaoda-conversation-file.cdn.bcebos.com/user-am3svbma0934/app-crmh8tn256v5/20260813/146947403c626ea20e514018df2f25da.jpg';
const craftSheet26JLKXD007: ContractCraftSheet = {
  id: 'cs-26JLKXD007-1',
  seq_no: '26060',
  title: '金龙工艺生产工艺单',
  customer_contract_no: '26KHM007',
  finish_date: '2026-09-03',
  colors: ['米色', '橄榄绿', '复古蓝'],
  rows: [
    { id: 'cs-26JLKXD007-1-1', product_code: 'GN2608-BG-QXL', image: craftSheetImage26JLKXD007, size: 'QUEEN XL 98×98英寸 + 20×26英寸×2', color_quantities: { 米色: 100, 橄榄绿: 0, 复古蓝: 0 }, total_quantity: 100 },
    { id: 'cs-26JLKXD007-1-2', product_code: 'GN2608-BG-KXL', image: craftSheetImage26JLKXD007, size: 'KING XL 108×98英寸 + 20×36英寸×2', color_quantities: { 米色: 80, 橄榄绿: 0, 复古蓝: 0 }, total_quantity: 80 },
    { id: 'cs-26JLKXD007-1-3', product_code: 'GN2608-BG-OK', image: craftSheetImage26JLKXD007, size: 'OVERSIZED KING 112×106英寸 + 20×36英寸×2', color_quantities: { 米色: 60, 橄榄绿: 0, 复古蓝: 0 }, total_quantity: 60 },
    { id: 'cs-26JLKXD007-1-4', product_code: 'GN2609-OG-QXL', image: craftSheetImage26JLKXD007, size: 'QUEEN XL 98×98英寸 + 20×26英寸×2', color_quantities: { 米色: 0, 橄榄绿: 90, 复古蓝: 0 }, total_quantity: 90 },
    { id: 'cs-26JLKXD007-1-5', product_code: 'GN2609-OG-KXL', image: craftSheetImage26JLKXD007, size: 'KING XL 108×98英寸 + 20×36英寸×2', color_quantities: { 米色: 0, 橄榄绿: 20, 复古蓝: 0 }, total_quantity: 20 },
    { id: 'cs-26JLKXD007-1-6', product_code: 'GN2609-OG-OK', image: craftSheetImage26JLKXD007, size: 'OVERSIZED KING 112×106英寸 + 20×36英寸×2', color_quantities: { 米色: 0, 橄榄绿: 20, 复古蓝: 0 }, total_quantity: 20 },
    { id: 'cs-26JLKXD007-1-7', product_code: 'GN2610-DB-QXL', image: craftSheetImage26JLKXD007, size: 'QUEEN XL 98×98英寸 + 20×26英寸×2', color_quantities: { 米色: 0, 橄榄绿: 0, 复古蓝: 25 }, total_quantity: 25 },
    { id: 'cs-26JLKXD007-1-8', product_code: 'GN2610-DB-KXL', image: craftSheetImage26JLKXD007, size: 'KING XL 108×98英寸 + 20×36英寸×2', color_quantities: { 米色: 0, 橄榄绿: 0, 复古蓝: 60 }, total_quantity: 60 },
    { id: 'cs-26JLKXD007-1-9', product_code: 'GN2610-DB-OK', image: craftSheetImage26JLKXD007, size: 'OVERSIZED KING 112×106英寸 + 20×36英寸×2', color_quantities: { 米色: 0, 橄榄绿: 0, 复古蓝: 28 }, total_quantity: 28 },
  ],
  process_requirements:
    '面布/底布/包边布：32S 68×62全棉素色砂洗；\n200g 芯棉，含棉量不低于90%；\n电脑绣花，单面配色绗线绣花；\n被子/枕套需包边包边，缝成小圆角；\n底布大小片：1/3处开口，小片压小片；\n小片与大身连接处接缝不少于8针；收布时不小于10针，整被制位需按人字对位；\n被套开口，靠垫位不可露针成线；\n成品水洗；被套四周车缝线条位置入涤纶卡位，PVC袋包装；入箱需按客户箱装要求；\n箱唛/标签：按客户要求。',
  total_quantity: 483,
};

export const seedContracts: Contract[] = [
  {
    id: 'c-26JLKXD007',
    contract_no: '26JLKXD007',
    original_contract_no: '26KHM007',
    title: '客户 26KHM007 - 绗缝被生产工艺单',
    customer_id: 'c-seed-26KHM007',
    customer_name: 'KHM 客户',
    contact_name: '张经理',
    contact_phone: '13800138000',
    customer_address: '义乌国际商贸城',
    contract_type: 'export',
    customer_level: 'normal',
    amount: 0,
    currency: 'CNY',
    sign_date: '2026-08-05',
    effective_date: '2026-08-05',
    delivery_date: '2026-09-03',
    payment_terms: '款到发货',
    status: 'executing',
    remark: '完成日期 2026年9月3日，序号 26060',
    version: 'V1.0',
    items: [
      {
        id: 'ci-26JLKXD007-1',
        product_id: 'p-cs-1',
        product_code: 'GN2608-BG',
        product_name: '复古绗缝被',
        specification: 'QUEEN XL 108x98" + 20x26" x 2 / KING XL 108x98" + 20x36" x 2 / OVERSIZED KING 112x106" + 20x36" x 2',
        quantity: 483,
        unit_price: 0,
        total_price: 0,
      },
    ],
    clauses: [],
    approval_logs: [],
    performance_nodes: [],
    version_logs: [],
    attachments: [],
    craft_sheets: [craftSheet26JLKXD007],
    reminders: [],
    created_by: '系统',
    created_at: '2026-08-05T00:00:00.000Z',
    updated_at: '2026-08-05T00:00:00.000Z',
  },
];

// 10 条领料单
export const seedMaterialRequisitions: MaterialRequisition[] = [
];


// 30 台设备
export const seedEquipment: Equipment[] = [
  // 缝纫机 8 台
  { id: 'eq-1', code: 'EQ-001', name: '缝纫机 A', model: 'FN-8700', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 409 },
  { id: 'eq-2', code: 'EQ-002', name: '缝纫机 B', model: 'FN-8700', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 410 },
  { id: 'eq-3', code: 'EQ-003', name: '缝纫机 C', model: 'FN-8700', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 413 },
  { id: 'eq-4', code: 'EQ-004', name: '缝纫机 D', model: 'FN-8700', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 416 },
  { id: 'eq-5', code: 'EQ-005', name: '缝纫机 E', model: 'FN-8700', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 427 },
  { id: 'eq-6', code: 'EQ-006', name: '缝纫机 F', model: 'FN-8700', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 424 },
  { id: 'eq-7', code: 'EQ-007', name: '缝纫机 G', model: 'FN-8700', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 423 },
  { id: 'eq-8', code: 'EQ-008', name: '缝纫机 H', model: 'FN-8700', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 419 },
  // 包边机 3 台
  { id: 'eq-9', code: 'EQ-009', name: '包边机 A', model: 'BB-600', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 374 },
  { id: 'eq-10', code: 'EQ-010', name: '包边机 B', model: 'BB-600', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 357 },
  { id: 'eq-11', code: 'EQ-011', name: '包边机 C', model: 'BB-600', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 374 },
  // 拷边机、松布机、充棉机、吸塑机
  { id: 'eq-12', code: 'EQ-012', name: '拷边机', model: 'KB-700', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '缝制设备', running_hours: 322 },
  { id: 'eq-13', code: 'EQ-013', name: '松布机', model: 'SB-300', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '裁剪设备', running_hours: 220 },
  { id: 'eq-14', code: 'EQ-014', name: '充棉机', model: 'CM-500', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '填充设备', running_hours: 256 },
  { id: 'eq-15', code: 'EQ-015', name: '吸塑机 A', model: 'XS-1000', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '包装设备', running_hours: 317 },
  { id: 'eq-16', code: 'EQ-016', name: '吸塑机 B', model: 'XS-1000', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '包装设备', running_hours: 306 },
  // 储气罐、空压机、检针机、升降机
  { id: 'eq-17', code: 'EQ-017', name: '储气罐', model: 'CG-1000', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '辅助设备', running_hours: 1234 },
  { id: 'eq-18', code: 'EQ-018', name: '空压机', model: 'KY-30', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '辅助设备', running_hours: 1243 },
  { id: 'eq-19', code: 'EQ-019', name: '检针机', model: 'JZ-200', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '检验设备', running_hours: 425 },
  { id: 'eq-20', code: 'EQ-020', name: '升降机', model: 'SJ-2000', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '搬运设备', running_hours: 221 },
  // 液压车 3 台
  { id: 'eq-21', code: 'EQ-021', name: '液压车 A', model: 'YY-500', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '搬运设备', running_hours: 109 },
  { id: 'eq-22', code: 'EQ-022', name: '液压车 B', model: 'YY-500', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '搬运设备', running_hours: 117 },
  { id: 'eq-23', code: 'EQ-023', name: '液压车 C', model: 'YY-500', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '搬运设备', running_hours: 112 },
  // 平板车 7 台
  { id: 'eq-24', code: 'EQ-024', name: '平板车 A', model: 'PB-300', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '搬运设备', running_hours: 111 },
  { id: 'eq-25', code: 'EQ-025', name: '平板车 B', model: 'PB-300', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '搬运设备', running_hours: 114 },
  { id: 'eq-26', code: 'EQ-026', name: '平板车 C', model: 'PB-300', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '搬运设备', running_hours: 107 },
  { id: 'eq-27', code: 'EQ-027', name: '平板车 D', model: 'PB-300', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '搬运设备', running_hours: 116 },
  { id: 'eq-28', code: 'EQ-028', name: '平板车 E', model: 'PB-300', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '搬运设备', running_hours: 119 },
  { id: 'eq-29', code: 'EQ-029', name: '平板车 F', model: 'PB-300', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '搬运设备', running_hours: 117 },
  { id: 'eq-30', code: 'EQ-030', name: '平板车 G', model: 'PB-300', purchase_date: '2024-03-15', status: 'idle', workshop: '生产车间', category: '搬运设备', running_hours: 107 },
];

// 30 条维保计划：编号与设备台账一一对应
export const seedMaintenancePlans: MaintenancePlan[] = [
  { id: 'mp-001', code: 'MP-001', equipment_id: 'eq-1', equipment_name: '缝纫机 A（EQ-001）', period_type: 'calendar', period: 30, last_date: '2026-07-02', next_date: '2026-08-01', content: '更换机针、清洁旋梭、检查润滑油位', status: 'overdue' },
  { id: 'mp-002', code: 'MP-002', equipment_id: 'eq-2', equipment_name: '缝纫机 B（EQ-002）', period_type: 'calendar', period: 30, last_date: '2026-07-02', next_date: '2026-08-01', content: '更换机针、清洁旋梭、检查润滑油位', status: 'overdue' },
  { id: 'mp-003', code: 'MP-003', equipment_id: 'eq-3', equipment_name: '缝纫机 C（EQ-003）', period_type: 'calendar', period: 30, last_date: '2026-07-31', next_date: '2026-08-25', content: '更换机针、清洁旋梭、检查润滑油位', status: 'upcoming' },
  { id: 'mp-004', code: 'MP-004', equipment_id: 'eq-4', equipment_name: '缝纫机 D（EQ-004）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '更换机针、清洁旋梭、检查润滑油位', status: 'normal' },
  { id: 'mp-005', code: 'MP-005', equipment_id: 'eq-5', equipment_name: '缝纫机 E（EQ-005）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '更换机针、清洁旋梭、检查润滑油位', status: 'normal' },
  { id: 'mp-006', code: 'MP-006', equipment_id: 'eq-6', equipment_name: '缝纫机 F（EQ-006）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '更换机针、清洁旋梭、检查润滑油位', status: 'normal' },
  { id: 'mp-007', code: 'MP-007', equipment_id: 'eq-7', equipment_name: '缝纫机 G（EQ-007）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '更换机针、清洁旋梭、检查润滑油位', status: 'normal' },
  { id: 'mp-008', code: 'MP-008', equipment_id: 'eq-8', equipment_name: '缝纫机 H（EQ-008）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '更换机针、清洁旋梭、检查润滑油位', status: 'normal' },
  { id: 'mp-009', code: 'MP-009', equipment_id: 'eq-9', equipment_name: '包边机 A（EQ-009）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '清洁送布牙、调整包边宽度、检查刀片', status: 'normal' },
  { id: 'mp-010', code: 'MP-010', equipment_id: 'eq-10', equipment_name: '包边机 B（EQ-010）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '清洁送布牙、调整包边宽度、检查刀片', status: 'normal' },
  { id: 'mp-011', code: 'MP-011', equipment_id: 'eq-11', equipment_name: '包边机 C（EQ-011）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '清洁送布牙、调整包边宽度、检查刀片', status: 'normal' },
  { id: 'mp-012', code: 'MP-012', equipment_id: 'eq-12', equipment_name: '拷边机（EQ-012）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '清洁切刀、调整线迹、检查压脚', status: 'normal' },
  { id: 'mp-013', code: 'MP-013', equipment_id: 'eq-13', equipment_name: '松布机（EQ-013）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '更换裁刀、校准裁床水平', status: 'normal' },
  { id: 'mp-014', code: 'MP-014', equipment_id: 'eq-14', equipment_name: '充棉机（EQ-014）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '清洁滤网、检查气压系统、补充填充料', status: 'normal' },
  { id: 'mp-015', code: 'MP-015', equipment_id: 'eq-15', equipment_name: '吸塑机 A（EQ-015）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查输送带、润滑链条、清洁吸塑模具', status: 'normal' },
  { id: 'mp-016', code: 'MP-016', equipment_id: 'eq-16', equipment_name: '吸塑机 B（EQ-016）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查输送带、润滑链条、清洁吸塑模具', status: 'normal' },
  { id: 'mp-017', code: 'MP-017', equipment_id: 'eq-17', equipment_name: '储气罐（EQ-017）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查压力表、排水排污、安全阀校验', status: 'normal' },
  { id: 'mp-018', code: 'MP-018', equipment_id: 'eq-18', equipment_name: '空压机（EQ-018）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '更换空滤、检查油气分离器、排水排污', status: 'normal' },
  { id: 'mp-019', code: 'MP-019', equipment_id: 'eq-19', equipment_name: '检针机（EQ-019）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '校准灵敏度、清洁台面、检查光源', status: 'normal' },
  { id: 'mp-020', code: 'MP-020', equipment_id: 'eq-20', equipment_name: '升降机（EQ-020）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查链条、润滑导轨、限位开关校验', status: 'normal' },
  { id: 'mp-021', code: 'MP-021', equipment_id: 'eq-21', equipment_name: '液压车 A（EQ-021）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查液压油、轮子轴承、刹车系统', status: 'normal' },
  { id: 'mp-022', code: 'MP-022', equipment_id: 'eq-22', equipment_name: '液压车 B（EQ-022）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查液压油、轮子轴承、刹车系统', status: 'normal' },
  { id: 'mp-023', code: 'MP-023', equipment_id: 'eq-23', equipment_name: '液压车 C（EQ-023）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查液压油、轮子轴承、刹车系统', status: 'normal' },
  { id: 'mp-024', code: 'MP-024', equipment_id: 'eq-24', equipment_name: '平板车 A（EQ-024）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查轮子、润滑轴承、刹车装置', status: 'normal' },
  { id: 'mp-025', code: 'MP-025', equipment_id: 'eq-25', equipment_name: '平板车 B（EQ-025）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查轮子、润滑轴承、刹车装置', status: 'normal' },
  { id: 'mp-026', code: 'MP-026', equipment_id: 'eq-26', equipment_name: '平板车 C（EQ-026）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查轮子、润滑轴承、刹车装置', status: 'normal' },
  { id: 'mp-027', code: 'MP-027', equipment_id: 'eq-27', equipment_name: '平板车 D（EQ-027）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查轮子、润滑轴承、刹车装置', status: 'normal' },
  { id: 'mp-028', code: 'MP-028', equipment_id: 'eq-28', equipment_name: '平板车 E（EQ-028）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查轮子、润滑轴承、刹车装置', status: 'normal' },
  { id: 'mp-029', code: 'MP-029', equipment_id: 'eq-29', equipment_name: '平板车 F（EQ-029）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查轮子、润滑轴承、刹车装置', status: 'normal' },
  { id: 'mp-030', code: 'MP-030', equipment_id: 'eq-30', equipment_name: '平板车 G（EQ-030）', period_type: 'calendar', period: 30, last_date: '2026-08-21', next_date: '2026-09-20', content: '检查轮子、润滑轴承、刹车装置', status: 'normal' },
];

// 保养与维修记录
export const seedSafetyRecords: SafetyRecord[] = [
  // 7 月：约 3 条，覆盖隐患、消防、已完成整改
  { id: 'saf-seed-0701-001', type: 'hazard', record_date: '2026-07-01', area: '绗缝车间A区', description: '应急照明灯故障，需更换', rectification_status: '已完成', completion_date: '2026-07-02', responsible_person: '郑华' },
  { id: 'saf-seed-0701-002', type: 'fire', record_date: '2026-07-01', area: '全厂区', description: '消防器材巡检，灭火器压力正常，消火栓水压达标', outcome: '正常', responsible_person: '安全员' },
  { id: 'saf-seed-0703-001', type: 'hazard', record_date: '2026-07-03', area: '裁剪车间', description: '裁剪刀具未入鞘存放，存在划伤风险', rectification_status: '整改中', responsible_person: '张工' },
  // 8 月：约 3 条，覆盖隐患闭环、事故上报、安全培训
  { id: 'saf-seed-0808-001', type: 'hazard', record_date: '2026-08-08', area: '包装车间', description: '通道临时堆放成品物料，影响人员通行并存在绊倒风险', rectification_status: '已完成', completion_date: '2026-08-14', responsible_person: '张工' },
  { id: 'saf-seed-0815-001', type: 'accident', record_date: '2026-08-15', area: '绗缝车间', description: '设备运行中出现异响，立即停机检查后排除故障，所幸无人受伤', outcome: '已处理', loss: '停机30分钟', responsible_person: '李班长' },
  { id: 'saf-seed-0822-001', type: 'training', record_date: '2026-08-22', topic: '消防器材使用与应急疏散演练', description: '灭火器、消防栓实操培训及全厂区应急疏散演练', outcome: '已完成', completion_date: '2026-08-22', participants: ['裁剪车间', '绗缝车间', '包装车间', '仓储部'], responsible_person: '安全主管' },
];

export const seedEquipmentRecords: EquipmentRecord[] = [
  // 保养记录
  { id: 'mr-seed-1', equipment_id: 'e-seed-1', type: 'maintenance', record_date: '2026-06-15 09:12', description: '更换机针、清洁旋梭、检查润滑油位', duration: 1.5, loss_output: 0, maintainer_id: 'emp-seed-3', maintainer: '郑华' },
  { id: 'mr-seed-2', equipment_id: 'e-seed-2', type: 'maintenance', record_date: '2026-05-20 10:35', description: '检查皮带张力、清洁针板、校准送布牙', duration: 2, loss_output: 0, maintainer_id: 'emp-seed-3', maintainer: '郑华' },
  { id: 'mr-seed-3', equipment_id: 'e-seed-3', type: 'maintenance', record_date: '2026-06-01 14:08', description: '更换裁刀、校准裁床水平', duration: 2.5, loss_output: 0, maintainer_id: 'emp-seed-3', maintainer: '郑华' },
  { id: 'mr-seed-4', equipment_id: 'e-seed-5', type: 'maintenance', record_date: '2026-06-10 11:47', description: '清洁送布牙、调整包边宽度', duration: 1, loss_output: 0, maintainer_id: 'emp-seed-3', maintainer: '郑华' },
  { id: 'mr-seed-5', equipment_id: 'e-seed-6', type: 'maintenance', record_date: '2026-05-05 15:23', description: '清洗滚筒、检查温控系统', duration: 3, loss_output: 0, maintainer_id: 'emp-seed-3', maintainer: '郑华' },
  // 维修记录
  { id: 'mr-seed-6', equipment_id: 'e-seed-4', type: 'repair', record_date: '2026-06-28 08:42', description: '电机异响，更换碳刷与轴承', duration: 4, loss_output: 120, maintainer_id: 'emp-seed-3', maintainer: '郑华' },
  { id: 'mr-seed-7', equipment_id: 'e-seed-4', type: 'repair', record_date: '2026-06-30 13:56', description: '压脚弹簧断裂，更换后调试', duration: 2, loss_output: 60, maintainer_id: 'emp-seed-3', maintainer: '郑华' },
  { id: 'mr-seed-8', equipment_id: 'e-seed-7', type: 'repair', record_date: '2026-06-25 16:09', description: '蒸汽管接头泄漏，更换密封垫', duration: 2.5, loss_output: 80, maintainer_id: 'emp-seed-3', maintainer: '郑华' },
  { id: 'mr-seed-9', equipment_id: 'e-seed-8', type: 'repair', record_date: '2026-06-20 10:18', description: '断线检测器误触发，调整灵敏度', duration: 1.5, loss_output: 40, maintainer_id: 'emp-seed-3', maintainer: '郑华' },
  { id: 'mr-seed-10', equipment_id: 'e-seed-9', type: 'repair', record_date: '2026-06-18 12:05', description: '输送带跑偏，调整滚筒与纠偏器', duration: 3, loss_output: 150, maintainer_id: 'emp-seed-3', maintainer: '郑华' },
];

// 10 名员工
export const seedEmployees: Employee[] = [
  { id: 'emp-seed-1', code: 'E010', name: '孙丽', department: '生产部', position: '绗缝工', skill_level: '高级', skill_tags: ['绗缝', '拼接'], hire_date: '2018-05-12', phone: '13900139010', status: 'active' },
  { id: 'emp-seed-2', code: 'E011', name: '周强', department: '生产部', position: '裁剪工', skill_level: '中级', skill_tags: ['裁剪', '检验'], hire_date: '2019-09-20', phone: '13900139011', status: 'active' },
  { id: 'emp-seed-3', code: 'E012', name: '吴敏', department: '质检部', position: '质检员', skill_level: '高级', skill_tags: ['质检', '包装'], hire_date: '2020-03-08', phone: '13900139012', status: 'active' },
  { id: 'emp-seed-4', code: 'E013', name: '郑华', department: '设备部', position: '维修工', skill_level: '中级', skill_tags: ['维修', '电工'], hire_date: '2017-11-15', phone: '13900139013', status: 'active' },
  { id: 'emp-seed-5', code: 'E014', name: '王芳', department: '生产部', position: '缝纫工', skill_level: '高级', skill_tags: ['缝纫', '包边'], hire_date: '2018-08-22', phone: '13900139014', status: 'active' },
  { id: 'emp-seed-6', code: 'E015', name: '李明', department: '生产部', position: '水洗工', skill_level: '中级', skill_tags: ['水洗', '整烫'], hire_date: '2019-04-10', phone: '13900139015', status: 'active' },
  { id: 'emp-seed-7', code: 'E016', name: '张婷', department: '质检部', position: '成品检', skill_level: '中级', skill_tags: ['质检', '包装'], hire_date: '2020-06-18', phone: '13900139016', status: 'active' },
  { id: 'emp-seed-8', code: 'E017', name: '刘洋', department: '仓储部', position: '仓管员', skill_level: '初级', skill_tags: ['仓储', '叉车'], hire_date: '2021-02-25', phone: '13900139017', status: 'active' },
  { id: 'emp-seed-9', code: 'E018', name: '陈静', department: '生产部', position: '绣花工', skill_level: '高级', skill_tags: ['绣花', '绗缝'], hire_date: '2018-12-03', phone: '13900139018', status: 'active' },
  { id: 'emp-seed-10', code: 'E019', name: '杨波', department: '生产部', position: '包装工', skill_level: '中级', skill_tags: ['包装', '搬运'], hire_date: '2019-07-14', phone: '13900139019', status: 'active' },
];

// 10 条财务记录
export const seedFinanceRecords: FinanceRecord[] = [
];


// 10 条售后工单
export const seedAfterSalesTickets: AfterSalesTicket[] = [
  {
    id: 'as-202608-0001',
    ticket_no: 'AS-202608-0001',
    order_id: 'sales-order-26jlkxd005',
    order_no: 'SO-26JLKXD005',
    customer_name: '青岛帝莱家居用品有限公司',
    product_code: 'SZ98875',
    product_name: 'SZ98875',
    issue_type: 'quality',
    issue_desc: '客户反馈部分套件颜色与确认样存在色差，要求退换货处理。',
    attachments: [],
    status: 'resolved',
    records: [
      { id: 'asr-1-1', handler: '张售后', handled_at: '2026-08-03 09:30', content: '联系客户获取色差照片，判定为染缸批次差异。', status: 'analyzing' },
      { id: 'asr-1-2', handler: '李主管', handled_at: '2026-08-04 14:00', content: '同意退货并换货，安排仓库接收退回商品。', status: 'processing' },
      { id: 'asr-1-3', handler: '张售后', handled_at: '2026-08-08 10:00', content: '客户确认收到换货，问题已解决，工单关闭。', status: 'resolved' },
    ],
    feedback: { id: 'asf-1', submitted_at: '2026-08-08 11:00', content: '处理速度快，态度好', rating: 5, nps: 9 },
    cause_analysis: '染缸批次差异导致色差',
    liability: 'production',
    liability_basis: '生产批次未执行首件确认',
    solution: 'exchange',
    solution_desc: '为客户更换同款同规格产品',
    refund_amount: 0,
    reship_cost: 0,
    freight_bearer: 'company',
    freight_amount: 480,
    total_cost: 480,
    created_at: '2026-08-03 08:00',
    updated_at: '2026-08-08 11:00',
  },
  {
    id: 'as-202608-0002',
    ticket_no: 'AS-202608-0002',
    order_id: 'sales-order-26jlhd011',
    order_no: 'SO-26JLHD011',
    customer_name: 'HAN OL DECO',
    product_code: 'SZ98816',
    product_name: 'SZ98816',
    issue_type: 'damage',
    issue_desc: '运输到港后部分外箱破损，产品边角受挤压影响销售。',
    attachments: [],
    status: 'resolved',
    records: [
      { id: 'asr-2-1', handler: '王售后', handled_at: '2026-08-05 10:00', content: '客户上传破损照片及物流异常签收证明，责任待确认。', status: 'analyzing' },
      { id: 'asr-2-2', handler: '王售后', handled_at: '2026-08-06 16:00', content: '判定为物流暴力装卸导致，申请补发50套同款产品。', status: 'processing' },
      { id: 'asr-2-3', handler: '王售后', handled_at: '2026-08-10 09:00', content: '客户确认收到补发货物，无异议，工单关闭。', status: 'resolved' },
    ],
    feedback: { id: 'asf-2', submitted_at: '2026-08-10 10:00', content: '问题解决，继续合作', rating: 4, nps: 8 },
    cause_analysis: '物流暴力装卸导致外箱破损',
    liability: 'logistics',
    liability_basis: '物流异常签收证明',
    solution: 'reship',
    solution_desc: '补发同款产品50套',
    refund_amount: 0,
    reship_cost: 4500,
    freight_bearer: 'company',
    freight_amount: 350,
    total_cost: 4850,
    created_at: '2026-08-05 08:00',
    updated_at: '2026-08-10 10:00',
  },
];

export const seedAfterSalesReturns: AfterSalesReturn[] = [
  {
    id: 'asr-rt-1',
    return_no: 'RT-202608-0001',
    ticket_id: 'as-202608-0001',
    ticket_no: 'AS-202608-0001',
    customer_name: '青岛帝莱家居用品有限公司',
    product_code: 'SZ98875',
    product_name: 'SZ98875',
    type: 'return',
    quantity: 20,
    reason: '色差',
    return_address: '青岛市市南区南京路12号',
    logistics_company: '顺丰速运',
    tracking_no: 'SF2026080301',
    inbound_time: '2026-08-06 15:00',
    status: 'inbounded',
    created_at: '2026-08-04 10:00',
    updated_at: '2026-08-06 15:00',
  },
  {
    id: 'asr-rt-2',
    return_no: 'RT-202608-0002',
    ticket_id: 'as-202608-0001',
    ticket_no: 'AS-202608-0001',
    customer_name: '青岛帝莱家居用品有限公司',
    product_code: 'SZ98875',
    product_name: 'SZ98875',
    type: 'exchange',
    quantity: 20,
    reason: '换货',
    ship_address: '青岛市市南区南京路12号',
    logistics_company: '顺丰速运',
    tracking_no: 'SF2026080701',
    ship_time: '2026-08-07 10:00',
    status: 'shipped',
    created_at: '2026-08-06 16:00',
    updated_at: '2026-08-07 10:00',
  },
];

export const seedAfterSalesReshipments: AfterSalesReshipment[] = [
  {
    id: 'asr-rs-1',
    reship_no: 'RS-202608-0001',
    ticket_id: 'as-202608-0002',
    ticket_no: 'AS-202608-0002',
    customer_name: 'HAN OL DECO',
    product_code: 'SZ98816',
    product_name: 'SZ98816',
    type: 'reship',
    quantity: 50,
    reason: '物流破损补发',
    ship_address: 'Los Angeles, USA',
    logistics_company: 'COSCO Logistics',
    tracking_no: 'COS2026080801',
    ship_time: '2026-08-08 10:00',
    status: 'shipped',
    created_at: '2026-08-07 17:00',
    updated_at: '2026-08-08 10:00',
  },
];


// 10 条质检记录
export const seedQualityInspections: QualityInspection[] = [
];


export const seedProcessInspectionStandards: ProcessInspectionStandard[] = [
  {
    id: 'pis-seed-1',
    code: 'PIS-2026-0001',
    process_id: 'p-cut',
    process_name: '裁剪',
    process_code: 'cut',
    status: 'active',
    created_at: '2026-07-01 08:00',
    updated_at: '2026-07-01 08:00',
    items: [
      { name: '裁片尺寸', standard: 0, lower: -2, upper: 2, unit: 'mm', category: 'physical', actual: 0, result: 'pending' },
      { name: '裁片毛边', standard: 0, lower: 0, upper: 1, unit: 'mm', category: 'appearance', actual: 0, result: 'pending' },
    ],
  },
  {
    id: 'pis-seed-2',
    code: 'PIS-2026-0002',
    process_id: 'p-sew',
    process_name: '拼接',
    process_code: 'sew',
    status: 'active',
    created_at: '2026-07-01 08:00',
    updated_at: '2026-07-01 08:00',
    items: [
      { name: '线迹密度', standard: 10, lower: 9, upper: 11, unit: '针/3cm', category: 'physical', actual: 10, result: 'pending' },
      { name: '缝边宽度', standard: 10, lower: 8, upper: 12, unit: 'mm', category: 'physical', actual: 10, result: 'pending' },
    ],
  },
  {
    id: 'pis-seed-3',
    code: 'PIS-2026-0003',
    process_id: 'p-quilt',
    process_name: '绗缝',
    process_code: 'quilt',
    status: 'active',
    created_at: '2026-07-01 08:00',
    updated_at: '2026-07-01 08:00',
    items: [
      { name: '针距密度', standard: 7, lower: 6, upper: 8, unit: '针/3cm', category: 'physical', actual: 7, result: 'pending' },
      { name: '花型对称度', standard: 2, lower: 0, upper: 3, unit: 'mm', category: 'appearance', actual: 1, result: 'pending' },
      { name: '跳针/断线', standard: 0, lower: 0, upper: 0, unit: '处', category: 'appearance', actual: 0, result: 'pending' },
    ],
  },
];

export const seedProcessInspections: ProcessInspection[] = [];

export const seedOutsourcingDispatches: OutsourcingDispatch[] = [];
export const seedOutsourcingReturnQCs: OutsourcingReturnQC[] = [];

// 10 条生产异常
export const seedProductionExceptions: ProductionException[] = [
];


// 10 条库存流水
export const seedStockRecords: StockRecord[] = [
];


// 10 条付款记录
export const seedPaymentRecords: PaymentRecord[] = [
];


// 工序库初始数据：内部计件工序 + 外协工序
export const seedProcesses: ProcessItem[] = [
  // 内部工序（计件单价）
  { id: 'proc-seed-1', code: 'G-001', name: '开料', price: 0.5, standard_minutes: 12, category: 'internal', device: '裁剪机', skill: '裁剪', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'proc-seed-2', code: 'G-002', name: '剪边', price: 0.3, standard_minutes: 6, category: 'internal', device: '剪边机', skill: '裁剪', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'proc-seed-3', code: 'G-003', name: '包边', price: 0.6, standard_minutes: 18, category: 'internal', device: '包边机', skill: '缝制', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'proc-seed-4', code: 'G-004', name: '初检', price: 0.2, standard_minutes: 6, category: 'internal', device: '检验台', skill: '检验', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'proc-seed-5', code: 'G-005', name: '复检', price: 0.25, standard_minutes: 6, category: 'internal', device: '检验台', skill: '检验', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'proc-seed-6', code: 'G-006', name: '修补', price: 0.4, standard_minutes: 12, category: 'internal', device: '平缝机', skill: '缝制', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'proc-seed-7', code: 'G-007', name: '包装', price: 0.3, standard_minutes: 6, category: 'internal', device: '包装线', skill: '包装', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  // 外协工序（外协加工单价）
  { id: 'proc-seed-8', code: 'G-008', name: '电脑绣', price: 0, outsourcing_price: 2.0, standard_minutes: 48, category: 'outsourcing', device: '绣花机', skill: '绣花', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'proc-seed-9', code: 'G-009', name: '做背布', price: 0, outsourcing_price: 1.5, standard_minutes: 30, category: 'outsourcing', device: '背布机', skill: '缝制', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'proc-seed-10', code: 'G-010', name: '水洗', price: 0, outsourcing_price: 1.0, standard_minutes: 24, category: 'outsourcing', device: '水洗机', skill: '水洗', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
];

// 10 条工艺路线
export const seedProcessRoutes: ProcessRoute[] = [
  {
    id: 'pr-seed-1', code: 'ROU-2026-0101', name: '四件套标准工艺路线', category: '四件套', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00',
    steps: [
      { seq: 1, code: 'inspect', name: '面料检验', price: 0.2, hours: 0.1, device: '检验台', skill: '裁剪/拼接' },
      { seq: 2, code: 'cut', name: '裁剪', price: 0.5, hours: 0.2, device: '裁剪机', skill: '裁剪/拼接' },
      { seq: 3, code: 'sew', name: '缝制', price: 0.8, hours: 0.5, device: '平缝机', skill: '裁剪/拼接' },
      { seq: 4, code: 'iron', name: '整烫', price: 0.4, hours: 0.2, device: '整烫机', skill: '水洗/整烫' },
      { seq: 5, code: 'qc', name: '检验', price: 0.2, hours: 0.1, device: '检验台', skill: '检验/包装' },
      { seq: 6, code: 'pack', name: '包装', price: 0.3, hours: 0.1, device: '包装线', skill: '检验/包装' },
    ],
  },
  {
    id: 'pr-seed-2', code: 'ROU-2026-0102', name: '沙发垫标准工艺路线', category: '沙发垫', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00',
    steps: [
      { seq: 1, code: 'inspect', name: '面料检验', price: 0.2, hours: 0.1, device: '检验台', skill: '裁剪/拼接' },
      { seq: 2, code: 'cut', name: '裁剪', price: 0.5, hours: 0.2, device: '裁剪机', skill: '裁剪/拼接' },
      { seq: 3, code: 'quilt', name: '绗缝', price: 1.2, hours: 1.0, device: '绗缝机', skill: '绗缝', is_bottleneck: true },
      { seq: 4, code: 'edge', name: '包边', price: 0.4, hours: 0.2, device: '包边机', skill: '裁剪/拼接' },
      { seq: 5, code: 'qc', name: '检验', price: 0.2, hours: 0.1, device: '检验台', skill: '检验/包装' },
      { seq: 6, code: 'pack', name: '包装', price: 0.3, hours: 0.1, device: '包装线', skill: '检验/包装' },
    ],
  },
  {
    id: 'pr-seed-3', code: 'ROU-2026-0103', name: '童被套件工艺路线', category: '童被套件', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00',
    steps: [
      { seq: 1, code: 'inspect', name: '面料检验', price: 0.2, hours: 0.1, device: '检验台', skill: '裁剪/拼接' },
      { seq: 2, code: 'cut', name: '裁剪', price: 0.5, hours: 0.2, device: '裁剪机', skill: '裁剪/拼接' },
      { seq: 3, code: 'embroidery', name: '绣花', price: 1.0, hours: 0.8, device: '绣花机', skill: '绣花', optional: true },
      { seq: 4, code: 'sew', name: '拼接', price: 0.8, hours: 0.4, device: '平缝机', skill: '裁剪/拼接' },
      { seq: 5, code: 'quilt', name: '绗缝', price: 1.2, hours: 1.2, device: '绗缝机', skill: '绗缝', is_bottleneck: true },
      { seq: 6, code: 'edge', name: '包边', price: 0.4, hours: 0.2, device: '包边机', skill: '裁剪/拼接' },
      { seq: 7, code: 'wash', name: '水洗', price: 0.3, hours: 0.3, device: '水洗机', skill: '水洗/整烫' },
      { seq: 8, code: 'iron', name: '整烫', price: 0.4, hours: 0.2, device: '整烫机', skill: '水洗/整烫' },
      { seq: 9, code: 'qc', name: '检验', price: 0.2, hours: 0.1, device: '检验台', skill: '检验/包装' },
      { seq: 10, code: 'pack', name: '包装', price: 0.3, hours: 0.1, device: '包装线', skill: '检验/包装' },
    ],
  },
  {
    id: 'pr-seed-4', code: 'ROU-2026-0104', name: '夏凉被工艺路线', category: '夏凉被', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00',
    steps: [
      { seq: 1, code: 'inspect', name: '面料检验', price: 0.2, hours: 0.1, device: '检验台', skill: '裁剪/拼接' },
      { seq: 2, code: 'cut', name: '裁剪', price: 0.5, hours: 0.2, device: '裁剪机', skill: '裁剪/拼接' },
      { seq: 3, code: 'sew', name: '拼接', price: 0.8, hours: 0.4, device: '平缝机', skill: '裁剪/拼接' },
      { seq: 4, code: 'quilt', name: '绗缝', price: 1.0, hours: 0.8, device: '绗缝机', skill: '绗缝', is_bottleneck: true },
      { seq: 5, code: 'edge', name: '包边', price: 0.4, hours: 0.2, device: '包边机', skill: '裁剪/拼接' },
      { seq: 6, code: 'qc', name: '检验', price: 0.2, hours: 0.1, device: '检验台', skill: '检验/包装' },
      { seq: 7, code: 'pack', name: '包装', price: 0.3, hours: 0.1, device: '包装线', skill: '检验/包装' },
    ],
  },
  {
    id: 'pr-seed-5', code: 'ROU-2026-0105', name: '被芯标准工艺路线', category: '被芯', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00',
    steps: [
      { seq: 1, code: 'inspect', name: '面料检验', price: 0.2, hours: 0.1, device: '检验台', skill: '裁剪/拼接' },
      { seq: 2, code: 'cut', name: '裁剪', price: 0.5, hours: 0.2, device: '裁剪机', skill: '裁剪/拼接' },
      { seq: 3, code: 'filling', name: '充棉', price: 0.6, hours: 0.3, device: '充棉机', skill: '填充' },
      { seq: 4, code: 'quilt', name: '绗缝', price: 1.2, hours: 1.2, device: '绗缝机', skill: '绗缝', is_bottleneck: true },
      { seq: 5, code: 'edge', name: '包边', price: 0.4, hours: 0.2, device: '包边机', skill: '裁剪/拼接' },
      { seq: 6, code: 'qc', name: '检验', price: 0.2, hours: 0.1, device: '检验台', skill: '检验/包装' },
      { seq: 7, code: 'pack', name: '包装', price: 0.3, hours: 0.1, device: '包装线', skill: '检验/包装' },
    ],
  },
  {
    id: 'pr-seed-6', code: 'ROU-2026-0106', name: '枕头标准工艺路线', category: '枕头', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00',
    steps: [
      { seq: 1, code: 'inspect', name: '面料检验', price: 0.2, hours: 0.1, device: '检验台', skill: '裁剪/拼接' },
      { seq: 2, code: 'cut', name: '裁剪', price: 0.4, hours: 0.2, device: '裁剪机', skill: '裁剪/拼接' },
      { seq: 3, code: 'sew', name: '缝制', price: 0.6, hours: 0.3, device: '平缝机', skill: '裁剪/拼接' },
      { seq: 4, code: 'filling', name: '充棉', price: 0.5, hours: 0.3, device: '充棉机', skill: '填充' },
      { seq: 5, code: 'qc', name: '检验', price: 0.2, hours: 0.1, device: '检验台', skill: '检验/包装' },
      { seq: 6, code: 'pack', name: '包装', price: 0.3, hours: 0.1, device: '包装线', skill: '检验/包装' },
    ],
  },
  {
    id: 'pr-seed-7', code: 'ROU-2026-0107', name: '床笠标准工艺路线', category: '床笠', status: 'inactive', created_at: '2026-06-01 08:00', updated_at: '2026-06-15 08:00',
    steps: [
      { seq: 1, code: 'inspect', name: '面料检验', price: 0.2, hours: 0.1, device: '检验台', skill: '裁剪/拼接' },
      { seq: 2, code: 'cut', name: '裁剪', price: 0.5, hours: 0.2, device: '裁剪机', skill: '裁剪/拼接' },
      { seq: 3, code: 'sew', name: '缝制', price: 0.7, hours: 0.4, device: '平缝机', skill: '裁剪/拼接' },
      { seq: 4, code: 'elastic', name: '上松紧', price: 0.3, hours: 0.2, device: '上松紧机', skill: '裁剪/拼接' },
      { seq: 5, code: 'qc', name: '检验', price: 0.2, hours: 0.1, device: '检验台', skill: '检验/包装' },
      { seq: 6, code: 'pack', name: '包装', price: 0.3, hours: 0.1, device: '包装线', skill: '检验/包装' },
    ],
  },
  {
    id: 'pr-seed-8', code: 'ROU-2026-0108', name: '床裙工艺路线', category: '床裙', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00',
    steps: [
      { seq: 1, code: 'inspect', name: '面料检验', price: 0.2, hours: 0.1, device: '检验台', skill: '裁剪/拼接' },
      { seq: 2, code: 'cut', name: '裁剪', price: 0.5, hours: 0.3, device: '裁剪机', skill: '裁剪/拼接' },
      { seq: 3, code: 'sew', name: '缝制', price: 0.8, hours: 0.5, device: '平缝机', skill: '裁剪/拼接' },
      { seq: 4, code: 'ruffle', name: '打褶', price: 0.4, hours: 0.3, device: '打褶机', skill: '裁剪/拼接' },
      { seq: 5, code: 'qc', name: '检验', price: 0.2, hours: 0.1, device: '检验台', skill: '检验/包装' },
      { seq: 6, code: 'pack', name: '包装', price: 0.3, hours: 0.1, device: '包装线', skill: '检验/包装' },
    ],
  },
  {
    id: 'pr-seed-9', code: 'ROU-2026-0109', name: '抱枕工艺路线', category: '抱枕', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00',
    steps: [
      { seq: 1, code: 'inspect', name: '面料检验', price: 0.15, hours: 0.1, device: '检验台', skill: '裁剪/拼接' },
      { seq: 2, code: 'cut', name: '裁剪', price: 0.35, hours: 0.15, device: '裁剪机', skill: '裁剪/拼接' },
      { seq: 3, code: 'embroidery', name: '绣花', price: 0.8, hours: 0.5, device: '绣花机', skill: '绣花', optional: true },
      { seq: 4, code: 'sew', name: '缝制', price: 0.5, hours: 0.3, device: '平缝机', skill: '裁剪/拼接' },
      { seq: 5, code: 'filling', name: '充棉', price: 0.4, hours: 0.2, device: '充棉机', skill: '填充' },
      { seq: 6, code: 'qc', name: '检验', price: 0.15, hours: 0.1, device: '检验台', skill: '检验/包装' },
      { seq: 7, code: 'pack', name: '包装', price: 0.2, hours: 0.1, device: '包装线', skill: '检验/包装' },
    ],
  },
  {
    id: 'pr-seed-10', code: 'ROU-2026-0110', name: '窗帘工艺路线', category: '窗帘', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00',
    steps: [
      { seq: 1, code: 'inspect', name: '面料检验', price: 0.25, hours: 0.1, device: '检验台', skill: '裁剪/拼接' },
      { seq: 2, code: 'cut', name: '裁剪', price: 0.6, hours: 0.3, device: '裁剪机', skill: '裁剪/拼接' },
      { seq: 3, code: 'sew', name: '缝制', price: 0.9, hours: 0.5, device: '平缝机', skill: '裁剪/拼接' },
      { seq: 4, code: 'hem', name: '卷边', price: 0.3, hours: 0.2, device: '卷边机', skill: '裁剪/拼接' },
      { seq: 5, code: 'qc', name: '检验', price: 0.2, hours: 0.1, device: '检验台', skill: '检验/包装' },
      { seq: 6, code: 'pack', name: '包装', price: 0.3, hours: 0.1, device: '包装线', skill: '检验/包装' },
    ],
  },
];

// 10 条工艺参数模板
export const seedProcessParamTemplates: ProcessParamTemplate[] = [
  { id: 'ppt-seed-1', code: 'PT-2026-0101', name: '裁剪工序参数模板', process_name: '裁剪', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00', params: [{ name: '裁刀转速', standard: 2800, lower: 2600, upper: 3000, unit: 'rpm' }, { name: '铺布层数', standard: 25, lower: 20, upper: 30, unit: '层' }] },
  { id: 'ppt-seed-2', code: 'PT-2026-0102', name: '缝制工序参数模板', process_name: '缝制', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00', params: [{ name: '针距', standard: 3, lower: 2.5, upper: 3.5, unit: 'mm' }, { name: '线张力', standard: 250, lower: 200, upper: 300, unit: 'g' }] },
  { id: 'ppt-seed-3', code: 'PT-2026-0103', name: '包边工序参数模板', process_name: '包边', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00', params: [{ name: '包边宽度', standard: 1.5, lower: 1.3, upper: 1.7, unit: 'cm' }, { name: '缝速', standard: 3000, lower: 2800, upper: 3200, unit: 'rpm' }] },
  { id: 'ppt-seed-4', code: 'PT-2026-0104', name: '绣花工序参数模板', process_name: '绣花', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00', params: [{ name: '转速', standard: 800, lower: 700, upper: 900, unit: 'rpm' }, { name: '针号', standard: 9, lower: 9, upper: 11, unit: '号' }] },
  { id: 'ppt-seed-5', code: 'PT-2026-0105', name: '充棉工序参数模板', process_name: '充棉', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00', params: [{ name: '充棉量', standard: 450, lower: 400, upper: 500, unit: 'g' }, { name: '气压', standard: 0.5, lower: 0.4, upper: 0.6, unit: 'MPa' }] },
  { id: 'ppt-seed-6', code: 'PT-2026-0106', name: '上松紧工序参数模板', process_name: '上松紧', status: 'inactive', created_at: '2026-06-01 08:00', updated_at: '2026-06-15 08:00', params: [{ name: '松紧拉伸比', standard: 1.8, lower: 1.6, upper: 2.0, unit: '倍' }, { name: '针距', standard: 3, lower: 2.5, upper: 3.5, unit: 'mm' }] },
  { id: 'ppt-seed-7', code: 'PT-2026-0107', name: '打褶工序参数模板', process_name: '打褶', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00', params: [{ name: '褶距', standard: 5, lower: 4, upper: 6, unit: 'cm' }, { name: '褶深', standard: 3, lower: 2.5, upper: 3.5, unit: 'cm' }] },
  { id: 'ppt-seed-8', code: 'PT-2026-0108', name: '卷边工序参数模板', process_name: '卷边', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00', params: [{ name: '卷边宽度', standard: 2, lower: 1.8, upper: 2.2, unit: 'cm' }, { name: '缝速', standard: 2500, lower: 2300, upper: 2700, unit: 'rpm' }] },
  { id: 'ppt-seed-9', code: 'PT-2026-0109', name: '面料检验参数模板', process_name: '面料检验', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00', params: [{ name: '照度', standard: 800, lower: 700, upper: 900, unit: 'lux' }, { name: '检验速度', standard: 15, lower: 10, upper: 20, unit: 'm/min' }] },
  { id: 'ppt-seed-10', code: 'PT-2026-0110', name: '包装工序参数模板', process_name: '包装', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00', params: [{ name: '真空度', standard: 0.08, lower: 0.07, upper: 0.09, unit: 'MPa' }, { name: '包装袋厚度', standard: 0.08, lower: 0.07, upper: 0.1, unit: 'mm' }] },
];

// 10 条工艺版本
export const seedProcessVersions: ProcessVersion[] = [
  { id: 'pv-seed-1', code: 'VER-2026-0101', product_id: 'p1', product_code: 'JF-2026-001', product_name: '北欧风绗缝被', route_id: 'pr1', route_name: '绗缝被标准工艺路线', effective_date: '2026-07-01', expiry_date: '2026-12-31', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'pv-seed-2', code: 'VER-2026-0102', product_id: 'p2', product_code: 'JF-2026-002', product_name: '亲肤四件套', route_id: 'pr-seed-1', route_name: '四件套标准工艺路线', effective_date: '2026-07-01', expiry_date: '2026-12-31', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'pv-seed-3', code: 'VER-2026-0103', product_id: 'p3', product_code: 'JF-2026-003', product_name: '云朵沙发垫', route_id: 'pr-seed-2', route_name: '沙发垫标准工艺路线', effective_date: '2026-07-01', expiry_date: '2026-12-31', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'pv-seed-4', code: 'VER-2026-0104', product_id: 'p4', product_code: 'JF-2026-004', product_name: '儿童绗缝童被', route_id: 'pr-seed-3', route_name: '童被套件工艺路线', effective_date: '2026-07-01', expiry_date: '2026-12-31', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'pv-seed-5', code: 'VER-2026-0105', product_id: 'p-seed-1', product_code: 'JF-2026-005', product_name: '全棉水洗绗缝夏被', route_id: 'pr-seed-4', route_name: '夏凉被工艺路线', effective_date: '2026-07-01', expiry_date: '2026-12-31', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'pv-seed-6', code: 'VER-2026-0106', product_id: 'p-seed-2', product_code: 'JF-2026-006', product_name: '羽绒复合被芯', route_id: 'pr-seed-5', route_name: '被芯标准工艺路线', effective_date: '2026-07-01', expiry_date: '2026-12-31', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'pv-seed-7', code: 'VER-2026-0107', product_id: 'p-seed-3', product_code: 'JF-2026-007', product_name: '乳胶枕', route_id: 'pr-seed-6', route_name: '枕头标准工艺路线', effective_date: '2026-07-01', expiry_date: '2026-12-31', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'pv-seed-8', code: 'VER-2026-0108', product_id: 'p-seed-4', product_code: 'JF-2026-008', product_name: '全棉床笠', route_id: 'pr-seed-7', route_name: '床笠标准工艺路线', effective_date: '2026-07-01', expiry_date: '2026-12-31', status: 'inactive', created_at: '2026-06-01 08:00', updated_at: '2026-06-15 08:00' },
  { id: 'pv-seed-9', code: 'VER-2026-0109', product_id: 'p-seed-5', product_code: 'JF-2026-009', product_name: '宫廷风床裙', route_id: 'pr-seed-8', route_name: '床裙工艺路线', effective_date: '2026-07-01', expiry_date: '2026-12-31', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
  { id: 'pv-seed-10', code: 'VER-2026-0110', product_id: 'p-seed-6', product_code: 'JF-2026-010', product_name: '绣花抱枕', route_id: 'pr-seed-9', route_name: '抱枕工艺路线', effective_date: '2026-07-01', expiry_date: '2026-12-31', status: 'active', created_at: '2026-06-01 08:00', updated_at: '2026-06-01 08:00' },
];

// 10 条工艺知识
export const seedProcessKnowledge: ProcessKnowledge[] = [
  { id: 'pk-seed-1', code: 'KN-2026-0101', title: '绗缝跳针处理', process_name: '绗缝', device: '绗缝机', tags: ['绗缝', '品质'], problem: '绗缝过程中跳针频繁', solution: '检查机针磨损、调整压脚压力至2.5bar、降低绗缝速度10%', effect: '跳针率下降80%', creator: '张工艺', created_at: '2026-06-10 09:00', updated_at: '2026-06-10 09:00' },
  { id: 'pk-seed-2', code: 'KN-2026-0102', title: '水洗尺寸收缩控制', process_name: '水洗', device: '水洗机', tags: ['水洗', '缩水率'], problem: '水洗后产品尺寸收缩率超标', solution: '温度控制在45±5℃，加入预缩剂，缩短单次水洗时间', effect: '缩水率稳定在2%以内', creator: '李工艺', created_at: '2026-06-12 10:00', updated_at: '2026-06-12 10:00' },
  { id: 'pk-seed-3', code: 'KN-2026-0103', title: '裁剪铺布平整度提升', process_name: '裁剪', device: '裁剪机', tags: ['裁剪', '效率'], problem: '铺布不平导致裁片尺寸偏差', solution: '调整铺布张力、增加压布辊、控制铺布层数在25层以内', effect: '裁片合格率提升5%', creator: '王工艺', created_at: '2026-06-15 14:00', updated_at: '2026-06-15 14:00' },
  { id: 'pk-seed-4', code: 'KN-2026-0104', title: '整烫压痕消除', process_name: '整烫', device: '整烫机', tags: ['整烫', '外观'], problem: '整烫后留下压痕影响外观', solution: '降低蒸汽压力、增加垫布、控制整烫时间', effect: '压痕不良率下降90%', creator: '赵工艺', created_at: '2026-06-18 11:00', updated_at: '2026-06-18 11:00' },
  { id: 'pk-seed-5', code: 'KN-2026-0105', title: '包边宽度不一致处理', process_name: '包边', device: '包边机', tags: ['包边', '品质'], problem: '包边宽度波动大', solution: '校准送布牙、更换包边压脚、调整包边条张力', effect: '包边宽度CPK提升至1.33', creator: '孙工艺', created_at: '2026-06-20 09:30', updated_at: '2026-06-20 09:30' },
  { id: 'pk-seed-6', code: 'KN-2026-0106', title: '绣花断线处理', process_name: '绣花', device: '绣花机', tags: ['绣花', '效率'], problem: '绣花过程中频繁断线', solution: '检查上线张力、更换绣花针、调整旋梭间隙', effect: '断线率下降70%', creator: '陈工艺', created_at: '2026-06-22 10:00', updated_at: '2026-06-22 10:00' },
  { id: 'pk-seed-7', code: 'KN-2026-0107', title: '充棉量不均匀解决', process_name: '充棉', device: '充棉机', tags: ['充棉', '克重'], problem: '被芯充棉量不均匀', solution: '校准称重传感器、调整充棉气压、增加拍打工序', effect: '克重合格率提升8%', creator: '周工艺', created_at: '2026-06-25 15:00', updated_at: '2026-06-25 15:00' },
  { id: 'pk-seed-8', code: 'KN-2026-0108', title: '面料检验漏检控制', process_name: '面料检验', device: '检验台', tags: ['检验', '品质'], problem: '面料瑕疵漏检率高', solution: '增加检验照度至800lux、双人复核、按AQL 2.5抽样', effect: '漏检率下降60%', creator: '吴工艺', created_at: '2026-06-28 11:00', updated_at: '2026-06-28 11:00' },
  { id: 'pk-seed-9', code: 'KN-2026-0109', title: '缝制线迹起皱处理', process_name: '缝制', device: '平缝机', tags: ['缝制', '外观'], problem: '缝制线迹起皱', solution: '调整面线张力、更换细号机针、降低缝速', effect: '线迹起皱不良率下降85%', creator: '郑工艺', created_at: '2026-06-30 14:00', updated_at: '2026-06-30 14:00' },
  { id: 'pk-seed-10', code: 'KN-2026-0110', title: '包装真空度不足处理', process_name: '包装', device: '包装线', tags: ['包装', '仓储'], problem: '真空包装漏气', solution: '检查封口温度、更换密封条、抽真空至0.08MPa', effect: '包装漏气率下降95%', creator: '钱工艺', created_at: '2026-07-02 09:00', updated_at: '2026-07-02 09:00' },
];

export const seedQualityStandards: QualityStandard[] = [
  {
    id: 'qs-seed-1',
    code: 'QS-2026-0101',
    name: '绗缝被成品检验标准',
    category: '绗缝被',
    status: 'active',
    items: [
      { name: '外观疵点', standard: 0, lower: 0, upper: 2, unit: '处', category: 'appearance' },
      { name: '色差等级', standard: 4, lower: 3, upper: 5, unit: '级', category: 'appearance' },
      { name: '尺寸偏差', standard: 0, lower: -2, upper: 2, unit: 'cm', category: 'physical' },
      { name: '填充物克重', standard: 300, lower: 280, upper: 320, unit: 'g/㎡', category: 'physical' },
      { name: '水洗尺寸变化率', standard: -3, lower: -5, upper: 0, unit: '%', category: 'physical' },
    ],
  },
  {
    id: 'qs-seed-2',
    code: 'QS-2026-0102',
    name: '四件套成品检验标准',
    category: '四件套',
    status: 'active',
    items: [
      { name: '外观疵点', standard: 0, lower: 0, upper: 2, unit: '处', category: 'appearance' },
      { name: '色差等级', standard: 4, lower: 3, upper: 5, unit: '级', category: 'appearance' },
      { name: '尺寸偏差', standard: 0, lower: -1.5, upper: 1.5, unit: 'cm', category: 'physical' },
      { name: '面料克重', standard: 120, lower: 110, upper: 130, unit: 'g/㎡', category: 'physical' },
      { name: 'pH值', standard: 6.5, lower: 4, upper: 9, unit: '', category: 'chemical' },
    ],
  },
  {
    id: 'qs-seed-3',
    code: 'QS-2026-0103',
    name: '沙发垫成品检验标准',
    category: '沙发垫',
    status: 'active',
    items: [
      { name: '外观疵点', standard: 0, lower: 0, upper: 1, unit: '处', category: 'appearance' },
      { name: '尺寸偏差', standard: 0, lower: -1, upper: 1, unit: 'cm', category: 'physical' },
      { name: '防滑性能', standard: 3, lower: 2, upper: 5, unit: '级', category: 'physical' },
    ],
  },
  {
    id: 'qs-seed-4',
    code: 'QS-2026-0104',
    name: '童被成品检验标准',
    category: '童被',
    status: 'active',
    items: [
      { name: '外观疵点', standard: 0, lower: 0, upper: 1, unit: '处', category: 'appearance' },
      { name: '甲醛含量', standard: 0, lower: 0, upper: 20, unit: 'mg/kg', category: 'chemical' },
      { name: 'pH值', standard: 6.5, lower: 4, upper: 7.5, unit: '', category: 'chemical' },
      { name: '尺寸偏差', standard: 0, lower: -1, upper: 1, unit: 'cm', category: 'physical' },
    ],
  },
];

export function getSeedData() {
  return {
    customers: seedCustomers,
    salesOrders: seedSalesOrders,
    shipments: seedShipments,
    followUps: seedFollowUps,
    materials: seedMaterials,
    inventory: seedInventory,
    suppliers: seedSuppliers,
    purchaseRequests: seedPurchaseRequests,
    purchaseOrders: seedPurchaseOrders,
    purchaseArrivals: seedPurchaseArrivals,
    workOrders: seedWorkOrders,
    materialRequisitions: seedMaterialRequisitions,
    equipment: seedEquipment,
    maintenancePlans: seedMaintenancePlans,
    equipmentRecords: seedEquipmentRecords,
    safetyRecords: seedSafetyRecords,
    employees: seedEmployees,
    financeRecords: seedFinanceRecords,
    afterSalesTickets: seedAfterSalesTickets,
    afterSalesReturns: seedAfterSalesReturns,
    afterSalesReshipments: seedAfterSalesReshipments,
    qualityInspections: seedQualityInspections,
    qualityStandards: seedQualityStandards,
    processInspections: seedProcessInspections,
    processInspectionStandards: seedProcessInspectionStandards,
    productionExceptions: seedProductionExceptions,
    stockRecords: seedStockRecords,
    paymentRecords: seedPaymentRecords,
    processes: seedProcesses,
    processRoutes: seedProcessRoutes,
    processParamTemplates: seedProcessParamTemplates,
    processVersions: seedProcessVersions,
    processKnowledge: seedProcessKnowledge,
    outsourcingDispatches: seedOutsourcingDispatches,
    outsourcingReturnQCs: seedOutsourcingReturnQCs,
    contracts: seedContracts,
    operationLogs: seedOperationLogs,
    loginLogs: seedLoginLogs,
  };
}

export const seedOperationLogs: OperationLog[] = [
  {
    id: 'op-seed-1',
    time: '2026-08-27 09:12:00',
    operator: 'admin',
    operator_name: '系统管理员',
    role: '管理员',
    action: 'create',
    action_label: '创建',
    module: '生产管理',
    target: 'WO-2026-0827-001',
    target_type: 'work_order',
    target_id: 'wo-seed-1',
    result: 'success',
    result_message: '创建工单成功',
    ip: '192.168.1.10',
    device: 'Chrome / Windows',
    detail: '新增生产工单：WO-2026-0827-001',
    created_at: '2026-08-27T09:12:00',
  },
  {
    id: 'op-seed-2',
    time: '2026-08-27 10:45:22',
    operator: 'wangsc',
    operator_name: '王生产',
    role: '生产主管',
    action: 'update',
    action_label: '更新',
    module: '计划排程',
    target: 'A线',
    target_type: 'production_line',
    result: 'success',
    result_message: '产线配置已更新',
    ip: '192.168.1.23',
    device: 'Chrome / macOS',
    detail: '为A线配置设备：缝纫机A、缝纫机B',
    created_at: '2026-08-27T10:45:22',
  },
  {
    id: 'op-seed-3',
    time: '2026-08-27 11:30:05',
    operator: 'liqj',
    operator_name: '李质检',
    role: '质检员',
    action: 'approve',
    action_label: '审批通过',
    module: '质量管理',
    target: 'QI-2026-0827-001',
    target_type: 'quality_inspection',
    result: 'success',
    result_message: '来料检验合格',
    ip: '192.168.1.45',
    device: 'Safari / iOS',
    detail: '来料检验审批通过',
    created_at: '2026-08-27T11:30:05',
  },
  {
    id: 'op-seed-4',
    time: '2026-08-26 16:20:18',
    operator: 'admin',
    operator_name: '系统管理员',
    role: '管理员',
    action: 'delete',
    action_label: '删除',
    module: '系统管理',
    target: '临时测试数据',
    target_type: 'data',
    result: 'success',
    result_message: '删除成功',
    ip: '192.168.1.10',
    device: 'Chrome / Windows',
    detail: '清理临时测试数据',
    created_at: '2026-08-26T16:20:18',
  },
  {
    id: 'op-seed-5',
    time: '2026-08-26 14:10:33',
    operator: 'sales1',
    operator_name: '张销售',
    role: '销售',
    action: 'export',
    action_label: '导出',
    module: '营销管理',
    target: '销售订单报表',
    target_type: 'report',
    result: 'success',
    result_message: '导出成功',
    ip: '192.168.1.12',
    device: 'Edge / Windows',
    detail: '导出2026年8月销售订单Excel',
    created_at: '2026-08-26T14:10:33',
  },
];

export const seedLoginLogs: LoginLog[] = [
  {
    id: 'login-seed-1',
    time: '2026-08-27 08:55:01',
    account: 'admin',
    user_name: '系统管理员',
    status: 'success',
    ip: '192.168.1.10',
    device: 'Chrome / Windows',
    reason: '正常登录',
    is_abnormal: false,
    created_at: '2026-08-27T08:55:01',
  },
  {
    id: 'login-seed-2',
    time: '2026-08-27 08:58:44',
    account: 'wangsc',
    user_name: '王生产',
    status: 'success',
    ip: '192.168.1.23',
    device: 'Chrome / macOS',
    reason: '正常登录',
    is_abnormal: false,
    created_at: '2026-08-27T08:58:44',
  },
  {
    id: 'login-seed-3',
    time: '2026-08-27 03:05:12',
    account: 'liqj',
    user_name: '李质检',
    status: 'failed',
    ip: '192.168.1.99',
    device: 'Firefox / Windows',
    reason: '账号或密码错误',
    is_abnormal: true,
    abnormal_reason: '登录失败；非工作时间登录',
    created_at: '2026-08-27T03:05:12',
  },
  {
    id: 'login-seed-4',
    time: '2026-08-27 03:06:33',
    account: 'liqj',
    user_name: '李质检',
    status: 'failed',
    ip: '192.168.1.99',
    device: 'Firefox / Windows',
    reason: '账号或密码错误',
    is_abnormal: true,
    abnormal_reason: '登录失败；非工作时间登录',
    created_at: '2026-08-27T03:06:33',
  },
  {
    id: 'login-seed-5',
    time: '2026-08-27 03:07:55',
    account: 'liqj',
    user_name: '李质检',
    status: 'failed',
    ip: '192.168.1.99',
    device: 'Firefox / Windows',
    reason: '账号或密码错误',
    is_abnormal: true,
    abnormal_reason: '登录失败；非工作时间登录',
    created_at: '2026-08-27T03:07:55',
  },
];

// 浦江家纺智造管理平台 - 常量与选项数据

export const PRODUCT_CATEGORIES = [
  '绗缝被',
  '被子',
  '四件套',
  '童被套件',
  '沙发垫',
  '抱垫',
  '靠垫',
  '宠物用品',
  '毛毯',
  '窗帘',
  '桌布',
];

export const FABRIC_TYPES = ['棉', '涤纶', '混纺', '绒布', '雪尼尔'];
export const FILLING_TYPES = ['喷胶棉', '羽绒', '海绵', '聚酯纤维'];
export const QUILT_PROCESSES = ['电脑绗缝', '多针绗缝', '手工绗缝'];
export const ORDER_TYPES = ['外贸', '电商', 'B2B'];
export const CURRENCIES = ['CNY', 'USD', 'EUR'];
export const TRADE_TERMS = ['FOB', 'CIF', 'EXW'];
export const CUSTOMER_TYPES = ['贸易商', '品牌商', '电商平台'];
export const CREDIT_LEVELS = ['A', 'B', 'C'];
export const MATERIAL_CATEGORIES = ['面料', '里料', '填充物', '辅料'];
export const EQUIPMENT_CATEGORIES = ['裁剪设备', '绗缝设备', '水洗设备', '整烫设备', '检验设备', '绣花设备', '包装设备'];
export const SKILL_TAGS = ['裁剪', '拼接', '绣花', '绗缝', '水洗', '整烫', '检验', '包装'];
export const WORKSHOPS = ['裁剪车间', '绗缝车间', '绣花车间', '水洗车间', '整烫车间', '检验车间', '包装车间'];

export const ORDER_STATUS = [
  { value: 'pending', label: '待确认', color: 'bg-yellow-500' },
  { value: 'confirmed', label: '已确认', color: 'bg-blue-500' },
  { value: 'approval', label: '待审批', color: 'bg-amber-500' },
  { value: 'approved', label: '已审批', color: 'bg-indigo-500' },
  { value: 'planned', label: '待排产', color: 'bg-purple-500' },
  { value: 'producing', label: '生产中', color: 'bg-orange-500' },
  { value: 'inspecting', label: '待检验', color: 'bg-pink-500' },
  { value: 'shipping', label: '待发货', color: 'bg-cyan-500' },
  { value: 'partial_shipped', label: '部分发货', color: 'bg-amber-500' },
  { value: 'shipped', label: '已发货', color: 'bg-teal-500' },
  { value: 'invoicing', label: '待开票', color: 'bg-sky-500' },
  { value: 'payment', label: '待回款', color: 'bg-violet-500' },
  { value: 'completed', label: '已完成', color: 'bg-green-500' },
];

export const QUOTATION_STATUS = [
  { value: 'draft', label: '草稿', color: 'bg-gray-500' },
  { value: 'pending', label: '待审批', color: 'bg-amber-500' },
  { value: 'approved', label: '已审批', color: 'bg-green-500' },
  { value: 'rejected', label: '需调整', color: 'bg-red-500' },
  { value: 'converted', label: '已转合同', color: 'bg-blue-500' },
  { value: 'expired', label: '已失效', color: 'bg-slate-500' },
];

export const CONTRACT_STATUS = [
  { value: 'draft', label: '草稿', color: 'bg-gray-500' },
  { value: 'pending', label: '审批中', color: 'bg-amber-500' },
  { value: 'effective', label: '生效中', color: 'bg-blue-500' },
  { value: 'executing', label: '执行中', color: 'bg-teal-500' },
  { value: 'completed', label: '已完结', color: 'bg-green-500' },
  { value: 'terminated', label: '已终止', color: 'bg-red-500' },
];

export const CONTRACT_TYPES = [
  { value: 'domestic', label: '内销' },
  { value: 'export', label: '外贸' },
  { value: 'processing', label: '加工' },
];

export const CONTRACT_CUSTOMER_LEVELS = [
  { value: 'normal', label: '普通' },
  { value: 'vip', label: 'VIP' },
  { value: 'strategic', label: '战略' },
];

export const PAYMENT_TERMS = [
  '款到发货',
  '货到付款',
  '30%预付款，70%出货前付清',
  '月结30天',
  '月结60天',
  '信用证',
];

export const SIGN_METHODS = [
  { value: 'paper', label: '纸质盖章' },
  { value: 'esign', label: '电子签章' },
  { value: 'email', label: '邮件确认' },
];

export const PERFORMANCE_NODE_TYPES = [
  { value: 'production', label: '生产状态', statuses: ['未开始', '排产中', '生产中', '已完工'] },
  { value: 'quality', label: '质检状态', statuses: ['未检验', '检验中', '已合格', '不合格'] },
  { value: 'shipment', label: '发货状态', statuses: ['待发货', '部分发货', '已发货'] },
  { value: 'invoice', label: '开票状态', statuses: ['未开票', '部分开票', '已开票'] },
  { value: 'payment', label: '回款状态', statuses: ['未回款', '部分回款', '已结清'] },
];

export const REMINDER_TYPES = [
  { value: 'delivery_due', label: '交货期提醒' },
  { value: 'delivery_overdue', label: '交货逾期预警' },
  { value: 'payment_due', label: '付款到期提醒' },
  { value: 'payment_overdue', label: '付款逾期预警' },
  { value: 'contract_expiry', label: '合同到期提醒' },
];

export const WORK_ORDER_STATUS = [
  { value: 'pending', label: '待排产', color: 'bg-yellow-500' },
  { value: 'issued', label: '已下发', color: 'bg-blue-500' },
  { value: 'producing', label: '生产中', color: 'bg-orange-500' },
  { value: 'inspecting', label: '待质检', color: 'bg-pink-500' },
  { value: 'completed', label: '已完成', color: 'bg-green-500' },
  { value: 'closed', label: '已结案', color: 'bg-green-500' },
];

export const INSPECTION_TYPES = [
  { value: 'incoming', label: '来料检验' },
  { value: 'process', label: '过程巡检' },
  { value: 'finished', label: '成品检验' },
];

export const SAFETY_RECORD_TYPES = [
  { value: 'hazard', label: '隐患排查' },
  { value: 'accident', label: '事故上报' },
  { value: 'training', label: '安全培训' },
  { value: 'fire', label: '消防检查' },
];

export function formatMoney(value: number | undefined | null, currency = 'CNY') {
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '¥';
  const num = value ?? 0;
  return `${symbol}${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getStatusLabel(status: string, list: { value: string; label: string; color?: string }[]) {
  return list.find((s) => s.value === status)?.label || status;
}

export function getStatusColor(status: string, list: { value: string; color?: string }[]) {
  return list.find((s) => s.value === status)?.color || 'bg-gray-500';
}

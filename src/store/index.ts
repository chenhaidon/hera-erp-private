import { create } from 'zustand';
import { getDefaultEmployeePermissions } from '@/lib/permissions';
import type { ResourceRules, AppRole } from '@/lib/permissions';
import type { ModuleVisibilityConfig } from '@/lib/moduleVisibility';
import { getDefaultModuleVisibility } from '@/lib/moduleVisibility';
import { createDbSlice, updateEntity } from './dbActions';
import { ENTITY_CONFIG_ARRAY } from './entityMap';
import { LOG_EXCLUDED_TYPES, buildEntityLogInfo } from './entityLog';
import { getOperator } from '@/lib/operator';
import { checkWritePermission } from '@/lib/rbac';
import type { RbacRoleConfig } from '@/lib/rbac';
import type {
  Product,
  ProductCategory,
  FabricType,
  FillingType,
  Customer,
  SalesOrder,
  Shipment,
  SalesOutbound,
  FollowUp,
  PriceList,
  CustomerDiscount,
  ExchangeRate,
  ProductionPlan,
  WorkOrder,
  ProcessItem,
  ProcessRoute,
  ProcessParamTemplate,
  ProcessVersion,
  ProcessKnowledge,
  WorkOrderCost,
  ProductionException,
  QualityStandard,
  QualityInspection,
  MaterialInspection,
  ProcessInspection,
  ProcessInspectionStandard,
  FinishedInspection,
  Equipment,
  MaintenancePlan,
  EquipmentRecord,
  SafetyRecord,
  Material,
  Inventory,
  WarehouseLocation,
  StockRecord,
  FinishedGoodsInbound,
  Supplier,
  PurchaseRequest,
  PurchaseOrder,
  PurchaseArrival,
  PurchaseReturn,
  MaterialRequisition,
  PaymentRecord,
  FinanceRecord,
  Employee,
  SystemUser,
  AttendanceRecord,
  LeaveRecord,
  PerformanceRecord,
  PerformanceGradeConfig,
  TrainingRecord,
  EvaluationItem,
  InventoryTurnover,
  SafetyPatrolPlan,
  SafetyPatrolTask,
  AlertNotification,
  AfterSalesTicket,
  AfterSalesReturn,
  AfterSalesReshipment,
  MaterialSupplierPrice,
  Quotation,
  Contract,
  ContractTemplate,
  OutsourcingDispatch,
  OutsourcingReturnQC,
  EcommercePurchaseTracking,
  OutsourceFactory,
  OutsourceShipment,
  OutsourceReturn,
  OutsourceProcessingPayment,
  SalaryRecord,
  PayrollDetail,
  ProductionLine,
  ProductionLineEquipment,
  OperationLog,
  LoginLog,
} from '@/types';

export interface AppState {
  products: Product[];
  productCategories: ProductCategory[];
  fabricTypes: FabricType[];
  fillingTypes: FillingType[];
  customers: Customer[];
  salesOrders: SalesOrder[];
  quotations: Quotation[];
  contracts: Contract[];
  shipments: Shipment[];
  salesOutbounds: SalesOutbound[];
  followUps: FollowUp[];
  priceLists: PriceList[];
  customerDiscounts: CustomerDiscount[];
  exchangeRates: ExchangeRate[];
  productionPlans: ProductionPlan[];
  workOrders: WorkOrder[];
  workOrderCosts: WorkOrderCost[];
  productionLines: ProductionLine[];
  productionLineEquipments: ProductionLineEquipment[];
  productionExceptions: ProductionException[];
  processes: ProcessItem[];
  processRoutes: ProcessRoute[];
  processParamTemplates: ProcessParamTemplate[];
  processVersions: ProcessVersion[];
  processKnowledge: ProcessKnowledge[];
  qualityStandards: QualityStandard[];
  processInspectionStandards: ProcessInspectionStandard[];
  qualityInspections: QualityInspection[];
  materialInspections: MaterialInspection[];
  processInspections: ProcessInspection[];
  finishedInspections: FinishedInspection[];
  equipment: Equipment[];
  addEquipment: (item: Equipment) => Promise<void> | void;
  updateEquipment: (item: Equipment) => Promise<void> | void;
  deleteEquipment: (id: string) => Promise<void> | void;
  maintenancePlans: MaintenancePlan[];
  deleteMaintenancePlan: (id: string) => Promise<void> | void;
  equipmentRecords: EquipmentRecord[];
  updateEquipmentRecord: (item: EquipmentRecord) => Promise<void> | void;
  deleteEquipmentRecord: (id: string) => Promise<void> | void;
  safetyRecords: SafetyRecord[];
  materials: Material[];
  inventory: Inventory[];
  warehouseLocations: WarehouseLocation[];
  stockRecords: StockRecord[];
  finishedGoodsInbounds: FinishedGoodsInbound[];
  suppliers: Supplier[];
  purchaseRequests: PurchaseRequest[];
  purchaseOrders: PurchaseOrder[];
  purchaseArrivals: PurchaseArrival[];
  purchaseReturns: PurchaseReturn[];
  materialRequisitions: MaterialRequisition[];
  paymentRecords: PaymentRecord[];
  financeRecords: FinanceRecord[];
  employees: Employee[];
  systemUsers: SystemUser[];
  attendanceRecords: AttendanceRecord[];
  leaveRecords: LeaveRecord[];
  performanceRecords: PerformanceRecord[];
  performanceGradeConfig: PerformanceGradeConfig[];
  trainingRecords: TrainingRecord[];
  evaluationItems: EvaluationItem[];

  inventoryTurnovers: InventoryTurnover[];

  safetyPatrolPlans: SafetyPatrolPlan[];
  safetyPatrolTasks: SafetyPatrolTask[];

  alertNotifications: AlertNotification[];

  afterSalesTickets: AfterSalesTicket[];
  afterSalesReturns: AfterSalesReturn[];
  afterSalesReshipments: AfterSalesReshipment[];
  materialSupplierPrices: MaterialSupplierPrice[];
  contractTemplates: ContractTemplate[];

  outsourcingDispatches: OutsourcingDispatch[];
  outsourcingReturnQCs: OutsourcingReturnQC[];

  outsourceFactories: OutsourceFactory[];
  outsourceShipments: OutsourceShipment[];
  outsourceReturns: OutsourceReturn[];
  outsourceProcessingPayments: OutsourceProcessingPayment[];

  currentRole: AppRole;
  theme: 'warm' | 'navy' | 'forest' | 'rose';
  setTheme: (theme: AppState['theme']) => void;

  fieldPermissions: Record<string, ResourceRules>;

  rolePermissions: Record<string, { modules: string[]; menus: string[]; actions: string[] }>;
  setRolePermissions: (role: string, permissions: { modules: string[]; menus: string[]; actions: string[] }) => void;

  // RBAC 角色权限（sys_roles + sys_role_menu_buttons）
  rbacPermissions: Record<string, RbacRoleConfig>;
  rbacEntityMenuMap: Record<string, string>;
  setRbacPermissions: (perms: Record<string, RbacRoleConfig>) => void;
  setRbacEntityMenuMap: (map: Record<string, string>) => void;

  // actions
  setProducts: (data: Product[]) => void;
  addProduct: (item: Product) => void;
  updateProduct: (item: Product) => void;
  removeProduct: (id: string) => void;
  setProductCategories: (data: ProductCategory[]) => void;
  addProductCategory: (item: ProductCategory) => void;
  updateProductCategory: (item: ProductCategory) => void;
  removeProductCategory: (id: string) => void;
  setFabricTypes: (data: FabricType[]) => void;
  addFabricType: (item: FabricType) => void;
  updateFabricType: (item: FabricType) => void;
  removeFabricType: (id: string) => void;
  setFillingTypes: (data: FillingType[]) => void;
  addFillingType: (item: FillingType) => void;
  updateFillingType: (item: FillingType) => void;
  removeFillingType: (id: string) => void;
  setCustomers: (data: Customer[]) => void;
  addCustomer: (item: Customer) => void;
  updateCustomer: (item: Customer) => void;
  deleteCustomer: (id: string) => void;
  setSalesOrders: (data: SalesOrder[]) => void;
  addSalesOrder: (item: SalesOrder) => void;
  updateSalesOrder: (item: SalesOrder) => void;
  deleteSalesOrder: (id: string) => void;
  setQuotations: (data: Quotation[]) => void;
  addQuotation: (item: Quotation) => void;
  updateQuotation: (item: Quotation) => void;
  deleteQuotation: (id: string) => void;
  setContracts: (data: Contract[]) => void;
  addContract: (item: Contract) => void;
  updateContract: (item: Contract) => void;
  deleteContract: (id: string) => void;
  setShipments: (data: Shipment[]) => void;
  addShipment: (item: Shipment) => void;
  updateShipment: (item: Shipment) => void;
  setSalesOutbounds: (data: SalesOutbound[]) => void;
  addSalesOutbound: (item: SalesOutbound) => void;
  updateSalesOutbound: (item: SalesOutbound) => void;
  setFollowUps: (data: FollowUp[]) => void;
  addFollowUp: (item: FollowUp) => void;
  setPriceLists: (data: PriceList[]) => void;
  addPriceList: (item: PriceList) => void;
  updatePriceList: (item: PriceList) => void;
  deletePriceList: (id: string) => void;
  setCustomerDiscounts: (data: CustomerDiscount[]) => void;
  addCustomerDiscount: (item: CustomerDiscount) => void;
  updateCustomerDiscount: (item: CustomerDiscount) => void;
  deleteCustomerDiscount: (id: string) => void;
  setExchangeRates: (data: ExchangeRate[]) => void;
  addExchangeRate: (item: ExchangeRate) => void;
  updateExchangeRate: (item: ExchangeRate) => void;
  deleteExchangeRate: (id: string) => void;
  setProductionPlans: (data: ProductionPlan[]) => void;
  addProductionPlan: (item: ProductionPlan) => void;
  updateProductionPlan: (item: ProductionPlan) => void;
  deleteProductionPlan: (id: string) => void;
  setWorkOrders: (data: WorkOrder[]) => void;
  addWorkOrder: (item: WorkOrder) => void;
  updateWorkOrder: (item: WorkOrder) => void;
  setWorkOrderCosts: (data: WorkOrderCost[]) => void;
  setProductionLines: (data: ProductionLine[]) => void;
  addProductionLine: (item: ProductionLine) => void;
  updateProductionLine: (item: ProductionLine) => void;
  deleteProductionLine: (id: string) => void;
  setProductionLineEquipments: (data: ProductionLineEquipment[]) => void;
  addProductionLineEquipment: (item: ProductionLineEquipment) => void;
  deleteProductionLineEquipment: (id: string) => void;
  setProductionExceptions: (data: ProductionException[]) => void;
  addProductionException: (item: ProductionException) => void;
  updateProductionException: (item: ProductionException) => void;
  setProcesses: (data: ProcessItem[]) => void;
  addProcess: (item: ProcessItem) => Promise<void>;
  updateProcess: (item: ProcessItem) => Promise<void>;
  deleteProcess: (id: string) => Promise<void>;
  setProcessRoutes: (data: ProcessRoute[]) => void;
  addProcessRoute: (item: ProcessRoute) => Promise<void>;
  updateProcessRoute: (item: ProcessRoute) => Promise<void>;
  deleteProcessRoute: (id: string) => Promise<void>;
  setProcessParamTemplates: (data: ProcessParamTemplate[]) => void;
  addProcessParamTemplate: (item: ProcessParamTemplate) => void;
  updateProcessParamTemplate: (item: ProcessParamTemplate) => void;
  setProcessVersions: (data: ProcessVersion[]) => void;
  addProcessVersion: (item: ProcessVersion) => void;
  updateProcessVersion: (item: ProcessVersion) => void;
  setProcessKnowledge: (data: ProcessKnowledge[]) => void;
  addProcessKnowledge: (item: ProcessKnowledge) => void;
  updateProcessKnowledge: (item: ProcessKnowledge) => void;
  setQualityStandards: (data: QualityStandard[]) => void;
  setProcessInspectionStandards: (data: ProcessInspectionStandard[]) => void;
  addProcessInspectionStandard: (item: ProcessInspectionStandard) => void;
  updateProcessInspectionStandard: (item: ProcessInspectionStandard) => void;
  deleteProcessInspectionStandard: (id: string) => void;
  setQualityInspections: (data: QualityInspection[]) => void;
  addQualityInspection: (item: QualityInspection) => void;
  setMaterialInspections: (data: MaterialInspection[]) => void;
  addMaterialInspection: (item: MaterialInspection) => void;
  updateMaterialInspection: (item: MaterialInspection) => void;
  setProcessInspections: (data: ProcessInspection[]) => void;
  addProcessInspection: (item: ProcessInspection) => void;
  updateProcessInspection: (item: ProcessInspection) => void;
  setFinishedInspections: (data: FinishedInspection[]) => void;
  addFinishedInspection: (item: FinishedInspection) => void;
  updateFinishedInspection: (item: FinishedInspection) => void;

  setEquipment: (data: Equipment[]) => void;
  setMaintenancePlans: (data: MaintenancePlan[]) => void;
  addMaintenancePlan: (item: MaintenancePlan) => void;
  updateMaintenancePlan: (item: MaintenancePlan) => void;
  setEquipmentRecords: (data: EquipmentRecord[]) => void;
  addEquipmentRecord: (item: EquipmentRecord) => void;
  setSafetyRecords: (data: SafetyRecord[]) => void;
  addSafetyRecord: (item: SafetyRecord) => void;
  updateSafetyRecord: (item: SafetyRecord) => void;
  setMaterials: (data: Material[]) => void;
  addMaterial: (item: Material) => void;
  updateMaterial: (item: Material) => void;
  deleteMaterial: (id: string) => void;
  setInventory: (data: Inventory[]) => void;
  addInventory: (item: Inventory) => void;
  updateInventory: (item: Inventory) => void;
  /** 根据物料 ID 查询所有有货库存并按数量降序返回 */
  getStockRecommendations: (materialIds: string[]) => Record<string, { warehouse: string; location_id: string; quantity: number }[]>;
  setWarehouseLocations: (data: WarehouseLocation[]) => void;
  addWarehouseLocation: (item: WarehouseLocation) => void;
  updateWarehouseLocation: (item: WarehouseLocation) => void;
  removeWarehouseLocation: (id: string) => void;
  setStockRecords: (data: StockRecord[]) => void;
  addStockRecord: (item: StockRecord) => void;
  updateStockRecord: (item: StockRecord) => void;
  setFinishedGoodsInbounds: (data: FinishedGoodsInbound[]) => void;
  addFinishedGoodsInbound: (item: FinishedGoodsInbound) => void;
  updateFinishedGoodsInbound: (item: FinishedGoodsInbound) => void;
  setSuppliers: (data: Supplier[]) => void;
  addSupplier: (item: Supplier) => void;
  updateSupplier: (item: Supplier) => void;

  setPurchaseRequests: (data: PurchaseRequest[]) => void;
  addPurchaseRequest: (item: PurchaseRequest) => void;
  updatePurchaseRequest: (item: PurchaseRequest) => void;
  setMaterialRequisitions: (data: MaterialRequisition[]) => void;
  addMaterialRequisition: (item: MaterialRequisition) => void;
  updateMaterialRequisition: (item: MaterialRequisition) => void;

  setPurchaseOrders: (data: PurchaseOrder[]) => void;
  addPurchaseOrder: (item: PurchaseOrder) => void;
  updatePurchaseOrder: (item: PurchaseOrder) => void;

  setPurchaseArrivals: (data: PurchaseArrival[]) => void;
  addPurchaseArrival: (item: PurchaseArrival) => void;
  updatePurchaseArrival: (item: PurchaseArrival) => void;

  setPurchaseReturns: (data: PurchaseReturn[]) => void;
  addPurchaseReturn: (item: PurchaseReturn) => void;
  updatePurchaseReturn: (item: PurchaseReturn) => void;

  setPaymentRecords: (data: PaymentRecord[]) => void;
  addPaymentRecord: (item: PaymentRecord) => void;
  updatePaymentRecord: (item: PaymentRecord) => void;

  setFinanceRecords: (data: FinanceRecord[]) => void;
  addFinanceRecord: (item: FinanceRecord) => void;
  updateFinanceRecord: (item: FinanceRecord) => void;
  setEmployees: (data: Employee[]) => void;
  addEmployee: (item: Employee) => void;
  updateEmployee: (item: Employee) => void;
  deleteEmployee: (id: string) => void;

  setSystemUsers: (data: SystemUser[]) => void;
  addSystemUser: (item: SystemUser) => void;
  updateSystemUser: (item: SystemUser) => void;
  deleteSystemUser: (id: string) => void;
  setAttendanceRecords: (data: AttendanceRecord[]) => void;
  addAttendanceRecord: (item: AttendanceRecord) => void;
  updateAttendanceRecord: (item: AttendanceRecord) => void;
  setLeaveRecords: (data: LeaveRecord[]) => void;
  addLeaveRecord: (item: LeaveRecord) => void;
  updateLeaveRecord: (item: LeaveRecord) => void;
  setPerformanceRecords: (data: PerformanceRecord[]) => void;
  addPerformanceRecord: (item: PerformanceRecord) => void;
  updatePerformanceRecord: (item: PerformanceRecord) => void;
  setPerformanceGradeConfig: (data: PerformanceGradeConfig[]) => void;
  addPerformanceGradeConfig: (item: PerformanceGradeConfig) => void;
  updatePerformanceGradeConfig: (item: PerformanceGradeConfig) => void;
  setTrainingRecords: (data: TrainingRecord[]) => void;
  addTrainingRecord: (item: TrainingRecord) => void;
  updateTrainingRecord: (item: TrainingRecord) => void;
  setEvaluationItems: (data: EvaluationItem[]) => void;

  setInventoryTurnovers: (data: InventoryTurnover[]) => void;

  setSafetyPatrolPlans: (data: SafetyPatrolPlan[]) => void;
  addSafetyPatrolPlan: (item: SafetyPatrolPlan) => void;
  updateSafetyPatrolPlan: (item: SafetyPatrolPlan) => void;

  setSafetyPatrolTasks: (data: SafetyPatrolTask[]) => void;
  addSafetyPatrolTask: (item: SafetyPatrolTask) => void;
  updateSafetyPatrolTask: (item: SafetyPatrolTask) => void;

  setAlertNotifications: (data: AlertNotification[]) => void;
  addAlertNotification: (item: AlertNotification) => void;
  markAlertRead: (id: string) => void;
  markAllAlertsRead: () => void;

  setAfterSalesTickets: (data: AfterSalesTicket[]) => void;
  addAfterSalesTicket: (item: AfterSalesTicket) => void;
  updateAfterSalesTicket: (item: AfterSalesTicket) => void;
  deleteAfterSalesTicket: (id: string) => void;

  setAfterSalesReturns: (data: AfterSalesReturn[]) => void;
  addAfterSalesReturn: (item: AfterSalesReturn) => void;
  updateAfterSalesReturn: (item: AfterSalesReturn) => void;
  deleteAfterSalesReturn: (id: string) => void;

  setAfterSalesReshipments: (data: AfterSalesReshipment[]) => void;
  addAfterSalesReshipment: (item: AfterSalesReshipment) => void;
  updateAfterSalesReshipment: (item: AfterSalesReshipment) => void;
  deleteAfterSalesReshipment: (id: string) => void;

  setMaterialSupplierPrices: (data: MaterialSupplierPrice[]) => void;
  addMaterialSupplierPrice: (item: MaterialSupplierPrice) => void;
  updateMaterialSupplierPrice: (item: MaterialSupplierPrice) => void;
  deleteMaterialSupplierPrice: (id: string) => void;

  setContractTemplates: (data: ContractTemplate[]) => void;
  addContractTemplate: (item: ContractTemplate) => void;
  updateContractTemplate: (item: ContractTemplate) => void;
  deleteContractTemplate: (id: string) => void;

  setOutsourcingDispatches: (data: OutsourcingDispatch[]) => void;
  addOutsourcingDispatch: (item: OutsourcingDispatch) => void;
  updateOutsourcingDispatch: (item: OutsourcingDispatch) => void;
  deleteOutsourcingDispatch: (id: string) => void;

  setOutsourcingReturnQCs: (data: OutsourcingReturnQC[]) => void;
  addOutsourcingReturnQC: (item: OutsourcingReturnQC) => void;
  updateOutsourcingReturnQC: (item: OutsourcingReturnQC) => void;
  deleteOutsourcingReturnQC: (id: string) => void;

  ecommercePurchaseTrackings: EcommercePurchaseTracking[];
  setEcommercePurchaseTrackings: (data: EcommercePurchaseTracking[]) => void;
  addEcommercePurchaseTracking: (item: EcommercePurchaseTracking) => void;
  updateEcommercePurchaseTracking: (item: EcommercePurchaseTracking) => void;
  deleteEcommercePurchaseTracking: (id: string) => void;

  setOutsourceFactories: (data: OutsourceFactory[]) => void;
  addOutsourceFactory: (item: OutsourceFactory) => void;
  updateOutsourceFactory: (item: OutsourceFactory) => void;
  deleteOutsourceFactory: (id: string) => void;

  setOutsourceShipments: (data: OutsourceShipment[]) => void;
  addOutsourceShipment: (item: OutsourceShipment) => void;
  updateOutsourceShipment: (item: OutsourceShipment) => void;
  deleteOutsourceShipment: (id: string) => void;

  setOutsourceReturns: (data: OutsourceReturn[]) => void;
  addOutsourceReturn: (item: OutsourceReturn) => void;
  updateOutsourceReturn: (item: OutsourceReturn) => void;
  deleteOutsourceReturn: (id: string) => void;

  setOutsourceProcessingPayments: (data: OutsourceProcessingPayment[]) => void;
  addOutsourceProcessingPayment: (item: OutsourceProcessingPayment) => void;
  updateOutsourceProcessingPayment: (item: OutsourceProcessingPayment) => void;
  deleteOutsourceProcessingPayment: (id: string) => void;

  salaryRecords: SalaryRecord[];
  setSalaryRecords: (data: SalaryRecord[]) => void;
  addSalaryRecord: (item: SalaryRecord) => Promise<void> | void;
  updateSalaryRecord: (item: SalaryRecord) => Promise<void> | void;
  deleteSalaryRecord: (id: string) => Promise<void> | void;

  payrollDetails: PayrollDetail[];
  setPayrollDetails: (data: PayrollDetail[]) => void;
  /** 新增或更新单条薪资明细（按 id upsert） */
  upsertPayrollDetail: (item: PayrollDetail) => void;
  /** 批量写入/覆盖某月薪资明细 */
  replacePayrollDetails: (month: string, items: PayrollDetail[]) => void;
  /** 锁定某月薪资明细 */
  lockPayrollMonth: (month: string) => void;

  operationLogs: OperationLog[];
  setOperationLogs: (data: OperationLog[]) => void;
  addOperationLog: (item: OperationLog) => Promise<void> | void;

  loginLogs: LoginLog[];
  setLoginLogs: (data: LoginLog[]) => void;
  addLoginLog: (item: LoginLog) => Promise<void> | void;

  setCurrentRole: (role: AppState['currentRole']) => void;

  setFieldPermissions: (data: Record<string, ResourceRules>) => void;
  updateFieldPermission: (resource: string, field: string, role: string, permission: 'hidden' | 'read' | 'write') => void;

  moduleVisibility: ModuleVisibilityConfig;
  setModuleVisibility: (config: ModuleVisibilityConfig) => void;
}

/** 记录操作日志（动态 import 避免循环依赖） */
async function emitLog(action: 'create' | 'update' | 'delete', entityType: string, item: Record<string, unknown>) {
  try {
    const info = buildEntityLogInfo(entityType, action, item);
    if (!info) return;
    const { recordOperationLog } = await import('@/lib/log');
    const op = getOperator();
    await recordOperationLog({
      action,
      operator: op.username,
      operator_name: op.fullName,
      role: op.role,
      module: info.module,
      target: info.target,
      target_type: info.targetType,
      target_id: info.targetId,
    });
  } catch (err) {
    console.error('[store] emitLog failed', err);
  }
}

/** 包装 slice 的 add/update/delete action，注入权限校验与操作日志 */
function wrapWithLog(slice: Record<string, unknown>, config: import('./dbActions').EntityConfig) {
  const { addAction, updateAction, deleteAction, entityType } = config;
  if (addAction && typeof slice[addAction] === 'function') {
    const orig = slice[addAction] as (item: Record<string, unknown>) => Promise<unknown>;
    slice[addAction] = async (item: Record<string, unknown>) => {
      if (!checkWritePermission(entityType, 'create')) throw new Error('RBAC_PERMISSION_DENIED');
      const res = await orig(item);
      void emitLog('create', entityType, item);
      return res;
    };
  }
  if (updateAction && typeof slice[updateAction] === 'function') {
    const orig = slice[updateAction] as (item: Record<string, unknown>) => Promise<unknown>;
    slice[updateAction] = async (item: Record<string, unknown>) => {
      if (!checkWritePermission(entityType, 'update')) throw new Error('RBAC_PERMISSION_DENIED');
      const res = await orig(item);
      void emitLog('update', entityType, item);
      return res;
    };
  }
  if (deleteAction && typeof slice[deleteAction] === 'function') {
    const orig = slice[deleteAction] as (id: string) => Promise<unknown>;
    slice[deleteAction] = async (id: string) => {
      if (!checkWritePermission(entityType, 'delete')) throw new Error('RBAC_PERMISSION_DENIED');
      // 删除前先取目标信息用于日志展示
      const state = useAppStore.getState() as unknown as Record<string, unknown>;
      const list = (state[config.field] as Record<string, unknown>[]) || [];
      const item = list.find((x) => String(x.id) === id) || { id };
      const res = await orig(id);
      void emitLog('delete', entityType, item);
      return res;
    };
  }
}

export const useAppStore = create<AppState>()((set, get) => {
  const slices = ENTITY_CONFIG_ARRAY.reduce<Record<string, unknown>>((acc, config) => {
    const slice = createDbSlice(set as import('./dbActions').AppStateSetter, config);
    // 包装 add/update/delete，自动记录操作日志（排除日志类自身）
    if (!LOG_EXCLUDED_TYPES.has(config.entityType)) {
      wrapWithLog(slice, config);
    }
    Object.assign(acc, slice);
    return acc;
  }, {});

  return {
    ...slices,
    getStockRecommendations: (materialIds: string[]) => {
      const state = get();
      const result: Record<string, { warehouse: string; location_id: string; quantity: number }[]> = {};
      for (const mid of materialIds) {
        const stocks = state.inventory
          .filter((inv) => inv.type === 'material' && inv.material_id === mid && inv.quantity > 0)
          .map((inv) => ({ warehouse: inv.warehouse, location_id: inv.location_id || '', quantity: inv.quantity }))
          .sort((a, b) => b.quantity - a.quantity);
        result[mid] = stocks;
      }
      return result;
    },
    ...slices,

    markAlertRead: async (id: string) => {
      let target: AlertNotification | undefined;
      set((state) => {
        const next = state.alertNotifications.map((i) => {
          if (i.id === id) {
            target = { ...i, status: 'read' as const };
            return target;
          }
          return i;
        });
        return { alertNotifications: next };
      });
      if (target) await updateEntity('alert_notifications', (target as unknown) as Record<string, unknown>);
    },

    markAllAlertsRead: async () => {
      const ids: string[] = [];
      set((state) => {
        const next = state.alertNotifications.map((i) => {
          if (i.status === 'unread') {
            ids.push(i.id);
            return { ...i, status: 'read' as const };
          }
          return i;
        });
        return { alertNotifications: next };
      });
      for (const id of ids) {
        const target = get().alertNotifications.find((i) => i.id === id);
        if (target) await updateEntity('alert_notifications', (target as unknown) as Record<string, unknown>);
      }
    },

    currentRole: 'admin' as const,
    setCurrentRole: (role: AppState['currentRole']) => set({ currentRole: role }),
    theme: 'warm' as const,
    setTheme: (theme: AppState['theme']) => set({ theme }),

    fieldPermissions: {
      employee: getDefaultEmployeePermissions(),
    },
    setFieldPermissions: (data: Record<string, ResourceRules>) => set({ fieldPermissions: data }),
    updateFieldPermission: (resource: string, field: string, roleKey: string, permission: 'hidden' | 'read' | 'write') =>
      set((state) => ({
        fieldPermissions: {
          ...state.fieldPermissions,
          [resource]: {
            ...state.fieldPermissions[resource],
            [field]: {
              ...state.fieldPermissions[resource]?.[field],
              [roleKey]: permission,
            },
          },
        },
      })),

    moduleVisibility: getDefaultModuleVisibility(),
    setModuleVisibility: (config: ModuleVisibilityConfig) => set({ moduleVisibility: config }),

    rbacPermissions: {},
    rbacEntityMenuMap: {},
    setRbacPermissions: (perms: Record<string, RbacRoleConfig>) => set({ rbacPermissions: perms }),
    setRbacEntityMenuMap: (map: Record<string, string>) => set({ rbacEntityMenuMap: map }),

    rolePermissions: {
      admin: {
        modules: ['home', 'products', 'marketing', 'planning', 'process', 'production', 'outsourcing', 'quality', 'equipment', 'safety', 'inventory', 'purchase', 'finance', 'finance-tax-refund', 'personnel', 'reports', 'dashboard', 'system'],
        menus: ['*'],
        actions: ['*'],
      },
      production: {
        modules: ['home', 'planning', 'process', 'production', 'outsourcing', 'quality', 'equipment', 'personnel'],
        menus: ['*'],
        actions: ['view', 'create', 'edit', 'delete', 'export'],
      },
      planner: {
        modules: ['home', 'planning', 'process', 'production', 'quality', 'equipment'],
        menus: ['*'],
        actions: ['view', 'create', 'edit', 'export'],
      },
      worker: {
        modules: ['home', 'production', 'process', 'quality', 'equipment'],
        menus: ['*'],
        actions: ['view', 'create', 'edit'],
      },
      quality: {
        modules: ['home', 'quality', 'equipment'],
        menus: ['*'],
        actions: ['view', 'create', 'edit', 'delete', 'export'],
      },
      warehouse: {
        modules: ['home', 'inventory', 'purchase'],
        menus: ['*'],
        actions: ['view', 'create', 'edit', 'delete', 'export'],
      },
      finance: {
        modules: ['home', 'finance', 'finance-tax-refund', 'reports'],
        menus: ['*'],
        actions: ['view', 'create', 'edit', 'delete', 'export'],
      },
      sales: {
        modules: ['home', 'marketing', 'reports'],
        menus: ['*'],
        actions: ['view', 'create', 'edit', 'delete', 'export'],
      },
      procurement: {
        modules: ['home', 'purchase'],
        menus: [],
        actions: ['view', 'edit'],
      },
      outsourcing: {
        modules: ['home', 'outsourcing'],
        menus: [],
        actions: ['view', 'edit'],
      },
      hr: {
        modules: ['home', 'personnel'],
        menus: [],
        actions: ['view', 'edit'],
      },
    },
    setRolePermissions: (
      role: string,
      permissions: { modules: string[]; menus: string[]; actions: string[] }
    ) =>
      set((state) => ({
        rolePermissions: { ...state.rolePermissions, [role]: permissions },
      })),

    outsourceFactories: [],
    setOutsourceFactories: (data: OutsourceFactory[]) => set({ outsourceFactories: data }),
    addOutsourceFactory: (item: OutsourceFactory) =>
      set((state) => ({ outsourceFactories: [...state.outsourceFactories, item] })),
    updateOutsourceFactory: (item: OutsourceFactory) =>
      set((state) => ({
        outsourceFactories: state.outsourceFactories.map((i) => (i.id === item.id ? item : i)),
      })),
    deleteOutsourceFactory: (id: string) =>
      set((state) => ({
        outsourceFactories: state.outsourceFactories.filter((i) => i.id !== id),
      })),

    outsourceShipments: [],
    setOutsourceShipments: (data: OutsourceShipment[]) => set({ outsourceShipments: data }),
    addOutsourceShipment: (item: OutsourceShipment) =>
      set((state) => ({ outsourceShipments: [...state.outsourceShipments, item] })),
    updateOutsourceShipment: (item: OutsourceShipment) =>
      set((state) => ({
        outsourceShipments: state.outsourceShipments.map((i) => (i.id === item.id ? item : i)),
      })),
    deleteOutsourceShipment: (id: string) =>
      set((state) => ({
        outsourceShipments: state.outsourceShipments.filter((i) => i.id !== id),
      })),

    outsourceReturns: [],
    setOutsourceReturns: (data: OutsourceReturn[]) => set({ outsourceReturns: data }),
    addOutsourceReturn: (item: OutsourceReturn) =>
      set((state) => ({ outsourceReturns: [...state.outsourceReturns, item] })),
    updateOutsourceReturn: (item: OutsourceReturn) =>
      set((state) => ({
        outsourceReturns: state.outsourceReturns.map((i) => (i.id === item.id ? item : i)),
      })),
    deleteOutsourceReturn: (id: string) =>
      set((state) => ({
        outsourceReturns: state.outsourceReturns.filter((i) => i.id !== id),
      })),

    payrollDetails: [],
    setPayrollDetails: (data: PayrollDetail[]) => set({ payrollDetails: data }),
    upsertPayrollDetail: (item: PayrollDetail) =>
      set((state) => {
        const exists = state.payrollDetails.some((i) => i.id === item.id);
        return {
          payrollDetails: exists
            ? state.payrollDetails.map((i) => (i.id === item.id ? item : i))
            : [...state.payrollDetails, item],
        };
      }),
    replacePayrollDetails: (month: string, items: PayrollDetail[]) =>
      set((state) => ({
        payrollDetails: [
          ...state.payrollDetails.filter((i) => i.month !== month),
          ...items,
        ],
      })),
    lockPayrollMonth: (month: string) =>
      set((state) => ({
        payrollDetails: state.payrollDetails.map((i) =>
          i.month === month ? { ...i, is_locked: true } : i,
        ),
      })),
  } as unknown as AppState;
});


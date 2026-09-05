import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmActionDialog } from "@/components/common/ConfirmActionDialog";
import { useAppStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { useVisibleTabs } from "@/lib/moduleVisibility";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { uuid } from "@/lib/utils";
import {
  unlockNextOperation,
  recalcWorkOrderFromOperations,
  isFinishedInspectionQualified,
  createPendingFinishedInspection,
  generateMissingInternalReports,
} from "@/lib/production";
import {
  fetchFactories,
  reconcileMissingShipments,
  fetchReturns,
  createFactory,
  updateFactory,
  deleteFactory,
  createShipment,
  updateShipment,
  deleteShipment,
  updateShipmentStatus,
  createReturn,
  updateReturn,
  deleteReturn,
  updateReturnInspection,
} from "@/services/outsourcing";
import type {
  OutsourceFactory,
  OutsourceShipment,
  OutsourceShipmentItem,
  OutsourceReturn,
  OutsourceReturnItem,
  OutsourceProcessingPayment,
  WorkOrder,
  WorkOrderOperation,
  OperationReportRecord,
  Inventory,
  StockRecord,
} from "@/types";
import {
  Factory,
  Package,
  ShieldCheck,
  Plus,
  Search,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  Truck,
  Banknote,
  Eye,
} from "lucide-react";

const TABS = [
  { value: "factory", label: "加工厂", icon: Factory },
  { value: "shipment", label: "发料单", icon: Package },
  { value: "return", label: "回货单", icon: ShieldCheck },
];

const emptyFactory: Partial<OutsourceFactory> = { status: "enabled" };
const emptyShipment: Partial<OutsourceShipment> = {
  shipment_date: new Date().toISOString().slice(0, 10),
  shipment_quantity: 0,
  status: "pending",
  items: [],
};
const emptyReturn: Partial<OutsourceReturn> = {
  return_date: new Date().toISOString().slice(0, 10),
  return_type: "finished",
  return_quantity: 0,
  qualified_quantity: 0,
  defective_quantity: 0,
  inspection_status: "pending",
  status: "pending",
  items: [],
};
const emptyPayment: Partial<OutsourceProcessingPayment> = {
  quantity: 0,
  unit_price: 0,
  amount: 0,
  status: "pending",
};

export function OutsourcingPage() {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [searchParams] = useSearchParams();
  const { activeTab, setActiveTab } = useVisibleTabs("/outsourcing", "factory");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  // 加工厂
  const [factoryOpen, setFactoryOpen] = useState(false);
  const [editingFactory, setEditingFactory] = useState<OutsourceFactory | null>(
    null,
  );
  const [factoryForm, setFactoryForm] =
    useState<Partial<OutsourceFactory>>(emptyFactory);

  // 发料单
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [editingShipment, setEditingShipment] =
    useState<OutsourceShipment | null>(null);
  const [shipmentForm, setShipmentForm] =
    useState<Partial<OutsourceShipment>>(emptyShipment);
  const [confirmShipmentState, setConfirmShipmentState] =
    useState<OutsourceShipment | null>(null);
  const [detailShipment, setDetailShipment] =
    useState<OutsourceShipment | null>(null);

  // 回货单
  const [returnOpen, setReturnOpen] = useState(false);
  const [editingReturn, setEditingReturn] = useState<OutsourceReturn | null>(
    null,
  );
  const [returnForm, setReturnForm] =
    useState<Partial<OutsourceReturn>>(emptyReturn);
  const [confirmQc, setConfirmQc] = useState<{
    r: OutsourceReturn;
    pass: boolean;
  } | null>(null);
  const [qcForm, setQcForm] = useState({
    qualified_quantity: 0,
    defective_quantity: 0,
    inspector: currentUserName,
  });
  const [detailReturn, setDetailReturn] = useState<OutsourceReturn | null>(
    null,
  );

  // 加工款
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] =
    useState<OutsourceProcessingPayment | null>(null);
  const [paymentForm, setPaymentForm] =
    useState<Partial<OutsourceProcessingPayment>>(emptyPayment);
  const [confirmPayment, setConfirmPayment] =
    useState<OutsourceProcessingPayment | null>(null);
  const [payForm, setPayForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    payment_amount: 0,
    payment_method: "银行转账",
    remark: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const workId = searchParams.get("work_id") || "";
      const workNo = searchParams.get("work_no") || "";
      const productCode = searchParams.get("product_code") || "";
      const productName = searchParams.get("product_name") || "";
      const opCode = searchParams.get("operation_code") || "";
      const opName = searchParams.get("operation_name") || "";
      const qty = Number(searchParams.get("qty")) || 0;
      setActiveTab("shipment");
      setShipmentForm({
        ...emptyShipment,
        work_order_id: workId,
        work_order_no: workNo,
        product_code: productCode,
        product_name: productName,
        operation_code: opCode,
        operation_name: opName,
        shipment_quantity: qty,
        items: [
          {
            id: uuid(),
            shipment_id: "",
            material_code: productCode,
            material_name: productName || "半成品",
            quantity: qty,
            unit: "件",
          },
        ],
      });
      setShipmentOpen(true);
    }
  }, [searchParams]);

  async function loadData() {
    setLoading(true);
    try {
      const [factories, shipments, returns] = await Promise.all([
        fetchFactories(),
        reconcileMissingShipments(store.workOrders),
        fetchReturns(),
      ]);
      store.setOutsourceFactories(factories);
      store.setOutsourceShipments(shipments);
      store.setOutsourceReturns(returns);
      // 自动补全历史已质检但未生成加工款的回货单
      await reconcileMissingPayments();
    } catch (err) {
      toast.error("外协数据加载失败");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // 筛选
  const filteredFactories = useMemo(() => {
    const text = filter.toLowerCase();
    return store.outsourceFactories.filter((f) =>
      `${f.factory_name} ${f.contact_phone} ${f.processing_capability}`
        .toLowerCase()
        .includes(text),
    );
  }, [store.outsourceFactories, filter]);

  const filteredShipments = useMemo(() => {
    const text = filter.toLowerCase();
    return store.outsourceShipments
      .filter((s) =>
        `${s.shipment_no} ${s.contract_no || ""} ${s.work_order_no} ${s.product_name} ${s.operation_name} ${s.factory_name}`
          .toLowerCase()
          .includes(text),
      )
      .sort(
        (a, b) =>
          new Date(b.shipment_date || 0).getTime() -
          new Date(a.shipment_date || 0).getTime(),
      );
  }, [store.outsourceShipments, filter]);

  const filteredReturns = useMemo(() => {
    const text = filter.toLowerCase();
    return store.outsourceReturns
      .filter((r) =>
        `${r.return_no} ${r.shipment_no} ${r.contract_no || ""} ${r.work_order_no} ${r.product_code} ${r.product_name} ${r.operation_name} ${r.factory_name}`
          .toLowerCase()
          .includes(text),
      )
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
  }, [store.outsourceReturns, filter]);

  const filteredPayments = useMemo(() => {
    const text = filter.toLowerCase();
    return store.outsourceProcessingPayments
      .filter((p) =>
        `${p.payment_no} ${p.work_order_no} ${p.product_name} ${p.product_spec || ""} ${p.product_color || ""} ${p.operation_name} ${p.factory_name}`
          .toLowerCase()
          .includes(text),
      )
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
  }, [store.outsourceProcessingPayments, filter]);

  // 工厂相关
  function openNewFactory() {
    setEditingFactory(null);
    setFactoryForm(emptyFactory);
    setFactoryOpen(true);
  }

  function openEditFactory(factory: OutsourceFactory) {
    setEditingFactory(factory);
    setFactoryForm({ ...factory });
    setFactoryOpen(true);
  }

  async function saveFactory() {
    if (
      !factoryForm.factory_name ||
      !factoryForm.contact_phone
    ) {
      toast.error("请填写完整加工厂信息");
      return;
    }
    try {
      if (editingFactory) {
        const updated = await updateFactory({
          ...editingFactory,
          ...factoryForm,
        } as OutsourceFactory);
        store.updateOutsourceFactory(updated);
      } else {
        const created = await createFactory(
          factoryForm as Omit<
            OutsourceFactory,
            "id" | "created_at" | "updated_at"
          >,
        );
        store.addOutsourceFactory(created);
      }
      setFactoryOpen(false);
      toast.success("加工厂已保存");
    } catch (err) {
      toast.error("保存失败");
      console.error(err);
    }
  }

  async function removeFactory(id: string) {
    try {
      await deleteFactory(id);
      store.deleteOutsourceFactory(id);
      toast.success("加工厂已删除");
    } catch (err) {
      toast.error("删除失败");
      console.error(err);
    }
  }

  // 发料单相关
  function openNewShipment() {
    setEditingShipment(null);
    setShipmentForm(emptyShipment);
    setShipmentOpen(true);
  }

  function openEditShipment(shipment: OutsourceShipment) {
    setEditingShipment(shipment);
    setShipmentForm({ ...shipment });
    setShipmentOpen(true);
  }

  function addShipmentItem() {
    setShipmentForm((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          id: uuid(),
          shipment_id: prev.id || "",
          material_code: "",
          material_name: "",
          quantity: 0,
          unit: "件",
        },
      ],
    }));
  }

  function updateShipmentItem(index: number, item: OutsourceShipmentItem) {
    setShipmentForm((prev) => {
      const items = [...(prev.items || [])];
      items[index] = item;
      return { ...prev, items };
    });
  }

  function removeShipmentItem(index: number) {
    setShipmentForm((prev) => {
      const items = [...(prev.items || [])];
      items.splice(index, 1);
      return { ...prev, items };
    });
  }

  async function saveShipment() {
    const form = shipmentForm;
    if (
      !form.factory_id ||
      !form.work_order_id ||
      !form.shipment_date ||
      !form.shipment_quantity ||
      !form.items?.length
    ) {
      toast.error("请填写完整发料单信息");
      return;
    }
    try {
      const factory = store.outsourceFactories.find(
        (f) => f.id === form.factory_id,
      );
      const wo = store.workOrders.find((w) => w.id === form.work_order_id);
      const op = wo?.operations.find((o) => o.code === form.operation_code);
      const shipmentNo = editingShipment
        ? editingShipment.shipment_no
        : `OS-${Date.now().toString().slice(-8)}`;
      const payload: Omit<
        OutsourceShipment,
        "id" | "created_at" | "updated_at" | "items"
      > = {
        shipment_no: shipmentNo,
        contract_no: form.contract_no || wo?.contract_no || "",
        work_order_id: form.work_order_id,
        work_order_no: form.work_order_no || wo?.work_no || "",
        operation_code: form.operation_code || "",
        operation_name: form.operation_name || op?.name || "",
        product_code: form.product_code || wo?.product_code || "",
        product_name: form.product_name || wo?.product_name || "",
        factory_id: form.factory_id,
        factory_name: factory?.factory_name || "",
        shipment_date: form.shipment_date,
        shipment_quantity: form.shipment_quantity,
        logistics_company: form.logistics_company,
        logistics_no: form.logistics_no,
        status: form.status || "pending",
      };
      const items = form.items.map((it) => ({
        ...it,
        shipment_id: it.shipment_id || "",
      }));
      let saved: OutsourceShipment;
      if (editingShipment) {
        saved = await updateShipment({ ...editingShipment, ...payload, items });
        store.updateOutsourceShipment(saved);
      } else {
        saved = await createShipment(payload, items);
        store.addOutsourceShipment(saved);
      }
      // 联动工序：创建发料单后置为生产中 + 待发料
      if (wo && op) {
        const updatedOps = wo.operations.map((o) =>
          o.code === op.code
            ? ({
                ...o,
                status: "running" as const,
                outsourcing_status: "pending" as const,
                dispatch_id: saved.id,
              } as WorkOrderOperation)
            : o,
        );
        const updated = { ...wo, operations: updatedOps };
        const recalc = recalcWorkOrderFromOperations(updated);
        store.updateWorkOrder({ ...updated, ...recalc });
      }
      setShipmentOpen(false);
      toast.success("发料单已保存");
    } catch (err) {
      toast.error("保存发料单失败");
      console.error(err);
    }
  }

  async function removeShipment(id: string) {
    try {
      await deleteShipment(id);
      store.deleteOutsourceShipment(id);
      // 同步删除本地关联回货单
      const relatedReturns = store.outsourceReturns.filter((r) => r.shipment_id === id);
      relatedReturns.forEach((r) => store.deleteOutsourceReturn(r.id));
      toast.success("发料单已删除");
    } catch (err) {
      toast.error("删除失败");
      console.error(err);
    }
  }

  async function confirmShipment(shipment: OutsourceShipment) {
    if (shipment.status !== "pending") return;
    try {
      await updateShipmentStatus(shipment.id, "shipped");
      store.updateOutsourceShipment({ ...shipment, status: "shipped" });
      // 联动工序：外协状态变为已发料
      const wo = store.workOrders.find((w) => w.id === shipment.work_order_id);
      const op = wo?.operations.find(
        (o) =>
          o.code === shipment.operation_code ||
          o.name === shipment.operation_name,
      );
      if (wo && op) {
        const updatedOps = wo.operations.map((o) =>
          o.code === op.code
            ? ({
                ...o,
                outsourcing_status: "dispatched" as const,
              } as WorkOrderOperation)
            : o,
        );
        const updated = { ...wo, operations: updatedOps };
        const recalc = recalcWorkOrderFromOperations(updated);
        store.updateWorkOrder({ ...updated, ...recalc });
      }
      toast.success("发料单已确认发料，状态更新为已发料");
    } catch (err) {
      toast.error("确认发料失败");
      console.error(err);
    }
  }

  // 回货单相关
  function openNewReturn(shipment?: OutsourceShipment) {
    setEditingReturn(null);
    if (shipment) {
      const returnItems = shipment.items.length
        ? shipment.items.map((it) => ({
            id: uuid(),
            return_id: "",
            material_code: it.material_code,
            material_name: it.material_name,
            quantity: it.quantity,
            unit: it.unit,
          }))
        : [
            {
              id: uuid(),
              return_id: "",
              material_code: shipment.product_code,
              material_name: shipment.product_name || "半成品",
              quantity: shipment.shipment_quantity,
              unit: "件",
            },
          ];
      setReturnForm({
        ...emptyReturn,
        shipment_id: shipment.id,
        shipment_no: shipment.shipment_no,
        work_order_id: shipment.work_order_id,
        work_order_no: shipment.work_order_no,
        operation_code: shipment.operation_code,
        operation_name: shipment.operation_name,
        product_code: shipment.product_code,
        product_name: shipment.product_name,
        factory_id: shipment.factory_id,
        factory_name: shipment.factory_name,
        return_quantity: shipment.shipment_quantity,
        items: returnItems,
      });
    } else {
      setReturnForm(emptyReturn);
    }
    setReturnOpen(true);
  }

  function openEditReturn(ret: OutsourceReturn) {
    setEditingReturn(ret);
    setReturnForm({ ...ret });
    setReturnOpen(true);
  }

  function addReturnItem() {
    setReturnForm((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          id: uuid(),
          return_id: prev.id || "",
          material_code: "",
          material_name: "",
          quantity: 0,
          unit: "件",
        },
      ],
    }));
  }

  function updateReturnItem(index: number, item: OutsourceReturnItem) {
    setReturnForm((prev) => {
      const items = [...(prev.items || [])];
      items[index] = item;
      return { ...prev, items };
    });
  }

  function removeReturnItem(index: number) {
    setReturnForm((prev) => {
      const items = [...(prev.items || [])];
      items.splice(index, 1);
      return { ...prev, items };
    });
  }

  async function saveReturn() {
    const form = returnForm;
    if (
      !form.shipment_id ||
      !form.return_date ||
      !form.return_quantity ||
      !form.items?.length
    ) {
      toast.error("请填写完整回货单信息");
      return;
    }
    const shipment = store.outsourceShipments.find(
      (s) => s.id === form.shipment_id,
    );
    if (!shipment) {
      toast.error("关联的发料单不存在");
      return;
    }
    const total = Number(form.return_quantity || 0);
    if (total <= 0) {
      toast.error("请填写回货数量");
      return;
    }
    try {
      const factory = store.outsourceFactories.find(
        (f) => f.id === shipment.factory_id,
      );
      const returnNo = editingReturn
        ? editingReturn.return_no
        : `OR-${Date.now().toString().slice(-8)}`;
      const wo = store.workOrders.find(
        (w) => w.id === shipment.work_order_id,
      );
      const payload: Omit<
        OutsourceReturn,
        "id" | "created_at" | "updated_at" | "items"
      > = {
        return_no: returnNo,
        shipment_id: shipment.id,
        shipment_no: shipment.shipment_no,
        contract_no: shipment.contract_no || wo?.contract_no || "",
        work_order_id: shipment.work_order_id,
        work_order_no: shipment.work_order_no,
        operation_code: shipment.operation_code,
        operation_name: shipment.operation_name,
        product_code: shipment.product_code,
        product_name: shipment.product_name,
        factory_id: shipment.factory_id,
        factory_name: factory?.factory_name || shipment.factory_name || "",
        return_date: form.return_date,
        return_type: form.return_type || "finished",
        return_quantity: total,
        qualified_quantity: 0,
        defective_quantity: 0,
        inspection_status: "pending",
        status: "pending",
      };
      const items = (form.items || []).map((it) => ({
        ...it,
        return_id: it.return_id || "",
      }));
      let saved: OutsourceReturn;
      if (editingReturn) {
        saved = await updateReturn({ ...editingReturn, ...payload, items });
        store.updateOutsourceReturn(saved);
      } else {
        saved = await createReturn(payload, items);
        store.addOutsourceReturn(saved);
      }
      // 新创建回货单时同步发料单状态与工序外协状态
      if (!editingReturn && shipment.status !== "returned") {
        await updateShipmentStatus(shipment.id, "returning");
        store.updateOutsourceShipment({ ...shipment, status: "returning" });
        const op = wo?.operations.find(
          (o) =>
            o.code === shipment.operation_code ||
            o.name === shipment.operation_name,
        );
        if (wo && op) {
          const updatedOps = wo.operations.map((o) =>
            o.code === op.code
              ? ({
                  ...o,
                  outsourcing_status: "returning" as const,
                } as WorkOrderOperation)
              : o,
          );
          const updated = { ...wo, operations: updatedOps };
          const recalc = recalcWorkOrderFromOperations(updated);
          store.updateWorkOrder({ ...updated, ...recalc });
        }
      }
      setReturnOpen(false);
      toast.success("回货单已保存");
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : String(err);
      toast.error("保存回货单失败：" + msg);
      console.error(err);
    }
  }

  async function removeReturn(id: string) {
    try {
      await deleteReturn(id);
      store.deleteOutsourceReturn(id);
      toast.success("回货单已删除");
    } catch (err) {
      toast.error("删除失败");
      console.error(err);
    }
  }

  function resolveOperationPrice(wo: WorkOrder, opCode?: string): number {
    const op = wo.operations.find((o) => o.code === opCode);
    if (op?.outsourcing_price && op.outsourcing_price > 0) return op.outsourcing_price;
    if (op?.category === "outsourcing" && opCode) {
      const product = store.products.find((p) => p.id === wo.product_id);
      const step = product?.process_steps?.find((s) => s.code === opCode);
      const price = step?.outsourcing_price ?? step?.price;
      if (price && price > 0) return price;
    }
    return 0;
  }

  function resolveOperationQuantity(wo: WorkOrder, opCode?: string): number {
    const op = wo.operations.find((o) => o.code === opCode);
    return op?.plan_qty ?? wo.plan_quantity ?? 0;
  }

  function resolveOperationFromReturn(ret: OutsourceReturn) {
    const wo = store.workOrders.find((w) => w.id === ret.work_order_id);
    let op = wo?.operations.find(
      (o) => o.code === ret.operation_code || o.name === ret.operation_name,
    );
    const OUTSOURCING_NAMES = ["电脑绣", "水洗", "做背布", "绣花"];
    if (!op && wo) {
      op = wo.operations.find(
        (o) =>
          o.status !== "completed" &&
          (o.category === "outsourcing" ||
            OUTSOURCING_NAMES.some((n) => o.name.includes(n))),
      );
    }
    return { wo, op };
  }

  function resolveProductFromWorkOrder(wo?: WorkOrder) {
    if (!wo) return { name: "", spec: "", color: "" };
    const product = store.products.find((p) => p.id === wo.product_id);
    const sku = product?.skus.find((s) => s.id === wo.sku_id);
    return {
      name: product?.name || wo.product_name,
      spec: sku?.specification || product?.specification || "",
      color: sku?.color || "",
    };
  }

  function resolveProductFromPayment(p: OutsourceProcessingPayment) {
    if (p.product_spec && p.product_color) {
      return {
        name: p.product_name,
        spec: p.product_spec,
        color: p.product_color,
      };
    }
    const wo = store.workOrders.find((w) => w.id === p.work_order_id);
    const info = resolveProductFromWorkOrder(wo);
    return {
      name: info.name || p.product_name,
      spec: p.product_spec || info.spec,
      color: p.product_color || info.color,
    };
  }

  async function createPaymentFromReturn(ret: OutsourceReturn) {
    const { wo, op } = resolveOperationFromReturn(ret);
    if (!wo || !op) return;
    const existing = store.outsourceProcessingPayments.find(
      (p) =>
        p.work_order_id === ret.work_order_id &&
        p.operation_code === op.code &&
        p.factory_id === ret.factory_id,
    );
    if (existing) return;
    const unitPrice = resolveOperationPrice(wo, op.code);
    const quantity = ret.qualified_quantity;
    if (unitPrice <= 0 || quantity <= 0) return;
    const productInfo = resolveProductFromWorkOrder(wo);
    const now = new Date().toISOString();
    const amount = Number((quantity * unitPrice).toFixed(2));
    const payment: OutsourceProcessingPayment = {
      id: uuid(),
      payment_no: `OP-${Date.now().toString().slice(-8)}`,
      work_order_id: ret.work_order_id,
      work_order_no: ret.work_order_no || wo.work_no,
      operation_code: op.code,
      operation_name: op.name,
      product_code: ret.product_code,
      product_name: productInfo.name,
      product_spec: productInfo.spec,
      product_color: productInfo.color,
      factory_id: ret.factory_id,
      factory_name: ret.factory_name,
      quantity,
      unit_price: unitPrice,
      amount,
      status: "pending",
      remark: `由回货单 ${ret.return_no} 生成`,
      created_at: now,
      updated_at: now,
    };
    await store.addOutsourceProcessingPayment(payment);
    toast.success("加工款已生成");
  }

  async function reconcileMissingPayments() {
    const qualifiedReturns = store.outsourceReturns.filter(
      (r) => r.inspection_status === "qualified",
    );
    for (const ret of qualifiedReturns) {
      const { wo, op } = resolveOperationFromReturn(ret);
      if (!wo || !op) continue;
      const existing = store.outsourceProcessingPayments.find(
        (p) =>
          p.work_order_id === ret.work_order_id &&
          p.operation_code === op.code &&
          p.factory_id === ret.factory_id,
      );
      if (!existing) {
        await createPaymentFromReturn(ret);
      }
    }
  }

  function openPaymentForm(item?: OutsourceProcessingPayment) {
    setEditingPayment(item || null);
    setPaymentForm(
      item
        ? { ...item }
        : { ...emptyPayment },
    );
    setPaymentOpen(true);
  }

  function closePaymentForm() {
    setPaymentOpen(false);
    setEditingPayment(null);
    setPaymentForm({ ...emptyPayment });
  }

  function savePayment() {
    const form = paymentForm;
    if (!form.work_order_id || !form.operation_code || !form.factory_id) {
      toast.error("请填写关联工单、工序和加工厂");
      return;
    }
    if (!form.quantity || form.quantity <= 0) {
      toast.error("数量必须大于0");
      return;
    }
    if (!form.unit_price || form.unit_price <= 0) {
      toast.error("单价必须大于0");
      return;
    }
    const wo = store.workOrders.find((w) => w.id === form.work_order_id);
    const op = wo?.operations.find((o) => o.code === form.operation_code);
    const factory = store.outsourceFactories.find((f) => f.id === form.factory_id);
    const now = new Date().toISOString();
    const amount = Number((form.quantity * form.unit_price).toFixed(2));
    const productInfo = resolveProductFromWorkOrder(wo);
    if (editingPayment) {
      const updated: OutsourceProcessingPayment = {
        ...editingPayment,
        ...form,
        amount,
        work_order_no: wo?.work_no,
        operation_name: op?.name,
        product_code: wo?.product_code || editingPayment.product_code,
        product_name: productInfo.name || editingPayment.product_name,
        product_spec: form.product_spec ?? editingPayment.product_spec ?? productInfo.spec,
        product_color: form.product_color ?? editingPayment.product_color ?? productInfo.color,
        factory_name: factory?.factory_name,
        updated_at: now,
      } as OutsourceProcessingPayment;
      store.updateOutsourceProcessingPayment(updated);
      toast.success("加工款已更新");
    } else {
      const payment: OutsourceProcessingPayment = {
        id: uuid(),
        payment_no: `OP-${Date.now().toString().slice(-8)}`,
        work_order_id: form.work_order_id,
        work_order_no: wo?.work_no,
        operation_code: form.operation_code,
        operation_name: op?.name,
        product_code: wo?.product_code || "",
        product_name: productInfo.name || "",
        product_spec: form.product_spec ?? productInfo.spec,
        product_color: form.product_color ?? productInfo.color,
        factory_id: form.factory_id,
        factory_name: factory?.factory_name,
        quantity: form.quantity,
        unit_price: form.unit_price,
        amount,
        status: "pending",
        remark: form.remark || "",
        created_at: now,
        updated_at: now,
      };
      store.addOutsourceProcessingPayment(payment);
      toast.success("加工款已创建");
    }
    closePaymentForm();
  }

  function removePayment(id: string) {
    store.deleteOutsourceProcessingPayment(id);
    toast.success("加工款已删除");
  }

  function confirmPaymentItem(payment: OutsourceProcessingPayment) {
    const now = new Date().toISOString();
    store.updateOutsourceProcessingPayment({
      ...payment,
      status: "confirmed",
      updated_at: now,
    });
    toast.success("加工款已确认");
    setConfirmPayment(null);
  }

  function payPaymentItem(payment: OutsourceProcessingPayment) {
    if (!payForm.payment_amount || payForm.payment_amount <= 0) {
      toast.error("付款金额必须大于0");
      return;
    }
    if (!payForm.payment_date) {
      toast.error("请选择付款日期");
      return;
    }
    const now = new Date().toISOString();
    store.updateOutsourceProcessingPayment({
      ...payment,
      status: "paid",
      payment_date: payForm.payment_date,
      payment_amount: payForm.payment_amount,
      payment_method: payForm.payment_method,
      remark: payForm.remark || payment.remark,
      updated_at: now,
    });
    toast.success("加工款已标记为已付款");
    setPayForm({
      payment_date: new Date().toISOString().slice(0, 10),
      payment_amount: 0,
      payment_method: "银行转账",
      remark: "",
    });
  }

  async function applyQc(
    ret: OutsourceReturn,
    pass: boolean,
    form: { qualified_quantity: number; defective_quantity: number; inspector: string }
  ) {
    try {
      const total = ret.return_quantity;
      const qualified = pass ? form.qualified_quantity : 0;
      const defective = pass ? form.defective_quantity : total;
      if (qualified + defective !== total) {
        toast.error("合格数量 + 不良数量必须等于回货数量");
        return;
      }
      if (pass && !form.inspector.trim()) {
        toast.error("请输入质检员");
        return;
      }
      const inspectionStatus: OutsourceReturn["inspection_status"] = pass
        ? "qualified"
        : "unqualified";
      const status: OutsourceReturn["status"] = pass ? "stored" : "returned";
      await updateReturnInspection(ret.id, {
        inspection_status: inspectionStatus,
        status,
        qualified_quantity: qualified,
        defective_quantity: defective,
        inspector: form.inspector.trim() || currentUserName || "质检员",
      });
      const updatedReturn = {
        ...ret,
        inspection_status: inspectionStatus,
        status,
        qualified_quantity: qualified,
        defective_quantity: defective,
        inspector: form.inspector.trim() || currentUserName || "质检员",
      };
      store.updateOutsourceReturn(updatedReturn);

      // 联动发料单
      const shipment = store.outsourceShipments.find(
        (s) => s.id === ret.shipment_id,
      );
      if (shipment && pass) {
        await updateShipmentStatus(shipment.id, "returned");
        await store.updateOutsourceShipment({ ...shipment, status: "returned" });
      }

      // 联动生产工序
      const wo = store.workOrders.find((w) => w.id === ret.work_order_id);
      let op = wo?.operations.find(
        (o) => o.code === ret.operation_code || o.name === ret.operation_name,
      );
      // 精确匹配失败时，尝试按外协工序做兜底匹配（兼容旧数据未标记 category）
      const OUTSOURCING_NAMES = ["电脑绣", "水洗", "做背布", "绣花"];
      if (!op && wo) {
        op = wo.operations.find(
          (o) =>
            o.status !== "completed" &&
            (o.category === "outsourcing" ||
              OUTSOURCING_NAMES.some((n) => o.name.includes(n))),
        );
      }
      if (!op) {
        toast.error(
          "未找到回货单关联的生产工序，请检查回货单/发料单的工序信息是否完整",
        );
      }
      if (wo && op) {
        let nextOps = wo.operations;
        if (pass) {
          const unitPrice = resolveOperationPrice(wo, op.code);
          const reportQty = ret.qualified_quantity || op.plan_qty;
          const report: OperationReportRecord = {
            id: uuid(),
            operator_id: undefined,
            operator_name: form.inspector.trim() || currentUserName || "外协质检",
            qty: reportQty,
            unit_price: unitPrice,
            amount: Number((reportQty * unitPrice).toFixed(2)),
            report_time: new Date().toISOString().slice(0, 10),
            work_no: wo.work_no,
            operation_name: op.name,
            operation_code: op.code,
          };
          const completedOp: WorkOrderOperation = {
            ...op,
            status: "completed",
            completed: true,
            completed_qty: op.plan_qty,
            return_qc_id: ret.id,
            outsourcing_status: "returned",
            reports: [...(op.reports || []), report],
          };
          nextOps = unlockNextOperation(
            {
              ...wo,
              operations: wo.operations.map((o) =>
                o.code === op.code ? completedOp : o,
              ),
            },
            completedOp,
          );
        }
        let updated = { ...wo, operations: nextOps };
        if (pass) {
          updated = generateMissingInternalReports(
            updated,
            store.products,
            form.inspector.trim() || currentUserName || "系统",
          );
        }
        const recalc = recalcWorkOrderFromOperations(updated);
        const finalWo = { ...updated, ...recalc };
        store.updateWorkOrder(finalWo);
        if (recalc.status === "qc" && !isFinishedInspectionQualified(store, finalWo)) {
          await createPendingFinishedInspection(store, finalWo);
        }
      }

      // 质检通过：成品回货写入库存，半成品回货不写入库存
      if (pass && ret.return_type !== "semi_finished") {
        await putQualifiedIntoInventory(ret, wo);
      }

      // 质检通过后自动生成加工款记录
      if (pass) {
        await createPaymentFromReturn(ret);
      }

      toast.success(
        pass
          ? "质检通过，工序已完工并解锁下道工序"
          : "质检不通过，已记录为不良",
      );
    } catch (err) {
      toast.error("质检处理失败");
      console.error(err);
    }
  }

  async function putQualifiedIntoInventory(
    ret: OutsourceReturn,
    wo?: WorkOrder,
  ) {
    const productId = wo?.product_id || ret.product_code;
    const warehouse =
      store.warehouseLocations.find((w) => w.status === "active")?.warehouse ||
      "成品仓";
    const existing = store.inventory.find(
      (i) => i.product_id === productId && i.warehouse === warehouse,
    );
    const qty = ret.qualified_quantity;
    if (existing) {
      const updated: Inventory = {
        ...existing,
        quantity: existing.quantity + qty,
      };
      store.updateInventory(updated);
    } else {
      const created: Inventory = {
        id: uuid(),
        product_id: productId,
        type: "product",
        quantity: qty,
        min_stock: 0,
        max_stock: 99999,
        warehouse,
      };
      store.addInventory(created);
    }
    const record: StockRecord = {
      id: uuid(),
      record_no: `SR-${Date.now().toString().slice(-8)}`,
      type: "in",
      subtype: "外协回货入库",
      product_id: productId,
      quantity: qty,
      warehouse,
      related_order: ret.return_no,
      related_order_id: ret.id,
      handler: ret.inspector || "质检员",
      record_date: new Date().toISOString(),
    };
    store.addStockRecord(record);
  }

  // UI helpers
  function factoryStatusLabel(status: OutsourceFactory["status"]) {
    return status === "enabled" ? "启用" : "停用";
  }

  function formatDate(value?: string) {
    if (!value) return "-";
    return value.split("T")[0].split(" ")[0];
  }

  function shipmentStatusLabel(status: OutsourceShipment["status"]) {
    const map: Record<string, string> = {
      pending: "待发料",
      shipped: "已发料",
      returning: "回货中",
      returned: "已全部完成",
    };
    return map[status] || status;
  }

  function returnStatusLabel(status: OutsourceReturn["status"]) {
    const map: Record<string, string> = {
      pending: "待回货",
      returned: "已回货",
      stored: "已入库",
    };
    return map[status] || status;
  }

  function inspectionStatusLabel(status: OutsourceReturn["inspection_status"]) {
    const map: Record<string, string> = {
      pending: "待质检",
      inspecting: "质检中",
      qualified: "合格",
      partial: "部分合格",
      unqualified: "不合格",
    };
    return map[status] || status;
  }

  function paymentStatusLabel(status: OutsourceProcessingPayment["status"]) {
    const map: Record<string, string> = {
      pending: "待确认",
      confirmed: "已确认",
      paid: "已付款",
    };
    return map[status] || status;
  }

  function statusBadgeVariant(status: string) {
    if (
      status === "completed" ||
      status === "qualified" ||
      status === "stored" ||
      status === "enabled" ||
      status === "paid" ||
      status === "confirmed"
    )
      return "default";
    if (status === "pending" || status === "pending_start" || status === "partial")
      return "secondary";
    if (status === "unqualified" || status === "disabled") return "destructive";
    return "outline";
  }

  const {
    paginatedItems: filteredReturnsPaginated,
    currentPage: filteredReturnsCurrentPage,
    pageSize: filteredReturnsPageSize,
    totalPages: filteredReturnsTotalPages,
    totalItems: filteredReturnsTotalItems,
    setPage: setFilteredReturnsPage,
    setPageSize: setFilteredReturnsPageSize,
  } = usePagination(filteredReturns);

  const {
    paginatedItems: filteredShipmentsPaginated,
    currentPage: filteredShipmentsCurrentPage,
    pageSize: filteredShipmentsPageSize,
    totalPages: filteredShipmentsTotalPages,
    totalItems: filteredShipmentsTotalItems,
    setPage: setFilteredShipmentsPage,
    setPageSize: setFilteredShipmentsPageSize,
  } = usePagination(filteredShipments);

  const {
    paginatedItems: filteredFactoriesPaginated,
    currentPage: filteredFactoriesCurrentPage,
    pageSize: filteredFactoriesPageSize,
    totalPages: filteredFactoriesTotalPages,
    totalItems: filteredFactoriesTotalItems,
    setPage: setFilteredFactoriesPage,
    setPageSize: setFilteredFactoriesPageSize,
  } = usePagination(filteredFactories);

  const {
    paginatedItems: filteredPaymentsPaginated,
    currentPage: filteredPaymentsCurrentPage,
    pageSize: filteredPaymentsPageSize,
    totalPages: filteredPaymentsTotalPages,
    totalItems: filteredPaymentsTotalItems,
    setPage: setFilteredPaymentsPage,
    setPageSize: setFilteredPaymentsPageSize,
  } = usePagination(filteredPayments);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="外协管理"
        description="外协加工厂、发料单、回货质检与生产工序联动"
      />
      <ControlledTabs
        modulePath="/outsourcing"
        defaultTab="factory"
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
      >
        <TabsList className="w-full flex-wrap justify-start md:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              <t.icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="factory" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">加工厂档案</CardTitle>
              <Button size="sm" onClick={openNewFactory}>
                <Plus className="mr-1 h-4 w-4" />
                新增加工厂
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索加工厂..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        加工厂名称
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        联系电话
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        加工能力
                      </TableHead>
                      <TableHead className="whitespace-nowrap">状态</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFactoriesPaginated.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {f.factory_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {f.contact_phone}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {f.processing_capability}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={statusBadgeVariant(f.status)}>
                            {factoryStatusLabel(f.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditFactory(f)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFactory(f.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredFactories.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          暂无加工厂
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <Pagination
                  currentPage={filteredFactoriesCurrentPage}
                  totalPages={filteredFactoriesTotalPages}
                  pageSize={filteredFactoriesPageSize}
                  totalItems={filteredFactoriesTotalItems}
                  onPageChange={setFilteredFactoriesPage}
                  onPageSizeChange={setFilteredFactoriesPageSize}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="shipment" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">发料单管理</CardTitle>
              <Button size="sm" onClick={openNewShipment}>
                <Plus className="mr-1 h-4 w-4" />
                新增发料单
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索发料单..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        发料单号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        合同编号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        关联工单
                      </TableHead>
                      <TableHead className="whitespace-nowrap">工序</TableHead>
                      <TableHead className="whitespace-nowrap">产品</TableHead>
                      <TableHead className="whitespace-nowrap">
                        加工厂
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        发料日期
                      </TableHead>
                      <TableHead className="whitespace-nowrap">数量</TableHead>
                      <TableHead className="whitespace-nowrap">状态</TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredShipmentsPaginated.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {s.shipment_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.contract_no || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.work_order_no || s.work_order_id}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.operation_name || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.product_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.factory_name || s.factory_id}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(s.shipment_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.shipment_quantity}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={statusBadgeVariant(s.status)}>
                            {shipmentStatusLabel(s.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {s.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => setConfirmShipmentState(s)}
                            >
                              <Truck className="mr-1 h-4 w-4" />
                              确认发料
                            </Button>
                          )}
                          {s.status === "shipped" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openNewReturn(s)}
                              title="新增回货单"
                            >
                              <Package className="mr-1 h-4 w-4" />
                              回货
                            </Button>
                          )}
                          {s.status === "returning" && (
                            <span className="text-xs text-muted-foreground">
                              回货中
                            </span>
                          )}
                          {s.status === "returned" && (
                            <span className="text-xs text-muted-foreground">
                              已全部完成
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetailShipment(s)}
                            title="详情"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditShipment(s)}
                            title="编辑"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeShipment(s.id)}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredShipments.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="text-center text-muted-foreground"
                        >
                          暂无发料单
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <Pagination
                  currentPage={filteredShipmentsCurrentPage}
                  totalPages={filteredShipmentsTotalPages}
                  pageSize={filteredShipmentsPageSize}
                  totalItems={filteredShipmentsTotalItems}
                  onPageChange={setFilteredShipmentsPage}
                  onPageSizeChange={setFilteredShipmentsPageSize}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="return" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">回货与质检管理</CardTitle>
              <Button size="sm" onClick={() => openNewReturn()}>
                <Plus className="mr-1 h-4 w-4" />
                新增回货单
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索回货单..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        回货单号
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        关联发料单
                      </TableHead>
                      <TableHead className="whitespace-nowrap">产品</TableHead>
                      <TableHead className="whitespace-nowrap">工序</TableHead>
                      <TableHead className="whitespace-nowrap">
                        加工厂
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        回货类型
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        回货/合格/不良
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        质检状态
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        入库状态
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReturnsPaginated.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {r.return_no}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.shipment_no || r.shipment_id}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.product_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.operation_name || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.factory_name || r.factory_id}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.return_type === "semi_finished"
                            ? "半成品"
                            : "成品"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.return_quantity} / {r.qualified_quantity} /{" "}
                          {r.defective_quantity}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant={statusBadgeVariant(r.inspection_status)}
                          >
                            {inspectionStatusLabel(r.inspection_status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={statusBadgeVariant(r.status)}>
                            {returnStatusLabel(r.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetailReturn(r)}
                            title="详情"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEditReturn(r)}
                          >
                            <Edit className="mr-1 h-4 w-4" />
                            编辑
                          </Button>
                          {r.inspection_status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                className="ml-2"
                                onClick={() => {
                                  setQcForm({
                                    qualified_quantity: r.return_quantity,
                                    defective_quantity: 0,
                                    inspector: currentUserName,
                                  });
                                  setConfirmQc({ r, pass: true });
                                }}
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                质检通过
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-2"
                                onClick={() => {
                                  setQcForm({
                                    qualified_quantity: 0,
                                    defective_quantity: r.return_quantity,
                                    inspector: currentUserName,
                                  });
                                  setConfirmQc({ r, pass: false });
                                }}
                              >
                                <XCircle className="mr-1 h-4 w-4" />
                                不通过
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-2"
                            onClick={() => removeReturn(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredReturns.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="text-center text-muted-foreground"
                        >
                          暂无回货单
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <Pagination
                  currentPage={filteredReturnsCurrentPage}
                  totalPages={filteredReturnsTotalPages}
                  pageSize={filteredReturnsPageSize}
                  totalItems={filteredReturnsTotalItems}
                  onPageChange={setFilteredReturnsPage}
                  onPageSizeChange={setFilteredReturnsPageSize}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">加工款管理</CardTitle>
              <Button size="sm" onClick={() => openPaymentForm()}>
                <Plus className="mr-1 h-4 w-4" />
                新增加工款
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索加工款..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">加工款单号</TableHead>
                      <TableHead className="whitespace-nowrap">关联工单</TableHead>
                      <TableHead className="whitespace-nowrap">产品</TableHead>
                      <TableHead className="whitespace-nowrap">规格</TableHead>
                      <TableHead className="whitespace-nowrap">颜色</TableHead>
                      <TableHead className="whitespace-nowrap">工序</TableHead>
                      <TableHead className="whitespace-nowrap">加工厂</TableHead>
                      <TableHead className="whitespace-nowrap">数量</TableHead>
                      <TableHead className="whitespace-nowrap">单价</TableHead>
                      <TableHead className="whitespace-nowrap">金额</TableHead>
                      <TableHead className="whitespace-nowrap">状态</TableHead>
                      <TableHead className="text-right whitespace-nowrap">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPaymentsPaginated.map((p) => {
                      const productInfo = resolveProductFromPayment(p);
                      return (
                        <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap font-medium">{p.payment_no}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.work_order_no || p.work_order_id}</TableCell>
                        <TableCell className="whitespace-nowrap">{productInfo.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{productInfo.spec || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{productInfo.color || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.operation_name}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.factory_name || p.factory_id}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.quantity}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.amount.toFixed(2)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={statusBadgeVariant(p.status)}>
                            {paymentStatusLabel(p.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openPaymentForm(p)}
                            disabled={p.status !== "pending"}
                          >
                            <Edit className="mr-1 h-4 w-4" />
                            编辑
                          </Button>
                          {p.status === "pending" && (
                            <Button
                              size="sm"
                              className="ml-2"
                              onClick={() => setConfirmPayment(p)}
                            >
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                              确认
                            </Button>
                          )}
                          {p.status === "confirmed" && (
                            <Button
                              size="sm"
                              className="ml-2"
                              onClick={() => {
                                setPayForm({
                                  payment_date: new Date().toISOString().slice(0, 10),
                                  payment_amount: p.amount,
                                  payment_method: "银行转账",
                                  remark: p.remark || "",
                                });
                                setConfirmPayment(p);
                              }}
                            >
                              <Banknote className="mr-1 h-4 w-4" />
                              付款
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-2"
                            onClick={() => removePayment(p.id)}
                            disabled={p.status !== "pending"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                    {filteredPayments.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={12}
                          className="text-center text-muted-foreground"
                        >
                          暂无加工款
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <Pagination
                  currentPage={filteredPaymentsCurrentPage}
                  totalPages={filteredPaymentsTotalPages}
                  pageSize={filteredPaymentsPageSize}
                  totalItems={filteredPaymentsTotalItems}
                  onPageChange={setFilteredPaymentsPage}
                  onPageSizeChange={setFilteredPaymentsPageSize}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </ControlledTabs>
      <ConfirmActionDialog
        open={!!confirmShipmentState}
        onOpenChange={(v) => !v && setConfirmShipmentState(null)}
        title="确认外协发料"
        description="请确认是否将该发料单状态更新为已发料。确认后对应外协工序将联动为已发料状态。"
        items={
          confirmShipmentState
            ? [
                { label: "发料单号", value: confirmShipmentState.shipment_no },
                {
                  label: "工单号",
                  value: confirmShipmentState.work_order_no || "-",
                },
                {
                  label: "产品",
                  value: `${confirmShipmentState.product_code} ${confirmShipmentState.product_name}`,
                },
                {
                  label: "加工厂",
                  value: confirmShipmentState.factory_name || "-",
                },
                {
                  label: "发料数量",
                  value: confirmShipmentState.shipment_quantity,
                },
                {
                  label: "状态",
                  value: shipmentStatusLabel(confirmShipmentState.status),
                },
              ]
            : []
        }
        confirmText="确认发料"
        onConfirm={() => {
          if (confirmShipmentState) confirmShipment(confirmShipmentState);
          setConfirmShipmentState(null);
        }}
      />
      <Dialog open={!!confirmQc} onOpenChange={(v) => !v && setConfirmQc(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmQc?.pass ? "回货质检通过" : "回货质检不通过"}
            </DialogTitle>
          </DialogHeader>
          {confirmQc && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">回货单号</div>
                  <div>{confirmQc.r.return_no}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">回货数量</div>
                  <div>{confirmQc.r.return_quantity}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>合格数量</Label>
                  <Input
                    type="number"
                    min={0}
                    value={qcForm.qualified_quantity}
                    onChange={(e) =>
                      setQcForm({
                        ...qcForm,
                        qualified_quantity: Number(e.target.value),
                      })
                    }
                    disabled={!confirmQc.pass}
                  />
                </div>
                <div className="space-y-2">
                  <Label>不良数量</Label>
                  <Input
                    type="number"
                    min={0}
                    value={qcForm.defective_quantity}
                    onChange={(e) =>
                      setQcForm({
                        ...qcForm,
                        defective_quantity: Number(e.target.value),
                      })
                    }
                    disabled={!confirmQc.pass}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>质检员</Label>
                  <Select
                    value={qcForm.inspector}
                    onValueChange={(v) =>
                      setQcForm({ ...qcForm, inspector: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择质检员" />
                    </SelectTrigger>
                    <SelectContent>
                      {store.employees
                        .filter(
                          (e) =>
                            e.status === "active" &&
                            (e.department === "质检部" ||
                              e.position?.includes("质检")),
                        )
                        .map((e) => (
                          <SelectItem key={e.id} value={e.name}>
                            {e.name}（{e.position}）
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmQc(null)}>
                  取消
                </Button>
                <Button
                  variant={confirmQc.pass ? "default" : "destructive"}
                  onClick={() => {
                    applyQc(confirmQc.r, confirmQc.pass, qcForm);
                    setConfirmQc(null);
                  }}
                >
                  {confirmQc.pass ? "确认通过" : "确认不通过"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* 加工厂表单 */}
      <Dialog open={factoryOpen} onOpenChange={setFactoryOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFactory ? "编辑加工厂" : "新增加工厂"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>加工厂名称</Label>
              <Input
                value={factoryForm.factory_name || ""}
                onChange={(e) =>
                  setFactoryForm({
                    ...factoryForm,
                    factory_name: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>联系电话</Label>
              <Input
                value={factoryForm.contact_phone || ""}
                onChange={(e) =>
                  setFactoryForm({
                    ...factoryForm,
                    contact_phone: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>加工能力</Label>
              <Textarea
                value={factoryForm.processing_capability || ""}
                onChange={(e) =>
                  setFactoryForm({
                    ...factoryForm,
                    processing_capability: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={factoryForm.status || "enabled"}
                onValueChange={(v) =>
                  setFactoryForm({
                    ...factoryForm,
                    status: v as OutsourceFactory["status"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">启用</SelectItem>
                  <SelectItem value="disabled">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={saveFactory}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* 发料单表单 */}
      <Dialog open={shipmentOpen} onOpenChange={setShipmentOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingShipment ? "编辑发料单" : "新增发料单"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[80dvh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>外协加工厂</Label>
                <Select
                  value={shipmentForm.factory_id || ""}
                  onValueChange={(v) =>
                    setShipmentForm({ ...shipmentForm, factory_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择加工厂" />
                  </SelectTrigger>
                  <SelectContent>
                    {store.outsourceFactories.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.factory_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>关联生产工单</Label>
                <Select
                  value={shipmentForm.work_order_id || ""}
                  onValueChange={(v) => {
                    const wo = store.workOrders.find((w) => w.id === v);
                    setShipmentForm({
                      ...shipmentForm,
                      work_order_id: v,
                      work_order_no: wo?.work_no || "",
                      product_code: wo?.product_code || "",
                      product_name: wo?.product_name || "",
                      operation_code: "",
                      operation_name: "",
                      items: [
                        {
                          id: uuid(),
                          shipment_id: "",
                          material_code: wo?.product_code || "",
                          material_name: wo?.product_name || "半成品",
                          quantity: shipmentForm.shipment_quantity || 0,
                          unit: "件",
                        },
                      ],
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择工单" />
                  </SelectTrigger>
                  <SelectContent>
                    {store.workOrders.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.work_no} - {w.product_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>关联工序</Label>
                <Select
                  value={shipmentForm.operation_code || ""}
                  onValueChange={(v) => {
                    const wo = store.workOrders.find(
                      (w) => w.id === shipmentForm.work_order_id,
                    );
                    const op = wo?.operations.find((o) => o.code === v);
                    setShipmentForm({
                      ...shipmentForm,
                      operation_code: v,
                      operation_name: op?.name || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择工序" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const wo = store.workOrders.find(
                        (w) => w.id === shipmentForm.work_order_id,
                      );
                      if (!wo) return null;
                      // 兼容旧数据：优先取标记为外协的工序，未标记时按常见外协名称兜底
                      let ops = wo.operations.filter(
                        (o) => o.category === "outsourcing",
                      );
                      if (ops.length === 0) {
                        ops = wo.operations.filter((o) =>
                          ["电脑绣", "水洗", "做背布", "外协", "绣花"].some(
                            (n) => o.name.includes(n),
                          ),
                        );
                      }
                      if (ops.length === 0) {
                        ops = wo.operations;
                      }
                      return ops.map((o) => (
                        <SelectItem key={o.code} value={o.code}>
                          {o.seq}. {o.name}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>发料日期</Label>
                <Input
                  type="date"
                  value={shipmentForm.shipment_date || ""}
                  onChange={(e) =>
                    setShipmentForm({
                      ...shipmentForm,
                      shipment_date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>发料数量</Label>
                <Input
                  type="number"
                  min={0}
                  value={shipmentForm.shipment_quantity || ""}
                  onChange={(e) =>
                    setShipmentForm({
                      ...shipmentForm,
                      shipment_quantity: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>物流公司</Label>
                <Input
                  value={shipmentForm.logistics_company || ""}
                  onChange={(e) =>
                    setShipmentForm({
                      ...shipmentForm,
                      logistics_company: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>物流单号</Label>
                <Input
                  value={shipmentForm.logistics_no || ""}
                  onChange={(e) =>
                    setShipmentForm({
                      ...shipmentForm,
                      logistics_no: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>发料明细</Label>
                <Button size="sm" variant="outline" onClick={addShipmentItem}>
                  <Plus className="mr-1 h-4 w-4" />
                  新增明细
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        物料/半成品
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        物料编码
                      </TableHead>
                      <TableHead className="whitespace-nowrap">数量</TableHead>
                      <TableHead className="whitespace-nowrap">单位</TableHead>
                      <TableHead className="whitespace-nowrap"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(shipmentForm.items || []).map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            value={item.material_name}
                            onChange={(e) =>
                              updateShipmentItem(idx, {
                                ...item,
                                material_name: e.target.value,
                              })
                            }
                            placeholder="名称"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            value={item.material_code}
                            onChange={(e) =>
                              updateShipmentItem(idx, {
                                ...item,
                                material_code: e.target.value,
                              })
                            }
                            placeholder="编码"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(e) =>
                              updateShipmentItem(idx, {
                                ...item,
                                quantity: Number(e.target.value),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            value={item.unit}
                            onChange={(e) =>
                              updateShipmentItem(idx, {
                                ...item,
                                unit: e.target.value,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeShipmentItem(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <Button className="w-full" onClick={saveShipment}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* 回货单表单 */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingReturn ? "编辑回货单" : "新增回货单"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[80dvh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>关联发料单</Label>
                <Select
                  value={returnForm.shipment_id || ""}
                  onValueChange={(v) => {
                    const s = store.outsourceShipments.find((x) => x.id === v);
                    if (s) {
                      setReturnForm({
                        ...emptyReturn,
                        shipment_id: s.id,
                        shipment_no: s.shipment_no,
                        work_order_id: s.work_order_id,
                        work_order_no: s.work_order_no,
                        operation_code: s.operation_code,
                        operation_name: s.operation_name,
                        product_code: s.product_code,
                        product_name: s.product_name,
                        factory_id: s.factory_id,
                        factory_name: s.factory_name,
                        return_quantity: s.shipment_quantity,
                        items: s.items.map((it) => ({
                          id: uuid(),
                          return_id: "",
                          material_code: it.material_code,
                          material_name: it.material_name,
                          quantity: it.quantity,
                          unit: it.unit,
                        })),
                      });
                    } else {
                      setReturnForm({ ...returnForm, shipment_id: v });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择发料单" />
                  </SelectTrigger>
                  <SelectContent>
                    {store.outsourceShipments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.shipment_no} - {s.product_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>回货日期</Label>
                <Input
                  type="date"
                  value={returnForm.return_date || ""}
                  onChange={(e) =>
                    setReturnForm({
                      ...returnForm,
                      return_date: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>回货类型</Label>
                <Select
                  value={returnForm.return_type || "finished"}
                  onValueChange={(v) =>
                    setReturnForm({
                      ...returnForm,
                      return_type: v as OutsourceReturn["return_type"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finished">成品回货</SelectItem>
                    <SelectItem value="semi_finished">半成品回货</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>回货数量</Label>
                <Input
                  type="number"
                  min={0}
                  value={returnForm.return_quantity || ""}
                  onChange={(e) => {
                    const qty = Number(e.target.value);
                    setReturnForm({
                      ...returnForm,
                      return_quantity: qty,
                      qualified_quantity: qty,
                      defective_quantity: 0,
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>工序</Label>
                <Input
                  value={returnForm.operation_name || "-"}
                  readOnly
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>回货明细</Label>
                <Button size="sm" variant="outline" onClick={addReturnItem}>
                  <Plus className="mr-1 h-4 w-4" />
                  新增明细
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        物料/半成品
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        物料编码
                      </TableHead>
                      <TableHead className="whitespace-nowrap">数量</TableHead>
                      <TableHead className="whitespace-nowrap">单位</TableHead>
                      <TableHead className="whitespace-nowrap"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(returnForm.items || []).map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            value={item.material_name}
                            onChange={(e) =>
                              updateReturnItem(idx, {
                                ...item,
                                material_name: e.target.value,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            value={item.material_code}
                            onChange={(e) =>
                              updateReturnItem(idx, {
                                ...item,
                                material_code: e.target.value,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(e) =>
                              updateReturnItem(idx, {
                                ...item,
                                quantity: Number(e.target.value),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            value={item.unit}
                            onChange={(e) =>
                              updateReturnItem(idx, {
                                ...item,
                                unit: e.target.value,
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeReturnItem(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <Button className="w-full" onClick={saveReturn}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 加工款表单 */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPayment ? "编辑加工款" : "新增加工款"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>关联工单</Label>
              <Select
                value={paymentForm.work_order_id || ""}
                onValueChange={(v) => {
                  const wo = store.workOrders.find((w) => w.id === v);
                  const productInfo = resolveProductFromWorkOrder(wo);
                  setPaymentForm({
                    ...paymentForm,
                    work_order_id: v,
                    work_order_no: wo?.work_no,
                    product_code: wo?.product_code,
                    product_name: productInfo.name,
                    product_spec: productInfo.spec,
                    product_color: productInfo.color,
                    operation_code: undefined,
                    operation_name: undefined,
                    quantity: 0,
                    unit_price: 0,
                    amount: 0,
                  });
                }}
                disabled={!!editingPayment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择工单" />
                </SelectTrigger>
                <SelectContent>
                  {store.workOrders
                    .filter((w) => w.operations.some((o) => o.category === "outsourcing"))
                    .map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.work_no} - {w.product_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>工序</Label>
              <Select
                value={paymentForm.operation_code || ""}
                onValueChange={(v) => {
                  const wo = store.workOrders.find(
                    (w) => w.id === paymentForm.work_order_id,
                  );
                  const op = wo?.operations.find((o) => o.code === v);
                  const qty = wo ? resolveOperationQuantity(wo, v) : 0;
                  const price = wo ? resolveOperationPrice(wo, v) : 0;
                  setPaymentForm({
                    ...paymentForm,
                    operation_code: v,
                    operation_name: op?.name,
                    quantity: qty,
                    unit_price: price,
                    amount: Number((qty * price).toFixed(2)),
                  });
                }}
                disabled={!paymentForm.work_order_id || !!editingPayment}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择工序" />
                </SelectTrigger>
                <SelectContent>
                  {store.workOrders
                    .find((w) => w.id === paymentForm.work_order_id)
                    ?.operations.filter((o) => o.category === "outsourcing")
                    .map((o) => (
                      <SelectItem key={o.code} value={o.code}>
                        {o.name} ({o.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>加工厂</Label>
              <Select
                value={paymentForm.factory_id || ""}
                onValueChange={(v) => {
                  const factory = store.outsourceFactories.find((f) => f.id === v);
                  setPaymentForm({
                    ...paymentForm,
                    factory_id: v,
                    factory_name: factory?.factory_name,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择加工厂" />
                </SelectTrigger>
                <SelectContent>
                  {store.outsourceFactories.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.factory_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>产品</Label>
                <Input
                  value={paymentForm.product_name || ""}
                  disabled
                />
              </div>
              <div>
                <Label>规格</Label>
                <Input
                  value={paymentForm.product_spec || ""}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, product_spec: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>颜色</Label>
                <Input
                  value={paymentForm.product_color || ""}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, product_color: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>数量</Label>
                <Input
                  type="number"
                  min={0}
                  value={paymentForm.quantity || ""}
                  onChange={(e) => {
                    const qty = Number(e.target.value);
                    setPaymentForm({
                      ...paymentForm,
                      quantity: qty,
                      amount: Number((qty * (paymentForm.unit_price || 0)).toFixed(2)),
                    });
                  }}
                />
              </div>
              <div>
                <Label>单价</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={paymentForm.unit_price || ""}
                  onChange={(e) => {
                    const price = Number(e.target.value);
                    setPaymentForm({
                      ...paymentForm,
                      unit_price: price,
                      amount: Number((price * (paymentForm.quantity || 0)).toFixed(2)),
                    });
                  }}
                />
              </div>
            </div>
            <div>
              <Label>金额</Label>
              <Input
                type="number"
                readOnly
                value={paymentForm.amount || ""}
              />
            </div>
            <div>
              <Label>备注</Label>
              <Textarea
                value={paymentForm.remark || ""}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, remark: e.target.value })
                }
              />
            </div>
            <Button className="w-full" onClick={savePayment}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 确认加工款 */}
      <Dialog open={!!confirmPayment} onOpenChange={(v) => !v && setConfirmPayment(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>确认加工款</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              确认后加工款状态将更新为已确认，是否继续？
            </p>
            {confirmPayment && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>加工款单号</span>
                  <span>{confirmPayment.payment_no}</span>
                </div>
                <div className="flex justify-between">
                  <span>工序</span>
                  <span>{confirmPayment.operation_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>金额</span>
                  <span>{confirmPayment.amount.toFixed(2)}</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setConfirmPayment(null)}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={() => confirmPayment && confirmPaymentItem(confirmPayment)}
              >
                确认
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 付款 */}
      <Dialog open={!!confirmPayment && confirmPayment.status === "confirmed"} onOpenChange={(v) => !v && setConfirmPayment(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>加工款付款</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>付款金额</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={payForm.payment_amount || ""}
                onChange={(e) =>
                  setPayForm({ ...payForm, payment_amount: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>付款日期</Label>
              <Input
                type="date"
                value={payForm.payment_date}
                onChange={(e) =>
                  setPayForm({ ...payForm, payment_date: e.target.value })
                }
              />
            </div>
            <div>
              <Label>付款方式</Label>
              <Select
                value={payForm.payment_method}
                onValueChange={(v) => setPayForm({ ...payForm, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="银行转账">银行转账</SelectItem>
                  <SelectItem value="现金">现金</SelectItem>
                  <SelectItem value="支票">支票</SelectItem>
                  <SelectItem value="其他">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>付款备注</Label>
              <Textarea
                value={payForm.remark}
                onChange={(e) => setPayForm({ ...payForm, remark: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setConfirmPayment(null)}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={() => confirmPayment && payPaymentItem(confirmPayment)}
              >
                确认付款
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 发料单详情 */}
      <Dialog
        open={!!detailShipment}
        onOpenChange={(v) => !v && setDetailShipment(null)}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>发料单详情</DialogTitle>
          </DialogHeader>
          {detailShipment && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">发料单号</span>
                <span className="col-span-2">{detailShipment.shipment_no}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">合同编号</span>
                <span className="col-span-2">
                  {detailShipment.contract_no || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">关联工单</span>
                <span className="col-span-2">
                  {detailShipment.work_order_no || detailShipment.work_order_id}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">工序</span>
                <span className="col-span-2">
                  {detailShipment.operation_name || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">产品</span>
                <span className="col-span-2">
                  {detailShipment.product_code} {detailShipment.product_name}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">加工厂</span>
                <span className="col-span-2">
                  {detailShipment.factory_name || detailShipment.factory_id}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">发料日期</span>
                <span className="col-span-2">
                  {formatDate(detailShipment.shipment_date)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">发料数量</span>
                <span className="col-span-2">
                  {detailShipment.shipment_quantity}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">状态</span>
                <span className="col-span-2">
                  <Badge variant={statusBadgeVariant(detailShipment.status)}>
                    {shipmentStatusLabel(detailShipment.status)}
                  </Badge>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">物流公司</span>
                <span className="col-span-2">
                  {detailShipment.logistics_company || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">物流单号</span>
                <span className="col-span-2">
                  {detailShipment.logistics_no || "-"}
                </span>
              </div>
              {detailShipment.items && detailShipment.items.length > 0 && (
                <div>
                  <span className="text-muted-foreground">明细</span>
                  <div className="mt-1 rounded border p-2 space-y-1">
                    {detailShipment.items.map((it) => (
                      <div key={it.id} className="flex justify-between">
                        <span>{it.material_name}</span>
                        <span>
                          {it.quantity} {it.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 回货单详情 */}
      <Dialog
        open={!!detailReturn}
        onOpenChange={(v) => !v && setDetailReturn(null)}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>回货单详情</DialogTitle>
          </DialogHeader>
          {detailReturn && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">回货单号</span>
                <span className="col-span-2">{detailReturn.return_no}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">关联发料单</span>
                <span className="col-span-2">
                  {detailReturn.shipment_no || detailReturn.shipment_id}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">工序</span>
                <span className="col-span-2">
                  {detailReturn.operation_name || "-"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">产品</span>
                <span className="col-span-2">
                  {detailReturn.product_code} {detailReturn.product_name}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">加工厂</span>
                <span className="col-span-2">
                  {detailReturn.factory_name || detailReturn.factory_id}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">回货日期</span>
                <span className="col-span-2">{detailReturn.return_date}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">回货类型</span>
                <span className="col-span-2">
                  {detailReturn.return_type === "semi_finished"
                    ? "半成品"
                    : "成品"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">回货数量</span>
                <span className="col-span-2">
                  {detailReturn.return_quantity}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">合格数量</span>
                <span className="col-span-2">
                  {detailReturn.qualified_quantity}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">缺陷数量</span>
                <span className="col-span-2">
                  {detailReturn.defective_quantity || 0}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">质检状态</span>
                <span className="col-span-2">
                  <Badge
                    variant={statusBadgeVariant(detailReturn.inspection_status)}
                  >
                    {inspectionStatusLabel(detailReturn.inspection_status)}
                  </Badge>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">回货状态</span>
                <span className="col-span-2">
                  <Badge variant={statusBadgeVariant(detailReturn.status)}>
                    {returnStatusLabel(detailReturn.status)}
                  </Badge>
                </span>
              </div>
              {(detailReturn.inspection_status === "unqualified" ||
                detailReturn.inspection_status === "partial") && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">不合格原因</span>
                  <span className="col-span-2">
                    {detailReturn.defect_reason || "暂无记录"}
                  </span>
                </div>
              )}
              {detailReturn.items && detailReturn.items.length > 0 && (
                <div>
                  <span className="text-muted-foreground">明细</span>
                  <div className="mt-1 rounded border p-2 space-y-1">
                    {detailReturn.items.map((it) => (
                      <div key={it.id} className="flex justify-between">
                        <span>{it.material_name}</span>
                        <span>
                          {it.quantity} {it.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

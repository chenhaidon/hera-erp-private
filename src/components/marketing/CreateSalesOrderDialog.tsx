import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { nanoid } from "@/lib/utils";
import { CURRENCIES, TRADE_TERMS } from "@/lib/data";
import type { Product, ProductSku, SalesOrder, SalesOrderItem } from "@/types";

export interface CreateSalesOrderPrefillData {
  customerId?: string;
  orderDate?: string;
  deliveryDate?: string;
  contractId?: string;
  remark?: string;
  items?: SalesOrderItem[];
}

interface CreateSalesOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillData?: CreateSalesOrderPrefillData | null;
  onPrefillConsumed?: () => void;
}

const emptyItem = (): SalesOrderItem => ({
  product_id: "",
  sku_id: "",
  product_code: "",
  product_name: "",
  sku_summary: "",
  quantity: 1,
  unit: "件",
  unit_price: 0,
  amount: 0,
});

const todayStr = () => new Date().toISOString().slice(0, 10);

export function CreateSalesOrderDialog({
  open,
  onOpenChange,
  prefillData,
  onPrefillConsumed,
}: CreateSalesOrderDialogProps) {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';

  const [customerId, setCustomerId] = useState("");
  const [orderDate, setOrderDate] = useState(todayStr());
  const [deliveryDate, setDeliveryDate] = useState(todayStr());
  const [currency, setCurrency] = useState("CNY");
  const [tradeTerm, setTradeTerm] = useState("none");
  const [destination, setDestination] = useState("");
  const [contractId, setContractId] = useState("");
  const [remark, setRemark] = useState("");
  const [items, setItems] = useState<SalesOrderItem[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);

  const customer = useMemo(
    () => store.customers.find((c) => c.id === customerId),
    [customerId, store.customers],
  );

  const totalAmount = useMemo(
    () => items.reduce((sum, it) => sum + (it.amount || 0), 0),
    [items],
  );

  function resetForm() {
    setCustomerId("");
    setOrderDate(todayStr());
    setDeliveryDate(todayStr());
    setCurrency("CNY");
    setTradeTerm("none");
    setDestination("");
    setContractId("");
    setRemark("");
    setItems([emptyItem()]);
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  useEffect(() => {
    if (!open || !prefillData) return;
    if (prefillData.customerId) setCustomerId(prefillData.customerId);
    if (prefillData.orderDate) setOrderDate(prefillData.orderDate);
    if (prefillData.deliveryDate) setDeliveryDate(prefillData.deliveryDate);
    if (prefillData.contractId) setContractId(prefillData.contractId);
    if (prefillData.remark !== undefined) setRemark(prefillData.remark);
    if (prefillData.items && prefillData.items.length > 0) {
      setItems(prefillData.items.map((it) => recalc(it)));
    }
    onPrefillConsumed?.();
  }, [open, prefillData]);

  function recalc(item: SalesOrderItem): SalesOrderItem {
    const qty = Math.max(0, Math.floor(item.quantity || 0));
    const price = Math.max(0, item.unit_price || 0);
    return {
      ...item,
      quantity: qty,
      unit_price: price,
      amount: Number((qty * price).toFixed(2)),
    };
  }

  function updateItem(index: number, patch: Partial<SalesOrderItem>) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const next = { ...it, ...patch };
        return recalc(next);
      }),
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }

  function findProduct(id?: string): Product | undefined {
    return store.products.find((p) => p.id === id);
  }

  function findSku(productId?: string, skuId?: string): ProductSku | undefined {
    const product = findProduct(productId);
    return product?.skus.find((s) => s.id === skuId);
  }

  function buildOrder(status: string): SalesOrder {
    const customer = store.customers.find((c) => c.id === customerId);
    const orderNo = `SO-${new Date().getFullYear()}-${String(store.salesOrders.length + 1).padStart(4, "0")}`;
    const contract = store.contracts.find((c) => c.id === contractId);

    return {
      id: nanoid(),
      order_no: orderNo,
      order_type: "B2B",
      channel: "批发",
      customer_id: customerId,
      customer_name: customer?.name || "",
      currency,
      trade_term: tradeTerm === "none" ? "" : tradeTerm,
      destination,
      delivery_date: deliveryDate,
      total_amount: totalAmount,
      status,
      created_at: new Date().toISOString(),
      contract_id: contractId || undefined,
      contract_no: contract?.contract_no,
      items: items.map((it) => ({ ...it, amount: recalc(it).amount })),
      logs: [
        {
          status,
          operator: currentUserName,
          time: new Date().toISOString().slice(0, 16).replace("T", " "),
          remark: status === "pending" ? "保存草稿" : "提交订单",
        },
      ],
    };
  }

  function validate(): string | null {
    if (!customerId) return "请选择客户";
    if (!orderDate) return "请填写订单日期";
    if (!deliveryDate) return "请填写预计交货日期";
    if (deliveryDate <= orderDate) return "预计交货日期必须晚于订单日期";
    if (items.length === 0) return "请至少添加一个产品";

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.product_id) return `请完善第 ${i + 1} 行产品信息：选择产品`;
      if (!it.sku_id) return `请完善第 ${i + 1} 行产品信息：选择SKU`;
      if (!it.quantity || it.quantity <= 0) return `第 ${i + 1} 行订单数量必须为正整数`;
      if (it.unit_price === undefined || it.unit_price <= 0) return `第 ${i + 1} 行单价必须大于0`;
    }

    const keys = new Set<string>();
    for (const it of items) {
      const key = `${it.product_id}-${it.sku_id}`;
      if (keys.has(key)) {
        const product = findProduct(it.product_id);
        const sku = findSku(it.product_id, it.sku_id);
        return `产品 ${product?.name || ""} 的SKU ${sku?.specification || ""} 已存在，请勿重复添加`;
      }
      keys.add(key);
    }

    return null;
  }

  function checkStock(): { ok: boolean; message?: string } {
    const insufficient: { productName: string; skuSummary: string; qty: number; stock: number }[] = [];
    for (const it of items) {
      const product = findProduct(it.product_id);
      const sku = findSku(it.product_id, it.sku_id);
      const inventory = store.inventory.find(
        (inv) => inv.type === "product" && inv.product_id === it.product_id,
      );
      const stock = inventory?.quantity || 0;
      if (it.quantity > stock) {
        insufficient.push({
          productName: product?.name || "",
          skuSummary: sku?.specification || "",
          qty: it.quantity,
          stock,
        });
      }
    }
    if (insufficient.length === 0) return { ok: true };

    const detail = insufficient
      .map((x) => `产品 ${x.productName} 的SKU ${x.skuSummary} 库存不足，当前可用库存为 ${x.stock}，订单数量为 ${x.qty}`)
      .join("；");
    return { ok: false, message: `${detail}。是否继续提交？` };
  }

  async function handleSubmit(finalStatus: "pending" | "confirmed") {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    if (finalStatus === "confirmed") {
      const stockCheck = checkStock();
      if (!stockCheck.ok) {
        const confirmed = window.confirm(stockCheck.message);
        if (!confirmed) return;
      }
    }

    setLoading(true);
    try {
      const order = buildOrder(finalStatus);
      await store.addSalesOrder(order);
      toast.success(finalStatus === "pending" ? "草稿已保存" : "销售订单已提交");
      handleClose();
    } catch (e) {
      toast.error("保存失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建销售订单</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 基础信息 */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>
                客户名称 <span className="text-destructive">*</span>
              </Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择客户" />
                </SelectTrigger>
                <SelectContent>
                  {store.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>客户联系人</Label>
              <Input value={customer?.contact || ""} readOnly placeholder="选择客户后自动带出" />
            </div>
            <div className="grid gap-2">
              <Label>联系电话</Label>
              <Input value={customer?.phone || ""} readOnly placeholder="选择客户后自动带出" />
            </div>
            <div className="grid gap-2">
              <Label>收货地址</Label>
              <Input value={customer?.address || ""} readOnly placeholder="选择客户后自动带出" />
            </div>
            <div className="grid gap-2">
              <Label>
                订单日期 <span className="text-destructive">*</span>
              </Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>
                预计交货日期 <span className="text-destructive">*</span>
              </Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>币种</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="选择币种" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>关联合同</Label>
              <Select value={contractId || "none"} onValueChange={(v) => setContractId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择关联合同" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无</SelectItem>
                  {store.contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contract_no} - {c.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>贸易条款</Label>
              <Select value={tradeTerm} onValueChange={setTradeTerm}>
                <SelectTrigger>
                  <SelectValue placeholder="选择贸易条款" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无</SelectItem>
                  {TRADE_TERMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>目的地</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="请输入目的地" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>备注</Label>
              <Textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="最多200字"
                maxLength={200}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">{remark.length}/200</p>
            </div>
          </div>

          {/* 产品明细 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">产品明细</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-4 w-4" />
                添加产品
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">产品名称</TableHead>
                    <TableHead className="whitespace-nowrap">SKU规格</TableHead>
                    <TableHead className="whitespace-nowrap">颜色</TableHead>
                    <TableHead className="whitespace-nowrap">数量</TableHead>
                    <TableHead className="whitespace-nowrap">单价</TableHead>
                    <TableHead className="whitespace-nowrap">小计</TableHead>
                    <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const product = findProduct(item.product_id);
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={item.product_id || ""}
                            onValueChange={(value) => {
                              const p = store.products.find((x) => x.id === value);
                              updateItem(index, {
                                product_id: value,
                                product_code: p?.code || "",
                                product_name: p?.name || "",
                                sku_id: "",
                                sku_summary: "",
                                unit: "件",
                                unit_price: 0,
                              });
                            }}
                          >
                            <SelectTrigger className="min-w-[140px]">
                              <SelectValue placeholder="选择产品" />
                            </SelectTrigger>
                            <SelectContent>
                              {store.products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.code} {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.sku_id || ""}
                            onValueChange={(value) => {
                              const sku = findSku(item.product_id, value);
                              updateItem(index, {
                                sku_id: value,
                                sku_summary: sku?.specification || "",
                                color: sku?.color || "",
                                unit_price: sku?.suggested_price || 0,
                                unit: sku?.unit || "件",
                              });
                            }}
                            disabled={!item.product_id}
                          >
                            <SelectTrigger className="min-w-[140px]">
                              <SelectValue placeholder={item.product_id ? "选择SKU" : "请先选择产品"} />
                            </SelectTrigger>
                            <SelectContent>
                              {(product?.skus || []).map((sku) => (
                                <SelectItem key={sku.id} value={sku.id}>
                                  {sku.specification}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.color || "-"}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity || ""}
                            onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value || "0", 10) })}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={item.unit_price || ""}
                            onChange={(e) => updateItem(index, { unit_price: parseFloat(e.target.value || "0") })}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            disabled={items.length <= 1}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end">
              <div className="text-base font-semibold">
                订单总金额：<span className="text-primary">{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 md:flex-row">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button variant="secondary" onClick={() => handleSubmit("pending")} disabled={loading}>
            保存草稿
          </Button>
          <Button onClick={() => handleSubmit("confirmed")} disabled={loading}>
            提交订单
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

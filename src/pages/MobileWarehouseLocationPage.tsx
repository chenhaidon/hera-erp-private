import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Package,
  MapPin,
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  ChevronLeft,
  UserX,
} from "lucide-react";
import { useAppStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import type { Inventory, Material, Product, WarehouseType } from "@/types";
import { nanoid } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MoveMode = "menu" | "in" | "out";
type SelectedItem =
  | { type: "material"; data: Material }
  | { type: "product"; data: Product }
  | null;

const ALLOWED_ROLES = ["admin", "warehouse"];

function deriveWarehouseType(type?: string): WarehouseType {
  return type === "成品仓" ? "finished_goods" : "raw_material";
}

export function MobileWarehouseLocationPage() {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get("locationId") || "";
  const store = useAppStore();
  const { profile } = useAuth();

  const [mode, setMode] = useState<MoveMode>("menu");
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);

  const role = (profile?.role || store.currentRole) as string;
  const canAccess = ALLOWED_ROLES.includes(role);

  const location = useMemo(
    () => store.warehouseLocations.find((l) => l.id === locationId),
    [store.warehouseLocations, locationId],
  );

  // 兼容旧库位：自动补全 warehouse_type
  useEffect(() => {
    if (!location) return;
    if (location.warehouse_type) return;
    const next: WarehouseType = deriveWarehouseType(location.type);
    store.updateWarehouseLocation({ ...location, warehouse_type: next });
  }, [location, store]);

  const warehouseType: WarehouseType = useMemo(
    () => location?.warehouse_type || deriveWarehouseType(location?.type),
    [location],
  );

  const items = useMemo(() => {
    const list = store.inventory.filter((i) => i.location_id === locationId);
    // 按 产品/物料 + 颜色/规格 合并，避免同一库位重复显示多条相同库存
    // 成品：同一款号 + 同一颜色 + 同一规格只显示一条；物料：同一编码 + 同一规格只显示一条
    const map = new Map<string, Inventory>();
    for (const i of list) {
      const key =
        i.type === "product"
          ? `product|${i.product_id || ""}|${i.color || ""}|${i.specification || ""}`
          : `material|${i.material_id || ""}|${i.specification || ""}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += i.quantity;
      } else {
        map.set(key, { ...i });
      }
    }
    return Array.from(map.values());
  }, [store.inventory, locationId]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      if (i.type === "product") {
        const p = store.products.find((x) => x.id === i.product_id);
        return (
          (p?.name || "").toLowerCase().includes(q) ||
          (p?.code || "").toLowerCase().includes(q) ||
          (i.color || "").toLowerCase().includes(q) ||
          (i.specification || "").toLowerCase().includes(q)
        );
      }
      const m = store.materials.find((x) => x.id === i.material_id);
      return (
        (m?.name || "").toLowerCase().includes(q) ||
        (m?.code || "").toLowerCase().includes(q) ||
        (i.specification || "").toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery, store.products, store.materials]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // 出库：只能从当前库位已有库存中选择
    if (mode === "out") {
      if (warehouseType === "finished_goods") {
        const productIds = new Set(
          items.filter((i) => i.type === "product" && i.quantity > 0).map((i) => i.product_id),
        );
        return store.products
          .filter(
            (p) =>
              productIds.has(p.id) &&
              (p.name.toLowerCase().includes(q) ||
                p.code.toLowerCase().includes(q)),
          )
          .slice(0, 20);
      }
      const materialIds = new Set(
        items.filter((i) => i.type === "material" && i.quantity > 0).map((i) => i.material_id),
      );
      return store.materials
        .filter(
          (m) =>
            materialIds.has(m.id) &&
            (m.name.toLowerCase().includes(q) ||
              m.code.toLowerCase().includes(q)),
        )
        .slice(0, 20);
    }

    // 入库：可以从全部档案中选择
    if (warehouseType === "finished_goods") {
      return store.products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q),
        )
        .slice(0, 20);
    }
    return store.materials
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.code.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [query, store.products, store.materials, warehouseType, mode, items]);

  const currentStock = useMemo(() => {
    if (!selectedItem) return null;
    return items.find((i) =>
      selectedItem.type === "product"
        ? i.product_id === selectedItem.data.id
        : i.material_id === selectedItem.data.id,
    );
  }, [selectedItem, items]);

  function resetFlow() {
    setMode("menu");
    setQuery("");
    setSelectedItem(null);
    setQuantity("");
  }

  function handleConfirm() {
    if (!location || !selectedItem) return;
    const qty = Number(quantity);
    if (!quantity || Number.isNaN(qty) || qty <= 0) {
      toast.error("请输入有效的数量");
      return;
    }

    setLoading(true);

    try {
      const existing = currentStock;
      const isOut = mode === "out";

      if (isOut) {
        if (!existing || existing.quantity < qty) {
          toast.error("库存不足，无法出库");
          setLoading(false);
          return;
        }
      }

      let target: Inventory;
      if (existing) {
        target = {
          ...existing,
          quantity: isOut
            ? Math.max(0, existing.quantity - qty)
            : existing.quantity + qty,
        };
        store.updateInventory(target);
      } else {
        target = {
          id: nanoid(),
          type: selectedItem.type,
          quantity: qty,
          min_stock: 0,
          max_stock: 999999,
          warehouse: location.warehouse,
          location_id: location.id,
          ...(selectedItem.type === "product"
            ? { product_id: selectedItem.data.id }
            : { material_id: selectedItem.data.id }),
        };
        store.addInventory(target);
      }

      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toTimeString().slice(0, 5).replace(":", "");
      const prefix = isOut ? "CK" : "RK";
      const recordNo = `${prefix}-${dateStr.replace(/-/g, "")}-${timeStr}-${Math.floor(
        Math.random() * 1000,
      )
        .toString()
        .padStart(3, "0")}`;

      const handler = profile?.full_name || profile?.username || "手动录入";
      const record: import("@/types").StockRecord = {
        id: nanoid(),
        record_no: recordNo,
        type: isOut ? "out" : "in",
        subtype: "manual",
        quantity: qty,
        warehouse: location.warehouse,
        location_id: location.id,
        related_order: "手动录入",
        handler,
        record_date: dateStr,
        remark: `移动端${isOut ? "出库" : "入库"}`,
        ...(selectedItem.type === "product"
          ? {
              product_id: selectedItem.data.id,
              product_code: selectedItem.data.code,
              product_name: selectedItem.data.name,
            }
          : {
              material_id: selectedItem.data.id,
              product_code: selectedItem.data.code,
              product_name: selectedItem.data.name,
            }),
      };
      store.addStockRecord(record);

      toast.success(`${isOut ? "出库" : "入库"}成功：${qty}${selectedItem.type === "product" ? "件" : selectedItem.data.unit}`);
      resetFlow();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  if (!canAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-6 text-center">
        <UserX className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-lg font-semibold">暂无权限</p>
        <p className="mt-2 text-sm text-muted-foreground">
          该功能仅对仓库管理员和系统管理员开放
        </p>
      </div>
    );
  }

  if (!locationId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6 text-center">
        <div>
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            缺少库位参数，请扫描有效的库位二维码
          </p>
        </div>
      </div>
    );
  }

  if (locationId && !location) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6 text-center">
        <div>
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-4 text-muted-foreground">
            未找到该库位，请确认二维码是否有效
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted p-4">
      <div className="mx-auto max-w-md space-y-4">
        {/* 库位信息 */}
        <div className="rounded-2xl bg-card p-6 shadow-sm text-center">
          <p className="text-sm text-muted-foreground">当前库位</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {location?.code || locationId}
          </h1>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>{location?.warehouse}</span>
            <span>·</span>
            <span>{warehouseType === "finished_goods" ? "成品仓" : "物料仓"}</span>
          </div>
          <Badge
            className="mt-3"
            variant={location?.status === "active" ? "default" : "secondary"}
          >
            {location?.status === "active" ? "启用" : "停用"}
          </Badge>
        </div>

        {/* 主操作区 */}
        {mode === "menu" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                size="lg"
                className="h-32 flex-col gap-3 rounded-2xl text-lg"
                onClick={() => setMode("in")}
              >
                <ArrowDownToLine className="h-8 w-8" />
                入库
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-32 flex-col gap-3 rounded-2xl text-lg"
                onClick={() => setMode("out")}
              >
                <ArrowUpFromLine className="h-8 w-8" />
                出库
              </Button>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>库存明细</span>
                <span className="ml-auto">{filteredItems.length} 项</span>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索名称/款号/颜色/规格"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                {filteredItems.map((i) => (
                  <InventoryCard key={i.id} item={i} />
                ))}
                {filteredItems.length === 0 && (
                  <Card>
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      {searchQuery ? "未找到匹配的库存" : "该库位暂无库存"}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {(mode === "in" || mode === "out") && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={resetFlow}
            >
              <ChevronLeft className="h-4 w-4" />
              返回
            </Button>

            {!selectedItem && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={
                      warehouseType === "finished_goods"
                        ? "搜索成品名称或款号"
                        : "搜索物料名称或编码"
                    }
                    className="h-14 pl-10 text-base"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                  />
                </div>

                {query.trim() && searchResults.length === 0 && (
                  <Card>
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      未找到匹配的物品
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {warehouseType === "finished_goods"
                    ? (searchResults as Product[]).map((p) => (
                        <button
                          key={p.id}
                          className="w-full rounded-xl bg-card p-4 text-left shadow-sm active:scale-[0.99] transition-transform"
                          onClick={() =>
                            setSelectedItem({ type: "product", data: p })
                          }
                        >
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-sm text-muted-foreground">
                            款号：{p.code}
                          </p>
                        </button>
                      ))
                    : (searchResults as Material[]).map((m) => (
                        <button
                          key={m.id}
                          className="w-full rounded-xl bg-card p-4 text-left shadow-sm active:scale-[0.99] transition-transform"
                          onClick={() =>
                            setSelectedItem({ type: "material", data: m })
                          }
                        >
                          <p className="font-semibold">{m.name}</p>
                          <p className="text-sm text-muted-foreground">
                            编码：{m.code} · 规格：{m.specification || "-"}
                          </p>
                        </button>
                      ))}
                </div>
              </div>
            )}

            {selectedItem && (
              <div className="space-y-4">
                <Card className="rounded-2xl">
                  <CardContent className="space-y-4 p-5">
                    <div>
                      <Label className="text-muted-foreground">当前库位</Label>
                      <p className="text-lg font-semibold">
                        {location?.code}（{location?.warehouse}）
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">所选物品</Label>
                      <p className="text-lg font-semibold">
                        {selectedItem.data.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedItem.type === "product"
                          ? `款号：${selectedItem.data.code}`
                          : `编码：${selectedItem.data.code} · 规格：${selectedItem.data.specification || "-"}`}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        当前库存
                      </Label>
                      <p className="text-lg font-semibold">
                        {currentStock ? currentStock.quantity : 0}{" "}
                        {selectedItem.type === "product"
                          ? "件"
                          : selectedItem.data.unit}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="qty" className="text-muted-foreground">
                        {mode === "in" ? "入库数量" : "出库数量"}
                      </Label>
                      <Input
                        id="qty"
                        type="number"
                        min={1}
                        step={1}
                        placeholder="请输入数量"
                        className="mt-1 h-14 text-center text-2xl font-bold"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </CardContent>
                </Card>

                <Button
                  size="lg"
                  className={cn(
                    "h-16 w-full rounded-2xl text-lg font-semibold",
                    mode === "out" && "bg-destructive hover:bg-destructive/90",
                  )}
                  disabled={loading}
                  onClick={handleConfirm}
                >
                  {loading
                    ? "处理中..."
                    : mode === "in"
                      ? "确认入库"
                      : "确认出库"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InventoryCard({ item }: { item: Inventory }) {
  const store = useAppStore();

  if (item.type === "product") {
    const product = store.products.find((p) => p.id === item.product_id);
    const skuColor = item.sku_id
      ? product?.skus?.find((s) => s.id === item.sku_id)?.color
      : undefined;
    const image = product?.images?.[0];
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
              {image ? (
                <img
                  src={image}
                  alt={product?.name || ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  无图
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
                {product?.name || "未知成品"}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                款号：{product?.code || "-"}
              </p>
              {(item.color || skuColor) && (
                <p className="text-sm text-muted-foreground truncate">
                  颜色：{item.color || skuColor || "-"}
                </p>
              )}
              {(item.specification || product?.specification) && (
                <p className="text-sm text-muted-foreground truncate">
                  规格：{item.specification || product?.specification || "-"}
                </p>
              )}
              <p className="mt-2 text-lg font-bold text-primary">
                {item.quantity} 件
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const material = store.materials.find((m) => m.id === item.material_id);
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-semibold text-foreground">
          {material?.name || "未知物料"}
        </p>
        <p className="text-sm text-muted-foreground">
          物料编码：{material?.code || "-"}
        </p>
        <p className="text-sm text-muted-foreground">
          规格：{material?.specification || "-"}
        </p>
        <p className="mt-2 text-lg font-bold text-primary">
          {item.quantity} {material?.unit || "件"}
        </p>
      </CardContent>
    </Card>
  );
}

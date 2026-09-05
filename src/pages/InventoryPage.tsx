import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppStore } from "@/store";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Warehouse,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  Package,
  Search,
  CheckCircle2,
  TrendingUp,
  Clock,
  QrCode,
  MapPin,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import JSZip from "jszip";
import type {
  Inventory,
  WarehouseLocation,
  WarehouseType,
  StockRecord,
  AlertNotification,
  FinishedGoodsInbound,
} from "@/types";
import { nanoid } from "@/lib/utils";
import { syncSalesOrderStatusFromProduction } from "@/lib/production";
import QRCodeDataUrl from "@/components/ui/qrcodedataurl";

function now() {
  return new Date().toISOString();
}

export function InventoryPage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "product";

  useEffect(() => {
    // 自动检查库存预警
    const lowItems = store.inventory.filter((i) => i.quantity < i.min_stock);
    if (lowItems.length === 0) return;

    lowItems.forEach((i) => {
      const name =
        i.type === "product"
          ? store.products.find((p) => p.id === i.product_id)?.name
          : store.materials.find((m) => m.id === i.material_id)?.name;
      const title = `${name || i.id} 库存低于安全库存`;
      const exists = store.alertNotifications.some(
        (n) =>
          n.type === "inventory_low" &&
          n.title === title &&
          n.status !== "resolved",
      );
      if (!exists) {
        const alert: AlertNotification = {
          id: nanoid(),
          type: "inventory_low",
          title,
          content: `当前库存 ${i.quantity}，安全库存 ${i.min_stock}，请及时补货。`,
          target_id: i.product_id || i.material_id,
          status: "unread",
          created_at: new Date().toISOString().split("T")[0],
        };
        store.addAlertNotification(alert);
        toast.warning(title, { description: alert.content });
      }
    });
  }, [store]);

  function updateUrlTab(next: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", next);
    navigate(`/inventory?${nextParams.toString()}`, { replace: true });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="库存管理"
        description="成品与物料库存、出入库、盘点与预警"
      />
      <ControlledTabs
        modulePath="/inventory"
        defaultTab={initialTab}
        onActiveTabChange={updateUrlTab}
      >
        <TabsList className="bg-muted">
          <TabsTrigger value="product">成品库存</TabsTrigger>
          <TabsTrigger value="material">物料库存</TabsTrigger>
          <TabsTrigger value="location">库位管理</TabsTrigger>
          <TabsTrigger value="finished_inbound">成品入库</TabsTrigger>
          <TabsTrigger value="records">出入库管理</TabsTrigger>
          <TabsTrigger value="check">库存盘点</TabsTrigger>
        </TabsList>
        <ProductInventoryTab />
        <MaterialInventoryTab />
        <LocationManagementTab />
        <FinishedGoodsInboundTab />
        <StockRecordsTab />
        <StockCheckTab />
      </ControlledTabs>
    </div>
  );
}

/* ─── 公共库位单元格 ───────────────────────────────────────── */

function LocationCell({ locationId }: { locationId?: string }) {
  const store = useAppStore();
  const navigate = useNavigate();
  const location = useMemo(
    () => store.warehouseLocations.find((l) => l.id === locationId),
    [store.warehouseLocations, locationId],
  );
  if (!locationId || !location)
    return <span className="text-muted-foreground text-xs">未分配</span>;
  return (
    <Button
      variant="link"
      className="h-auto p-0 text-xs"
      onClick={() =>
        navigate(`/inventory?tab=location&locationId=${locationId}`)
      }
    >
      <MapPin className="mr-1 h-3 w-3" />
      {location.code}
    </Button>
  );
}

function EditableLocationCell({ item }: { item: Inventory }) {
  const store = useAppStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const location = useMemo(
    () => store.warehouseLocations.find((l) => l.id === item.location_id),
    [store.warehouseLocations, item.location_id],
  );
  const candidates = useMemo(
    () => store.warehouseLocations.filter((l) => l.warehouse === item.warehouse),
    [store.warehouseLocations, item.warehouse],
  );

  async function save() {
    if (!selected) return;
    await store.updateInventory({ ...item, location_id: selected });
    setOpen(false);
    toast.success("库位配置已保存");
  }

  if (!item.location_id || !location)
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs text-muted-foreground"
          onClick={() => {
            setSelected(candidates[0]?.id || "");
            setOpen(true);
          }}
        >
          未分配
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
            <DialogHeader>
              <DialogTitle>配置库位</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {item.warehouse} · 请选择库位
              </p>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择库位" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button onClick={save}>保存</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );

  return (
    <Button
      variant="link"
      className="h-auto p-0 text-xs"
      onClick={() =>
        navigate(`/inventory?tab=location&locationId=${item.location_id}`)
      }
    >
      <MapPin className="mr-1 h-3 w-3" />
      {location.code}
    </Button>
  );
}

/* ─── 成品库存 ───────────────────────────────────────────── */

function ProductInventoryTab() {
  const store = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const lowOnly = searchParams.get("low") === "1";

  const warehouses = useMemo(
    () => Array.from(new Set(store.inventory.map((i) => i.warehouse))),
    [store.inventory],
  );

  const data = useMemo(() => {
    let list = store.inventory.filter((i) => i.type === "product");
    if (lowOnly) list = list.filter((i) => i.quantity < i.min_stock);
    if (search) {
      list = list.filter((i) => {
        const p = store.products.find((pr) => pr.id === i.product_id);
        const sku = p?.skus?.find((s) => s.id === i.sku_id);
        const fields = [
          p?.name,
          p?.code,
          p?.specification,
          sku?.specification,
          sku?.color,
        ];
        return fields.some((f) => f?.toLowerCase().includes(search.toLowerCase()));
      });
    }
    if (warehouseFilter !== "all")
      list = list.filter((i) => i.warehouse === warehouseFilter);
    return list;
  }, [store.inventory, store.products, search, warehouseFilter, lowOnly]);

  const lowCount = data.filter((i) => i.quantity < i.min_stock).length;

  const {
    paginatedItems: dataPaginated,
    currentPage: dataCurrentPage,
    pageSize: dataPageSize,
    totalPages: dataTotalPages,
    totalItems: dataTotalItems,
    setPage: setDataPage,
    setPageSize: setDataPageSize,
  } = usePagination(data);

  return (
    <TabsContent value="product" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">SKU总数</p>
              <p className="text-xl font-bold">{data.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            if (lowOnly) next.delete("low");
            else next.set("low", "1");
            setSearchParams(next, { replace: true });
          }}
          className="cursor-pointer transition-colors hover:border-destructive/50 hover:bg-destructive/5"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">库存预警</p>
              <p className="text-xl font-bold">{lowCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">正常库存</p>
              <p className="text-xl font-bold">{data.length - lowCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索品名/款号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部仓库</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">款号</TableHead>
                <TableHead className="whitespace-nowrap">品名</TableHead>
                <TableHead className="whitespace-nowrap">规格</TableHead>
                <TableHead className="whitespace-nowrap">颜色</TableHead>
                <TableHead className="whitespace-nowrap">单位</TableHead>
                <TableHead className="whitespace-nowrap">仓库</TableHead>
                <TableHead className="whitespace-nowrap">所在库位</TableHead>
                <TableHead className="whitespace-nowrap text-right">数量</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataPaginated.map((i) => {
                const product = store.products.find(
                  (p) => p.id === i.product_id,
                );
                const sku = product?.skus?.find((s) => s.id === i.sku_id);
                const isLow = i.quantity < i.min_stock;
                return (
                  <TableRow
                    key={i.id}
                    className={isLow ? "bg-destructive/5" : ""}
                  >
                    <TableCell className="whitespace-nowrap font-medium">
                      {product?.code || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {product?.name || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {sku?.specification || product?.specification || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {sku?.color ||
                        product?.skus?.map((s) => s.color).filter(Boolean).join(
                          ", ",
                        ) ||
                        "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {product?.unit || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {i.warehouse}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <EditableLocationCell item={i} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {Number(i.quantity).toFixed(2)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isLow ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          预警
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">
                          正常
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={dataCurrentPage}
            totalPages={dataTotalPages}
            pageSize={dataPageSize}
            totalItems={dataTotalItems}
            onPageChange={setDataPage}
            onPageSizeChange={setDataPageSize}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}

/* ─── 物料库存 ───────────────────────────────────────────── */

function MaterialInventoryTab() {
  const store = useAppStore();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const warehouses = useMemo(
    () =>
      Array.from(
        new Set(
          store.inventory
            .filter((i) => i.type === "material")
            .map((i) => i.warehouse),
        ),
      ),
    [store.inventory],
  );

  const data = useMemo(() => {
    let list = store.inventory.filter((i) => i.type === "material");
    if (search) {
      list = list.filter((i) => {
        const m = store.materials.find((mt) => mt.id === i.material_id);
        return m && (m.name.includes(search) || m.code.includes(search));
      });
    }
    if (warehouseFilter !== "all")
      list = list.filter((i) => i.warehouse === warehouseFilter);
    // 将 MAT-QUILT-THREAD-橄榄绿 排在最后
    return list.sort((a, b) => {
      const getCode = (i: typeof a) =>
        store.materials.find((m) => m.id === i.material_id)?.code || "";
      const isA = getCode(a) === "MAT-QUILT-THREAD-橄榄绿";
      const isB = getCode(b) === "MAT-QUILT-THREAD-橄榄绿";
      if (isA && !isB) return 1;
      if (!isA && isB) return -1;
      return 0;
    });
  }, [store.inventory, store.materials, search, warehouseFilter]);

  const lowCount = data.filter((i) => i.quantity < i.min_stock).length;

  const {
    paginatedItems: dataPaginated,
    currentPage: dataCurrentPage,
    pageSize: dataPageSize,
    totalPages: dataTotalPages,
    totalItems: dataTotalItems,
    setPage: setDataPage,
    setPageSize: setDataPageSize,
  } = usePagination(data);

  return (
    <TabsContent value="material" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">物料种类</p>
              <p className="text-xl font-bold">{data.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">库存预警</p>
              <p className="text-xl font-bold">{lowCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">正常库存</p>
              <p className="text-xl font-bold">{data.length - lowCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索物料名称/编码"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部仓库</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">物料编码</TableHead>
                <TableHead className="whitespace-nowrap">名称</TableHead>
                <TableHead className="whitespace-nowrap">规格</TableHead>
                <TableHead className="whitespace-nowrap">颜色</TableHead>
                <TableHead className="whitespace-nowrap">仓库</TableHead>
                <TableHead className="whitespace-nowrap">所在库位</TableHead>
                <TableHead className="whitespace-nowrap text-right">数量</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataPaginated.map((i) => {
                const material = store.materials.find(
                  (m) => m.id === i.material_id,
                );
                const isLow = i.quantity < i.min_stock;
                return (
                  <TableRow
                    key={i.id}
                    className={isLow ? "bg-destructive/5" : ""}
                  >
                    <TableCell className="whitespace-nowrap font-medium">
                      {material?.code || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {material?.name || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {i.specification || material?.specification || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {i.color || material?.color || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {i.warehouse}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <EditableLocationCell item={i} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {Number(i.quantity).toFixed(2)} {material?.unit}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isLow ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          预警
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">
                          正常
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={dataCurrentPage}
            totalPages={dataTotalPages}
            pageSize={dataPageSize}
            totalItems={dataTotalItems}
            onPageChange={setDataPage}
            onPageSizeChange={setDataPageSize}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}

/* ─── 库位管理 ───────────────────────────────────────────── */

const WAREHOUSE_TYPES = ["成品仓", "面料仓", "填充仓", "辅料仓", "包材仓"];

function LocationManagementTab() {
  const store = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLocations, setQrLocations] = useState<WarehouseLocation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailLocationId, setDetailLocationId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<WarehouseLocation>>({
    status: "active",
    capacity: 100,
    type: "成品仓",
    zone: "A",
    row: "01",
    layer: "01",
  });
  const [typeFilter, setTypeFilter] = useState("all");

  const preselectedLocationId = searchParams.get("locationId");

  const locations = useMemo(
    () =>
      store.warehouseLocations
        .slice()
        .sort(
          (a, b) =>
            a.warehouse.localeCompare(b.warehouse) ||
            a.code.localeCompare(b.code),
        ),
    [store.warehouseLocations],
  );

  const occupancyMap = useMemo(() => {
    const map = new Map<string, number>();
    store.inventory.forEach((i) => {
      if (!i.location_id) return;
      map.set(
        i.location_id,
        (map.get(i.location_id) || 0) + (i.quantity || 0),
      );
    });
    return map;
  }, [store.inventory]);

  const filteredLocations = useMemo(() => {
    let list = locations;
    if (preselectedLocationId) {
      list = list.filter((l) => l.id === preselectedLocationId);
    } else if (typeFilter !== "all") {
      list = list.filter((l) => l.type === typeFilter);
    }
    return list;
  }, [locations, preselectedLocationId, typeFilter]);

  function buildCode(zone?: string, row?: string, layer?: string) {
    const z = (zone || "A").toUpperCase();
    const r = String(row || "01").padStart(2, "0");
    const l = String(layer || "01").padStart(2, "0");
    return `${z}-${r}-${l}`;
  }

  const zonePattern = /^[A-Z]$/;
  const segmentPattern = /^[0-9]{2}$/;

  function validateLocationForm() {
    if (!form.warehouse || !form.capacity) return "请填写完整库位信息";
    if (!zonePattern.test(form.zone || "")) return "区域必须为单个大写字母";
    if (!segmentPattern.test(form.row || "")) return "货架号必须为两位数字";
    if (!segmentPattern.test(form.layer || "")) return "层位号必须为两位数字";
    return "";
  }

  function deriveWarehouseType(type?: string): WarehouseType {
    return type === "成品仓" ? "finished_goods" : "raw_material";
  }

  function deriveDefaultContents(type?: string): string {
    switch (type) {
      case "成品仓":
        return "成品";
      case "面料仓":
        return "面料";
      case "填充仓":
        return "填充物";
      case "辅料仓":
        return "辅料";
      case "包材仓":
        return "包材";
      default:
        return "";
    }
  }

  function save() {
    const error = validateLocationForm();
    if (error) {
      toast.error(error);
      return;
    }
    const code = buildCode(form.zone, form.row, form.layer);
    const contents =
      (form.contents || "").trim() || deriveDefaultContents(form.type);
    const payload: WarehouseLocation = {
      ...(form as WarehouseLocation),
      code,
      warehouse_type: deriveWarehouseType(form.type),
      contents,
      id: nanoid(),
      created_at: new Date().toISOString().split("T")[0],
    };
    store.addWarehouseLocation(payload);
    setOpen(false);
    setForm({ status: "active", capacity: 100, type: "成品仓", zone: "A", row: "01", layer: "01" });
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelectedIds(new Set(filteredLocations.map((l) => l.id)));
    else setSelectedIds(new Set());
  }

  function generateQRCodes(items: WarehouseLocation[]) {
    setQrLocations(items);
    setQrOpen(true);
  }

  /* ─── 库位二维码标签：二维码 + 仓库/库位文字，返回 PNG dataURL ─── */
  async function generateLocationQrPng(l: WarehouseLocation): Promise<string> {
    const qrDataUrl = await QRCode.toDataURL(locationUrl(l.id), {
      width: 200,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise<void>((resolve) => {
      qrImg.onload = () => resolve();
    });

    const scale = 6;
    const W = 100 * scale;
    const H = 100 * scale;
    const titleH = 12 * scale;
    const bodyH = H - titleH;
    const rows = 6;
    const rowH = bodyH / rows;
    const labelW = 26 * scale;
    const qrColW = 35 * scale;
    const valueW = W - labelW - qrColW;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return qrDataUrl;

    // 背景
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // 标题
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${3.5 * scale}px sans-serif`;
    ctx.fillText("库位标签卡", W / 2, titleH / 2);

    // 外边框
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, titleH, W, bodyH);

    // 竖线
    ctx.beginPath();
    ctx.moveTo(labelW, titleH);
    ctx.lineTo(labelW, H);
    ctx.moveTo(labelW + valueW, titleH);
    ctx.lineTo(labelW + valueW, H);
    ctx.stroke();

    // 横线（仅左侧两列）
    for (let i = 1; i < rows; i++) {
      const y = titleH + i * rowH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(labelW + valueW, y);
      ctx.stroke();
    }

    // 标签与值
    const labels = [
      "库位编号",
      "所属仓库",
      "库存内容",
      "区域",
      "货架号",
      "层位号",
    ];
    const values = [
      l.code,
      l.warehouse,
      l.contents || "-",
      l.zone || "-",
      l.row || "-",
      l.layer || "-",
    ];
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const labelFont = `bold ${2.8 * scale}px sans-serif`;
    const valueFont = `${2.8 * scale}px sans-serif`;
    const pad = 2 * scale;
    for (let i = 0; i < rows; i++) {
      const y = titleH + i * rowH + rowH / 2;
      ctx.font = labelFont;
      ctx.fillText(labels[i], pad, y);
      ctx.font = valueFont;
      ctx.fillText(values[i], labelW + pad, y);
    }

    // 二维码
    const qrSize = 24 * scale;
    const qrX = labelW + valueW + (qrColW - qrSize) / 2;
    const qrY = titleH + (bodyH - qrSize) / 2;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // 二维码下方文字
    ctx.textAlign = "center";
    ctx.font = `${2.2 * scale}px sans-serif`;
    ctx.fillText(
      "二维码",
      labelW + valueW + qrColW / 2,
      qrY + qrSize + 3 * scale,
    );

    return canvas.toDataURL("image/png");
  }

  /* ─── 单个库位 100mm×100mm 流转卡样式 HTML（与生产流转卡格式一致）─── */
  function buildLocationCardHtml(l: WarehouseLocation, qrSrc: string): string {
    // 移除容量、状态、创建日期、扫码定位后共 6 行，二维码占满右侧 6 行
    return `
      <div class="location-print-card">
        <div class="text-center font-bold text-base py-2 print:py-1">库位标签卡</div>
        <div class="grid grid-cols-[26mm_1fr_35mm] border border-border" style="grid-template-rows: repeat(6, calc((100mm - 8mm) / 6)) !important;">
          <div class="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">库位编号</span></div>
          <div class="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">${l.code}</span></div>
          <div class="flex flex-col items-center justify-center gap-2 px-3 border-b overflow-hidden" style="grid-row: span 6 / span 6 !important;">
            <img src="${qrSrc}" alt="${l.code}" style="width:24mm;height:24mm" />
            <div class="flex flex-col items-center gap-0.5 w-full">
              <span class="text-xs text-muted-foreground">二维码</span>
            </div>
          </div>

          <div class="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">所属仓库</span></div>
          <div class="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">${l.warehouse}</span></div>

          <div class="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">库存内容</span></div>
          <div class="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">${l.contents || "-"}</span></div>

          <div class="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">区域</span></div>
          <div class="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">${l.zone || "-"}</span></div>

          <div class="border-r border-b px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">货架号</span></div>
          <div class="border-r border-b px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">${l.row || "-"}</span></div>

          <div class="border-r px-3 py-3 text-sm font-medium flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">层位号</span></div>
          <div class="px-3 py-3 text-sm flex items-center whitespace-nowrap overflow-hidden"><span class="truncate">${l.layer || "-"}</span></div>
        </div>
      </div>`;
  }

  /* ─── 批量导出：单张直接下载 PNG，多张打包 ZIP ─── */
  async function batchExportQr() {
    const selected = locations.filter((l) => selectedIds.has(l.id));
    if (selected.length === 0) {
      toast.error("请先勾选要导出的库位");
      return;
    }
    try {
      if (selected.length === 1) {
        const dataUrl = await generateLocationQrPng(selected[0]);
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `库位二维码-${selected[0].code || "unknown"}.png`;
        link.click();
        return;
      }
      toast.info("正在打包库位二维码，请稍候…");
      const zip = new JSZip();
      await Promise.all(
        selected.map(async (l) => {
          const dataUrl = await generateLocationQrPng(l);
          const base64 = dataUrl.split(",")[1];
          const safeName = l.code.replace(/[\\/:*?"<>|]/g, "_");
          zip.file(`库位二维码-${safeName}.png`, base64, { base64: true });
        }),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `库位二维码批量导出-${selected.length}个.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("导出失败，请重试");
    }
  }

  /* ─── 批量打印：复用全局 .print-card 样式，每张 100mm×100mm 分页 ─── */
  async function batchPrintQr(items?: WarehouseLocation[]) {
    const list = items ?? locations.filter((l) => selectedIds.has(l.id));
    if (list.length === 0) {
      toast.error("请先勾选要打印的库位");
      return;
    }
    try {
      const cards = await Promise.all(
        list.map(async (l) => ({
          code: l.code,
          html: buildLocationCardHtml(
            l,
            await QRCode.toDataURL(locationUrl(l.id), {
              width: 200,
              margin: 1,
              errorCorrectionLevel: "L",
              color: { dark: "#000000", light: "#ffffff" },
            }),
          ),
        })),
      );

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.top = "-9999px";
      iframe.style.width = "100mm";
      iframe.style.height = "100mm";
      iframe.style.border = "none";
      iframe.style.visibility = "hidden";
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        toast.error("打印失败，请重试");
        return;
      }

      const styles = Array.from(
        document.querySelectorAll("style, link[rel='stylesheet']"),
      )
        .map((el) => {
          if (el.tagName === "STYLE") {
            return `<style>${el.textContent}</style>`;
          }
          return `<link rel="stylesheet" href="${(el as HTMLLinkElement).href}">`;
        })
        .join("");

      // 每张卡片独立一页：使用独立 class 避免被全局 .print-card 的 fixed 定位覆盖
      const cardPages = cards
        .map(
          (c) =>
            `<div class="print-page">${c.html}</div>`,
        )
        .join("");

      doc.open();
      doc.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>库位标签卡打印</title>
${styles}
<style>
  @page { size: 100mm 100mm; margin: 0; }
  body { margin: 0; padding: 0; background: #fff; }
  .print-page {
    width: 100mm;
    height: 100mm;
    box-sizing: border-box;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
  }
  .print-page:last-child { page-break-after: auto; break-after: auto; }
  .location-print-card {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    background: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .location-print-card .text-center {
    font-size: 11pt;
    font-weight: bold;
    text-align: center;
    height: 8mm;
    line-height: 8mm;
    flex-shrink: 0;
  }
</style>
</head>
<body>
${cardPages}
</body>
</html>`);
      doc.close();

      // 等待二维码图片加载完成后再打印
      const images = Array.from(doc.querySelectorAll("img"));
      let loaded = 0;
      const total = images.length;

      function doPrint() {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }

      if (total === 0) {
        setTimeout(doPrint, 100);
      } else {
        // 先统计已加载完成的图片，再为未完成的注册事件
        images.forEach((img) => {
          if (img.complete) loaded++;
        });
        if (loaded === total) {
          doPrint();
        } else {
          images.forEach((img) => {
            if (!img.complete) {
              img.onload = () => {
                loaded++;
                if (loaded === total) doPrint();
              };
              img.onerror = () => {
                loaded++;
                if (loaded === total) doPrint();
              };
            }
          });
        }
      }
    } catch {
      toast.error("打印失败，请重试");
    }
  }

  function locationUrl(id: string) {
    // 基于当前页面目录生成入口 URL，避免 hash 路由在部分扫码器/浏览器中被截断或解析异常。
    // 应用启动时会通过启动脚本统一重定向到 hash 路由。
    const base = window.location.href
      .replace(/#.*$/, "")
      .replace(/\?.*$/, "")
      .replace(/\/[^/]*$/, "/");
    return `${base}?r=mobile/warehouse/location&locationId=${id}`;
  }

  function clearFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete("locationId");
    setSearchParams(next, { replace: true });
  }

  const {
    paginatedItems: filteredLocationsPaginated,
    currentPage: filteredLocationsCurrentPage,
    pageSize: filteredLocationsPageSize,
    totalPages: filteredLocationsTotalPages,
    totalItems: filteredLocationsTotalItems,
    setPage: setFilteredLocationsPage,
    setPageSize: setFilteredLocationsPageSize,
  } = usePagination(filteredLocations);

  function InventoryDetailCard({ item }: { item: Inventory }) {
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
                    规格：
                    {item.specification || product?.specification || "-"}
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

  function LocationDetailDialog({
    locationId,
    onClose,
  }: {
    locationId: string | null;
    onClose: () => void;
  }) {
    const [searchQuery, setSearchQuery] = useState("");
    const location = useMemo(
      () => store.warehouseLocations.find((l) => l.id === locationId),
      [locationId],
    );
    const warehouseType = useMemo(
      () => location?.warehouse_type || deriveWarehouseType(location?.type),
      [location],
    );

    const items = useMemo(() => {
      const list = store.inventory.filter((i) => i.location_id === locationId);
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
    }, [locationId]);

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

    if (!location) return null;

    return (
      <Dialog open={!!locationId} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>库位详情</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-card p-6 shadow-sm text-center border">
              <p className="text-sm text-muted-foreground">当前库位</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight">
                {location.code}
              </h2>
              <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>{location.warehouse}</span>
                <span>·</span>
                <span>
                  {warehouseType === "finished_goods" ? "成品仓" : "物料仓"}
                </span>
              </div>
              <Badge
                className="mt-3"
                variant={
                  location.status === "active" ? "default" : "secondary"
                }
              >
                {location.status === "active" ? "启用" : "停用"}
              </Badge>
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
                  <InventoryDetailCard key={i.id} item={i} />
                ))}
                {filteredItems.length === 0 && (
                  <Card>
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      {searchQuery
                        ? "未找到匹配的库存"
                        : "该库位暂无库存"}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <TabsContent value="location" className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">库位管理</h3>
          {preselectedLocationId && (
            <Button variant="outline" size="sm" onClick={clearFilter}>
              清除筛选
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                generateQRCodes(locations.filter((l) => selectedIds.has(l.id)))
              }
            >
              <QrCode className="mr-1 h-4 w-4" />
              批量生成二维码 ({selectedIds.size})
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={batchExportQr}
            >
              <ArrowDownToLine className="mr-1 h-4 w-4" />
              导出二维码 ({selectedIds.size})
            </Button>
          )}
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => batchPrintQr()}
            >
              <Printer className="mr-1 h-4 w-4" />
              打印二维码 ({selectedIds.size})
            </Button>
          )}
          <Button size="sm" onClick={() => setOpen(true)}>
            <Package className="mr-1 h-4 w-4" />
            新建库位
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={typeFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setTypeFilter("all")}
        >
          全部 ({locations.length})
        </Button>
        {WAREHOUSE_TYPES.map((t) => (
          <Button
            key={t}
            variant={typeFilter === t ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter(t)}
          >
            {t} ({locations.filter((l) => l.type === t).length})
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      selectedIds.size === filteredLocations.length &&
                      filteredLocations.length > 0
                    }
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                </TableHead>
                <TableHead className="whitespace-nowrap">库位编号</TableHead>
                <TableHead className="whitespace-nowrap">仓库类型</TableHead>
                <TableHead className="whitespace-nowrap">所属仓库</TableHead>
                <TableHead className="whitespace-nowrap">库存内容</TableHead>
                <TableHead className="whitespace-nowrap">
                  当前库存占用
                </TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLocationsPaginated.map((l) => {
                const occupancy = occupancyMap.get(l.id) || 0;
                return (
                  <TableRow
                    key={l.id}
                    className="cursor-pointer"
                    onClick={() => setDetailLocationId(l.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(l.id)}
                        onCheckedChange={() => toggleSelect(l.id)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {l.code}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="secondary">{l.type}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {l.warehouse}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {l.contents || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {occupancy}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        variant={
                          l.status === "active" ? "default" : "secondary"
                        }
                      >
                        {l.status === "active" ? "启用" : "停用"}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateQRCodes([l])}
                      >
                        <QrCode className="mr-1 h-3 w-3" />
                        生成二维码
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredLocations.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无库位数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={filteredLocationsCurrentPage}
            totalPages={filteredLocationsTotalPages}
            pageSize={filteredLocationsPageSize}
            totalItems={filteredLocationsTotalItems}
            onPageChange={setFilteredLocationsPage}
            onPageSizeChange={setFilteredLocationsPageSize}
          />
        </CardContent>
      </Card>
      <LocationDetailDialog
        locationId={detailLocationId}
        onClose={() => setDetailLocationId(null)}
      />
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setForm({ status: "active", capacity: 100, type: "成品仓", zone: "A", row: "01", layer: "01" });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建库位</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>仓库类型</Label>
              <Select
                value={form.type || "成品仓"}
                onValueChange={(v) => setForm({ ...form, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>所属仓库</Label>
              <Input
                value={form.warehouse || ""}
                onChange={(e) =>
                  setForm({ ...form, warehouse: e.target.value })
                }
                placeholder="如：面料仓"
              />
            </div>
            <div className="grid gap-2">
              <Label>库位编号</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">区域</span>
                  <Input
                    value={form.zone || ""}
                    onChange={(e) =>
                      setForm({ ...form, zone: e.target.value.toUpperCase() })
                    }
                    placeholder="A"
                    maxLength={1}
                  />
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">货架</span>
                  <Input
                    value={form.row || ""}
                    onChange={(e) =>
                      setForm({ ...form, row: e.target.value })
                    }
                    placeholder="01"
                    maxLength={2}
                  />
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">层位</span>
                  <Input
                    value={form.layer || ""}
                    onChange={(e) =>
                      setForm({ ...form, layer: e.target.value })
                    }
                    placeholder="01"
                    maxLength={2}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                组合编号：{buildCode(form.zone, form.row, form.layer)}
              </p>
            </div>
            <div className="grid gap-2">
              <Label>库存内容</Label>
              <Input
                value={form.contents || ""}
                onChange={(e) =>
                  setForm({ ...form, contents: e.target.value })
                }
                placeholder="如：成品、面料、填充物、辅料、包材"
              />
            </div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select
                value={form.status || "active"}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as "active" | "inactive" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={qrOpen}
        onOpenChange={(v) => {
          setQrOpen(v);
          if (!v) setQrLocations([]);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>库位二维码</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4 md:grid-cols-2">
            {qrLocations.map((l) => (
              <Card key={l.id} className="flex flex-col items-center p-4">
                <div className="text-center mb-2">
                  <p className="font-semibold">{l.code}</p>
                  <p className="text-xs text-muted-foreground">{l.warehouse}</p>
                </div>
                <QRCodeDataUrl text={locationUrl(l.id)} width={160} />
                <p className="mt-2 text-xs text-center break-all max-w-[200px]">
                  {locationUrl(l.id)}
                </p>
              </Card>
            ))}
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            <Button
              variant="outline"
              onClick={() => batchExportQr()}
              disabled={qrLocations.length === 0}
            >
              <ArrowDownToLine className="mr-1 h-4 w-4" />
              导出二维码 ({qrLocations.length})
            </Button>
            <Button
              variant="outline"
              onClick={() => batchPrintQr(qrLocations)}
              disabled={qrLocations.length === 0}
            >
              <Printer className="mr-1 h-4 w-4" />
              打印 ({qrLocations.length})
            </Button>
            <Button onClick={() => setQrOpen(false)}>关闭</Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 出入库管理 ──────────────────────────────────────────── */

function StockRecordsTab() {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<StockRecord>>({
    type: "in",
    subtype: "采购入库",
    record_date: new Date().toISOString().split("T")[0],
    handler: currentUserName,
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | StockRecord["type"]>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");

  const records = useMemo(
    () =>
      store.stockRecords
        .filter((r) => {
          if (!search) return true;
          const s = search.toLowerCase();
          const productName =
            store.products.find((p) => p.id === r.product_id)?.name || "";
          const materialName =
            store.materials.find((m) => m.id === r.material_id)?.name || "";
          return (
            (r.contract_no || "").toLowerCase().includes(s) ||
            r.record_no.toLowerCase().includes(s) ||
            (r.related_order || "").toLowerCase().includes(s) ||
            r.subtype.includes(s) ||
            productName.toLowerCase().includes(s) ||
            materialName.toLowerCase().includes(s) ||
            (r.remark || "").toLowerCase().includes(s)
          );
        })
        .filter((r) => typeFilter === "all" || r.type === typeFilter)
        .filter((r) => warehouseFilter === "all" || r.warehouse === warehouseFilter)
        .slice()
        .sort((a, b) => b.record_date.localeCompare(a.record_date)),
    [store.stockRecords, store.products, store.materials, search, typeFilter, warehouseFilter],
  );

  function save() {
    if (!form.type || !form.subtype || !form.quantity || !form.warehouse)
      return;
    const payload: StockRecord = {
      id: nanoid(),
      record_no:
        form.type === "in"
          ? `IN-${Date.now().toString().slice(-6)}`
          : form.type === "out"
            ? `OUT-${Date.now().toString().slice(-6)}`
            : `TK-${Date.now().toString().slice(-6)}`,
      type: form.type,
      subtype: form.subtype,
      product_id: form.product_id || "",
      material_id: form.material_id || "",
      quantity: Number(form.quantity),
      warehouse: form.warehouse,
      location_id: form.location_id,
      related_order: form.related_order || "",
      related_order_id: form.related_order_id,
      contract_no: form.contract_no || "",
      handler: form.handler || currentUserName || "系统",
      record_date: form.record_date || new Date().toISOString().split("T")[0],
    };
    store.addStockRecord(payload);
    // 同步更新库存数量
    const target = store.inventory.find(
      (i) =>
        (payload.product_id && i.product_id === payload.product_id) ||
        (payload.material_id && i.material_id === payload.material_id),
    );
    if (target) {
      const delta =
        payload.type === "in"
          ? payload.quantity
          : payload.type === "out"
            ? -payload.quantity
            : 0;
      const updated: Inventory = {
        ...target,
        quantity: target.quantity + delta,
      };
      store.setInventory(
        store.inventory.map((i) => (i.id === target.id ? updated : i)),
      );
    }
    setOpen(false);
    setForm({
      type: "in",
      subtype: "采购入库",
      record_date: new Date().toISOString().split("T")[0],
      handler: currentUserName,
    });
  }

  const subtypeMap: Record<string, string[]> = {
    in: ["采购入库", "生产入库", "退货入库", "调拨入库"],
    out: ["销售出库", "领料出库", "调拨出库", "报废出库"],
    take: ["盘点盈亏"],
  };

  const allInventory = store.inventory;

  const warehouses = useMemo(
    () => [...new Set(store.stockRecords.map((r) => r.warehouse))].sort(),
    [store.stockRecords],
  );

  const {
    paginatedItems: recordsPaginated,
    currentPage: recordsCurrentPage,
    pageSize: recordsPageSize,
    totalPages: recordsTotalPages,
    totalItems: recordsTotalItems,
    setPage: setRecordsPage,
    setPageSize: setRecordsPageSize,
  } = usePagination(records);

  return (
    <TabsContent value="records" className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="搜索单号/业务类型/产品/合同编号"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-64"
        />
        <Button onClick={() => {
          setForm({ type: "in", subtype: "采购入库", record_date: new Date().toISOString().split("T")[0], handler: currentUserName });
          setOpen(true);
        }}>
          <ArrowDownToLine className="mr-2 h-4 w-4" />
          出入库操作
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">单号</TableHead>
                <TableHead className="whitespace-nowrap min-w-[96px]">
                  <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                    <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0 text-foreground shadow-none hover:text-primary focus:ring-0 [&>svg]:ml-auto">
                      <span className="font-medium">类型</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="in">入库</SelectItem>
                      <SelectItem value="out">出库</SelectItem>
                      <SelectItem value="take">盘点</SelectItem>
                    </SelectContent>
                  </Select>
                </TableHead>
                <TableHead className="whitespace-nowrap">业务类型</TableHead>
                <TableHead className="whitespace-nowrap">产品/物料</TableHead>
                <TableHead className="whitespace-nowrap">数量</TableHead>
                <TableHead className="whitespace-nowrap min-w-[120px]">
                  <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                    <SelectTrigger className="h-7 w-full border-0 bg-transparent p-0 text-foreground shadow-none hover:text-primary focus:ring-0 [&>svg]:ml-auto">
                      <span className="font-medium">仓库</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部仓库</SelectItem>
                      {warehouses.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableHead>
                <TableHead className="whitespace-nowrap">经办人</TableHead>
                <TableHead className="whitespace-nowrap">库位</TableHead>
                <TableHead className="whitespace-nowrap">关联单据</TableHead>
                <TableHead className="whitespace-nowrap">合同编号</TableHead>
                <TableHead className="whitespace-nowrap">日期</TableHead>
                <TableHead className="whitespace-nowrap">备注</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsPaginated.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {r.record_no}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.type === "in" ? (
                      <Badge variant="default" className="bg-green-500">
                        <ArrowDownToLine className="mr-1 h-3 w-3" />
                        入库
                      </Badge>
                    ) : r.type === "out" ? (
                      <Badge variant="destructive">
                        <ArrowUpFromLine className="mr-1 h-3 w-3" />
                        出库
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <RotateCcw className="mr-1 h-3 w-3" />
                        盘点
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.subtype}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {store.products.find((p) => p.id === r.product_id)?.name ||
                      store.materials.find((m) => m.id === r.material_id)
                        ?.name ||
                      "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.quantity}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.warehouse}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.handler}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <LocationCell locationId={r.location_id} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {r.related_order || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {r.contract_no || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.record_date ? new Date(r.record_date).toISOString().slice(0, 10) : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {r.remark || "-"}
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={recordsCurrentPage}
            totalPages={recordsTotalPages}
            pageSize={recordsPageSize}
            totalItems={recordsTotalItems}
            onPageChange={setRecordsPage}
            onPageSizeChange={setRecordsPageSize}
          />
        </CardContent>
      </Card>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v)
            setForm({
              type: "in",
              subtype: "采购入库",
              record_date: new Date().toISOString().split("T")[0],
            });
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>出入库操作</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>操作类型</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    type: v as "in" | "out" | "take",
                    subtype: subtypeMap[v][0],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">入库</SelectItem>
                  <SelectItem value="out">出库</SelectItem>
                  <SelectItem value="take">盘点</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>业务类型</Label>
              <Select
                value={form.subtype}
                onValueChange={(v) => setForm({ ...form, subtype: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(subtypeMap[form.type || "in"] || []).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>库存项</Label>
              <Select
                value={form.product_id || form.material_id || ""}
                onValueChange={(v) => {
                  const item = allInventory.find((i) => i.id === v);
                  if (item) {
                    setForm({
                      ...form,
                      product_id: item.product_id || "",
                      material_id: item.material_id || "",
                      warehouse: item.warehouse,
                      location_id: item.location_id,
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allInventory.map((i) => {
                    const name =
                      i.type === "product"
                        ? store.products.find((p) => p.id === i.product_id)
                            ?.name
                        : store.materials.find((m) => m.id === i.material_id)
                            ?.name;
                    return (
                      <SelectItem key={i.id} value={i.id}>
                        {name} ({i.warehouse})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>数量</Label>
              <Input
                type="number"
                value={form.quantity || ""}
                onChange={(e) =>
                  setForm({ ...form, quantity: Number(e.target.value) })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>仓库</Label>
              <Select
                value={form.warehouse || ""}
                onValueChange={(v) =>
                  setForm({ ...form, warehouse: v, location_id: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择仓库" />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set(store.warehouseLocations.map((l) => l.warehouse))]
                    .sort()
                    .map((w) => (
                      <SelectItem key={w} value={w}>
                        {w}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>库位</Label>
              <Select
                value={form.location_id || ""}
                onValueChange={(v) => setForm({ ...form, location_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择库位" />
                </SelectTrigger>
                <SelectContent>
                  {store.warehouseLocations
                    .filter((l) => l.warehouse === form.warehouse)
                    .map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.code}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>关联单号</Label>
              {["采购入库"].includes(form.subtype || "") ? (
                <Select
                  value={form.related_order_id || "none"}
                  onValueChange={(v) => {
                    const o = store.purchaseOrders.find((x) => x.id === v);
                    setForm({
                      ...form,
                      related_order_id: o?.id,
                      related_order: o?.order_no,
                      contract_no: o?.contract_no,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择采购订单" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联</SelectItem>
                    {store.purchaseOrders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.order_no} - {o.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : ["销售出库", "退货入库"].includes(form.subtype || "") ? (
                <Select
                  value={form.related_order_id || "none"}
                  onValueChange={(v) => {
                    const o = store.salesOrders.find((x) => x.id === v);
                    setForm({
                      ...form,
                      related_order_id: o?.id,
                      related_order: o?.order_no,
                      contract_no: o?.contract_no,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择销售订单" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联</SelectItem>
                    {store.salesOrders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.order_no} - {o.customer_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : ["生产入库", "领料出库"].includes(form.subtype || "") ? (
                <Select
                  value={form.related_order_id || "none"}
                  onValueChange={(v) => {
                    const o = store.workOrders.find((x) => x.id === v);
                    setForm({
                      ...form,
                      related_order_id: o?.id,
                      related_order: o?.work_no,
                      contract_no: o?.contract_no,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择生产工单" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不关联</SelectItem>
                    {store.workOrders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.work_no} - {o.product_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.related_order || ""}
                  onChange={(e) =>
                    setForm({ ...form, related_order: e.target.value })
                  }
                  placeholder="如调拨单/盘点单号"
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label>经办人</Label>
              <Input
                value={form.handler || ""}
                onChange={(e) => setForm({ ...form, handler: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>日期</Label>
              <Input
                type="date"
                value={form.record_date || ""}
                onChange={(e) =>
                  setForm({ ...form, record_date: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>提交</Button>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

/* ─── 库存盘点 ───────────────────────────────────────────── */

function StockCheckTab() {
  const store = useAppStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actualMap, setActualMap] = useState<Record<string, number>>({});
  const [started, setStarted] = useState(false);

  const allItems = store.inventory;

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function generateCheck() {
    setStarted(true);
    const map: Record<string, number> = {};
    allItems.forEach((i) => {
      map[i.id] = i.quantity;
    });
    setActualMap(map);
    setSelectedIds(new Set(allItems.map((i) => i.id)));
  }

  function submitCheck() {
    selectedIds.forEach((id) => {
      const item = store.inventory.find((i) => i.id === id);
      if (!item) return;
      const actual = actualMap[id] ?? item.quantity;
      const diff = actual - item.quantity;
      if (diff !== 0) {
        const record: StockRecord = {
          id: nanoid(),
          record_no: `TK-${Date.now().toString().slice(-6)}`,
          type: "take",
          subtype: "盘点盈亏",
          product_id: item.product_id || "",
          material_id: item.material_id || "",
          quantity: Math.abs(diff),
          warehouse: item.warehouse,
          related_order: "",
          handler: "盘点员",
          record_date: new Date().toISOString().split("T")[0],
          actual_qty: actual,
          profit_loss: diff,
        };
        store.addStockRecord(record);
        const updated: Inventory = { ...item, quantity: actual };
        store.setInventory(
          store.inventory.map((i) => (i.id === id ? updated : i)),
        );
      }
    });
    setStarted(false);
    setSelectedIds(new Set());
    setActualMap({});
  }

  const {
    paginatedItems: allItemsPaginated,
    currentPage: allItemsCurrentPage,
    pageSize: allItemsPageSize,
    totalPages: allItemsTotalPages,
    totalItems: allItemsTotalItems,
    setPage: setAllItemsPage,
    setPageSize: setAllItemsPageSize,
  } = usePagination(allItems);

  return (
    <TabsContent value="check" className="space-y-4">
      {!started ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              生成盘点单，选择盘点范围，录入实际数量，系统自动计算盈亏并生成盘点记录。
            </p>
            <Button onClick={generateCheck}>
              <RotateCcw className="mr-2 h-4 w-4" />
              生成全库盘点单
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              已选择 {selectedIds.size} 项，录入实际数量后提交盘点。
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStarted(false);
                  setSelectedIds(new Set());
                  setActualMap({});
                }}
              >
                取消
              </Button>
              <Button onClick={submitCheck}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                提交盘点
              </Button>
            </div>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">选择</TableHead>
                    <TableHead className="whitespace-nowrap">名称</TableHead>
                    <TableHead className="whitespace-nowrap">仓库</TableHead>
                    <TableHead className="whitespace-nowrap">
                      系统数量
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      实际数量
                    </TableHead>
                    <TableHead className="whitespace-nowrap">盈亏</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allItemsPaginated.map((i) => {
                    const name =
                      i.type === "product"
                        ? store.products.find((p) => p.id === i.product_id)
                            ?.name
                        : store.materials.find((m) => m.id === i.material_id)
                            ?.name;
                    const actual = actualMap[i.id] ?? i.quantity;
                    const diff = actual - i.quantity;
                    return (
                      <TableRow key={i.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(i.id)}
                            onChange={() => toggleSelect(i.id)}
                            className="h-4 w-4"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {name || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {i.warehouse}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {i.quantity}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Input
                            type="number"
                            className="w-24"
                            value={actual}
                            onChange={(e) =>
                              setActualMap({
                                ...actualMap,
                                [i.id]: Number(e.target.value),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {diff > 0 ? (
                            <span className="text-green-600">+{diff}</span>
                          ) : diff < 0 ? (
                            <span className="text-destructive">{diff}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                currentPage={allItemsCurrentPage}
                totalPages={allItemsTotalPages}
                pageSize={allItemsPageSize}
                totalItems={allItemsTotalItems}
                onPageChange={setAllItemsPage}
                onPageSizeChange={setAllItemsPageSize}
              />
            </CardContent>
          </Card>
        </>
      )}
    </TabsContent>
  );
}

/* ─── 周转率分析 ──────────────────────────────────────────── */

function TurnoverTab() {
  const store = useAppStore();
  const [typeFilter, setTypeFilter] = useState<"all" | "product" | "material">(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | "slow" | "dead" | "normal"
  >("all");

  const data = useMemo(() => {
    let list = store.inventoryTurnovers;
    if (typeFilter !== "all")
      list = list.filter((t) => t.item_type === typeFilter);
    if (statusFilter !== "all")
      list = list.filter((t) => t.status === statusFilter);
    return list.sort((a, b) => b.days - a.days);
  }, [store.inventoryTurnovers, typeFilter, statusFilter]);

  const slowCount = store.inventoryTurnovers.filter(
    (t) => t.status === "slow",
  ).length;
  const deadCount = store.inventoryTurnovers.filter(
    (t) => t.status === "dead",
  ).length;

  function statusBadge(status: string) {
    if (status === "dead")
      return (
        <Badge variant="destructive">
          <AlertTriangle className="mr-1 h-3 w-3" />
          呆滞
        </Badge>
      );
    if (status === "slow")
      return (
        <Badge variant="secondary">
          <Clock className="mr-1 h-3 w-3" />
          周转慢
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-green-600">
        正常
      </Badge>
    );
  }

  const {
    paginatedItems: dataPaginated,
    currentPage: dataCurrentPage,
    pageSize: dataPageSize,
    totalPages: dataTotalPages,
    totalItems: dataTotalItems,
    setPage: setDataPage,
    setPageSize: setDataPageSize,
  } = usePagination(data);

  return (
    <TabsContent value="turnover" className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">分析项数</p>
              <p className="text-xl font-bold">
                {store.inventoryTurnovers.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">周转慢</p>
              <p className="text-xl font-bold">{slowCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">呆滞库存</p>
              <p className="text-xl font-bold">{deadCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="product">成品</SelectItem>
            <SelectItem value="material">物料</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="slow">周转慢</SelectItem>
            <SelectItem value="dead">呆滞</SelectItem>
            <SelectItem value="normal">正常</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">编码</TableHead>
                <TableHead className="whitespace-nowrap">名称</TableHead>
                <TableHead className="whitespace-nowrap">类型</TableHead>
                <TableHead className="whitespace-nowrap">月份</TableHead>
                <TableHead className="whitespace-nowrap">期初</TableHead>
                <TableHead className="whitespace-nowrap">入库</TableHead>
                <TableHead className="whitespace-nowrap">出库</TableHead>
                <TableHead className="whitespace-nowrap">期末</TableHead>
                <TableHead className="whitespace-nowrap">周转率</TableHead>
                <TableHead className="whitespace-nowrap">周转天数</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataPaginated.map((t) => (
                <TableRow
                  key={t.id}
                  className={t.status !== "normal" ? "bg-destructive/5" : ""}
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    {t.item_code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.item_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.item_type === "product" ? "成品" : "物料"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.period}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.beginning_qty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.incoming_qty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.outgoing_qty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.ending_qty}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.turnover_rate.toFixed(2)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.days} 天
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {statusBadge(t.status)}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={dataCurrentPage}
            totalPages={dataTotalPages}
            pageSize={dataPageSize}
            totalItems={dataTotalItems}
            onPageChange={setDataPage}
            onPageSizeChange={setDataPageSize}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function parseProductName(productName?: string) {
  if (!productName) return { name: "-", specification: "-", color: "-" };
  const parts = productName.split(" - ");
  return {
    name: parts[0] || "-",
    specification: parts[1] || "-",
    color: parts[2] || "-",
  };
}

/* ─── 成品入库 ───────────────────────────────────────────── */

function FinishedGoodsInboundTab() {
  const store = useAppStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "inbound"
  >("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState<FinishedGoodsInbound | null>(null);
  const [warehouse, setWarehouse] = useState("");
  const [locationId, setLocationId] = useState("");

  const warehouses = useMemo(() => {
    const set = new Set(store.warehouseLocations.map((l) => l.warehouse));
    return Array.from(set);
  }, [store.warehouseLocations]);

  const locations = useMemo(() => {
    if (!warehouse) return [];
    return store.warehouseLocations.filter((l) => l.warehouse === warehouse);
  }, [store.warehouseLocations, warehouse]);

  const data = useMemo(() => {
    let list = [...store.finishedGoodsInbounds];
    if (statusFilter !== "all")
      list = list.filter((i) => i.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.inbound_no.toLowerCase().includes(q) ||
          i.work_no.toLowerCase().includes(q) ||
          i.product_name.toLowerCase().includes(q),
      );
    }
    return list.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [store.finishedGoodsInbounds, statusFilter, search]);

  function openConfirm(item: FinishedGoodsInbound) {
    setSelected(item);
    setWarehouse(item.warehouse || "");
    setLocationId(item.location_id || "");
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (!selected) return;
    if (!warehouse) {
      toast.error("请选择入库仓库");
      return;
    }
    if (!locationId) {
      toast.error("请选择入库库位");
      return;
    }
    const wo = store.workOrders.find((w) => w.id === selected.work_id);
    if (!wo) {
      toast.error("未找到关联工单");
      return;
    }
    const existing = store.inventory.find(
      (i) =>
        i.product_id === selected.product_id &&
        i.warehouse === warehouse &&
        i.location_id === locationId,
    );
    if (existing) {
      store.updateInventory({
        ...existing,
        quantity: existing.quantity + selected.quantity,
      });
    } else {
      store.addInventory({
        id: nanoid(),
        type: "product",
        product_id: selected.product_id,
        quantity: selected.quantity,
        min_stock: 50,
        max_stock: 2000,
        warehouse,
        location_id: locationId,
      });
    }
    store.addStockRecord({
      id: nanoid(),
      record_no: `WI-${Date.now().toString().slice(-6)}`,
      type: "in",
      subtype: "生产入库",
      product_id: selected.product_id,
      quantity: selected.quantity,
      warehouse,
      related_order: selected.work_no,
      related_order_id: selected.work_id,
      handler: "仓库管理员",
      record_date: now(),
    });
    store.updateFinishedGoodsInbound({
      ...selected,
      status: "inbound",
      warehouse,
      location_id: locationId,
      inbound_date: now(),
    });
    store.updateWorkOrder({ ...wo, status: "inbound" });
    syncSalesOrderStatusFromProduction(store);
    toast.success("成品已入库");
    setConfirmOpen(false);
    setSelected(null);
    setWarehouse("");
    setLocationId("");
  }

  const {
    paginatedItems: dataPaginated,
    currentPage: dataCurrentPage,
    pageSize: dataPageSize,
    totalPages: dataTotalPages,
    totalItems: dataTotalItems,
    setPage: setDataPage,
    setPageSize: setDataPageSize,
  } = usePagination(data);

  return (
    <TabsContent value="finished_inbound" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">成品入库单</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索入库单号 / 工单号 / 产品"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">状态</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="pending">待入库</SelectItem>
                  <SelectItem value="inbound">已入库</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">入库单号</TableHead>
                  <TableHead className="whitespace-nowrap">工单号</TableHead>
                  <TableHead className="whitespace-nowrap">产品款号</TableHead>
                  <TableHead className="whitespace-nowrap">名称</TableHead>
                  <TableHead className="whitespace-nowrap">规格</TableHead>
                  <TableHead className="whitespace-nowrap">颜色</TableHead>
                  <TableHead className="whitespace-nowrap">数量</TableHead>
                  <TableHead className="whitespace-nowrap">仓库</TableHead>
                  <TableHead className="whitespace-nowrap">库位</TableHead>
                  <TableHead className="whitespace-nowrap">入库日期</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataPaginated.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {item.inbound_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.work_no}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.product_code}
                    </TableCell>
                    {(() => {
                      const parts = parseProductName(item.product_name);
                      return (
                        <>
                          <TableCell className="whitespace-nowrap">
                            {parts.name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {parts.specification}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {parts.color}
                          </TableCell>
                        </>
                      );
                    })()}
                    <TableCell className="whitespace-nowrap">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.warehouse || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <LocationCell locationId={item.location_id} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.inbound_date || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        variant={
                          item.status === "inbound" ? "default" : "secondary"
                        }
                      >
                        {item.status === "inbound" ? "已入库" : "待入库"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {item.status === "pending" && (
                        <Button size="sm" onClick={() => openConfirm(item)}>
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          确认入库
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className="text-center text-sm text-muted-foreground"
                    >
                      暂无成品入库单
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Pagination
              currentPage={dataCurrentPage}
              totalPages={dataTotalPages}
              pageSize={dataPageSize}
              totalItems={dataTotalItems}
              onPageChange={setDataPage}
              onPageSizeChange={setDataPageSize}
            />
          </div>
        </CardContent>
      </Card>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>确认入库</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">入库单号</span>
                  <p className="font-medium">{selected.inbound_no}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">工单号</span>
                  <p className="font-medium">{selected.work_no}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">产品</span>
                  <p className="font-medium">
                    {(() => {
                      const parts = parseProductName(selected.product_name);
                      return `${parts.name} ${parts.specification !== "-" ? parts.specification : ""} ${parts.color !== "-" ? parts.color : ""}`.trim();
                    })()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">入库数量</span>
                  <p className="font-medium">{selected.quantity}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                请确认入库信息，并选择入库仓库与库位。确认后库存将增加，工单状态将更新为已入库。
              </p>
              <div className="space-y-2">
                <Label htmlFor="inbound-warehouse">
                  入库仓库 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={warehouse}
                  onValueChange={(v) => {
                    setWarehouse(v);
                    setLocationId("");
                  }}
                >
                  <SelectTrigger id="inbound-warehouse">
                    <SelectValue placeholder="请选择仓库" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w} value={w}>
                        {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inbound-location">
                  入库库位 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={locationId}
                  onValueChange={setLocationId}
                  disabled={!warehouse}
                >
                  <SelectTrigger id="inbound-location">
                    <SelectValue
                      placeholder={warehouse ? "请选择库位" : "请先选择仓库"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleConfirm}>确认入库</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

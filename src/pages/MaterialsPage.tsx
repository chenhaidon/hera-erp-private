import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { PageHeader } from "@/components/common/PageHeader";
import { useAppStore } from "@/store";
import { useCanButton } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Package, Plus, Pencil, Trash2, Download, Upload, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  downloadMaterialTemplate,
  parseMaterialExcel,
  type MaterialImportError,
} from "@/lib/materialImport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

export function MaterialsPage() {
  const navigate = useNavigate();
  const store = useAppStore();
  const can = useCanButton();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [warnReason, setWarnReason] = useState("");
  const [importErrors, setImportErrors] = useState<MaterialImportError[]>([]);
  const [importProgress, setImportProgress] = useState<{
    open: boolean;
    status: "running" | "done";
    current: number;
    total: number;
    success: number;
    failed: number;
    failedCodes: string[];
  }>({
    open: false,
    status: "running",
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    failedCodes: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => Array.from(new Set(store.materials.map((m) => m.category))),
    [store.materials],
  );

  const data = useMemo(() => {
    let list = store.materials;
    if (search)
      list = list.filter(
        (m) => m.name.includes(search) || m.code.includes(search),
      );
    if (category !== "all") list = list.filter((m) => m.category === category);
    return list;
  }, [store.materials, search, category]);
  const {
    paginatedItems: pagedData,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    setPage,
    setPageSize,
  } = usePagination(data);

  useEffect(() => {
    setPage(1);
  }, [search, category]);

  function canDelete(material: (typeof store.materials)[number]) {
    const reasons: string[] = [];
    const hasBom = store.products.some((p) =>
      (p.boms || []).some((b) => b.material_id === material.id),
    );
    if (hasBom) reasons.push("BOM");
    const hasPurchase = store.purchaseOrders.some((o) =>
      (o.items || []).some((i) => i.material_id === material.id),
    );
    if (hasPurchase) reasons.push("采购订单");
    const hasSupplier = store.materialSupplierPrices.some(
      (s) => s.material_id === material.id,
    );
    if (hasSupplier) reasons.push("供应商价格");
    return reasons;
  }

  function handleDeleteClick(
    e: React.MouseEvent,
    material: (typeof store.materials)[number],
  ) {
    e.stopPropagation();
    const reasons = canDelete(material);
    if (reasons.length > 0) {
      setSelected(material.id);
      setWarnReason(reasons.join("、"));
      setWarnOpen(true);
      return;
    }
    setSelected(material.id);
    setConfirmOpen(true);
  }

  function confirmDelete() {
    if (!selected) return;
    store.deleteMaterial(selected);
    toast.success("物料删除成功");
    setConfirmOpen(false);
    setSelected(null);
  }

  function closeImportProgress() {
    setImportProgress({
      open: false,
      status: "running",
      current: 0,
      total: 0,
      success: 0,
      failed: 0,
      failedCodes: [],
    });
  }

  function handleDownloadTemplate() {
    downloadMaterialTemplate();
    toast.success("物料导入模板已开始下载");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const result = await parseMaterialExcel(file, store.materials);
    if (!result.success) {
      setImportErrors(result.errors);
      return;
    }

    setImportProgress({
      open: true,
      status: "running",
      current: 0,
      total: result.materials.length,
      success: 0,
      failed: 0,
      failedCodes: [],
    });

    const failedCodes: string[] = [];
    for (let i = 0; i < result.materials.length; i++) {
      const material = result.materials[i];
      try {
        await store.addMaterial(material);
        setImportProgress((prev) => ({
          ...prev,
          current: i + 1,
          success: prev.success + 1,
        }));
      } catch (err) {
        failedCodes.push(material.code);
        setImportProgress((prev) => ({
          ...prev,
          current: i + 1,
          failed: prev.failed + 1,
          failedCodes: [...prev.failedCodes, material.code],
        }));
      }
    }

    setImportProgress((prev) => ({ ...prev, status: "done" }));
    toast.success(
      `物料导入完成，成功创建 ${result.materials.length - failedCodes.length}/${result.materials.length} 个物料`,
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="物料档案"
        description="面料、辅料、填充物等物料基础信息与供应商价格管理"
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">物料总数</p>
              <p className="text-xl font-bold">{store.materials.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">面料</p>
              <p className="text-xl font-bold">
                {store.materials.filter((m) => m.category === "面料").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">辅料</p>
              <p className="text-xl font-bold">
                {store.materials.filter((m) => m.category === "辅料").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">填充物</p>
              <p className="text-xl font-bold">
                {store.materials.filter((m) => m.category === "填充物").length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索物料编码/名称"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">全部类别</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={can("materials", "create") ? "" : "hidden"}>
              <Upload className="mr-1 h-4 w-4" />
              批量导入
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              下载导入模板
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              导入物料 Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button size="sm" onClick={() => navigate("/materials/create")} className={can("materials", "create") ? "" : "hidden"}>
          <Plus className="mr-2 h-4 w-4" />
          新增物料
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">物料编码</TableHead>
                <TableHead className="whitespace-nowrap">名称</TableHead>
                <TableHead className="whitespace-nowrap">类别</TableHead>
                <TableHead className="whitespace-nowrap">规格</TableHead>
                <TableHead className="whitespace-nowrap">单位</TableHead>
                <TableHead className="whitespace-nowrap">门幅</TableHead>
                <TableHead className="whitespace-nowrap">颜色</TableHead>
                <TableHead className="whitespace-nowrap">备注</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedData.map((m) => (
                <TableRow
                  key={m.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/materials/${m.id}`)}
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    {m.code}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{m.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.category}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.specification}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{m.unit}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.width || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.color || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.remark || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={m.status === "active" ? "default" : "secondary"}
                    >
                      {m.status === "active" ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/materials/${m.id}?edit=true`);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteClick(e, m)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {pagedData.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-sm text-muted-foreground"
                  >
                    暂无数据
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="border-t-0 rounded-t-none"
        />
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定删除该物料吗？删除后不可恢复。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>无法删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            该物料已被{warnReason}引用，无法删除，建议停用。
          </p>
          <DialogFooter>
            <Button onClick={() => setWarnOpen(false)}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importErrors.length > 0}
        onOpenChange={(v) => !v && setImportErrors([])}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>导入校验失败</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <p className="text-sm text-muted-foreground">
              请根据以下错误修正后重新上传：
            </p>
            <ScrollArea className="h-64">
              <ul className="space-y-1 pr-4 text-sm">
                {importErrors.map((err, idx) => (
                  <li key={idx} className="rounded-md border p-2">
                    <span className="font-medium">第 {err.row} 行：</span>
                    {err.message}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button onClick={() => setImportErrors([])}>我知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importProgress.open}
        onOpenChange={(v) => !v && closeImportProgress()}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {importProgress.status === "running"
                ? "正在导入物料"
                : "导入完成"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                进度 {importProgress.current}/{importProgress.total}
              </span>
              <span className="font-medium">
                {Math.round(
                  importProgress.total > 0
                    ? (importProgress.current / importProgress.total) * 100
                    : 0,
                )}%
              </span>
            </div>
            <Progress
              value={
                importProgress.total > 0
                  ? (importProgress.current / importProgress.total) * 100
                  : 0
              }
            />
            <div className="grid grid-cols-2 gap-4 text-center text-sm">
              <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:bg-green-950/30">
                <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {importProgress.success}
                </div>
                <div className="text-muted-foreground">成功</div>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:bg-red-950/30">
                <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {importProgress.failed}
                </div>
                <div className="text-muted-foreground">失败</div>
              </div>
            </div>
            {importProgress.status === "done" &&
              importProgress.failedCodes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">失败编码：</p>
                  <ScrollArea className="h-32">
                    <ul className="space-y-1 pr-4 text-sm">
                      {importProgress.failedCodes.map((code, idx) => (
                        <li key={idx} className="text-destructive">
                          {code}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
          </div>
          <DialogFooter>
            {importProgress.status === "done" && (
              <Button onClick={closeImportProgress}>我知道了</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

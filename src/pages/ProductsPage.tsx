import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePagination } from "@/lib/pagination";
import { Pagination } from "@/components/common/Pagination";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useAppStore } from "@/store";
import { useCanButton } from "@/lib/rbac";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { ProductDictionaryTab } from "@/pages/DataDictionaryPage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Eye,
  Package,
  BookOpen,
  Pencil,
  Copy,
  Power,
  Play,
  FileText,
  Trash2,
  Plus,
  Download,
  Upload,
  ImageIcon,
  ChevronDown,
} from "lucide-react";
import { nanoid } from "@/lib/utils";
import { toast } from "sonner";
import { useProductCategoryOptions } from "@/hooks/useDictionaryOptions";
import {
  downloadProductTemplate,
  parseProductExcel,
  type ProductImportError,
  sanitizeFileName,
  compressImage,
} from "@/lib/productImport";
import { supabase } from "@/db/supabase";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Product } from "@/types";

function ProductListTab() {
  const navigate = useNavigate();
  const store = useAppStore();
  const can = useCanButton();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const categoryOptions = useProductCategoryOptions();
  const [importErrors, setImportErrors] = useState<ProductImportError[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
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
  const imageInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return store.products.filter((p) => {
      if (
        s &&
        !p.code.toLowerCase().includes(s) &&
        !p.name.toLowerCase().includes(s) &&
        !p.category.includes(s)
      )
        return false;
      if (category !== "all" && p.category !== category) return false;
      if (status !== "all" && p.status !== status) return false;
      return true;
    });
  }, [store.products, search, category, status]);

  const activeCount = useMemo(
    () => store.products.filter((p) => p.status === "active").length,
    [store.products],
  );
  const inactiveCount = useMemo(
    () => store.products.filter((p) => p.status === "inactive").length,
    [store.products],
  );

  const {
    paginatedItems: paged,
    currentPage: page,
    pageSize,
    totalPages,
    totalItems,
    setPage,
    setPageSize,
  } = usePagination(filtered);

  useEffect(() => {
    setPage(1);
  }, [search, category, status]);

  function handleAdd() {
    navigate("/products/create");
  }

  function handleCopy(p: Product) {
    const copy: Product = {
      ...p,
      id: nanoid(),
      code: `${p.code}-CP`,
      name: `${p.name}（复制）`,
      status: "active",
      skus: p.skus ? p.skus.map((s) => ({ ...s, id: nanoid() })) : [],
      boms: p.boms ? [...p.boms] : [],
    };
    store.addProduct(copy);
    navigate(`/products/${copy.id}`);
  }

  function toggleStatus(p: Product) {
    store.updateProduct({
      ...p,
      status: p.status === "active" ? "inactive" : "active",
    });
  }

  function handleDelete(p: Product) {
    store.removeProduct(p.id);
  }

  function handleDownloadTemplate() {
    downloadProductTemplate();
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
    setImageFiles([]);
  }

  async function uploadImages(files: File[]): Promise<Map<string, string>> {
    const bucket = "product-images";
    const folder = "imports";
    const map = new Map<string, string>();
    const { data: bucketData } = await supabase.storage.getBucket(bucket);
    if (!bucketData) {
      const { error } = await supabase.storage.createBucket(bucket, {
        public: true,
      });
      if (error) throw new Error(`创建图片存储桶失败：${error.message}`);
    }

    for (const file of files) {
      const rawName = file.name;
      let uploadFile = file;
      const maxSize = 1024 * 1024;
      if (file.size > maxSize && file.type.startsWith("image/")) {
        try {
          const blob = await compressImage(file);
          uploadFile = new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
            type: "image/webp",
          });
          toast.info(`${file.name} 已压缩至 ${(uploadFile.size / 1024 / 1024).toFixed(2)}MB`);
        } catch {
          toast.error(`${file.name} 压缩失败`);
          continue;
        }
      }
      if (uploadFile.size > maxSize) {
        toast.error(`${rawName} 超过 1MB，请压缩后重新上传`);
        continue;
      }
      const path = `${folder}/${sanitizeFileName(uploadFile.name)}`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, uploadFile, { contentType: uploadFile.type });
      if (error || !data) {
        toast.error(`${rawName} 上传失败：${error?.message || "未知错误"}`);
      } else {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        map.set(rawName, urlData.publicUrl);
        toast.success(`${rawName} 上传成功`);
      }
    }
    return map;
  }

  function handleImageFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setImageFiles((prev) => [...prev, ...Array.from(files)]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function removeImageFile(name: string) {
    setImageFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const result = await parseProductExcel(
      file,
      store.products,
      categoryOptions,
    );
    if (!result.success) {
      setImportErrors(result.errors);
      return;
    }

    let uploadedImageMap = new Map<string, string>();
    if (result.pendingImages.length > 0 && imageFiles.length > 0) {
      toast.info("正在上传本地图片...");
      uploadedImageMap = await uploadImages(imageFiles);
    }

    const resolveImage = (value: string): string | null => {
      if (/^https?:\/\//i.test(value)) return value;
      return uploadedImageMap.get(value) || null;
    };

    const products = result.products.map((p) => ({
      ...p,
      images: p.images.map(resolveImage).filter((url): url is string => url !== null),
    }));
    setImportProgress({
      open: true,
      status: "running",
      current: 0,
      total: products.length,
      success: 0,
      failed: 0,
      failedCodes: [],
    });

    const failedCodes: string[] = [];
    for (let i = 0; i < products.length; i++) {
      const product = {
        ...products[i],
        id: nanoid(),
        skus: products[i].skus.map((s) => ({ ...s, id: nanoid() })),
      };
      try {
        await store.addProduct(product);
        setImportProgress((prev) => ({
          ...prev,
          current: i + 1,
          success: prev.success + 1,
        }));
      } catch (err) {
        console.error(err);
        failedCodes.push(products[i].code);
        setImportProgress((prev) => ({
          ...prev,
          current: i + 1,
          failed: prev.failed + 1,
          failedCodes: [...prev.failedCodes, products[i].code],
        }));
      }
    }

    setImportProgress((prev) => ({ ...prev, status: "done" }));
    toast.success(
      `成品导入完成，成功创建 ${products.length - failedCodes.length}/${products.length} 个成品`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">成品总数</p>
              <p className="text-2xl font-semibold">{store.products.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">已启用</p>
              <p className="text-2xl font-semibold text-emerald-600">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">已停用</p>
              <p className="text-2xl font-semibold text-slate-500">{inactiveCount}</p>
            </CardContent>
          </Card>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
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
                导入成品 Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                <ImageIcon className="mr-2 h-4 w-4" />
                上传本地图片
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
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageFiles}
          />
          <Button size="sm" onClick={handleAdd} className={can("products-products", "create") ? "" : "hidden"}>
            <Plus className="mr-1 h-4 w-4" />
            新建成品
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="按款号、品名搜索"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="产品类别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类别</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">启用</SelectItem>
            <SelectItem value="inactive">停用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {imageFiles.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">待上传图片（共 {imageFiles.length} 张）</p>
            <div className="flex flex-wrap gap-2">
              {imageFiles.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="max-w-[160px] truncate">{f.name}</span>
                  <span className="text-muted-foreground">
                    ({(f.size / 1024).toFixed(1)}KB)
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeImageFile(f.name)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              提示：Excel 中填写图片文件名（如 pd002.jpg），系统将自动匹配已选图片并上传；也可直接填写图片 URL。
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24 whitespace-nowrap">封面</TableHead>
                  <TableHead className="whitespace-nowrap">款号</TableHead>
                  <TableHead className="whitespace-nowrap">品名</TableHead>
                  <TableHead className="whitespace-nowrap">类别</TableHead>
                  <TableHead className="whitespace-nowrap">SKU 数</TableHead>
                  <TableHead className="whitespace-nowrap">规格预览</TableHead>
                  <TableHead className="whitespace-nowrap">图纸</TableHead>
                  <TableHead className="whitespace-nowrap">状态</TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.images?.[0] ? (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="h-12 w-12 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {p.code}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.category}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.skus?.length || 0}
                    </TableCell>
                    <TableCell className="whitespace-nowrap max-w-[200px] truncate">
                      {p.skus?.length
                        ? p.skus
                            .map((s) => s.specification || s.size || "-")
                            .filter(Boolean)
                            .join(" / ")
                        : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.design_drawing ? (
                        <a
                          href={p.design_drawing}
                          target="_blank"
                          rel="noreferrer"
                          title="查看设计图纸"
                        >
                          <FileText className="h-4 w-4 text-primary" />
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={p.status}
                        options={[
                          {
                            value: "active",
                            label: "启用",
                            color: "bg-emerald-500",
                          },
                          {
                            value: "inactive",
                            label: "停用",
                            color: "bg-slate-500",
                          },
                        ]}
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/products/${p.id}`)}
                          title="详情"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            navigate(`/products/${p.id}?edit=true`)
                          }
                          title="编辑"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(p)}
                          title="复制"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleStatus(p)}
                          title={p.status === "active" ? "停用" : "启用"}
                        >
                          {p.status === "active" ? (
                            <Power className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        {p.status === "inactive" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  删除后不可恢复，确定要删除成品「{p.name}（{p.code}）」吗？
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(p)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              暂无符合条件的产品
            </div>
          )}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            className="border-t-0 rounded-t-none"
          />
        </CardContent>
      </Card>

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
              <ul className="space-y-1 text-sm pr-4">
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
                ? "正在导入成品"
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
                  <p className="text-sm font-medium">失败款号：</p>
                  <ScrollArea className="h-32">
                    <ul className="space-y-1 text-sm pr-4">
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

export function ProductsPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "products";

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="成品档案"
        description="管理家纺成品的规格、工艺、SKU 与基础数据字典"
      />
      <ControlledTabs modulePath="/products" defaultTab={defaultTab}>
        <TabsList className="w-full flex-wrap justify-start md:w-auto">
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            成品档案
          </TabsTrigger>
          <TabsTrigger value="dictionary" className="gap-2">
            <BookOpen className="h-4 w-4" />
            基础数据字典
          </TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <ProductListTab />
        </TabsContent>
        <TabsContent value="dictionary">
          <ProductDictionaryTab />
        </TabsContent>
      </ControlledTabs>
    </div>
  );
}

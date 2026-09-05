import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Trash2,
  GripVertical,
  Star,
  Plus,
  Save,
  Copy,
  FileText,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAppStore } from "@/store";
import { nanoid } from "@/lib/utils";
import { getProductBomsBySku } from "@/lib/utils";
import { supabase } from "@/db/supabase";
import { ORDER_STATUS, getStatusLabel } from "@/lib/data";
import { useProductCategoryOptions } from "@/hooks/useDictionaryOptions";
import type {
  Product,
  ProductSku,
  ProductBom,
  Material,
  ProcessRoute,
  ProcessVersion,
  ProductPricingStrategy,
} from "@/types";
import { ProductProcessTab } from "@/components/products/ProductProcessTab";
import {
  parseBomExcel,
  downloadBomTemplate,
  applySpecMapping,
} from "@/lib/bomImport";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contractId = searchParams.get("contractId");
  const location = useLocation();
  const {
    products,
    salesOrders,
    materials,
    processRoutes,
    processVersions,
    processes,
    updateProduct,
    addProduct,
    addMaterial,
    updateMaterial,
  } = useAppStore();
  const categoryOptions = useProductCategoryOptions();
  const existing = products.find((p) => p.id === id);
  const isCreate = id === "create";
  const startEdit = new URLSearchParams(location.search).get("edit") === "true";
  const [isEditing, setIsEditing] = useState(isCreate || startEdit);
  const [product, setProduct] = useState<Partial<Product>>(() =>
    initProduct(existing, isCreate),
  );

  useEffect(() => {
    setProduct(initProduct(existing, isCreate));
  }, [existing, id, isCreate]);

  const orderHistory = useMemo(
    () =>
      salesOrders.filter((o) =>
        o.items.some((i) => i.product_code === product.code),
      ),
    [salesOrders, product.code],
  );

  const handleSave = async () => {
    if (!product.code?.trim()) {
      toast.error("请填写成品编码");
      return;
    }
    if (!product.name?.trim()) {
      toast.error("请填写成品名称");
      return;
    }
    if (!product.category) {
      toast.error("请选择产品类别");
      return;
    }
    if (!product.unit?.trim()) {
      toast.error("请填写计量单位");
      return;
    }
    const codeExists = products.some(
      (p) => p.code === product.code && p.id !== product.id,
    );
    if (codeExists) {
      toast.error("成品编码已存在，请修改");
      return;
    }
    const skus = product.skus || [];
    if (skus.length === 0) {
      toast.error("请至少添加一个SKU规格");
      return;
    }
    const skuBarcodes = new Set<string>();
    const skuCodes = new Set<string>();
    const skuKeys = new Set<string>();
    for (let i = 0; i < skus.length; i++) {
      const s = skus[i];
      if (!s.size?.trim()) {
        toast.error(`请填写第 ${i + 1} 行SKU的尺寸`);
        return;
      }
      if (s.suggested_price === undefined || s.suggested_price <= 0) {
        toast.error(`第 ${i + 1} 行默认销售价格必须大于0`);
        return;
      }
      // SKU 编码唯一
      const code = (s.sku_code || "").trim();
      if (code) {
        if (skuCodes.has(code)) {
          toast.error(`SKU编码「${code}」已存在，请修改`);
          return;
        }
        skuCodes.add(code);
      }
      // 规格唯一性：同一尺寸、颜色组合不可重复
      const skuKey = [s.size, s.color].map((v) => (v || "").trim()).join("|");
      if (skuKeys.has(skuKey)) {
        toast.error(`规格「${s.size} / ${s.color || "无颜色"}」已存在，请勿重复添加`);
        return;
      }
      skuKeys.add(skuKey);
      // 同一成品下 SKU 条码不可重复
      const key = (s.barcode || "").trim();
      if (key && skuBarcodes.has(key)) {
        toast.error(`条码「${key}」已存在，请勿重复添加`);
        return;
      }
      if (key) skuBarcodes.add(key);
    }
    const boms = product.boms || [];
    for (let i = 0; i < boms.length; i++) {
      const b = boms[i];
      if (!b.material_id && !b.material_name?.trim()) {
        toast.error(`请完善第 ${i + 1} 行BOM物料信息：选择物料或输入物料统称`);
        return;
      }
      if (b.dosage === undefined || b.dosage <= 0) {
        toast.error(`第 ${i + 1} 行用量必须大于0`);
        return;
      }
      if (b.loss_rate !== undefined && (b.loss_rate < 0 || b.loss_rate > 100)) {
        toast.error(`第 ${i + 1} 行损耗率必须在0-100之间`);
        return;
      }
    }

    const payload = {
      ...product,
      id: product.id || nanoid(),
      skus: skus.map((s, idx) => ({
        ...s,
        sku_code: s.sku_code?.trim() || `${product.code}-${String(idx + 1).padStart(3, "0")}`,
        status: s.status || "active",
      })),
      boms: product.boms || [],
      images: product.images || [],
      drawings: product.drawings || [],
      process_list: product.process_list || [],
      process_steps: product.process_steps || [],
      pricing_strategy: {
        ...(product.pricing_strategy || {
          markup_rate: 0.2,
          target_profit_rate: 0.15,
          min_price: 0,
          suggested_price: 0,
        }),
      },
    } as Product;
    if (!existing && !isCreate) return;
    try {
      if (isCreate) await addProduct(payload);
      else await updateProduct(payload);
      navigate(`/products/${payload.id}`);
      setIsEditing(false);
      toast.success("保存成功");
    } catch (err) {
      console.error(err);
      toast.error("保存失败，请稍后重试");
    }
  };

  const toggleStatus = () => {
    if (!existing) return;
    updateProduct({
      ...existing,
      status: existing.status === "active" ? "inactive" : "active",
    });
  };

  const handleCopy = () => {
    if (!existing) return;
    const copy: Product = {
      ...existing,
      id: nanoid(),
      code: `${existing.code}-CP`,
      name: `${existing.name}（复制）`,
      status: "active",
      skus: existing.skus.map((s) => ({
        ...s,
        id: nanoid(),
        sku_code: undefined,
        status: "active",
      })),
    };
    addProduct(copy);
    navigate(`/products/${copy.id}`);
  };

  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingDrawing, setUploadingDrawing] = useState(false);
  const drawingRef = useRef<HTMLInputElement>(null);

  async function ensureDrawingBucket() {
    const { data: bucket } =
      await supabase.storage.getBucket("product-drawings");
    if (!bucket) {
      const { error } = await supabase.storage.createBucket(
        "product-drawings",
        {
          public: true,
          fileSizeLimit: 10 * 1024 * 1024,
          allowedMimeTypes: [
            "image/png",
            "image/jpeg",
            "image/webp",
            "application/pdf",
          ],
        },
      );
      if (error) throw error;
    }
  }

  async function uploadDrawing(file: File) {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
    ];
    const allowedExts = ["pdf", "png", "jpg", "jpeg", "webp", "dwg", "dxf"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      toast.error("请上传 PDF、JPG、PNG、WEBP、DWG 或 DXF 格式的图纸文件");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("产品图纸大小不能超过 20MB");
      return;
    }
    setUploadingDrawing(true);
    try {
      await ensureDrawingBucket();
      const safeExt = allowedExts.includes(ext) ? ext : "pdf";
      const path = `${nanoid()}.${safeExt}`;
      const { error: uploadError } = await supabase.storage
        .from("product-drawings")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage
        .from("product-drawings")
        .getPublicUrl(path);
      setProduct((p) => ({
        ...p,
        drawings: [...(p.drawings || []), data.publicUrl],
      }));
      toast.success("产品图纸上传成功");
    } catch (err) {
      toast.error(
        "产品图纸上传失败：" +
          (err instanceof Error ? err.message : "未知错误"),
      );
    } finally {
      setUploadingDrawing(false);
    }
  }

  function removeDrawing() {
    setProduct((p) => ({ ...p, design_drawing: undefined }));
  }

  async function compressImage(file: File): Promise<Blob> {
    const maxSize = 1024 * 1024; // 1 MB
    if (file.size <= maxSize && file.type === "image/webp") return file;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const maxDim = 1080;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法创建画布上下文"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const tryQuality = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("图片压缩失败"));
                return;
              }
              if (blob.size <= maxSize || quality <= 0.5) {
                resolve(blob);
              } else {
                tryQuality(quality - 0.1);
              }
            },
            "image/webp",
            quality,
          );
        };
        tryQuality(0.8);
      };
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = url;
    });
  }

  const onImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/avif",
    ];
    const invalid = Array.from(files).filter(
      (f) => !allowedTypes.includes(f.type),
    );
    if (invalid.length > 0) {
      toast.error(
        `仅支持 ${allowedTypes.map((t) => t.replace("image/", "")).join("/")} 格式`,
      );
      return;
    }

    setUploadingImages(true);
    const uploadedUrls: string[] = [];
    const bucket = "product-images";

    for (const file of Array.from(files)) {
      try {
        const blob = await compressImage(file);
        const ext =
          blob.type === "image/webp"
            ? "webp"
            : file.name
                .split(".")
                .pop()
                ?.replace(/[^a-z0-9]/gi, "") || "webp";
        const safeName = `${nanoid()}.${ext}`;
        const path = `products/${safeName}`;
        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, blob, {
            cacheControl: "3600",
            upsert: false,
            contentType: blob.type || file.type,
          });
        if (error) throw error;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (data?.publicUrl) uploadedUrls.push(data.publicUrl);
      } catch (err) {
        console.error("[ProductDetail] image upload error:", err);
        toast.error(`${file.name} 上传失败`);
      }
    }

    if (uploadedUrls.length > 0) {
      setProduct((prev) => ({
        ...prev,
        images: [...(prev.images || []), ...uploadedUrls],
      }));
      toast.success(`成功上传 ${uploadedUrls.length} 张图片`);
    }
    setUploadingImages(false);
    e.target.value = "";
  };

  const moveImage = (index: number, dir: number) => {
    const imgs = product.images ? [...product.images] : [];
    const target = index + dir;
    if (target < 0 || target >= imgs.length) return;
    [imgs[index], imgs[target]] = [imgs[target], imgs[index]];
    setProduct((prev) => ({ ...prev, images: imgs }));
  };

  const removeImage = (index: number) => {
    setProduct((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index),
    }));
  };

  const setCover = (index: number) => {
    const imgs = product.images ? [...product.images] : [];
    const [cover] = imgs.splice(index, 1);
    imgs.unshift(cover);
    setProduct((prev) => ({ ...prev, images: imgs }));
  };

  const updateSku = (
    skuId: string,
    field: keyof ProductSku,
    value: string | number,
  ) => {
    setProduct((prev) => ({
      ...prev,
      skus: (prev.skus || []).map((s) => {
        if (s.id !== skuId) return s;
        const updates: Partial<ProductSku> = { [field]: value };
        // 规格字段与尺寸同步，避免重复录入
        if (field === "size" && typeof value === "string") {
          updates.specification = value;
        }
        return { ...s, ...updates };
      }),
    }));
  };

  const addSku = (defaultSize = "", callback?: (newSku: ProductSku) => void) => {
    const newSku: ProductSku = {
      id: nanoid(),
      sku_code: "",
      specification: defaultSize,
      size: defaultSize,
      pattern: "",
      color: "",
      filling_weight: 0,
      quilt_pattern: "",
      quilt_process: "",
      weight: 0,
      barcode: "",
      suggested_price: 0,
      currency: "CNY",
      unit: product.unit || "",
      status: "active",
    };
    setProduct((prev) => ({
      ...prev,
      skus: [...(prev.skus || []), newSku],
    }));
    if (defaultSize) {
      setExpandedSizeGroups((prev) => {
        const next = new Set(prev);
        next.add(defaultSize);
        return next;
      });
    }
    callback?.(newSku);
  };

  const [deleteSkuConfirmOpen, setDeleteSkuConfirmOpen] = useState(false);
  const [pendingDeleteSkuId, setPendingDeleteSkuId] = useState<string>("");

  const requestRemoveSku = (skuId: string) => {
    if ((product.skus || []).length <= 1) {
      toast.error("至少保留一个 SKU");
      return;
    }
    setPendingDeleteSkuId(skuId);
    setDeleteSkuConfirmOpen(true);
  };

  const confirmRemoveSku = () => {
    if (!pendingDeleteSkuId) return;
    setProduct((prev) => {
      const skus = (prev.skus || []).filter((s) => s.id !== pendingDeleteSkuId);
      return { ...prev, skus };
    });
    setPendingDeleteSkuId("");
    setDeleteSkuConfirmOpen(false);
  };

  const [deleteGroupConfirmOpen, setDeleteGroupConfirmOpen] = useState(false);
  const [pendingDeleteSize, setPendingDeleteSize] = useState<string>("");

  const requestRemoveSizeGroup = (size: string) => {
    setPendingDeleteSize(size);
    setDeleteGroupConfirmOpen(true);
  };

  const confirmRemoveSizeGroup = () => {
    if (!pendingDeleteSize) return;
    setProduct((prev) => {
      const remaining = (prev.skus || []).filter(
        (s) => (s.size || s.specification || "未分类") !== pendingDeleteSize,
      );
      if (remaining.length === 0) {
        toast.error("至少保留一个 SKU");
        return prev;
      }
      return { ...prev, skus: remaining };
    });
    setPendingDeleteSize("");
    setDeleteGroupConfirmOpen(false);
  };

  const copyBomBetweenSkus = (sourceSkuId: string, targetSkuId: string) => {
    const sourceBoms = getProductBomsBySku(product as Product, sourceSkuId);
    if (sourceBoms.length === 0) return;
    const targetSku = product.skus?.find((s) => s.id === targetSkuId);
    if (!targetSku) return;
    const copied = sourceBoms.map((b) => ({
      ...b,
      id: nanoid(),
      sku_id: targetSkuId,
      sku_specification:
        targetSku.barcode || targetSku.specification || targetSku.size || "",
    }));
    setProduct((prev) => ({
      ...prev,
      boms: [...(prev.boms || []).filter((b) => b.sku_id !== targetSkuId), ...copied],
    }));
    toast.success(`已复制 ${copied.length} 条 BOM 到新增 SKU`);
  };

  const [copyBomConfirmOpen, setCopyBomConfirmOpen] = useState(false);
  const [copyBomSourceId, setCopyBomSourceId] = useState<string>("");
  const [copyBomTargetId, setCopyBomTargetId] = useState<string>("");

  const checkAndPromptCopyBom = (newSkuId: string, size: string) => {
    const sameSizeSku = product.skus?.find(
      (s) => s.id !== newSkuId && s.size === size && getProductBomsBySku(product as Product, s.id).length > 0,
    );
    if (!sameSizeSku) return;
    setCopyBomSourceId(sameSizeSku.id);
    setCopyBomTargetId(newSkuId);
    setCopyBomConfirmOpen(true);
  };

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchMode, setBatchMode] = useState<"new" | "append">("new");
  const [batchSizes, setBatchSizes] = useState("");
  const [batchAppendSize, setBatchAppendSize] = useState("");
  const [batchColors, setBatchColors] = useState("");
  const [batchPatterns, setBatchPatterns] = useState("");
  const [batchDefaultPattern, setBatchDefaultPattern] = useState("");
  const [batchDefaultQuiltPattern, setBatchDefaultQuiltPattern] = useState("");
  const [batchDefaultQuiltProcess, setBatchDefaultQuiltProcess] = useState("");
  const [batchDefaultUnit, setBatchDefaultUnit] = useState("条");
  const [batchDefaultCurrency, setBatchDefaultCurrency] = useState("CNY");
  const [batchDefaultPrice, setBatchDefaultPrice] = useState("");
  const [batchBarcodePrefix, setBatchBarcodePrefix] = useState("");
  const [batchAppendMode, setBatchAppendMode] = useState(true);

  const [selectedBomSkuId, setSelectedBomSkuId] = useState<string>("");
  const [bomDialogOpen, setBomDialogOpen] = useState(false);
  const [specMappingOpen, setSpecMappingOpen] = useState(false);
  const [pendingBomImport, setPendingBomImport] = useState<ProductBom[]>([]);
  const [pendingNewMaterials, setPendingNewMaterials] = useState<Material[]>([]);
  const [pendingUpdatedMaterials, setPendingUpdatedMaterials] = useState<Material[]>([]);
  const [pendingUnmatchedSpecs, setPendingUnmatchedSpecs] = useState<
    { spec: string; rows: number[]; sheet: string }[]
  >([]);
  const [specMapping, setSpecMapping] = useState<Record<string, string>>({});
  const [expandedBomSkus, setExpandedBomSkus] = useState<Set<string>>(new Set());
  const [expandedSizeGroups, setExpandedSizeGroups] = useState<Set<string>>(new Set());
  const [expandedBomSizeGroups, setExpandedBomSizeGroups] = useState<Set<string>>(new Set());
  const [bulkPriceTarget, setBulkPriceTarget] = useState<string | null>(null);
  const [bulkPriceValue, setBulkPriceValue] = useState<number>(0);

  const toggleSizeGroup = (size: string) => {
    setExpandedSizeGroups((prev) => {
      const next = new Set(prev);
      if (next.has(size)) next.delete(size);
      else next.add(size);
      return next;
    });
  };

  const applyBulkPrice = (size: string, price: number) => {
    setProduct((prev) => ({
      ...prev,
      skus: (prev.skus || []).map((s) =>
        s.size === size ? { ...s, suggested_price: price } : s,
      ),
    }));
    setBulkPriceTarget(null);
    toast.success(`已统一设置「${size}」的价格为 ${price}`);
  };

  const toggleBomSizeGroup = (size: string) => {
    setExpandedBomSizeGroups((prev) => {
      const next = new Set(prev);
      if (next.has(size)) next.delete(size);
      else next.add(size);
      return next;
    });
  };

  useEffect(() => {
    if (product.skus && product.skus.length > 0) {
      setSelectedBomSkuId((prev) =>
        prev && product.skus?.some((s) => s.id === prev)
          ? prev
          : product.skus?.[0]?.id || "",
      );
      // 默认展开所有已有 BOM 的 SKU
      setExpandedBomSkus((prev) => {
        const next = new Set(prev);
        product.skus?.forEach((s) => {
          if (getProductBomsBySku(product as Product, s.id).length > 0) {
            next.add(s.id);
          }
        });
        return next;
      });
      // 默认展开所有尺寸分组
      setExpandedSizeGroups((prev) => {
        const next = new Set(prev);
        product.skus?.forEach((s) => {
          if (s.size) next.add(s.size);
        });
        return next;
      });
      // 默认展开所有已有 BOM 的尺寸分组
      setExpandedBomSizeGroups((prev) => {
        const next = new Set(prev);
        product.skus?.forEach((s) => {
          if (s.size && getProductBomsBySku(product as Product, s.id).length > 0) {
            next.add(s.size);
          }
        });
        return next;
      });
    } else {
      setSelectedBomSkuId("");
    }
  }, [product.skus, product.boms]);

  // 为旧数据/外部导入的BOM补齐缺失的id，确保删除等操作可正确定位
  useEffect(() => {
    const boms = product.boms || [];
    if (boms.some((b) => !b.id)) {
      setProduct((p) => ({
        ...p,
        boms: boms.map((b) => (b.id ? b : { ...b, id: nanoid() })),
      }));
    }
  }, [product.boms]);

  const selectedBomSku = useMemo(
    () => product.skus?.find((s) => s.id === selectedBomSkuId),
    [product.skus, selectedBomSkuId],
  );
  const currentBoms = useMemo(
    () => getProductBomsBySku(product as Product, selectedBomSkuId),
    [product, selectedBomSkuId],
  );

  const generateSkus = () => {
    const rawColors = batchColors
      .split(/[,，]/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (rawColors.length === 0) {
      toast.error("请至少输入一个颜色");
      return;
    }

    let sizes: string[] = [];
    if (batchMode === "append") {
      if (!batchAppendSize) {
        toast.error("请选择要追加的尺寸");
        return;
      }
      sizes = [batchAppendSize];
    } else {
      sizes = batchSizes
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (sizes.length === 0) {
        toast.error("请至少输入一个尺寸");
        return;
      }
    }

    const colors = rawColors;
    const patterns = batchPatterns
      .split(/[,，]/)
      .map((p) => p.trim())
      .filter(Boolean);

    const prefix = batchBarcodePrefix || product.code || "SKU";
    const defaultPrice = Number(batchDefaultPrice) || 0;

    const generated: ProductSku[] = [];
    const usedBarcodes = new Set<string>();
    sizes.forEach((size) => {
      colors.forEach((color) => {
        const pattern = patterns.length
          ? patterns[colors.indexOf(color) % patterns.length]
          : batchDefaultPattern || color;
        const spec = size;
        const colorCode = color.replace(/\s+/g, "");
        const sizeCode = size.replace(/[××Xx]/g, "x").replace(/\s+/g, "");
        let barcode = `${prefix}-${colorCode}-${sizeCode}`;
        // 保证条码唯一：条码与已生成或已存在的 SKU 不重复
        let suffix = "";
        let barcodeKey = barcode.toLowerCase();
        while (
          usedBarcodes.has(barcodeKey) ||
          (product.skus || []).some(
            (s) => s.barcode?.toLowerCase() === barcodeKey,
          )
        ) {
          suffix = suffix === "" ? "1" : String(Number(suffix) + 1);
          barcode = `${prefix}-${colorCode}-${sizeCode}-${suffix}`;
          barcodeKey = barcode.toLowerCase();
        }
        usedBarcodes.add(barcodeKey);
        generated.push({
          id: nanoid(),
          sku_code: "",
          specification: spec,
          size,
          pattern,
          color,
          filling_weight: 0,
          quilt_pattern: batchDefaultQuiltPattern,
          quilt_process: batchDefaultQuiltProcess,
          weight: 0,
          barcode,
          suggested_price: defaultPrice,
          currency: batchDefaultCurrency,
          unit: batchDefaultUnit,
          status: "active",
        });
      });
    });

    // 去重：与已有 SKU 的 size + color 组合不重复
    const existingKeys = new Set(
      (product.skus || []).map((s) => `${s.size || ""}-${s.color || ""}`),
    );
    const uniqueSkus = generated.filter(
      (s) => !existingKeys.has(`${s.size}-${s.color}`),
    );
    if (uniqueSkus.length === 0) {
      toast.error("生成的 SKU 均已存在，未添加重复规格");
      return;
    }

    const firstSize = uniqueSkus[0]?.size;
    setProduct((prev) => ({
      ...prev,
      skus: batchAppendMode
        ? [...(prev.skus || []), ...uniqueSkus]
        : uniqueSkus,
    }));
    setBatchOpen(false);
    setBatchMode("new");
    setBatchSizes("");
    setBatchAppendSize("");
    setBatchColors("");
    setBatchPatterns("");
    toast.success(
      `已生成 ${uniqueSkus.length} 条 SKU（${generated.length - uniqueSkus.length} 条已存在被忽略）`,
    );

    // 批量追加到指定尺寸后，若该尺寸已有 BOM，提示复制
    if (batchMode === "append" && firstSize) {
      setTimeout(() => {
        const target = uniqueSkus[0];
        if (target) checkAndPromptCopyBom(target.id, firstSize);
      }, 0);
    }
  };

  const toggleBomSkuExpanded = (skuId: string) => {
    setExpandedBomSkus((prev) => {
      const next = new Set(prev);
      if (next.has(skuId)) next.delete(skuId);
      else next.add(skuId);
      return next;
    });
  };

  const updateBom = (
    rowId: string,
    field: keyof ProductBom,
    value: string | number,
  ) => {
    setProduct((prev) => ({
      ...prev,
      boms: (prev.boms || []).map((b) =>
        b.id === rowId ? { ...b, [field]: value } : b,
      ),
    }));
  };

  const addBom = () => {
    const first = materials[0];
    const sku = selectedBomSku;
    setProduct((prev) => ({
      ...prev,
      boms: [
        ...(prev.boms || []),
        {
          id: nanoid(),
          sku_id: sku?.id || "",
          sku_specification:
            sku?.barcode || sku?.specification || sku?.size || "",
          material_id: first?.id || "",
          material_code: first?.code || "",
          material_name: first?.name || "",
          category: first?.category || "",
          specification: first?.specification || "",
          dosage: 0,
          unit: first?.unit || "米",
          component: "",
          fabric_width: first?.width || "",
          cutting_specification: "",
          source_process_order: "",
          process_remark: "",
          remark: "",
        },
      ],
    }));
  };

  const removeBom = (rowId: string) => {
    setProduct((prev) => ({
      ...prev,
      boms: (prev.boms || []).filter((b) => b.id !== rowId),
    }));
  };

  const setBomMaterial = (rowId: string, materialId: string) => {
    const material = materials.find((m) => m.id === materialId);
    setProduct((prev) => ({
      ...prev,
      boms: (prev.boms || []).map((b) =>
        b.id === rowId
          ? {
              ...b,
              material_id: material?.id || "",
              material_code: material?.code || "",
              material_name: material?.name || "",
              category: material?.category || "",
              specification: material?.specification || "",
              unit: material?.unit || b.unit,
              fabric_width: material?.width || b.fabric_width,
            }
          : b,
      ),
    }));
  };

  const finalizeBomImport = async (
    boms: ProductBom[],
    newMaterials: Material[],
    updatedMaterials: Material[] = [],
  ) => {
    // 创建新物料
    if (newMaterials.length > 0) {
      for (const m of newMaterials) {
        await addMaterial(m);
      }
      toast.success(`已新建 ${newMaterials.length} 个物料`);
    }

    // 更新已有物料的布号/布色/门幅/规格等缺失字段
    if (updatedMaterials.length > 0) {
      for (const m of updatedMaterials) {
        await updateMaterial(m);
      }
      toast.success(`已更新 ${updatedMaterials.length} 个物料档案字段`);
    }

    // 过滤掉仍占位的 BOM
    const validBoms = boms.filter((b) => !b.sku_id.startsWith("__UNMATCHED__"));

    if (validBoms.length === 0) {
      toast.warning("没有可导入的有效 BOM 数据");
      return;
    }

    // 合并导入的 BOM，按 sku_id 去重覆盖
    const targetSkuIds = new Set(validBoms.map((b) => b.sku_id));
    setProduct((prev) => {
      const existing = prev.boms || [];
      const kept = existing.filter((b) => !targetSkuIds.has(b.sku_id));
      return { ...prev, boms: [...kept, ...validBoms] };
    });

    toast.success(`已导入 ${validBoms.length} 条 BOM 物料（覆盖 ${targetSkuIds.size} 个规格）`);
  };

  const handleBomImport = async (file: File) => {
    if (!product.skus?.length) {
      toast.error("请先添加 SKU 规格");
      return;
    }
    const result = await parseBomExcel(file, product as Product, materials);
    if (result.errors.length > 0) {
      result.errors.forEach((err) => {
        toast.error(`第 ${err.row} 行（${err.sheet || "汇总"}）：${err.message}`);
      });
      return;
    }

    if (result.unmatchedSpecs.length > 0) {
      setPendingBomImport(result.boms);
      setPendingNewMaterials(result.newMaterials);
      setPendingUpdatedMaterials(result.updatedMaterials);
      setPendingUnmatchedSpecs(result.unmatchedSpecs);
      // 初始化映射：尝试自动匹配
      const initMapping: Record<string, string> = {};
      result.unmatchedSpecs.forEach(({ spec }) => {
        const sku = product.skus?.find((s) =>
          [s.size, s.specification, s.barcode, s.sku_code]
            .filter(Boolean)
            .some((text) =>
              text!.replace(/\s+/g, "").includes(spec.replace(/\s+/g, "")),
            ),
        );
        if (sku) initMapping[spec] = sku.id;
      });
      setSpecMapping(initMapping);
      setSpecMappingOpen(true);
      return;
    }

    await finalizeBomImport(
      result.boms,
      result.newMaterials,
      result.updatedMaterials,
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (contractId) {
                navigate(`/contract?detailId=${contractId}`);
              } else {
                navigate("/products");
              }
            }}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> {contractId ? "返回合同" : "返回"}
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              {isCreate ? "新建产品" : product.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {product.code || "产品款号"}
            </p>
          </div>
          {!isCreate && (
            <Badge
              className={
                product.status === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-700"
              }
            >
              {product.status === "active" ? "启用" : "停用"}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isCreate && (
            <>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                复制新建
              </Button>
              <Button variant="outline" size="sm" onClick={toggleStatus}>
                {product.status === "active" ? "停用" : "启用"}
              </Button>
            </>
          )}
          {isEditing ? (
            <Button size="sm" onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
          ) : (
            <Button size="sm" onClick={() => setIsEditing(true)}>
              编辑
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="sku">规格参数</TabsTrigger>
          <TabsTrigger value="process">工艺工序</TabsTrigger>
          <TabsTrigger value="images">图片库</TabsTrigger>
          <TabsTrigger value="orders">历史订单</TabsTrigger>
          <TabsTrigger value="bom">BOM 物料</TabsTrigger>
          <TabsTrigger value="pricing">定价策略</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>款号</Label>
                <Input
                  disabled={!isEditing}
                  value={product.code || ""}
                  onChange={(e) =>
                    setProduct((p) => ({ ...p, code: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>品名</Label>
                <Input
                  disabled={!isEditing}
                  value={product.name || ""}
                  onChange={(e) =>
                    setProduct((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>产品类别</Label>
                <Select
                  disabled={!isEditing}
                  value={product.category}
                  onValueChange={(v) =>
                    setProduct((p) => ({ ...p, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>计量单位</Label>
                <Input
                  disabled={!isEditing}
                  value={product.unit || ""}
                  onChange={(e) =>
                    setProduct((p) => ({ ...p, unit: e.target.value }))
                  }
                  placeholder="如：件、套、米"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>产品描述</Label>
                <Textarea
                  disabled={!isEditing}
                  value={product.description || ""}
                  onChange={(e) =>
                    setProduct((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="填写产品特点、用途、注意事项等"
                  rows={3}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>设计图纸</Label>
                <input
                  ref={drawingRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg,.dxf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadDrawing(file);
                    e.target.value = "";
                  }}
                />
                {product.design_drawing ? (
                  <div className="flex items-center gap-3 rounded-md border p-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="flex-1 min-w-0">
                      <a
                        href={product.design_drawing}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary hover:underline truncate block"
                      >
                        查看设计图纸
                      </a>
                      <p className="text-xs text-muted-foreground truncate">
                        {product.design_drawing}
                      </p>
                    </div>
                    {isEditing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={removeDrawing}
                        title="移除"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!isEditing || uploadingDrawing}
                    onClick={() => drawingRef.current?.click()}
                  >
                    {uploadingDrawing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    上传设计图纸
                  </Button>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>产品图纸</Label>
                <div className="space-y-2">
                  {(product.drawings || []).map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="flex items-center gap-3 rounded-md border p-3"
                    >
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="flex-1 min-w-0">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-primary hover:underline truncate block"
                        >
                          图纸 {idx + 1}
                        </a>
                        <p className="text-xs text-muted-foreground truncate">{url}</p>
                      </div>
                      {isEditing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setProduct((p) => ({
                              ...p,
                              drawings: (p.drawings || []).filter((_, i) => i !== idx),
                            }))
                          }
                          title="移除"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingDrawing}
                      onClick={() => drawingRef.current?.click()}
                    >
                      {uploadingDrawing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      上传产品图纸
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <Switch
                  disabled={!isEditing}
                  checked={product.status === "active"}
                  onCheckedChange={(v) =>
                    setProduct((p) => ({
                      ...p,
                      status: v ? "active" : "inactive",
                    }))
                  }
                />
                <Label>
                  {product.status === "active" ? "已启用" : "已停用"}
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sku" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">SKU 规格</CardTitle>
              {isEditing && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBatchOpen(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    批量生成 SKU
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addSku()}>
                    <Plus className="mr-1 h-4 w-4" />
                    新增 SKU
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left whitespace-nowrap min-w-[120px]">SKU编码</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[160px]">尺寸</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[110px]">花色</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[110px]">颜色</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[110px]">
                      填充克重(g)
                    </th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[110px]">花型</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[150px]">
                      绗缝工艺
                    </th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[180px]">
                      条码
                    </th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[70px]">单位</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[120px]">
                      建议零售价
                    </th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[70px]">币种</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[90px]">状态</th>
                    {isEditing && (
                      <th className="p-2 text-left whitespace-nowrap">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const sizeGroups = new Map<string, ProductSku[]>();
                    (product.skus || []).forEach((sku) => {
                      const key = sku.size || sku.specification || "未分类";
                      if (!sizeGroups.has(key)) sizeGroups.set(key, []);
                      sizeGroups.get(key)!.push(sku);
                    });
                    const rows: ReactNode[] = [];
                    sizeGroups.forEach((skus, size) => {
                      const expanded = expandedSizeGroups.has(size);
                      rows.push(
                        <tr key={`size-${size}`} className="border-b bg-muted/20">
                          <td className="p-2">
                            <button
                              type="button"
                              onClick={() => toggleSizeGroup(size)}
                              className="inline-flex items-center gap-1 text-sm font-medium hover:text-primary"
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0" />
                              )}
                              <span>{size}</span>
                            </button>
                          </td>
                          <td className="p-2 text-sm text-muted-foreground" colSpan={isEditing ? 11 : 10}>
                            {skus.length} 个颜色
                            {skus.length > 0 && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {skus.map((s) => s.color || s.sku_code).join(" / ")}
                              </span>
                            )}
                          </td>
                          {isEditing && (
                            <td className="p-2">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const first = skus.find((s) => s.suggested_price > 0);
                                    setBulkPriceValue(first?.suggested_price || 0);
                                    setBulkPriceTarget(size);
                                  }}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Banknote className="mr-1 h-3 w-3" />
                                  统一定价
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    addSku(size, (newSku) =>
                                      checkAndPromptCopyBom(newSku.id, size),
                                    );
                                  }}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Plus className="mr-1 h-3 w-3" />
                                  添加SKU
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => requestRemoveSizeGroup(size)}
                                  className="h-7 w-7"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>,
                      );
                      if (expanded) {
                        skus.forEach((sku) => {
                          rows.push(
                            <tr key={sku.id} className="border-b">
                              <td className="p-2 whitespace-nowrap pl-8 text-muted-foreground">
                                {sku.sku_code || "-"}
                              </td>
                              <td className="p-2 min-w-[180px]">
                                <SizeCombobox
                                  disabled={!isEditing}
                                  value={sku.size}
                                  options={Array.from(
                                    new Set((product.skus || []).map((s) => s.size).filter(Boolean)),
                                  )}
                                  onChange={(value) => updateSku(sku.id, "size", value)}
                                />
                              </td>
                              <td className="p-2 min-w-[110px]">
                                <Input
                                  disabled={!isEditing}
                                  value={sku.pattern}
                                  onChange={(e) =>
                                    updateSku(sku.id, "pattern", e.target.value)
                                  }
                                  className="h-8"
                                  title={sku.pattern}
                                />
                              </td>
                              <td className="p-2 min-w-[110px]">
                                <Input
                                  disabled={!isEditing}
                                  value={sku.color}
                                  onChange={(e) =>
                                    updateSku(sku.id, "color", e.target.value)
                                  }
                                  className="h-8"
                                  title={sku.color}
                                />
                              </td>
                              <td className="p-2 min-w-[110px]">
                                <Input
                                  disabled={!isEditing}
                                  type="number"
                                  value={sku.filling_weight}
                                  onChange={(e) =>
                                    updateSku(
                                      sku.id,
                                      "filling_weight",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="h-8"
                                />
                              </td>
                              <td className="p-2 min-w-[110px]">
                                <Input
                                  disabled={!isEditing}
                                  value={sku.quilt_pattern}
                                  onChange={(e) =>
                                    updateSku(sku.id, "quilt_pattern", e.target.value)
                                  }
                                  className="h-8"
                                  title={sku.quilt_pattern}
                                />
                              </td>
                              <td className="p-2 min-w-[150px]">
                                <Input
                                  disabled={!isEditing}
                                  value={sku.quilt_process}
                                  onChange={(e) =>
                                    updateSku(sku.id, "quilt_process", e.target.value)
                                  }
                                  className="h-8"
                                  title={sku.quilt_process}
                                />
                              </td>
                              <td className="p-2 min-w-[180px]">
                                <Input
                                  disabled={!isEditing}
                                  value={sku.barcode}
                                  onChange={(e) =>
                                    updateSku(sku.id, "barcode", e.target.value)
                                  }
                                  className="h-8 min-w-[160px]"
                                />
                              </td>
                              <td className="p-2 min-w-[70px]">
                                <Input
                                  disabled={!isEditing}
                                  value={sku.unit || ""}
                                  onChange={(e) =>
                                    updateSku(sku.id, "unit", e.target.value)
                                  }
                                  className="h-8"
                                />
                              </td>
                              <td className="p-2 min-w-[120px]">
                                <Input
                                  disabled={!isEditing}
                                  type="number"
                                  value={sku.suggested_price}
                                  onChange={(e) =>
                                    updateSku(
                                      sku.id,
                                      "suggested_price",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="h-8"
                                />
                              </td>
                              <td className="p-2 min-w-[70px]">
                                <Input
                                  disabled={!isEditing}
                                  value={sku.currency || "CNY"}
                                  onChange={(e) =>
                                    updateSku(sku.id, "currency", e.target.value)
                                  }
                                  className="h-8"
                                />
                              </td>
                              <td className="p-2 min-w-[90px]">
                                <Select
                                  disabled={!isEditing}
                                  value={sku.status || "active"}
                                  onValueChange={(v) =>
                                    updateSku(sku.id, "status", v as "active" | "inactive")
                                  }
                                >
                                  <SelectTrigger className="h-8 w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="active">启用</SelectItem>
                                    <SelectItem value="inactive">停用</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              {isEditing && (
                                <td className="p-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={(product.skus || []).length <= 1}
                                    onClick={() => requestRemoveSku(sku.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </td>
                              )}
                            </tr>,
                          );
                        });
                      }
                    });
                    return rows;
                  })()}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="process" className="space-y-4">
          <ProductProcessTab
            product={product}
            setProduct={setProduct}
            isEditing={isEditing}
            routes={processRoutes}
            processes={processes}
            onSave={handleSave}
          />
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">图片库</CardTitle>
              {isEditing && (
                <Label
                  className={`cursor-pointer ${uploadingImages ? "pointer-events-none opacity-60" : ""}`}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
                    className="hidden"
                    onChange={onImageUpload}
                    disabled={uploadingImages}
                  />
                  <span className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingImages ? "上传中..." : "上传图片"}
                  </span>
                </Label>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                {(product.images || []).map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="group relative rounded-lg border p-2"
                  >
                    {idx === 0 && (
                      <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                        封面
                      </span>
                    )}
                    <img
                      src={url}
                      alt={`产品图${idx + 1}`}
                      className="aspect-square w-full rounded-md object-cover"
                    />
                    {isEditing && (
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveImage(idx, -1)}
                          disabled={idx === 0}
                        >
                          <GripVertical className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setCover(idx)}
                          disabled={idx === 0}
                        >
                          <Star className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeImage(idx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">历史订单</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">订单编号</th>
                    <th className="p-2 text-left">客户</th>
                    <th className="p-2 text-left">数量</th>
                    <th className="p-2 text-left">金额</th>
                    <th className="p-2 text-left">下单日期</th>
                    <th className="p-2 text-left">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {orderHistory.map((o) => (
                    <tr key={o.id} className="border-b">
                      <td className="p-2 font-medium">{o.order_no}</td>
                      <td className="p-2">{o.customer_name}</td>
                      <td className="p-2">
                        {o.items.find((i) => i.product_code === product.code)
                          ?.quantity || "-"}
                      </td>
                      <td className="p-2">{o.total_amount.toLocaleString()}</td>
                      <td className="p-2">{o.delivery_date}</td>
                      <td className="p-2">
                        <Badge variant="outline">
                          {getStatusLabel(o.status, ORDER_STATUS)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {orderHistory.length === 0 && (
                    <tr>
                      <td
                        className="p-4 text-center text-muted-foreground"
                        colSpan={6}
                      >
                        暂无历史订单
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bom" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">BOM 物料清单</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row">
                {isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!product.skus?.length}
                    onClick={() => {
                      setSelectedBomSkuId(product.skus?.[0]?.id || "");
                      setBomDialogOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    配置 BOM
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadBomTemplate}
                >
                  <FileText className="mr-1 h-4 w-4" />
                  下载模板
                </Button>
                <Label
                  className={`inline-flex cursor-pointer items-center ${!isEditing ? "pointer-events-none opacity-60" : ""}`}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={!isEditing}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBomImport(file);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                    <Upload className="mr-1 h-4 w-4" />
                    导入 BOM
                  </span>
                </Label>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                BOM 用于报价时自动核料与成本核算。按尺寸折叠，每个尺寸下展示同款色物料；生成领料单时会根据实际工单 SKU 颜色自动匹配颜色物料。
              </p>
              {!product.skus?.length ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  请先添加 SKU 规格。
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const sizeGroups = new Map<string, ProductSku[]>();
                    (product.skus || []).forEach((sku) => {
                      const key = sku.size || sku.specification || "未分类";
                      if (!sizeGroups.has(key)) sizeGroups.set(key, []);
                      sizeGroups.get(key)!.push(sku);
                    });
                    const panels: ReactNode[] = [];
                    sizeGroups.forEach((skus, size) => {
                      const firstSku = skus[0];
                      const sizeBoms = firstSku
                        ? getProductBomsBySku(product as Product, firstSku.id)
                        : [];
                      const expanded = expandedBomSizeGroups.has(size);
                      const colors = skus.map((s) => s.color).filter(Boolean);
                      panels.push(
                        <div key={`bom-size-${size}`} className="rounded-md border">
                          <div
                            className="flex items-center justify-between gap-3 bg-muted/30 p-3 hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleBomSizeGroup(size)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {expanded ? (
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0" />
                              )}
                              <span className="font-medium whitespace-nowrap">{size}</span>
                              {colors.length > 0 && (
                                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                                  {colors.length} 色
                                </span>
                              )}
                              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                {sizeBoms.length} 项
                              </span>
                            </div>
                            {isEditing && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBomSkuId(firstSku?.id || "");
                                  setBomDialogOpen(true);
                                }}
                              >
                                配置
                              </Button>
                            )}
                          </div>
                          {expanded && (
                            <div className="overflow-x-auto">
                              <p className="px-3 py-2 text-xs text-muted-foreground">
                                同款色：系统生成领料单时会根据工单 SKU 颜色自动匹配颜色物料。
                              </p>
                              <table className="w-full min-w-max text-sm">
                                <thead className="bg-muted/50 text-muted-foreground">
                                  <tr>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[120px]">物料编码</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[160px]">物料名称</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[100px]">部件</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[80px]">布号</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[80px]">布色</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[80px]">门幅</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[80px]">类别</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[160px]">规格</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[80px]">用量</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[100px]">损耗率(%)</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[60px]">单位</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[120px]">来源工艺单</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[120px]">工艺备注</th>
                                    <th className="p-2 text-left whitespace-nowrap min-w-[120px]">备注</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sizeBoms.map((bom) => {
                                    const material = materials.find(
                                      (m) => m.id === bom.material_id,
                                    );
                                    return (
                                      <tr key={bom.id} className="border-b">
                                        <td className="p-2 whitespace-nowrap">{bom.material_code}</td>
                                        <td className="p-2 whitespace-nowrap">{bom.material_name}</td>
                                        <td className="p-2 whitespace-nowrap">{bom.component || "-"}</td>
                                        <td className="p-2 whitespace-nowrap">{material?.fabric_no || "-"}</td>
                                        <td className="p-2 whitespace-nowrap text-muted-foreground">-</td>
                                        <td className="p-2 whitespace-nowrap">{bom.fabric_width || material?.width || "-"}</td>
                                        <td className="p-2 whitespace-nowrap">{bom.category}</td>
                                        <td className="p-2 whitespace-nowrap">{bom.specification || bom.cutting_specification || "-"}</td>
                                        <td className="p-2 whitespace-nowrap">
                                          {Number(bom.dosage).toLocaleString("zh-CN", {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 4,
                                          })}
                                        </td>
                                        <td className="p-2 whitespace-nowrap">{bom.loss_rate ?? 0}</td>
                                        <td className="p-2 whitespace-nowrap">{bom.unit}</td>
                                        <td className="p-2 whitespace-nowrap">{bom.source_process_order || "-"}</td>
                                        <td className="p-2 whitespace-nowrap">{bom.process_remark || "-"}</td>
                                        <td className="p-2 whitespace-nowrap">{bom.remark || "-"}</td>
                                      </tr>
                                    );
                                  })}
                                  {sizeBoms.length === 0 && (
                                    <tr>
                                      <td
                                        className="p-4 text-center text-muted-foreground"
                                        colSpan={14}
                                      >
                                        该尺寸暂未配置 BOM，请先添加物料或导入模板。
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>,
                      );
                    });
                    return panels;
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <PricingStrategyTab
            product={product}
            setProduct={setProduct}
            isEditing={isEditing}
            routes={processRoutes}
            versions={processVersions}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteSkuConfirmOpen} onOpenChange={setDeleteSkuConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除 SKU</AlertDialogTitle>
            <AlertDialogDescription>
              删除后该 SKU 的 BOM 也将被移除，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteSkuId("")}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveSku}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteGroupConfirmOpen} onOpenChange={setDeleteGroupConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除尺寸分组</AlertDialogTitle>
            <AlertDialogDescription>
              该尺寸下的所有 SKU 及其 BOM 将被删除，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteSize("")}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveSizeGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={copyBomConfirmOpen} onOpenChange={setCopyBomConfirmOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>复制 BOM</AlertDialogTitle>
            <AlertDialogDescription>
              检测到该尺寸下已有 SKU 绑定了 BOM，是否需要复制 BOM 到新增 SKU？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setCopyBomSourceId("");
                setCopyBomTargetId("");
              }}
            >
              否
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (copyBomSourceId && copyBomTargetId) {
                  copyBomBetweenSkus(copyBomSourceId, copyBomTargetId);
                }
                setCopyBomSourceId("");
                setCopyBomTargetId("");
              }}
            >
              是
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>批量生成 SKU</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center gap-4 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="batch-mode"
                  value="new"
                  checked={batchMode === "new"}
                  onChange={() => setBatchMode("new")}
                  className="h-4 w-4"
                />
                全新生成
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="batch-mode"
                  value="append"
                  checked={batchMode === "append"}
                  onChange={() => setBatchMode("append")}
                  className="h-4 w-4"
                />
                追加到指定尺寸
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  {batchMode === "append" ? "选择尺寸" : "可选尺寸"}
                  <span className="text-destructive">*</span>
                </Label>
                {batchMode === "append" ? (
                  <Select
                    value={batchAppendSize}
                    onValueChange={setBatchAppendSize}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择已有尺寸" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        new Set((product.skus || []).map((s) => s.size).filter(Boolean)),
                      ).map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Textarea
                    placeholder="例如：160×210CM, 200×230CM"
                    value={batchSizes}
                    onChange={(e) => setBatchSizes(e.target.value)}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  可选颜色/花色<span className="text-destructive">*</span>
                </Label>
                <Textarea
                  placeholder="例如：白色, 金色, 蓝色"
                  value={batchColors}
                  onChange={(e) => setBatchColors(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>可选花色（可选，与颜色一一对应）</Label>
                <Textarea
                  placeholder="例如：纯色, 提花（留空则使用颜色作为花色）"
                  value={batchPatterns}
                  onChange={(e) => setBatchPatterns(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>默认花型</Label>
                <Input
                  placeholder="例如：波浪纹"
                  value={batchDefaultQuiltPattern}
                  onChange={(e) => setBatchDefaultQuiltPattern(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>默认绗缝工艺</Label>
                <Input
                  placeholder="例如：电脑绗缝"
                  value={batchDefaultQuiltProcess}
                  onChange={(e) => setBatchDefaultQuiltProcess(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>默认单位</Label>
                <Input
                  value={batchDefaultUnit}
                  onChange={(e) => setBatchDefaultUnit(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>默认建议零售价</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={batchDefaultPrice}
                  onChange={(e) => setBatchDefaultPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>默认币种</Label>
                <Input
                  value={batchDefaultCurrency}
                  onChange={(e) => setBatchDefaultCurrency(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>条码前缀</Label>
                <Input
                  placeholder={product.code || "SKU"}
                  value={batchBarcodePrefix}
                  onChange={(e) => setBatchBarcodePrefix(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="batch-append"
                checked={batchAppendMode}
                onChange={(e) => setBatchAppendMode(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="batch-append" className="font-normal">
                追加到现有 SKU（取消勾选则覆盖已有 SKU）
              </Label>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              将生成{" "}
              {batchSizes.split(/[,，]/).filter(Boolean).length *
                Math.max(
                  1,
                  batchColors.split(/[,，]/).filter(Boolean).length,
                )}{" "}
              行 SKU，条码自动格式为：前缀-颜色-尺寸
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>
              取消
            </Button>
            <Button onClick={generateSkus}>生成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bomDialogOpen} onOpenChange={setBomDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-6xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>配置 BOM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <Select
                value={selectedBomSkuId}
                onValueChange={setSelectedBomSkuId}
                disabled={!product.skus?.length}
              >
                <SelectTrigger className="w-full md:w-72">
                  <SelectValue placeholder="选择规格" />
                </SelectTrigger>
                <SelectContent>
                  {(product.skus || []).map((sku) => (
                    <SelectItem key={sku.id} value={sku.id}>
                      {sku.barcode || sku.sku_code || sku.id}
                      {sku.size ? ` ｜ ${sku.size}` : ""}
                      {sku.specification ? ` ｜ ${sku.specification}` : ""}
                      {sku.color ? ` ｜ 颜色：${sku.color}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={addBom}>
                  <Plus className="mr-1 h-4 w-4" />
                  新增物料
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left whitespace-nowrap min-w-[14rem]">物料</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[100px]">部件</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[80px]">布号</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[80px]">布色</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[80px]">门幅</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[160px]">规格/裁剪规格</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[100px]">单套用量</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[100px]">损耗率(%)</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[60px]">单位</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[120px]">来源工艺单</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[120px]">工艺备注</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[120px]">备注</th>
                    <th className="p-2 text-left whitespace-nowrap min-w-[60px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {currentBoms.map((bom) => {
                    const material = materials.find(
                      (m) => m.id === bom.material_id,
                    );
                    return (
                      <tr key={bom.id} className="border-b">
                        <td className="p-2 min-w-[14rem]">
                          <Select
                            value={bom.material_id || "__CUSTOM__"}
                            onValueChange={(v) => {
                              if (v === "__CUSTOM__") {
                                setProduct((prev) => ({
                                  ...prev,
                                  boms: (prev.boms || []).map((b) =>
                                    b.id === bom.id
                                      ? {
                                          ...b,
                                          material_id: "",
                                          material_code: "",
                                          material_name: "",
                                          category: "",
                                          specification: "",
                                          unit: b.unit || "米",
                                          fabric_width: "",
                                        }
                                      : b,
                                  ),
                                }));
                              } else {
                                setBomMaterial(bom.id, v);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择物料或统称" />
                            </SelectTrigger>
                            <SelectContent>
                              {materials.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.code} {m.name}｜布号：{m.fabric_no || "-"}
                                  ｜布色：{m.color || "-"}｜门幅：
                                  {m.width || "-"}（{m.category}）
                                </SelectItem>
                              ))}
                              <SelectItem value="__CUSTOM__">— 手动输入统称 —</SelectItem>
                            </SelectContent>
                          </Select>
                          {(!bom.material_id || bom.material_id === "__CUSTOM__") && (
                            <Input
                              value={bom.material_name || ""}
                              onChange={(e) =>
                                updateBom(bom.id, "material_name", e.target.value)
                              }
                              placeholder="如：A#凉感布"
                              className="h-8 mt-1"
                            />
                          )}
                        </td>
                        <td className="p-2">
                          <Input
                            value={bom.component || ""}
                            onChange={(e) =>
                              updateBom(bom.id, "component", e.target.value)
                            }
                            className="h-8"
                            placeholder="部件"
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap">{material?.fabric_no || "-"}</td>
                        <td className="p-2 whitespace-nowrap">{material?.color || "-"}</td>
                        <td className="p-2 whitespace-nowrap">{bom.fabric_width || material?.width || "-"}</td>
                        <td className="p-2">
                          <Input
                            value={bom.cutting_specification || bom.specification || ""}
                            onChange={(e) =>
                              updateBom(bom.id, "cutting_specification", e.target.value)
                            }
                            className="h-8"
                            placeholder="裁剪规格"
                          />
                        </td>
                        <td className="p-2 min-w-[100px]">
                          <Input
                            type="text"
                            inputMode="decimal"
                            defaultValue={
                              bom.dosage === 0
                                ? ""
                                : Number(bom.dosage)
                                    .toFixed(4)
                                    .replace(/\.?0+$/, "")
                            }
                            placeholder="输入用量"
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v === "") {
                                updateBom(bom.id, "dosage", 0);
                              } else {
                                const n = Number(v);
                                if (!isNaN(n)) updateBom(bom.id, "dosage", n);
                              }
                            }}
                            className="h-8 no-spinner"
                          />
                        </td>
                        <td className="p-2 min-w-[100px]">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={bom.loss_rate || 0}
                            onChange={(e) =>
                              updateBom(bom.id, "loss_rate", Number(e.target.value))
                            }
                            className="h-8"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={bom.unit}
                            onChange={(e) =>
                              updateBom(bom.id, "unit", e.target.value)
                            }
                            className="h-8"
                            placeholder="单位"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={bom.source_process_order || ""}
                            onChange={(e) =>
                              updateBom(bom.id, "source_process_order", e.target.value)
                            }
                            className="h-8"
                            placeholder="来源工艺单"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={bom.process_remark || ""}
                            onChange={(e) =>
                              updateBom(bom.id, "process_remark", e.target.value)
                            }
                            className="h-8"
                            placeholder="工艺备注"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={bom.remark || ""}
                            onChange={(e) =>
                              updateBom(bom.id, "remark", e.target.value)
                            }
                            className="h-8"
                            placeholder="备注"
                          />
                        </td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeBom(bom.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {currentBoms.length === 0 && (
                    <tr>
                      <td
                        className="p-4 text-center text-muted-foreground"
                        colSpan={13}
                      >
                        该规格暂未配置 BOM，请点击上方「新增物料」添加或导入模板。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBomDialogOpen(false)}>
              关闭
            </Button>
            <Button
              onClick={async () => {
                await handleSave();
                setBomDialogOpen(false);
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={specMappingOpen} onOpenChange={setSpecMappingOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>规格映射</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              以下 Excel 规格未能自动匹配到 SKU，请手动选择对应规格：
            </p>
            {pendingUnmatchedSpecs.map(({ spec, rows, sheet }) => (
              <div key={spec} className="space-y-2">
                <Label className="text-sm">
                  {spec}
                  <span className="ml-2 text-xs text-muted-foreground">
                    （{sheet} 第 {rows.join(", ")} 行）
                  </span>
                </Label>
                <Select
                  value={specMapping[spec] || ""}
                  onValueChange={(v) =>
                    setSpecMapping((prev) => ({ ...prev, [spec]: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择 SKU 规格" />
                  </SelectTrigger>
                  <SelectContent>
                    {(product.skus || []).map((sku) => (
                      <SelectItem key={sku.id} value={sku.id}>
                        {sku.barcode || sku.id}
                        {sku.size ? ` ｜ 尺寸：${sku.size}` : ""}
                        {sku.specification ? ` ｜ 规格：${sku.specification}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpecMappingOpen(false)}>
              取消
            </Button>
            <Button
              onClick={async () => {
                const mapped = applySpecMapping(
                  pendingBomImport,
                  product as Product,
                  specMapping,
                );
                await finalizeBomImport(
                  mapped,
                  pendingNewMaterials,
                  pendingUpdatedMaterials,
                );
                setSpecMappingOpen(false);
                setPendingBomImport([]);
                setPendingNewMaterials([]);
                setPendingUnmatchedSpecs([]);
                setSpecMapping({});
              }}
            >
              确认导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkPriceTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBulkPriceTarget(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>统一定价</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              为「{bulkPriceTarget}」下的所有颜色设置统一建议零售价。
            </p>
            <div className="space-y-2">
              <Label>统一价格</Label>
              <Input
                type="number"
                value={bulkPriceValue}
                onChange={(e) => setBulkPriceValue(Number(e.target.value))}
                min={0}
                step={0.01}
                placeholder="请输入统一价格"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPriceTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (bulkPriceTarget) {
                  if (bulkPriceValue <= 0) {
                    toast.error("价格必须大于 0");
                    return;
                  }
                  applyBulkPrice(bulkPriceTarget, bulkPriceValue);
                }
              }}
            >
              应用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function initProduct(existing?: Product, isCreate?: boolean): Partial<Product> {
  if (existing) return { ...existing };
  if (isCreate)
    return {
      id: "",
      code: "",
      name: "",
      category: "绗缝被",
      unit: "件",
      description: "",
      process_list: [],
      process_steps: [],
      images: [],
      drawings: [],
      status: "active",
      design_drawing: undefined,
      skus: [],
      boms: [],
      pricing_strategy: {
        markup_rate: 0.2,
        target_profit_rate: 0.15,
        min_price: 0,
        suggested_price: 0,
        cost_price: 0,
        remark: "",
      },
    };
  return {};
}

function PricingStrategyTab({
  product,
  setProduct,
  isEditing,
  routes,
  versions,
}: {
  product: Partial<Product>;
  setProduct: React.Dispatch<React.SetStateAction<Partial<Product>>>;
  isEditing: boolean;
  routes: ProcessRoute[];
  versions: ProcessVersion[];
}) {
  const strategy: ProductPricingStrategy = product.pricing_strategy || {
    markup_rate: 0.2,
    target_profit_rate: 0.15,
    min_price: 0,
    suggested_price: 0,
    cost_price: 0,
    remark: "",
  };
  const binding = product.route_binding;

  const routeVersions = binding
    ? versions.filter((v) => v.route_id === binding.route_id)
    : [];

  const updateStrategy = (
    field: keyof ProductPricingStrategy,
    value: number,
  ) => {
    setProduct((p) => ({
      ...p,
      pricing_strategy: { ...strategy, [field]: value },
    }));
  };

  const updateRoute = (routeId: string) => {
    const route = routes.find((r) => r.id === routeId);
    const activeVersion = versions.find(
      (v) => v.route_id === routeId && v.status === "active",
    );
    setProduct((p) => ({
      ...p,
      route_binding: route
        ? {
            route_id: route.id,
            route_name: route.name,
            route_code: route.code,
            version_id: activeVersion?.id || "",
            version_code: activeVersion?.code || "",
          }
        : undefined,
    }));
  };

  const updateVersion = (versionId: string) => {
    const version = versions.find((v) => v.id === versionId);
    if (!version || !binding) return;
    setProduct((p) => ({
      ...p,
      route_binding: {
        ...binding,
        version_id: version.id,
        version_code: version.code,
      },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">定价策略与工艺路线</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>默认加价率（小数）</Label>
            <Input
              disabled={!isEditing}
              type="number"
              step={0.01}
              value={strategy.markup_rate}
              onChange={(e) =>
                updateStrategy("markup_rate", Number(e.target.value))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>目标利润率（小数）</Label>
            <Input
              disabled={!isEditing}
              type="number"
              step={0.01}
              value={strategy.target_profit_rate}
              onChange={(e) =>
                updateStrategy("target_profit_rate", Number(e.target.value))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>最低限价</Label>
            <Input
              disabled={!isEditing}
              type="number"
              value={strategy.min_price}
              onChange={(e) =>
                updateStrategy("min_price", Number(e.target.value))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>建议零售价</Label>
            <Input
              disabled={!isEditing}
              type="number"
              value={strategy.suggested_price}
              onChange={(e) =>
                updateStrategy("suggested_price", Number(e.target.value))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>成本价</Label>
            <Input
              disabled={!isEditing}
              type="number"
              min={0}
              step={0.01}
              value={strategy.cost_price || 0}
              onChange={(e) =>
                updateStrategy("cost_price", Number(e.target.value))
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>备注</Label>
          <Textarea
            disabled={!isEditing}
            value={strategy.remark || ""}
            onChange={(e) =>
              setProduct((p) => ({
                ...p,
                pricing_strategy: { ...strategy, remark: e.target.value },
              }))
            }
            placeholder="填写价格策略备注"
            rows={3}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>默认工艺路线</Label>
            <Select
              disabled={!isEditing}
              value={binding?.route_id || ""}
              onValueChange={updateRoute}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择工艺路线" />
              </SelectTrigger>
              <SelectContent>
                {routes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>工艺版本</Label>
            <Select
              disabled={!isEditing}
              value={binding?.version_id || ""}
              onValueChange={updateVersion}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择版本" />
              </SelectTrigger>
              <SelectContent>
                {routeVersions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {binding && (
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            已绑定工艺路线：{binding.route_name}（{binding.route_code}）/ 版本{" "}
            {binding.version_code}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SizeCombobox({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(inputValue.toLowerCase()),
  );

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-8 w-full justify-between px-2 text-xs font-normal"
        >
          <span className="truncate">{value || "选择或输入尺寸"}</span>
          <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="输入新尺寸或搜索..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              <button
                type="button"
                onClick={() => {
                  onChange(inputValue.trim());
                  setOpen(false);
                }}
                className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                使用「{inputValue.trim()}」
              </button>
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                  }}
                >
                  <span className={value === option ? "font-medium" : ""}>
                    {option}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {inputValue && !filtered.includes(inputValue.trim()) && (
              <CommandGroup>
                <CommandItem
                  value={`__new__${inputValue.trim()}`}
                  onSelect={() => {
                    onChange(inputValue.trim());
                    setOpen(false);
                  }}
                >
                  新建尺寸「{inputValue.trim()}」
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


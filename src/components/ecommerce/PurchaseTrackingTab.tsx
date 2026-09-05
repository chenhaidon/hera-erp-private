import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  CalendarIcon,
  Plus,
  Trash2,
  FileDown,
  Package,
  Upload,
  Search,
  X,
  Check,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { utils, writeFile } from 'xlsx';
import { supabase } from '@/db/supabase';
import type { EcommercePurchaseTracking, Product } from '@/types';

interface EditableRow extends EcommercePurchaseTracking {
  _isNew?: boolean;
  _isEditing?: boolean;
}

type SummaryMode = 'none' | 'supplier' | 'platform';

interface SummaryRow {
  id: string;
  key: string;
  label: string;
  order_quantity: number;
  cutting_quantity: number;
  production_quantity: number;
  shipment_quantity: number;
  return_quantity: number;
  details: EcommercePurchaseTracking[];
}

function sanitizeFileName(name: string) {
  const base = name.replace(/[^a-zA-Z0-9.]/g, '_').replace(/_+/g, '_');
  const ext = base.split('.').pop() || 'bin';
  const stem = base.slice(0, base.lastIndexOf('.')) || 'file';
  return `${stem.slice(0, 40)}_${Date.now()}.${ext}`;
}

function compressImage(file: File, maxWidth = 1080, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法创建 canvas 上下文'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('压缩失败'))),
        'image/webp',
        quality
      );
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}

async function uploadImage(file: File, folder: string): Promise<string | null> {
  const bucket = 'ecommerce-images';
  let uploadFile = file;
  const isImage = file.type.startsWith('image/');
  const maxSize = 1024 * 1024;

  if (file.size > maxSize && isImage) {
    try {
      const blob = await compressImage(file);
      uploadFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
        type: 'image/webp',
      });
      toast.info(`${file.name} 已压缩至 ${(uploadFile.size / 1024 / 1024).toFixed(2)}MB`);
      if (uploadFile.size > maxSize) {
        toast.error('压缩后仍超过 1MB，请重新选择');
        return null;
      }
    } catch {
      toast.error('图片压缩失败');
      return null;
    }
  } else if (file.size > maxSize) {
    toast.error('文件超过 1MB，请压缩后上传');
    return null;
  }

  const path = `${folder}/${sanitizeFileName(uploadFile.name)}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, uploadFile, { contentType: uploadFile.type });

  if (error || !data) {
    toast.error(`上传失败: ${error?.message || '未知错误'}`);
    return null;
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  toast.success('图片上传成功');
  return urlData.publicUrl;
}

function ProductPicker({
  products,
  selectedId,
  onSelect,
}: {
  products: Product[];
  selectedId?: string;
  onSelect: (product: Product) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () =>
      products
        .filter((p) => p.status === 'active')
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.code.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 50),
    [products, query]
  );

  return (
    <div className="w-72 space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索成品档案"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="max-h-60 overflow-y-auto rounded-md border">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            未找到匹配产品
          </div>
        )}
        {filtered.map((p) => {
          const image = p.images?.[0];
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted',
                selectedId === p.id && 'bg-primary/10'
              )}
            >
              {image ? (
                <img src={image} alt={p.name} className="h-8 w-8 rounded object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <span className="flex-1 truncate">
                {p.code} - {p.name}
              </span>
              {selectedId === p.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const emptyForm: EditableRow = {
  id: '',
  supplier_id: '',
  supplier_name: '',
  product_name: '',
  product_specification: '',
  product_image_url: '',
  order_quantity: 0,
  cutting_quantity: 0,
  production_quantity: 0,
  shipment_quantity: 0,
  return_quantity: 0,
  platform_merchant_name: '',
  record_date: format(new Date(), 'yyyy-MM-dd'),
  _isNew: true,
  _isEditing: true,
};

export default function PurchaseTrackingTab() {
  const store = useAppStore();
  const products = store.products || [];

  const [records, setRecords] = useState<EditableRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<EditableRow>(emptyForm);
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('none');
  const [expandedSummaryKeys, setExpandedSummaryKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRecords(
      store.ecommercePurchaseTrackings.map((item) => ({ ...item, _isEditing: false }))
    );
    setLoaded(true);
  }, [store.ecommercePurchaseTrackings]);

  const filteredRecords = useMemo(() => {
    if (!startDate || !endDate) return records;
    return records.filter(
      (row) => row.record_date >= startDate && row.record_date <= endDate
    );
  }, [records, startDate, endDate]);

  const summaryRows = useMemo<SummaryRow[]>(() => {
    if (summaryMode === 'none') return [];
    const map = new Map<string, SummaryRow>();
    for (const row of filteredRecords) {
      const key = summaryMode === 'supplier' ? getSupplierName(row) || '未填写' : row.platform_merchant_name || '未填写';
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          key,
          label: key,
          order_quantity: 0,
          cutting_quantity: 0,
          production_quantity: 0,
          shipment_quantity: 0,
          return_quantity: 0,
          details: [],
        });
      }
      const item = map.get(key)!;
      item.order_quantity += row.order_quantity || 0;
      item.cutting_quantity += row.cutting_quantity || 0;
      item.production_quantity += row.production_quantity || 0;
      item.shipment_quantity += row.shipment_quantity || 0;
      item.return_quantity += row.return_quantity || 0;
      item.details.push(row);
    }
    return Array.from(map.values());
  }, [filteredRecords, summaryMode]);

  const displayTotals = useMemo(() => {
    const source = summaryMode === 'none' ? filteredRecords : summaryRows;
    return source.reduce(
      (acc, row) => ({
        order_quantity: acc.order_quantity + (row.order_quantity || 0),
        cutting_quantity: acc.cutting_quantity + (row.cutting_quantity || 0),
        production_quantity: acc.production_quantity + (row.production_quantity || 0),
        shipment_quantity: acc.shipment_quantity + (row.shipment_quantity || 0),
        return_quantity: acc.return_quantity + (row.return_quantity || 0),
      }),
      {
        order_quantity: 0,
        cutting_quantity: 0,
        production_quantity: 0,
        shipment_quantity: 0,
        return_quantity: 0,
      }
    );
  }, [filteredRecords, summaryRows, summaryMode]);

  const isSummaryMode = summaryMode !== 'none';

  function handleOpenForm() {
    setForm({
      ...emptyForm,
      id: crypto.randomUUID(),
      supplier_id: undefined,
      supplier_name: '',
      record_date: format(new Date(), 'yyyy-MM-dd'),
    });
    setFormOpen(true);
  }

  function handleCloseForm() {
    setFormOpen(false);
    setForm(emptyForm);
  }

  function updateForm(partial: Partial<EditableRow>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function handleSelectProduct(product: Product) {
    updateForm({
      product_id: product.id,
      product_name: product.name,
      product_specification: product.specification || '',
      product_image_url: product.images?.[0] || '',
    });
  }

  function handleClearProductImage() {
    updateForm({ product_image_url: '' });
  }

  async function handleImageUpload(file: File) {
    const url = await uploadImage(file, 'records');
    if (url) {
      updateForm({ product_image_url: url });
    }
  }

  function getSupplierName(row: EcommercePurchaseTracking) {
    return (row.supplier_name || '').trim();
  }

  function validateRow(row: EcommercePurchaseTracking): string | null {
    if (!row.supplier_name?.trim()) return '请填写供货厂家名称';
    if (!row.product_name.trim()) return '请填写产品名称';
    if (!row.order_quantity || row.order_quantity <= 0) return '订单数量必须为正整数';
    if (row.cutting_quantity < 0) return '开料数量不能为负数';
    if (row.production_quantity < 0) return '生产数量不能为负数';
    if (row.shipment_quantity < 0) return '发货数量不能为负数';
    if (row.return_quantity < 0) return '退货数量不能为负数';
    if (!row.platform_merchant_name.trim()) return '请填写平台或商家名称';
    if (row.platform_merchant_name.length > 100) return '平台或商家名称最多100字';
    if (!row.record_date) return '请选择日期';
    return null;
  }

  async function handleSaveForm() {
    const error = validateRow(form);
    if (error) {
      toast.error(error);
      return;
    }

    const payload: EcommercePurchaseTracking = {
      id: form.id || crypto.randomUUID(),
      supplier_name: form.supplier_name?.trim(),
      product_id: form.product_id,
      product_name: form.product_name.trim(),
      product_specification: form.product_specification?.trim(),
      product_image_url: form.product_image_url?.trim(),
      order_quantity: form.order_quantity,
      cutting_quantity: form.cutting_quantity || 0,
      production_quantity: form.production_quantity || 0,
      shipment_quantity: form.shipment_quantity || 0,
      return_quantity: form.return_quantity || 0,
      platform_merchant_name: form.platform_merchant_name.trim(),
      record_date: form.record_date,
    };

    try {
      await store.addEcommercePurchaseTracking(payload);
      handleCloseForm();
      toast.success('新增成功');
    } catch (e) {
      toast.error('保存失败');
    }
  }

  function handleEditRow(id: string) {
    const target = records.find((r) => r.id === id);
    if (!target) return;
    setForm({ ...target, _isNew: false, _isEditing: true });
    setFormOpen(true);
  }

  async function handleSaveEdit() {
    const error = validateRow(form);
    if (error) {
      toast.error(error);
      return;
    }

    const payload: EcommercePurchaseTracking = {
      id: form.id,
      supplier_name: form.supplier_name?.trim(),
      product_id: form.product_id,
      product_name: form.product_name.trim(),
      product_specification: form.product_specification?.trim(),
      product_image_url: form.product_image_url?.trim(),
      order_quantity: form.order_quantity,
      cutting_quantity: form.cutting_quantity || 0,
      production_quantity: form.production_quantity || 0,
      shipment_quantity: form.shipment_quantity || 0,
      return_quantity: form.return_quantity || 0,
      platform_merchant_name: form.platform_merchant_name.trim(),
      record_date: form.record_date,
    };

    try {
      await store.updateEcommercePurchaseTracking(payload);
      handleCloseForm();
      toast.success('保存成功');
    } catch (e) {
      toast.error('保存失败');
    }
  }

  async function handleDeleteRow(id: string) {
    if (!confirm('确认删除该记录吗？')) return;
    try {
      await store.deleteEcommercePurchaseTracking(id);
      toast.success('删除成功');
    } catch (e) {
      toast.error('删除失败');
    }
  }

  function handleExportExcel() {
    const modeSuffix =
      summaryMode === 'supplier' ? '_按厂家汇总' : summaryMode === 'platform' ? '_按平台汇总' : '';
    if (isSummaryMode) {
      const rows = summaryRows.map((row) => ({
        [summaryMode === 'supplier' ? '供货厂家名称' : '平台或商家名称']: row.label,
        订单数量: row.order_quantity,
        开料数量: row.cutting_quantity,
        生产数量: row.production_quantity,
        发货数量: row.shipment_quantity,
        退货数量: row.return_quantity,
      }));
      const totalRow = {
        [summaryMode === 'supplier' ? '供货厂家名称' : '平台或商家名称']: '合计',
        订单数量: displayTotals.order_quantity,
        开料数量: displayTotals.cutting_quantity,
        生产数量: displayTotals.production_quantity,
        发货数量: displayTotals.shipment_quantity,
        退货数量: displayTotals.return_quantity,
      };
      const ws = utils.json_to_sheet([...rows, totalRow]);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, '采购发货汇总');
      const dateStr = format(new Date(), 'yyyyMMdd');
      writeFile(wb, `采购发货跟踪单${modeSuffix}_${dateStr}.xlsx`);
      toast.success('导出成功');
      return;
    }

    const rows = filteredRecords.map((row) => ({
      供货厂家名称: getSupplierName(row),
      产品名称: row.product_name,
      产品规格: row.product_specification || '',
      订单数量: row.order_quantity,
      开料数量: row.cutting_quantity,
      生产数量: row.production_quantity,
      发货数量: row.shipment_quantity,
      退货数量: row.return_quantity,
      平台或商家名称: row.platform_merchant_name,
      日期: row.record_date,
    }));
    const totalRow = {
      供货厂家名称: '合计',
      产品名称: '',
      产品规格: '',
      订单数量: displayTotals.order_quantity,
      开料数量: displayTotals.cutting_quantity,
      生产数量: displayTotals.production_quantity,
      发货数量: displayTotals.shipment_quantity,
      退货数量: displayTotals.return_quantity,
      平台或商家名称: '',
      日期: '',
    };
    const ws = utils.json_to_sheet([...rows, totalRow]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, '采购发货跟踪单');
    const dateStr = format(new Date(), 'yyyyMMdd');
    writeFile(wb, `采购发货跟踪单_${dateStr}.xlsx`);
    toast.success('导出成功');
  }

  if (!loaded) {
    return (
      <div className="space-y-4">
        <div className="text-muted-foreground">数据加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">采购发货跟踪单</h2>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <Button variant="outline" onClick={handleExportExcel}>
                <FileDown className="mr-2 h-4 w-4" />
                导出 Excel
              </Button>
              <Button onClick={handleOpenForm}>
                <Plus className="mr-2 h-4 w-4" />
                新增记录
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
              <div className="space-y-2">
                <Label className="text-xs">开始日期</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal md:w-40',
                        !startDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? (
                        format(new Date(startDate), 'yyyy-MM-dd')
                      ) : (
                        <span>选择日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate ? new Date(startDate) : undefined}
                      onSelect={(date) =>
                        setStartDate(date ? format(date, 'yyyy-MM-dd') : '')
                      }
                      initialFocus
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">结束日期</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal md:w-40',
                        !endDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? (
                        format(new Date(endDate), 'yyyy-MM-dd')
                      ) : (
                        <span>选择日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate ? new Date(endDate) : undefined}
                      onSelect={(date) =>
                        setEndDate(date ? format(date, 'yyyy-MM-dd') : '')
                      }
                      initialFocus
                      locale={zhCN}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">汇总方式</Label>
                <Select
                  value={summaryMode}
                  onValueChange={(value) => setSummaryMode(value as SummaryMode)}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="选择汇总方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不汇总</SelectItem>
                    <SelectItem value="supplier">按供货厂家汇总</SelectItem>
                    <SelectItem value="platform">按平台汇总</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="secondary"
                onClick={() => {
                  if (!startDate) {
                    toast.error('请选择开始日期');
                    return;
                  }
                  if (!endDate) {
                    toast.error('请选择结束日期');
                    return;
                  }
                  if (endDate < startDate) {
                    toast.error('结束日期不能早于开始日期');
                    return;
                  }
                  toast.success('筛选已应用');
                }}
                className="w-full md:w-auto"
              >
                筛选
              </Button>
            </div>
          </div>

          <div className="w-full max-w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {isSummaryMode ? (
                    <>
                      <TableHead className="whitespace-nowrap">
                        {summaryMode === 'supplier' ? '供货厂家名称' : '平台或商家名称'}
                      </TableHead>
                      <TableHead className="whitespace-nowrap">订单数量</TableHead>
                      <TableHead className="whitespace-nowrap">开料数量</TableHead>
                      <TableHead className="whitespace-nowrap">生产数量</TableHead>
                      <TableHead className="whitespace-nowrap">发货数量</TableHead>
                      <TableHead className="whitespace-nowrap">退货数量</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="whitespace-nowrap">供货厂家名称</TableHead>
                      <TableHead className="whitespace-nowrap">产品名称</TableHead>
                      <TableHead className="whitespace-nowrap">规格</TableHead>
                      <TableHead className="whitespace-nowrap">产品图片</TableHead>
                      <TableHead className="whitespace-nowrap">订单数量</TableHead>
                      <TableHead className="whitespace-nowrap">开料数量</TableHead>
                      <TableHead className="whitespace-nowrap">生产数量</TableHead>
                      <TableHead className="whitespace-nowrap">发货数量</TableHead>
                      <TableHead className="whitespace-nowrap">退货数量</TableHead>
                      <TableHead className="whitespace-nowrap">平台/商家</TableHead>
                      <TableHead className="whitespace-nowrap">日期</TableHead>
                      <TableHead className="whitespace-nowrap">操作</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isSummaryMode ? (
                  <>
                    {summaryRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-muted-foreground"
                        >
                          暂无符合条件的数据
                        </TableCell>
                      </TableRow>
                    )}
                    {summaryRows.map((row) => {
                      const isExpanded = expandedSummaryKeys.has(row.key);
                      return (
                        <>
                          <TableRow
                            key={row.id}
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => {
                              setExpandedSummaryKeys((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.key)) {
                                  next.delete(row.key);
                                } else {
                                  next.add(row.key);
                                }
                                return next;
                              });
                            }}
                          >
                            <TableCell className="whitespace-nowrap">
                              <div className="flex max-w-60 items-center gap-1">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate">{row.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{row.order_quantity}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.cutting_quantity}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.production_quantity}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.shipment_quantity}</TableCell>
                            <TableCell className="whitespace-nowrap">{row.return_quantity}</TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={6} className="p-0">
                                <div className="bg-muted/20 p-3">
                                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                                    明细记录（{row.details.length} 条）
                                  </div>
                                  <div className="w-full max-w-full overflow-x-auto rounded-md border bg-card">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                          {summaryMode === 'supplier' ? (
                                            <>
                                              <TableHead className="whitespace-nowrap">产品名称</TableHead>
                                              <TableHead className="whitespace-nowrap">图片</TableHead>
                                              <TableHead className="whitespace-nowrap">规格</TableHead>
                                              <TableHead className="whitespace-nowrap">平台/商家</TableHead>
                                            </>
                                          ) : (
                                            <>
                                              <TableHead className="whitespace-nowrap">供货厂家名称</TableHead>
                                              <TableHead className="whitespace-nowrap">产品名称</TableHead>
                                              <TableHead className="whitespace-nowrap">图片</TableHead>
                                              <TableHead className="whitespace-nowrap">规格</TableHead>
                                            </>
                                          )}
                                          <TableHead className="whitespace-nowrap">订单数量</TableHead>
                                          <TableHead className="whitespace-nowrap">开料数量</TableHead>
                                          <TableHead className="whitespace-nowrap">生产数量</TableHead>
                                          <TableHead className="whitespace-nowrap">发货数量</TableHead>
                                          <TableHead className="whitespace-nowrap">退货数量</TableHead>
                                          <TableHead className="whitespace-nowrap">日期</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {row.details.map((detail) => (
                                          <TableRow key={detail.id} className="hover:bg-transparent">
                                            {summaryMode === 'supplier' ? (
                                              <>
                                                <TableCell className="whitespace-nowrap">
                                                  <div className="max-w-48 whitespace-normal break-words">
                                                    {detail.product_name}
                                                  </div>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                  {detail.product_image_url ? (
                                                    <img
                                                      src={detail.product_image_url}
                                                      alt={detail.product_name}
                                                      className="h-10 w-10 rounded object-cover"
                                                    />
                                                  ) : (
                                                    <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-muted-foreground">
                                                      <Package className="h-4 w-4" />
                                                    </div>
                                                  )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                  <div className="max-w-32 whitespace-normal break-words">
                                                    {detail.product_specification || '-'}
                                                  </div>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                  <div className="max-w-40 whitespace-normal break-words">
                                                    {detail.platform_merchant_name}
                                                  </div>
                                                </TableCell>
                                              </>
                                            ) : (
                                              <>
                                                <TableCell className="whitespace-nowrap">
                                                  {getSupplierName(detail)}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                  <div className="max-w-48 whitespace-normal break-words">
                                                    {detail.product_name}
                                                  </div>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                  {detail.product_image_url ? (
                                                    <img
                                                      src={detail.product_image_url}
                                                      alt={detail.product_name}
                                                      className="h-10 w-10 rounded object-cover"
                                                    />
                                                  ) : (
                                                    <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-muted-foreground">
                                                      <Package className="h-4 w-4" />
                                                    </div>
                                                  )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                  <div className="max-w-32 whitespace-normal break-words">
                                                    {detail.product_specification || '-'}
                                                  </div>
                                                </TableCell>
                                              </>
                                            )}
                                            <TableCell className="whitespace-nowrap">{detail.order_quantity}</TableCell>
                                            <TableCell className="whitespace-nowrap">{detail.cutting_quantity}</TableCell>
                                            <TableCell className="whitespace-nowrap">{detail.production_quantity}</TableCell>
                                            <TableCell className="whitespace-nowrap">{detail.shipment_quantity}</TableCell>
                                            <TableCell className="whitespace-nowrap">{detail.return_quantity}</TableCell>
                                            <TableCell className="whitespace-nowrap">{detail.record_date}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {filteredRecords.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={12}
                          className="h-24 text-center text-muted-foreground"
                        >
                          暂无记录，点击「新增记录」添加
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredRecords.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">
                          {getSupplierName(row)}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-60 whitespace-normal break-words">
                            {row.product_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-40 whitespace-normal break-words">
                            {row.product_specification || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.product_image_url ? (
                            <img
                              src={row.product_image_url}
                              alt={row.product_name}
                              className="h-14 w-14 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded bg-muted text-muted-foreground">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{row.order_quantity}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.cutting_quantity}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.production_quantity}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.shipment_quantity}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.return_quantity}</TableCell>
                        <TableCell>
                          <div className="max-w-48 whitespace-normal break-words">
                            {row.platform_merchant_name}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{row.record_date}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditRow(row.id)}>
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteRow(row.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                {(isSummaryMode ? summaryRows.length > 0 : filteredRecords.length > 0) && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell className="whitespace-nowrap">合计</TableCell>
                    {isSummaryMode ? null : <TableCell className="whitespace-nowrap" colSpan={3} />}
                    <TableCell className="whitespace-nowrap">{displayTotals.order_quantity}</TableCell>
                    <TableCell className="whitespace-nowrap">{displayTotals.cutting_quantity}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {displayTotals.production_quantity}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{displayTotals.shipment_quantity}</TableCell>
                    <TableCell className="whitespace-nowrap">{displayTotals.return_quantity}</TableCell>
                    {isSummaryMode ? null : <TableCell className="whitespace-nowrap" colSpan={3} />}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filteredRecords.length === 0 && !isSummaryMode && (
            <p className="text-sm text-muted-foreground">暂无跟踪记录</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form._isNew ? '新增采购发货记录' : '编辑采购发货记录'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier">供货厂家名称</Label>
              <Input
                id="supplier"
                value={form.supplier_name || ''}
                onChange={(e) => updateForm({ supplier_name: e.target.value })}
                placeholder="如：义乌小商品批发市场、拼多多某店"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_name">产品名称</Label>
              <div className="flex gap-2">
                <Input
                  id="product_name"
                  value={form.product_name}
                  onChange={(e) =>
                    updateForm({ product_name: e.target.value, product_id: undefined })
                  }
                  placeholder="可直接输入产品名称"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="icon">
                      <Search className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="end">
                    <ProductPicker
                      products={products}
                      selectedId={form.product_id}
                      onSelect={handleSelectProduct}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specification">规格</Label>
              <Input
                id="specification"
                value={form.product_specification || ''}
                onChange={(e) => updateForm({ product_specification: e.target.value })}
                placeholder="可直接输入规格"
              />
            </div>

            <div className="space-y-2">
              <Label>产品图片</Label>
              <div className="flex items-center gap-3">
                {form.product_image_url ? (
                  <div className="relative">
                    <img
                      src={form.product_image_url}
                      alt="产品图片"
                      className="h-20 w-20 rounded object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleClearProductImage}
                      className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded bg-muted text-muted-foreground">
                    <Package className="h-6 w-6" />
                  </div>
                )}
                <ImageUploadButton onUpload={handleImageUpload} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_quantity">订单数量</Label>
              <Input
                id="order_quantity"
                type="number"
                min={1}
                value={form.order_quantity || ''}
                onChange={(e) =>
                  updateForm({ order_quantity: parseInt(e.target.value, 10) || 0 })
                }
                placeholder="请输入"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cutting_quantity">开料数量</Label>
              <Input
                id="cutting_quantity"
                type="number"
                min={0}
                value={form.cutting_quantity || ''}
                onChange={(e) =>
                  updateForm({ cutting_quantity: parseInt(e.target.value, 10) || 0 })
                }
                placeholder="请输入"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="production_quantity">生产数量</Label>
              <Input
                id="production_quantity"
                type="number"
                min={0}
                value={form.production_quantity || ''}
                onChange={(e) =>
                  updateForm({ production_quantity: parseInt(e.target.value, 10) || 0 })
                }
                placeholder="请输入"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipment_quantity">发货数量</Label>
              <Input
                id="shipment_quantity"
                type="number"
                min={0}
                value={form.shipment_quantity || ''}
                onChange={(e) =>
                  updateForm({ shipment_quantity: parseInt(e.target.value, 10) || 0 })
                }
                placeholder="请输入"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="return_quantity">退货数量</Label>
              <Input
                id="return_quantity"
                type="number"
                min={0}
                value={form.return_quantity || ''}
                onChange={(e) =>
                  updateForm({ return_quantity: parseInt(e.target.value, 10) || 0 })
                }
                placeholder="请输入"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">平台或商家名称</Label>
              <Input
                id="platform"
                value={form.platform_merchant_name}
                onChange={(e) => updateForm({ platform_merchant_name: e.target.value })}
                placeholder="如：拼多多-XX旗舰店"
              />
            </div>

            <div className="space-y-2">
              <Label>日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.record_date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.record_date ? (
                      format(new Date(form.record_date), 'yyyy-MM-dd')
                    ) : (
                      <span>选择日期</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.record_date ? new Date(form.record_date) : undefined}
                    onSelect={(date) =>
                      updateForm({ record_date: date ? format(date, 'yyyy-MM-dd') : '' })
                    }
                    initialFocus
                    locale={zhCN}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseForm}>
              取消
            </Button>
            <Button onClick={form._isNew ? handleSaveForm : handleSaveEdit}>
              {form._isNew ? '新增' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImageUploadButton({ onUpload }: { onUpload: (file: File) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onUpload(file);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <>
      <Input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-1 h-4 w-4" />
        {uploading ? '上传中' : '上传图片'}
      </Button>
    </>
  );
}

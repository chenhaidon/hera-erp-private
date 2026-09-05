import { useRef } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import { nanoid } from '@/lib/utils';
import type { ContractCraftSheet, ContractCraftSheetRow } from '@/types/contract';

interface CraftSheetMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ContractCraftSheet | null;
  onDraftChange: (draft: ContractCraftSheet) => void;
  onSave: () => void;
}

export function CraftSheetMaintenanceDialog({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  onSave,
}: CraftSheetMaintenanceDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!draft) return null;

  const handleDownloadTemplate = () => {
    const headers = ['货号', '尺寸', ...(draft.colors || [])];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '生产工艺单');
    const blob = new Blob(
      [XLSX.write(wb, { bookType: 'xlsx', type: 'array' })],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '生产工艺单导入模板.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportExcel = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      }) as (string | number)[][];
      if (rows.length < 2) {
        toast.error('Excel 内容为空或缺少表头');
        return;
      }
      const headers = rows[0].map((h) => String(h).trim());
      const productCodeIdx = headers.findIndex((h) => h.includes('货号'));
      const sizeIdx = headers.findIndex((h) => h.includes('尺寸'));
      if (productCodeIdx === -1 || sizeIdx === -1) {
        toast.error('Excel 缺少“货号”或“尺寸”列');
        return;
      }

      const currentColors = [...(draft.colors || [])];
      const colorIdxMap: Record<string, number> = {};
      for (const color of currentColors) {
        const idx = headers.findIndex((h) => h === color);
        if (idx !== -1) colorIdxMap[color] = idx;
      }
      for (const header of headers) {
        if (header.includes('货号') || header.includes('尺寸')) continue;
        if (!currentColors.includes(header)) {
          currentColors.push(header);
        }
        colorIdxMap[header] = headers.indexOf(header);
      }

      const importedRows: ContractCraftSheetRow[] = [];
      for (const row of rows.slice(1)) {
        const productCode = String(row[productCodeIdx] || '').trim();
        if (!productCode) continue;
        const colorQuantities: Record<string, number> = {};
        for (const color of currentColors) {
          const idx = colorIdxMap[color];
          const raw = idx !== -1 ? row[idx] : 0;
          const qty = typeof raw === 'number' ? raw : parseInt(String(raw || '0'), 10) || 0;
          colorQuantities[color] = qty;
        }
        const total = Object.values(colorQuantities).reduce((a, b) => a + b, 0);
        importedRows.push({
          id: nanoid(),
          product_code: productCode,
          size: String(row[sizeIdx] || ''),
          color_quantities: colorQuantities,
          total_quantity: total,
        });
      }

      if (importedRows.length === 0) {
        toast.error('未找到有效数据行');
        return;
      }

      onDraftChange({
        ...draft,
        colors: currentColors,
        rows: [...draft.rows, ...importedRows],
      });
      toast.success(`成功导入 ${importedRows.length} 行数据`);
    } catch (err) {
      console.error('导入生产工艺单失败', err);
      toast.error('导入失败，请检查 Excel 格式');
    }
  };

  const addRow = () => {
    onDraftChange({
      ...draft,
      rows: [
        ...draft.rows,
        {
          id: nanoid(),
          product_code: '',
          size: '',
          color_quantities: Object.fromEntries(
            (draft.colors || []).map((c) => [c, 0]),
          ),
          total_quantity: 0,
        },
      ],
    });
  };

  const updateRow = (idx: number, updates: Partial<ContractCraftSheetRow>) => {
    const newRows = [...draft.rows];
    newRows[idx] = { ...newRows[idx], ...updates };
    onDraftChange({ ...draft, rows: newRows });
  };

  const deleteRow = (idx: number) => {
    const newRows = draft.rows.filter((_, i) => i !== idx);
    onDraftChange({ ...draft, rows: newRows });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-4xl bg-card border-border max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">维护生产工艺单</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">序号</Label>
              <Input
                value={draft.seq_no}
                onChange={(e) => {
                  onDraftChange({ ...draft, seq_no: e.target.value });
                }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">标题</Label>
              <Input
                value={draft.title || ''}
                onChange={(e) => {
                  onDraftChange({ ...draft, title: e.target.value });
                }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">客户合同号</Label>
              <Input
                value={draft.customer_contract_no || ''}
                onChange={(e) => {
                  onDraftChange({ ...draft, customer_contract_no: e.target.value });
                }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">完成日期</Label>
              <Input
                type="date"
                value={draft.finish_date || ''}
                onChange={(e) => {
                  onDraftChange({ ...draft, finish_date: e.target.value });
                }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">颜色列（用逗号分隔）</Label>
              <Input
                value={(draft.colors || []).join(',')}
                onChange={(e) => {
                  onDraftChange({
                    ...draft,
                    colors: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  });
                }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">工艺要求</Label>
              <Textarea
                value={draft.process_requirements}
                onChange={(e) => {
                  onDraftChange({ ...draft, process_requirements: e.target.value });
                }}
                className="min-h-[6rem] text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">明细行</div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  下载模板
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  导入 Excel
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImportExcel(file);
                    }
                    e.target.value = '';
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={addRow}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  新增行
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto rounded border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="whitespace-nowrap">货号</TableHead>
                    <TableHead className="whitespace-nowrap">尺寸</TableHead>
                    {(draft.colors || []).map((color) => (
                      <TableHead key={color} className="whitespace-nowrap">
                        {color}
                      </TableHead>
                    ))}
                    <TableHead className="whitespace-nowrap">小计</TableHead>
                    <TableHead className="whitespace-nowrap w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.rows.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap p-2">
                        <Input
                          value={row.product_code}
                          onChange={(e) => {
                            updateRow(idx, { product_code: e.target.value });
                          }}
                          className="h-8 text-xs min-w-[8rem]"
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap p-2">
                        <Input
                          value={row.size}
                          onChange={(e) => {
                            updateRow(idx, { size: e.target.value });
                          }}
                          className="h-8 text-xs min-w-[10rem]"
                        />
                      </TableCell>
                      {(draft.colors || []).map((color) => (
                        <TableCell key={color} className="whitespace-nowrap p-2">
                          <Input
                            type="number"
                            min={0}
                            value={row.color_quantities[color] || 0}
                            onChange={(e) => {
                              const newQty = parseInt(e.target.value || '0', 10);
                              const newQuantities = {
                                ...row.color_quantities,
                                [color]: newQty,
                              };
                              const newTotal = Object.values(newQuantities).reduce(
                                (a, b) => a + (b || 0),
                                0,
                              );
                              updateRow(idx, {
                                color_quantities: newQuantities,
                                total_quantity: newTotal,
                              });
                            }}
                            className="h-8 text-xs min-w-[4rem]"
                          />
                        </TableCell>
                      ))}
                      <TableCell className="whitespace-nowrap p-2 text-xs font-medium">
                        {row.total_quantity}
                      </TableCell>
                      <TableCell className="whitespace-nowrap p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => deleteRow(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {draft.rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4 + (draft.colors || []).length}
                        className="text-center text-muted-foreground py-4"
                      >
                        暂无明细行，请点击“新增行”添加
                      </TableCell>
                    </TableRow>
                  )}
                  {draft.rows.length > 0 && (
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell className="whitespace-nowrap" colSpan={2}>
                        TOTAL
                      </TableCell>
                      {(draft.colors || []).map((color) => (
                        <TableCell key={color} className="whitespace-nowrap">
                          {draft.rows.reduce(
                            (sum, r) => sum + (r.color_quantities[color] || 0),
                            0,
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="whitespace-nowrap">
                        {draft.rows.reduce(
                          (sum, r) => sum + (r.total_quantity || 0),
                          0,
                        )}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={onSave}>
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

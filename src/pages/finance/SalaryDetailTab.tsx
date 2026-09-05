import { useMemo, useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/store';
import { toast } from 'sonner';
import { utils, writeFile } from 'xlsx';
import {
  FileDown,
  Printer,
  Lock,
} from 'lucide-react';
import type { PayrollDetail } from '@/types';

const CY = (amount: number) =>
  `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/** 允许查看该页面的角色 */
const ALLOWED_ROLES = ['admin', 'finance', 'hr'];

/** 工序来源筛选 */
type SourceFilter = 'all' | 'internal' | 'outsourcing';

/** 扣款字段配置 */
const DEDUCTION_FIELDS: {
  key: keyof PayrollDetail;
  label: string;
}[] = [
  { key: 'advance_payment', label: '预支款' },
  { key: 'repair_fee', label: '修补费' },
  { key: 'thread_cutting', label: '剪线头' },
  { key: 'waste_deduction', label: '扣废被' },
  { key: 'material_purchase', label: '买材料' },
];

/** 从工单工序获取外协单价 */
function getOutsourcingPrice(
  op: { outsourcing_price?: number; price?: number },
  productName: string,
): number {
  const opPrice = op.outsourcing_price;
  if (typeof opPrice === 'number' && opPrice > 0) return opPrice;
  const fallback = op.price;
  if (typeof fallback === 'number' && fallback > 0) return fallback;
  void productName;
  return 0;
}

export function SalaryDetailTab() {
  const store = useAppStore();
  const role = store.currentRole;
  const [month, setMonth] = useState(currentMonth());
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [lockOpen, setLockOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 月份、筛选或每页条数变化时重置到第一页
  useEffect(() => {
    setPage(1);
  }, [month, sourceFilter, pageSize]);

  const canView = ALLOWED_ROLES.includes(role);

  /** 从报工记录与外协质检回货记录聚合生成薪资明细 */
  const allRows = useMemo<PayrollDetail[]>(() => {
    if (!canView) return [];
    const saved = store.payrollDetails.filter((p) => p.month === month);
    const savedMap = new Map(saved.map((s) => [s.id, s]));
    const groups = new Map<string, PayrollDetail>();

    // 1) 内部：生产管理工人报工
    for (const wo of store.workOrders) {
      const product = store.products.find((p) => p.id === wo.product_id);
      const sku = wo.sku_id
        ? product?.skus.find((s) => s.id === wo.sku_id)
        : undefined;
      const color = sku?.color || '';
      const specification = sku?.specification || wo.sku_summary || '';

      for (const op of wo.operations) {
        for (const r of op.reports || []) {
          if (!r.report_time.startsWith(month)) continue;
          const key = `${month}|internal|${r.operator_name}|${wo.product_code}|${color}|${specification}|${r.operation_name}`;
          const existing = groups.get(key);
          if (existing) {
            existing.quantity += r.qty;
            existing.amount = Number((existing.quantity * existing.unit_price).toFixed(2));
          } else {
            groups.set(key, {
              id: key,
              month,
              process_source: 'internal',
              employee_name: r.operator_name,
              product_code: wo.product_code,
              color,
              specification,
              operation_name: r.operation_name,
              quantity: r.qty,
              unit_price: r.unit_price,
              amount: Number((r.qty * r.unit_price).toFixed(2)),
              advance_payment: 0,
              repair_fee: 0,
              thread_cutting: 0,
              waste_deduction: 0,
              material_purchase: 0,
              total_deduction: 0,
              salary_amount: Number((r.qty * r.unit_price).toFixed(2)),
              remark: '',
              is_locked: false,
              updated_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    // 2) 外协：外协质检回货合格记录
    for (const ret of store.outsourceReturns) {
      if (!ret.return_date.startsWith(month)) continue;
      const wo = store.workOrders.find((w) => w.id === ret.work_order_id);
      if (!wo) continue;
      const product = store.products.find((p) => p.id === wo.product_id);
      const sku = wo.sku_id
        ? product?.skus.find((s) => s.id === wo.sku_id)
        : undefined;
      const color = sku?.color || '';
      const specification = sku?.specification || wo.sku_summary || '';
      const operationName = ret.operation_name || '';
      const qualifiedQty = ret.qualified_quantity || 0;
      if (qualifiedQty <= 0) continue;
      // 找到对应工单工序，获取外协单价
      const woOp = wo.operations.find(
        (o) => o.name === operationName || o.code === ret.operation_code,
      );
      const unitPrice = getOutsourcingPrice(
        woOp ?? {},
        operationName,
      );
      const factoryName = ret.factory_name || '';
      const key = `${month}|outsourcing|${factoryName}|${wo.product_code}|${color}|${specification}|${operationName}`;
      const existing = groups.get(key);
      if (existing) {
        existing.quantity += qualifiedQty;
        existing.amount = Number((existing.quantity * existing.unit_price).toFixed(2));
      } else {
        const amount = Number((qualifiedQty * unitPrice).toFixed(2));
        groups.set(key, {
          id: key,
          month,
          process_source: 'outsourcing',
          employee_name: factoryName,
          product_code: wo.product_code,
          color,
          specification,
          operation_name: operationName,
          quantity: qualifiedQty,
          unit_price: unitPrice,
          amount,
          advance_payment: 0,
          repair_fee: 0,
          thread_cutting: 0,
          waste_deduction: 0,
          material_purchase: 0,
          total_deduction: 0,
          salary_amount: amount,
          remark: '',
          is_locked: false,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // 合并已保存的扣款/备注/锁定状态
    const result: PayrollDetail[] = [];
    for (const [key, g] of groups) {
      const s = savedMap.get(key);
      if (s) {
        result.push({
          ...g,
          ...s,
          quantity: g.quantity,
          unit_price: g.unit_price,
          amount: g.amount,
          process_source: g.process_source,
        });
      } else {
        result.push(g);
      }
    }
    return result.sort((a, b) =>
      a.employee_name.localeCompare(b.employee_name, 'zh-CN') ||
      a.product_code.localeCompare(b.product_code) ||
      a.operation_name.localeCompare(b.operation_name, 'zh-CN'),
    );
  }, [store, month, canView]);

  const rows = useMemo(
    () =>
      sourceFilter === 'all'
        ? allRows
        : allRows.filter((r) => r.process_source === sourceFilter),
    [allRows, sourceFilter],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage],
  );

  const isLocked = useMemo(
    () => allRows.length > 0 && allRows.every((r) => r.is_locked),
    [allRows],
  );

  /** 更新某行扣款/备注字段 */
  const updateField = useCallback(
    (rowId: string, field: keyof PayrollDetail, value: number | string) => {
      const target = allRows.find((r) => r.id === rowId);
      if (!target || target.is_locked) return;
      const updated: PayrollDetail = { ...target, [field]: value, updated_at: new Date().toISOString() };
      const totalDeduction = Number(
        (
          Number(updated.advance_payment) +
          Number(updated.repair_fee) +
          Number(updated.thread_cutting) +
          Number(updated.waste_deduction) +
          Number(updated.material_purchase)
        ).toFixed(2),
      );
      updated.total_deduction = totalDeduction;
      updated.salary_amount = Number((updated.amount - totalDeduction).toFixed(2));
      store.upsertPayrollDetail(updated);
    },
    [allRows, store],
  );

  const persistRows = useCallback(() => {
    if (allRows.length === 0) return;
    store.replacePayrollDetails(month, allRows);
  }, [allRows, month, store]);

  function handleExport() {
    if (rows.length === 0) {
      toast.error('当前筛选条件下暂无记录，无法导出');
      return;
    }
    persistRows();
    const data = rows.map((r) => ({
      姓名: r.employee_name,
      货号: r.product_code,
      颜色: r.color,
      规格: r.specification,
      工序: r.operation_name,
      工序来源: r.process_source === 'internal' ? '内部' : '外协',
      数量: r.quantity,
      单价: r.unit_price,
      金额: r.amount,
      预支款: r.advance_payment,
      修补费: r.repair_fee,
      剪线头: r.thread_cutting,
      扣废被: r.waste_deduction,
      买材料: r.material_purchase,
      应扣合计: r.total_deduction,
      工资金额: r.salary_amount,
      备注: r.remark,
    }));
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, '报工薪资明细');
    writeFile(wb, `报工薪资明细_${month.replace('-', '')}.xlsx`);
    toast.success('Excel 导出成功');
  }

  function handlePrint() {
    if (rows.length === 0) {
      toast.error('当前筛选条件下暂无记录，无法打印');
      return;
    }
    persistRows();
    const headers = [
      '姓名', '货号', '颜色', '规格', '工序', '来源',
      '数量', '单价', '金额',
      '预支款', '修补费', '剪线头', '扣废被', '买材料',
      '应扣合计', '工资金额', '备注',
    ];
    const tableRows = rows
      .map(
        (r) =>
          `<tr>${[
            r.employee_name, r.product_code, r.color, r.specification, r.operation_name,
            r.process_source === 'internal' ? '内部' : '外协',
            r.quantity, r.unit_price.toFixed(2), r.amount.toFixed(2),
            r.advance_payment.toFixed(2), r.repair_fee.toFixed(2), r.thread_cutting.toFixed(2),
            r.waste_deduction.toFixed(2), r.material_purchase.toFixed(2),
            r.total_deduction.toFixed(2), r.salary_amount.toFixed(2), r.remark,
          ]
            .map((c) => `<td style="border:1px solid #999;padding:4px 6px;text-align:center">${c}</td>`)
            .join('')}</tr>`,
      )
      .join('');
    const html = `
      <html><head><title>报工薪资明细 ${month}</title>
      <style>body{font-family:sans-serif;padding:20px}h2{text-align:center}
      table{border-collapse:collapse;width:100%;font-size:12px}
      th{background:#f0f0f0}</style></head>
      <body><h2>报工薪资明细（${month}）</h2>
      <table><thead><tr>${headers.map((h) => `<th style="border:1px solid #999;padding:4px 6px">${h}</th>`).join('')}</tr></thead>
      <tbody>${tableRows}</tbody></table></body></html>`;
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('当前浏览器拦截了弹窗，请允许后重试');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  function handleLock() {
    if (allRows.length === 0) {
      toast.error('该月暂无报工记录');
      return;
    }
    persistRows();
    store.lockPayrollMonth(month);
    setLockOpen(false);
    toast.success(`${month} 薪资明细已锁定`);
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        无权限访问该页面
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Label className="shrink-0">核算月份</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-40"
            />
            <Label className="shrink-0 md:ml-2">工序来源</Label>
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">查看全部</SelectItem>
                <SelectItem value="internal">仅内部</SelectItem>
                <SelectItem value="outsourcing">仅外协</SelectItem>
              </SelectContent>
            </Select>
            {isLocked && (
              <Badge variant="secondary" className="w-fit">
                <Lock className="mr-1 h-3 w-3" />
                已锁定
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <FileDown className="mr-1 h-4 w-4" />
              导出 Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-1 h-4 w-4" />
              打印
            </Button>
            {!isLocked && (
              <Button variant="destructive" size="sm" onClick={() => setLockOpen(true)}>
                <Lock className="mr-1 h-4 w-4" />
                锁定结算数据
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">姓名</TableHead>
                  <TableHead className="whitespace-nowrap">货号</TableHead>
                  <TableHead className="whitespace-nowrap">颜色</TableHead>
                  <TableHead className="whitespace-nowrap">规格</TableHead>
                  <TableHead className="whitespace-nowrap">工序</TableHead>
                  <TableHead className="whitespace-nowrap">工序来源</TableHead>
                  <TableHead className="whitespace-nowrap text-right">数量</TableHead>
                  <TableHead className="whitespace-nowrap text-right">单价</TableHead>
                  <TableHead className="whitespace-nowrap text-right">金额</TableHead>
                  <TableHead className="whitespace-nowrap text-right">预支款</TableHead>
                  <TableHead className="whitespace-nowrap text-right">修补费</TableHead>
                  <TableHead className="whitespace-nowrap text-right">剪线头</TableHead>
                  <TableHead className="whitespace-nowrap text-right">扣废被</TableHead>
                  <TableHead className="whitespace-nowrap text-right">买材料</TableHead>
                  <TableHead className="whitespace-nowrap text-right">应扣合计</TableHead>
                  <TableHead className="whitespace-nowrap text-right">工资金额</TableHead>
                  <TableHead className="whitespace-nowrap">备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={17} className="h-24 text-center text-muted-foreground">
                      当前筛选条件下暂无记录
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-medium">{r.employee_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.product_code}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.color}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.specification}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.operation_name}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge
                          variant={r.process_source === 'internal' ? 'default' : 'secondary'}
                          className={
                            r.process_source === 'internal'
                              ? 'bg-primary/10 text-primary hover:bg-primary/10'
                              : 'bg-accent text-accent-foreground hover:bg-accent'
                          }
                        >
                          {r.process_source === 'internal' ? '内部' : '外协'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">{r.quantity}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">{CY(r.unit_price)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium">{CY(r.amount)}</TableCell>
                      {DEDUCTION_FIELDS.map((f) => (
                        <TableCell key={f.key} className="whitespace-nowrap p-1">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={r[f.key] as number}
                            disabled={r.is_locked}
                            onChange={(e) =>
                              updateField(r.id, f.key, Number(e.target.value) || 0)
                            }
                            className="h-8 w-24 text-right"
                          />
                        </TableCell>
                      ))}
                      <TableCell className="whitespace-nowrap text-right text-destructive">
                        {CY(r.total_deduction)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-semibold text-primary">
                        {CY(r.salary_amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap p-1">
                        <Input
                          value={r.remark}
                          disabled={r.is_locked}
                          onChange={(e) => updateField(r.id, 'remark', e.target.value)}
                          placeholder="备注"
                          className="h-8 w-28"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 md:flex-row">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                共 {rows.length} 条记录，第 {safePage}/{totalPages} 页
              </p>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 条/页</SelectItem>
                  <SelectItem value="20">20 条/页</SelectItem>
                  <SelectItem value="50">50 条/页</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                    aria-disabled={safePage <= 1}
                    className={safePage <= 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - safePage) <= 1,
                  )
                  .reduce<Array<number | 'ellipsis'>>((acc, p) => {
                    const prev = acc[acc.length - 1];
                    if (typeof prev === 'number' && p - prev > 1) {
                      acc.push('ellipsis');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === 'ellipsis' ? (
                      <PaginationItem key={`ellipsis-${idx}`}>
                        <span className="px-2 text-muted-foreground">…</span>
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          href="#"
                          isActive={item === safePage}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(item);
                          }}
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                    aria-disabled={safePage >= totalPages}
                    className={safePage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={lockOpen} onOpenChange={setLockOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>确认锁定结算数据？</AlertDialogTitle>
            <AlertDialogDescription>
              锁定后，{month} 的所有金额字段将禁止修改，以确保财务凭证的永久有效性。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleLock}>确认锁定</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store';
import { ConfirmActionDialog } from '@/components/common/ConfirmActionDialog';
import { Pagination } from '@/components/common/Pagination';
import { usePagination } from '@/lib/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { nanoid, getProductBomsBySku, extractSkuColor, resolveColorMaterial } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Eye, Pencil, Trash2, Package, CheckCircle2, Printer } from 'lucide-react';
import type { MaterialRequisition, Inventory, WorkOrder } from '@/types';

const statusMap: Record<MaterialRequisition['status'], { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: '草稿', variant: 'secondary' },
  pending: { label: '待审批', variant: 'default' },
  approved: { label: '已批准', variant: 'outline' },
  issued: { label: '已出库', variant: 'outline' },
  partial: { label: '部分出库', variant: 'default' },
  completed: { label: '已出库', variant: 'outline' },
};

export function MaterialRequisitionsTab({
  highlightRequisition,
}: {
  highlightRequisition?: string | null;
}) {
  const store = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<MaterialRequisition | null>(null);
  const [editing, setEditing] = useState<MaterialRequisition | null>(null);
  const [issuing, setIssuing] = useState<MaterialRequisition | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<MaterialRequisition | null>(null);
  const [highlightedCode, setHighlightedCode] = useState<string | null>(
    highlightRequisition || null,
  );

  useEffect(() => {
    if (!highlightRequisition) return;
    setHighlightedCode(highlightRequisition);
    const timer = setTimeout(() => {
      setHighlightedCode(null);
      const params = new URLSearchParams(window.location.search);
      params.delete('highlightRequisition');
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}?${params.toString()}`,
      );
    }, 3000);
    return () => clearTimeout(timer);
  }, [highlightRequisition]);

  // 从工单页跳转过来时，自动打开对应草稿
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftWoNo = params.get('draftWorkOrder');
    if (!draftWoNo) return;
    const r = store.materialRequisitions.find(
      (x) => x.related_work_order_no === draftWoNo && x.status === 'pending'
    );
    if (r) {
      setEditing(r);
      setOpen(true);
    }
    params.delete('draftWorkOrder');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }, [store.materialRequisitions]);

  // 数据回填：合并旧领料单中重复物料、补全颜色字段、并重新解析为颜色物料
  useEffect(() => {
    const updated = store.materialRequisitions.map((r) => {
      let changed = false;
      const merged = new Map<string, MaterialRequisition['items'][0]>();
      for (const item of r.items) {
        const key = `${item.material_id}:${item.specification || ''}:${item.color || ''}`;
        const existing = merged.get(key);
        if (existing) {
          existing.required_qty += item.required_qty;
          existing.issued_qty = (existing.issued_qty || 0) + (item.issued_qty || 0);
          changed = true;
        } else {
          merged.set(key, { ...item });
        }
      }
      let items = Array.from(merged.values());
      const wo = store.workOrders.find(
        (w) => w.work_no === r.related_work_order_no,
      );
      const product = wo
        ? store.products.find((p) => p.id === wo.product_id)
        : undefined;
      const sku =
        wo && product
          ? product.skus?.find((s) => s.id === wo.sku_id)
          : undefined;
      const color = extractSkuColor(sku);
      if (color && items.some((it) => !it.color)) {
        items = items.map((it) =>
          !it.color ? { ...it, color } : it,
        );
        changed = true;
      }
      // 若存在颜色但物料仍是基础物料，重新解析为对应颜色物料
      items = items.map((it) => {
        if (!it.color) return it;
        const resolved = resolveColorMaterial(
          it.material_name,
          it.color,
          store.materials,
          it.material_code,
        ).material;
        if (
          resolved &&
          resolved.id !== it.material_id
        ) {
          changed = true;
          return {
            ...it,
            material_id: resolved.id,
            material_code: resolved.code,
            material_name: resolved.name,
          };
        }
        return it;
      });
      if (!changed) return r;
      return { ...r, items };
    });
    const hasChanges = updated.some(
      (r, idx) => r !== store.materialRequisitions[idx],
    );
    if (hasChanges) {
      store.setMaterialRequisitions(updated);
    }
  }, [store.materialRequisitions, store.workOrders, store.products, store.materials]);

  const filtered = useMemo(() => {
    return store.materialRequisitions
      .filter((r) => {
        if (r.status === 'draft') return false;
        const matchSearch =
          !search ||
          r.code.toLowerCase().includes(search.toLowerCase()) ||
          (r.related_work_order_no || '').toLowerCase().includes(search.toLowerCase()) ||
          (r.related_plan_no || '').toLowerCase().includes(search.toLowerCase()) ||
          r.items.some((i) => i.material_name.toLowerCase().includes(search.toLowerCase()));
        const matchStatus = statusFilter === 'all' || r.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => (b.required_date || "").localeCompare(a.required_date || ""));
  }, [store.materialRequisitions, search, statusFilter]);

  const {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    setPage,
    setPageSize,
  } = usePagination(filtered, { defaultPageSize: 20 });

  const stats = useMemo(() => {
    const valid = store.materialRequisitions.filter((r) => r.status !== 'draft');
    const total = valid.length;
    const pending = valid.filter((r) => r.status === 'pending').length;
    const approved = valid.filter((r) => r.status === 'approved').length;
    const completed = valid.filter((r) => r.status === 'completed' || r.status === 'issued').length;
    return { total, pending, approved, completed };
  }, [store.materialRequisitions]);

  function deleteRequisition(id: string) {
    store.updateMaterialRequisition({ ...store.materialRequisitions.find((r) => r.id === id)!, status: 'draft' });
    store.setMaterialRequisitions(store.materialRequisitions.filter((r) => r.id !== id));
    toast.success('领料单已删除');
  }

  function approveRequisition(r: MaterialRequisition) {
    store.updateMaterialRequisition({ ...r, status: 'approved' });
    toast.success(`领料单 ${r.code} 已审核通过`);
  }

  function completeIssue(r: MaterialRequisition, payload: IssuePayload) {
    const { items: actualItems } = payload;

    // 整笔预校验：任何一行库存不足都整笔阻断，确保事务原子性
    const insufficient = actualItems
      .map((actual, idx) => {
        const qty = actual.issued_qty || 0;
        if (qty <= 0) return null;
        const stock = getLocationStock(
          store.inventory,
          actual.material_id,
          actual.warehouse || '',
          actual.location_id || ''
        );
        return qty > stock ? { ...actual, index: idx + 1, stock } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (insufficient.length > 0) {
      const row = insufficient[0];
      toast.error(
        `第 ${row.index} 行物料 ${row.material_name} 在所选库位库存不足，请手动更换库位或减少出库数量。`
      );
      return;
    }

    // 更新领料单行累计出库数量并保留仓库/库位
    const updatedItems = r.items.map((i) => {
      const actual = actualItems.find((a) => a.material_id === i.material_id);
      return {
        ...i,
        issued_qty: (i.issued_qty ?? 0) + (actual?.issued_qty || 0),
        warehouse: actual?.warehouse || i.warehouse || '',
        location_id: actual?.location_id || i.location_id || '',
      };
    });

    const totalRequired = updatedItems.reduce((sum, i) => sum + i.required_qty, 0);
    const totalIssued = updatedItems.reduce((sum, i) => sum + (i.issued_qty ?? 0), 0);
    let nextStatus: MaterialRequisition['status'] = 'partial';
    if (totalIssued >= totalRequired) {
      nextStatus = 'completed';
    }

    const updated: MaterialRequisition = {
      ...r,
      status: nextStatus,
      items: updatedItems,
      total_issued_qty: totalIssued,
      issue_type: r.issue_type || '生产领料出库',
    };

    // 扣减对应仓库库位库存，并按单条 inventory 记录持久化到数据库
    function findInventoryRecord(
      materialId: string,
      warehouse: string,
      locationId?: string | null,
    ) {
      return store.inventory.find(
        (inv) =>
          inv.type === 'material' &&
          inv.material_id === materialId &&
          inv.warehouse === warehouse &&
          normalizeLocationId(inv.location_id) === normalizeLocationId(locationId),
      );
    }

    const inventoryUpdates: { record: Inventory; qty: number }[] = [];
    for (const actual of actualItems) {
      const qty = actual.issued_qty || 0;
      if (qty <= 0) continue;
      const record = findInventoryRecord(
        actual.material_id,
        actual.warehouse || '',
        actual.location_id,
      );
      if (!record) {
        toast.error(
          `未找到物料 ${actual.material_name} 在仓库 ${actual.warehouse || '—'} 库位 ${actual.location_id || '—'} 的库存记录，出库失败`,
        );
        return;
      }
      inventoryUpdates.push({ record, qty });
    }

    // 记录出库流水
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    for (const actual of actualItems) {
      const qty = actual.issued_qty || 0;
      if (qty <= 0) continue;
      store.addStockRecord({
        id: nanoid(),
        record_no: `${r.code}-OUT-${Date.now().toString(36).toUpperCase()}`,
        type: 'out',
        subtype: '生产领料',
        material_id: actual.material_id,
        quantity: qty,
        warehouse: actual.warehouse || '',
        location_id: actual.location_id || '',
        related_order: r.code,
        related_order_id: r.id,
        handler: r.applicant,
        record_date: now,
        actual_qty: qty,
        profit_loss: qty - (actual.required_qty || 0),
      });
    }

    // 联动生产工单：将领料状态更新为已领料，并解锁首道工序
    const relatedWo = store.workOrders.find((w) => w.work_no === r.related_work_order_no);
    if (relatedWo && relatedWo.picking_status !== 'picked') {
      const unlockedOps = relatedWo.operations.map((o, idx) =>
        idx === 0 && o.status === 'pending' ? { ...o, status: 'pending_start' as const } : o
      );
      store.updateWorkOrder({
        ...relatedWo,
        picking_status: 'picked',
        operations: unlockedOps,
      });
    }

    for (const { record, qty } of inventoryUpdates) {
      store.updateInventory({
        ...record,
        quantity: Math.max(0, record.quantity - qty),
      });
    }
    store.updateMaterialRequisition(updated);
    setIssuing(null);
    toast.success(`领料单 ${r.code} 已确认出库，库存已扣减，工单 ${r.related_work_order_no || ''} 已解锁报工`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">领料单总数</div>
            <div className="text-2xl font-semibold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">待审批</div>
            <div className="text-2xl font-semibold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">已批准</div>
            <div className="text-2xl font-semibold">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">已出库/完成</div>
            <div className="text-2xl font-semibold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            placeholder="搜索领料单号/工单号/计划号/物料"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending">待审批</SelectItem>
              <SelectItem value="approved">已批准</SelectItem>
              <SelectItem value="issued">已出库</SelectItem>
              <SelectItem value="partial">部分出库</SelectItem>
              <SelectItem value="completed">已出库</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />新建领料单
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            生产领料单列表
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">领料单号</TableHead>
                <TableHead className="whitespace-nowrap">关联工单/计划</TableHead>
                <TableHead className="whitespace-nowrap">申请部门</TableHead>
                <TableHead className="whitespace-nowrap">物料种数</TableHead>
                <TableHead className="whitespace-nowrap">需求日期</TableHead>
                <TableHead className="whitespace-nowrap">状态</TableHead>
                <TableHead className="whitespace-nowrap text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((r) => (
                <TableRow
                  key={r.id}
                  className={
                    highlightedCode === r.code
                      ? "bg-primary/10 ring-1 ring-primary transition-colors"
                      : undefined
                  }
                >
                  <TableCell className="whitespace-nowrap font-medium">{r.code}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.related_work_order_no || r.related_plan_no || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.department}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.items.length}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.required_date}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={statusMap[r.status].variant}>{statusMap[r.status].label}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setViewing(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {(r.status === 'draft' || r.status === 'pending') && (
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {r.status === 'pending' && (
                        <Button size="icon" variant="ghost" onClick={() => setConfirmApprove(r)} title="审核">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {(r.status === 'approved' || r.status === 'partial') && (
                        <Button size="icon" variant="ghost" onClick={() => setIssuing(r)} title="出库">
                          <Package className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => deleteRequisition(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                    暂无生产领料单，可通过右上角「新建领料单」或从 MRP 生成
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            className="border-t-0 rounded-t-none"
          />
        </CardContent>
      </Card>

      <RequisitionDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => { setOpen(false); setEditing(null); }}
      />

      <ViewDialog
        viewing={viewing}
        onClose={() => setViewing(null)}
        onIssue={() => viewing && setIssuing(viewing)}
      />
      <IssueDialog
        issuing={issuing}
        onClose={() => setIssuing(null)}
        onConfirm={(payload) => issuing && completeIssue(issuing, payload)}
      />

      <ConfirmActionDialog
        open={!!confirmApprove}
        onOpenChange={(v) => !v && setConfirmApprove(null)}
        title="审核生产领料单"
        description="请确认是否审核通过该领料单，审核后物料可从仓库出库。"
        items={confirmApprove ? [
          { label: '领料单号', value: confirmApprove.code },
          { label: '关联工单', value: confirmApprove.related_work_order_no || confirmApprove.related_plan_no || '-' },
          { label: '当前状态', value: statusMap[confirmApprove.status].label },
        ] : []}
        confirmText="确认通过"
        onConfirm={() => {
          if (confirmApprove) approveRequisition(confirmApprove);
          setConfirmApprove(null);
        }}
      />
    </div>
  );
}

function RequisitionDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: MaterialRequisition | null;
  onSaved: () => void;
}) {
  const store = useAppStore();
  const [workOrderId, setWorkOrderId] = useState<string>(() => {
    if (!editing?.related_work_order_no) return 'none';
    const wo = store.workOrders.find((w) => w.work_no === editing.related_work_order_no);
    return wo ? wo.id : 'none';
  });
  const [items, setItems] = useState<MaterialRequisition['items']>(editing?.items || []);

  const workOrders = store.workOrders.filter((w) => w.status !== 'completed');

  function addItem() {
    setItems((prev) => [
      ...prev,
      { material_id: '', material_code: '', material_name: '', specification: '', unit: '', required_qty: 1 },
    ]);
  }

  function updateItem(idx: number, patch: Partial<MaterialRequisition['items'][number]>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function autoFillFromWorkOrder(wid: string) {
    if (wid === 'none') return;
    const wo = store.workOrders.find((w) => w.id === wid);
    if (!wo) return;
    const product = store.products.find((p) => p.id === wo.product_id);
    if (!product) return;
    const effectiveSkuId = wo.sku_id || product.skus?.[0]?.id || "";
    const sku = product.skus?.find((s) => s.id === effectiveSkuId);
    const color = extractSkuColor(sku);
    const boms = effectiveSkuId ? getProductBomsBySku(product, effectiveSkuId) : [];
    const missing: string[] = [];
    const newItems = boms
      .map((bom) => {
        const baseName = bom.material_name;
        if (!baseName) {
          missing.push('未命名物料');
          return null;
        }
        const { material, missingName } = resolveColorMaterial(
          baseName,
          color,
          store.materials,
        );
        if (missingName) {
          missing.push(missingName);
          return null;
        }
        const resolved = material || {
          id: bom.material_id,
          code: bom.material_code,
          name: bom.material_name,
        };
        return {
          material_id: resolved.id,
          material_code: resolved.code,
          material_name: resolved.name,
          specification: bom.specification,
          unit: bom.unit,
          required_qty: Math.ceil(bom.dosage * wo.plan_quantity),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (missing.length > 0) {
      toast.error(`该工单颜色对应的物料档案不存在，请先在物料档案中建立 ${missing[0]}。`);
      return;
    }
    setItems(newItems);
  }

  function save() {
    if (items.length === 0 || items.some((i) => !i.material_id || i.required_qty <= 0)) {
      toast.error('请完善物料信息');
      return;
    }
    const now = new Date().toISOString().split('T')[0];
    const relatedWorkOrderNo = workOrderId !== 'none' ? store.workOrders.find((w) => w.id === workOrderId)?.work_no : editing?.related_work_order_no;
    if (editing) {
      store.updateMaterialRequisition({ ...editing, items, related_work_order_no: relatedWorkOrderNo, total_issued_qty: editing.total_issued_qty ?? 0, issue_type: editing.issue_type || '生产领料出库' });
      toast.success('领料单已更新');
    } else {
      const req: MaterialRequisition = {
        id: nanoid(),
        code: `MR-${new Date().getFullYear()}-${String(store.materialRequisitions.length + 1).padStart(4, '0')}`,
        applicant: '生产管理员',
        department: '生产部',
        created_at: now,
        required_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        status: 'pending',
        items,
        related_work_order_no: relatedWorkOrderNo,
        total_issued_qty: 0,
        issue_type: '生产领料出库',
      };
      store.addMaterialRequisition(req);
      toast.success(`领料单 ${req.code} 已创建`);
    }
    onSaved();
  }

  // 打开弹窗时根据 editing 重置表单
  const isOpen = open;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑领料单' : '新建生产领料单'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>关联工单</Label>
              <Select value={workOrderId} onValueChange={(v) => { setWorkOrderId(v); autoFillFromWorkOrder(v); }}>
                <SelectTrigger>
                  <SelectValue placeholder="选择工单自动填充 BOM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联</SelectItem>
                  {workOrders.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.work_no} · {w.product_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>需求日期</Label>
              <Input
                type="date"
                defaultValue={editing?.required_date || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]}
                onChange={(e) => { /* 简化：不单独管理日期状态，保存时读取 */ }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>物料明细</Label>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />添加物料
              </Button>
            </div>
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">物料</TableHead>
                    <TableHead className="whitespace-nowrap">规格</TableHead>
                    <TableHead className="whitespace-nowrap">单位</TableHead>
                    <TableHead className="whitespace-nowrap">需求数量</TableHead>
                    <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="min-w-[160px]">
                        <Select
                          value={item.material_id}
                          onValueChange={(v) => {
                            const m = store.materials.find((x) => x.id === v);
                            updateItem(idx, {
                              material_id: v,
                              material_code: m?.code || '',
                              material_name: m?.name || '',
                              specification: m?.specification || '',
                              unit: m?.unit || '',
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择物料" />
                          </SelectTrigger>
                          <SelectContent>
                            {store.materials.map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.name} · {m.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-sm">{item.specification || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-sm">{item.unit || '—'}</TableCell>
                      <TableCell className="min-w-[100px]">
                        <Input
                          type="number"
                          min={1}
                          value={item.required_qty}
                          onChange={(e) => updateItem(idx, { required_qty: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-4 text-center text-muted-foreground text-sm">
                        请添加物料或选择工单自动填充
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button onClick={save}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ViewDialog({
  viewing,
  onClose,
  onIssue,
}: {
  viewing: MaterialRequisition | null;
  onClose: () => void;
  onIssue: () => void;
}) {
  const store = useAppStore();
  if (!viewing) return null;
  const relatedWo = store.workOrders.find((w) => w.work_no === viewing.related_work_order_no);
  return (
    <Dialog open={!!viewing} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            领料单 {viewing.code}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">关联工单/计划</div>
              <div>{viewing.related_work_order_no || viewing.related_plan_no || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">申请部门</div>
              <div>{viewing.department}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">需求日期</div>
              <div>{viewing.required_date}</div>
            </div>
          </div>
          {relatedWo && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="font-medium mb-2">关联工单信息</div>
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-muted-foreground text-xs">工单号</div>
                  <div>{relatedWo.work_no}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">产品</div>
                  <div className="truncate">{relatedWo.product_name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">颜色/SKU</div>
                  <div className="truncate">{relatedWo.color || '—'} / {relatedWo.sku_summary || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">计划数量</div>
                  <div>{relatedWo.plan_quantity}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">工单状态</div>
                  <div>{relatedWo.status}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">计划开始日期</div>
                  <div>{relatedWo.start_date || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">计划结束日期</div>
                  <div>{relatedWo.end_date || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">合同编号</div>
                  <div>{relatedWo.contract_no || '—'}</div>
                </div>
              </div>
            </div>
          )}
          <Separator />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">物料编码</TableHead>
                  <TableHead className="whitespace-nowrap">物料名称</TableHead>
                  <TableHead className="whitespace-nowrap">颜色</TableHead>
                  <TableHead className="whitespace-nowrap">规格</TableHead>
                  <TableHead className="whitespace-nowrap">单位</TableHead>
                  <TableHead className="whitespace-nowrap">需求数量</TableHead>
                  <TableHead className="whitespace-nowrap">已出库</TableHead>
                  <TableHead className="whitespace-nowrap">实时库存</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewing.items.map((item) => {
                  const stock = store.inventory
                    .filter((inv) => inv.type === 'material' && inv.material_id === item.material_id)
                    .reduce((sum, inv) => sum + (inv.quantity ?? 0), 0);
                  return (
                    <TableRow key={item.material_id}>
                      <TableCell className="whitespace-nowrap">{item.material_code}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.material_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.color || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.specification || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.unit}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.required_qty}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.issued_qty ?? 0}</TableCell>
                      <TableCell className="whitespace-nowrap">{stock}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>关闭</Button>
            <Button variant="outline" onClick={() => { toast.info('打印功能开发中'); }}>
              <Printer className="h-4 w-4 mr-1" />打印
            </Button>
            {(viewing.status === 'approved' || viewing.status === 'partial') && (
              <Button onClick={() => { onIssue(); onClose(); }}>
                <CheckCircle2 className="h-4 w-4 mr-1" />确认出库
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
interface IssuePayload {
  items: MaterialRequisition['items'];
}

function normalizeLocationId(v?: string | null) {
  return (v ?? '').trim();
}

function getLocationStock(
  inventory: Inventory[],
  materialId: string,
  warehouse: string,
  locationId: string
) {
  return (
    inventory.find(
      (inv) =>
        inv.type === 'material' &&
        inv.material_id === materialId &&
        inv.warehouse === warehouse &&
        normalizeLocationId(inv.location_id) === normalizeLocationId(locationId)
    )?.quantity ?? 0
  );
}

function IssueDialog({
  issuing,
  onClose,
  onConfirm,
}: {
  issuing: MaterialRequisition | null;
  onClose: () => void;
  onConfirm: (payload: IssuePayload) => void;
}) {
  const store = useAppStore();
  const [items, setItems] = useState<MaterialRequisition['items']>([]);

  const recommendations = useMemo(
    () => store.getStockRecommendations(issuing ? issuing.items.map((i) => i.material_id) : []),
    [issuing, store]
  );

  useEffect(() => {
    if (issuing) {
      setItems(
        issuing.items.map((i) => {
          const remaining = i.required_qty - (i.issued_qty ?? 0);
          const best = recommendations[i.material_id]?.[0];
          const stock = best
            ? getLocationStock(store.inventory, i.material_id, best.warehouse, best.location_id)
            : 0;
          return {
            ...i,
            warehouse: best?.warehouse || i.warehouse || '',
            location_id: best?.location_id || i.location_id || '',
            issued_qty: Math.min(remaining, stock),
          };
        })
      );
    }
  }, [issuing, recommendations, store.inventory]);

  if (!issuing) return null;

  function updateQty(materialId: string, qty: number) {
    setItems((prev) => prev.map((i) => (i.material_id === materialId ? { ...i, issued_qty: qty } : i)));
  }

  function updateRowLocation(
    materialId: string,
    warehouse: string,
    locationId: string
  ) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.material_id !== materialId) return i;
        const remaining = i.required_qty - (i.issued_qty ?? 0);
        const stock = getLocationStock(store.inventory, materialId, warehouse, locationId);
        return {
          ...i,
          warehouse,
          location_id: locationId,
          issued_qty: Math.min(remaining, stock),
        };
      })
    );
  }

  const insufficientRows = items
    .map((i, idx) => {
      const stock = getLocationStock(store.inventory, i.material_id, i.warehouse || '', i.location_id || '');
      return { ...i, index: idx + 1, stock };
    })
    .filter((i) => (i.issued_qty || 0) > i.stock);

  function handleConfirm() {
    if (insufficientRows.length > 0) {
      const row = insufficientRows[0];
      toast.error(
        `第 ${row.index} 行物料 ${row.material_name} 在所选库位库存不足，请手动更换库位或减少出库数量。`
      );
      return;
    }
    if (items.every((i) => !(i.issued_qty || 0))) {
      toast.warning('请至少填写一项本次出库数量');
      return;
    }
    onConfirm({ items });
  }

  return (
    <Dialog open={!!issuing} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>确认出库 - {issuing.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">物料编码</TableHead>
                  <TableHead className="whitespace-nowrap">物料名称</TableHead>
                  <TableHead className="whitespace-nowrap">颜色</TableHead>
                  <TableHead className="whitespace-nowrap">规格</TableHead>
                  <TableHead className="whitespace-nowrap">待出数量</TableHead>
                  <TableHead className="whitespace-nowrap">本次出库</TableHead>
                  <TableHead className="whitespace-nowrap">出库仓库</TableHead>
                  <TableHead className="whitespace-nowrap">出库库位</TableHead>
                  <TableHead className="whitespace-nowrap">当前库位库存</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issuing.items.map((item, idx) => {
                  const actual = items.find((i) => i.material_id === item.material_id);
                  const candidates = recommendations[item.material_id] || [];
                  const warehouses = Array.from(new Set(candidates.map((c) => c.warehouse)));
                  const locations = candidates.filter((c) => c.warehouse === (actual?.warehouse || ''));
                  const stock = getLocationStock(
                    store.inventory,
                    item.material_id,
                    actual?.warehouse || '',
                    actual?.location_id || ''
                  );
                  const remaining = item.required_qty - (item.issued_qty ?? 0);
                  return (
                    <TableRow key={item.material_id}>
                      <TableCell className="whitespace-nowrap">{item.material_code}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.material_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.color || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.specification || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{remaining}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Input
                          type="number"
                          min={0}
                          value={actual?.issued_qty ?? 0}
                          onChange={(e) => updateQty(item.material_id, Number(e.target.value))}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Select
                          value={actual?.warehouse || ''}
                          onValueChange={(w) => updateRowLocation(item.material_id, w, '')}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="选择仓库" />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses.map((w) => (
                              <SelectItem key={w} value={w}>
                                {w}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Select
                          value={actual?.location_id || ''}
                          onValueChange={(loc) =>
                            updateRowLocation(item.material_id, actual?.warehouse || '', loc)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="选择库位" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map((loc) => (
                              <SelectItem key={loc.location_id} value={loc.location_id}>
                                {store.warehouseLocations.find((l) => l.id === loc.location_id)?.code || loc.location_id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{stock}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {insufficientRows.length > 0 && (
            <div className="text-sm text-destructive">
              部分行所选库位库存不足，请调整数量或更换库位。
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button onClick={handleConfirm}>
              <CheckCircle2 className="h-4 w-4 mr-1" />确认出库
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

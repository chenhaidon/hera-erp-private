import { useState } from 'react';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAppStore } from '@/store';
import type { InspectionItem } from './MobileQuality';
import type { QualityInspectionItem } from '@/types';

const typeLabel: Record<string, string> = {
  material: '来料检验',
  process: '过程检验',
  finished: '成品检验',
};

const resultMap: Record<string, string> = {
  qualified: '合格',
  unqualified: '不合格',
  partial: '部分合格',
  pending: '待检验',
};

function evaluateItem(item: QualityInspectionItem): QualityInspectionItem['result'] {
  if (item.actual === undefined || item.actual === null || Number.isNaN(Number(item.actual))) return 'pending';
  const actual = Number(item.actual);
  if (actual < item.lower || actual > item.upper) return 'unqualified';
  return 'qualified';
}

function deriveResult(items: QualityInspectionItem[]): 'qualified' | 'unqualified' | 'partial' | 'pending' {
  if (!items.length) return 'pending';
  if (items.some((i) => i.result === 'pending')) return 'pending';
  if (items.every((i) => i.result === 'qualified')) return 'qualified';
  if (items.every((i) => i.result === 'unqualified')) return 'unqualified';
  return 'partial';
}

export function MobileQualityDetail({ item, onBack }: { item: InspectionItem; onBack: () => void }) {
  const store = useAppStore();
  const [items, setItems] = useState<QualityInspectionItem[]>(item.data.items || []);
  const [qualifiedQty, setQualifiedQty] = useState(
    item.kind === 'process' ? '' : String(item.data.qualified_qty || ''),
  );
  const [unqualifiedQty, setUnqualifiedQty] = useState(
    item.kind === 'process' ? '' : String(item.data.unqualified_qty || ''),
  );
  const [defectReason, setDefectReason] = useState(item.data.defect_reason || '');
  const [saving, setSaving] = useState(false);

  const handleActualChange = (index: number, value: string) => {
    const num = value === '' ? undefined : Number(value);
    const next = items.map((it, i) => {
      if (i !== index) return it;
      const updated = { ...it, actual: num };
      updated.result = evaluateItem(updated);
      return updated;
    });
    setItems(next);
  };

  const handleSubmit = async () => {
    setSaving(true);
    const qualified = Number(qualifiedQty) || 0;
    const unqualified = Number(unqualifiedQty) || 0;
    const derived = deriveResult(items);
    const defect = unqualified > 0 ? defectReason : '';

    try {
      if (item.kind === 'material') {
        await store.updateMaterialInspection({
          ...item.data,
          items,
          qualified_qty: qualified,
          unqualified_qty: unqualified,
          defect_reason: defect,
          status: 'inspected',
          result: derived === 'pending' ? 'partial' : derived,
        });
      } else if (item.kind === 'process') {
        await store.updateProcessInspection({
          ...item.data,
          items,
          defect_reason: defect,
          status: 'inspected',
          result: derived === 'partial' ? 'unqualified' : derived,
        });
      } else {
        await store.updateFinishedInspection({
          ...item.data,
          items,
          qualified_qty: qualified,
          unqualified_qty: unqualified,
          defect_reason: defect,
          status: 'inspected',
          result: derived === 'qualified' ? 'qualified' : 'unqualified',
        });
      }
      alert('质检结果已保存');
    } catch (err: any) {
      alert('保存失败：' + (err.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const title = item.kind === 'material'
    ? item.data.material_name
    : item.kind === 'finished'
      ? item.data.product_name
      : item.data.operation_name;

  const showQty = item.kind !== 'process';

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-background px-4 py-4">
        <button onClick={onBack} className="flex items-center text-sm text-muted-foreground active:opacity-70">
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-6">
        <Card className="mb-4 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ClipboardCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{typeLabel[item.kind]} · {item.data.code}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {item.kind !== 'process' && (
              <div>
                <p className="text-muted-foreground">批次</p>
                <p className="font-medium text-foreground">{item.data.batch}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">当前结果</p>
              <p className="font-medium text-foreground">{resultMap[item.data.result || 'pending'] || '待检验'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">检验人</p>
              <p className="font-medium text-foreground">{item.data.inspector || '-'}</p>
            </div>
            {item.kind === 'material' && (
              <div>
                <p className="text-muted-foreground">供应商</p>
                <p className="font-medium text-foreground">{item.data.supplier || '-'}</p>
              </div>
            )}
            {showQty && (
              <div>
                <p className="text-muted-foreground">抽检数量</p>
                <p className="font-medium text-foreground">{item.data.check_qty}</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="mb-4 p-4">
          <p className="mb-4 text-base font-semibold text-foreground">检验项</p>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">无检验项</p>
          ) : (
            <div className="space-y-4">
              {items.map((it, index) => (
                <div key={it.name} className="rounded-xl bg-muted/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{it.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs text-white ${it.result === 'qualified' ? 'bg-emerald-500' : it.result === 'unqualified' ? 'bg-destructive' : 'bg-amber-500'}`}>
                      {resultMap[it.result] || '待检'}
                    </span>
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    标准 {it.standard}{it.unit} ({it.lower} ~ {it.upper})
                  </p>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="实测值"
                    value={it.actual === undefined ? '' : String(it.actual)}
                    onChange={(e) => handleActualChange(index, e.target.value)}
                    className="bg-background"
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        {showQty && (
          <Card className="mb-4 p-4">
            <p className="mb-4 text-base font-semibold text-foreground">数量录入</p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">合格数量</label>
                <Input type="number" inputMode="numeric" value={qualifiedQty} onChange={(e) => setQualifiedQty(e.target.value)} placeholder="请输入合格数量" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">不合格数量</label>
                <Input type="number" inputMode="numeric" value={unqualifiedQty} onChange={(e) => setUnqualifiedQty(e.target.value)} placeholder="请输入不合格数量" />
              </div>
              {(Number(unqualifiedQty) || 0) > 0 && (
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">不良原因</label>
                  <Input value={defectReason} onChange={(e) => setDefectReason(e.target.value)} placeholder="请输入不良原因" />
                </div>
              )}
            </div>
          </Card>
        )}

        <Button className="w-full" onClick={handleSubmit} disabled={saving}>
          {saving ? '提交中...' : '提交质检结果'}
        </Button>
      </div>
    </div>
  );
}

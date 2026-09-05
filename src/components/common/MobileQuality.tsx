import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAppStore } from '@/store';
import type { MaterialInspection, ProcessInspection, FinishedInspection } from '@/types';

export type InspectionItem =
  | { kind: 'material'; data: MaterialInspection }
  | { kind: 'process'; data: ProcessInspection }
  | { kind: 'finished'; data: FinishedInspection };

const resultMap: Record<string, { label: string; color: string }> = {
  qualified: { label: '合格', color: 'bg-emerald-500' },
  unqualified: { label: '不合格', color: 'bg-destructive' },
  partial: { label: '部分合格', color: 'bg-amber-500' },
  pending: { label: '待检验', color: 'bg-amber-500' },
};

const typeLabel: Record<string, string> = {
  material: '来料检验',
  process: '过程检验',
  finished: '成品检验',
};

function resultInfo(result?: string) {
  return resultMap[result || 'pending'] ?? { label: '待检验', color: 'bg-amber-500' };
}

export function MobileQuality({ onSelect }: { onSelect?: (item: InspectionItem) => void }) {
  const material = useAppStore((s) => s.materialInspections);
  const process = useAppStore((s) => s.processInspections);
  const finished = useAppStore((s) => s.finishedInspections);

  const inspections: InspectionItem[] = [
    ...material.map((data) => ({ kind: 'material' as const, data })),
    ...process.map((data) => ({ kind: 'process' as const, data })),
    ...finished.map((data) => ({ kind: 'finished' as const, data })),
  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-background px-4 pb-3 pt-6">
        <p className="text-xl font-bold text-foreground">质量检验</p>
        <p className="mt-1 text-sm text-muted-foreground">质检记录与结果</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-6">
        {inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">暂无质检记录</p>
          </div>
        ) : (
          inspections.map((item) => {
            const info = resultInfo(item.data.result);
            const title = item.kind === 'material'
              ? item.data.material_name
              : item.kind === 'finished'
                ? item.data.product_name
                : item.data.operation_name;
            const qtyInfo = item.kind === 'material'
              ? `到货 ${item.data.arrival_qty} / 抽检 ${item.data.check_qty}`
              : item.kind === 'finished'
                ? `抽检 ${item.data.check_qty}`
                : null;
            const resultQty = item.kind !== 'process' && (item.data.qualified_qty > 0 || item.data.unqualified_qty > 0)
              ? `合格 ${item.data.qualified_qty} / 不合格 ${item.data.unqualified_qty}`
              : null;
            return (
              <button
                key={`${item.kind}-${item.data.id}`}
                className="mb-3 w-full text-left"
                onClick={() => onSelect?.(item)}
              >
                <Card className="p-4 active:opacity-90">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-base font-semibold text-foreground">{title}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs text-white ${info.color}`}>{info.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">单号：{item.data.code}</p>
                  <p className="text-sm text-muted-foreground">类型：{typeLabel[item.kind]}</p>
                  {qtyInfo && <p className="text-sm text-muted-foreground">{qtyInfo}</p>}
                  {resultQty && <p className="text-sm text-muted-foreground">{resultQty}</p>}
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span>点击进行质检录入</span>
                  </div>
                </Card>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

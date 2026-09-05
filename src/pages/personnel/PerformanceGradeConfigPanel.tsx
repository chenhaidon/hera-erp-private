import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store';
import { toast } from 'sonner';
import { Settings2, Save, X } from 'lucide-react';
import type { PerformanceGradeConfig } from '@/types';
import { validateGradeConfig } from '@/lib/performanceGrade';

const GRADE_ORDER: PerformanceGradeConfig['grade_name'][] = ['A', 'B', 'C', 'D'];

function gradeBadgeStyle(grade: string) {
  if (grade === 'A') return 'bg-green-500 text-white';
  if (grade === 'C') return 'bg-orange-500 text-white';
  if (grade === 'D') return 'bg-destructive text-destructive-foreground';
  return '';
}

interface PerformanceGradeConfigPanelProps {
  onSaved?: () => void;
}

export function PerformanceGradeConfigPanel({ onSaved }: PerformanceGradeConfigPanelProps) {
  const store = useAppStore();
  const role = store.currentRole;
  const isAdmin = role === 'admin';

  const sorted = [...store.performanceGradeConfig].sort(
    (a, b) => b.score_min - a.score_min,
  );
  const [editing, setEditing] = useState<PerformanceGradeConfig[] | null>(null);

  function startEdit() {
    setEditing(sorted.map((g) => ({ ...g })));
  }

  function cancelEdit() {
    setEditing(null);
  }

  function updateField(id: string, field: 'score_min' | 'score_max', value: string) {
    if (!editing) return;
    const num = value === '' ? 0 : Number(value);
    setEditing(
      editing.map((g) => (g.id === id ? { ...g, [field]: Number.isNaN(num) ? 0 : num } : g)),
    );
  }

  async function save() {
    if (!editing) return;
    const err = validateGradeConfig(editing);
    if (err) {
      toast.error(err);
      return;
    }
    const now = new Date().toISOString();
    for (const g of editing) {
      await store.updatePerformanceGradeConfig({ ...g, updated_at: now });
    }
    setEditing(null);
    toast.success('绩效等级配置已保存');
    onSaved?.();
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        无权限访问该配置
      </div>
    );
  }

  const rows = editing ?? sorted;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-pretty">
        员工绩效等级根据综合分（产能分、质量分、出勤分、安全分的平均值）判定，管理员可自定义各等级对应的综合分区间。
      </p>
      <div className="overflow-x-auto">
        <div className="min-w-[360px] rounded-md border">
          <div className="grid grid-cols-3 border-b bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">
            <div>等级</div>
            <div>综合分下限</div>
            <div>综合分上限</div>
          </div>
          {rows.map((g) => (
            <div
              key={g.id}
              className="grid grid-cols-3 items-center border-b px-4 py-3 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <Badge className={gradeBadgeStyle(g.grade_name)}>
                  {g.grade_name}级
                </Badge>
              </div>
              {editing ? (
                <>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={g.score_min}
                    onChange={(e) => updateField(g.id, 'score_min', e.target.value)}
                    disabled={g.grade_name === 'D'}
                    className="w-24"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={g.score_max}
                    onChange={(e) => updateField(g.id, 'score_max', e.target.value)}
                    disabled={g.grade_name === 'A'}
                    className="w-24"
                  />
                </>
              ) : (
                <>
                  <div className="text-sm">{g.score_min}</div>
                  <div className="text-sm">{g.score_max}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-pretty">
        说明：D 等级下限固定为 0，A 等级上限固定为 100；相邻等级的分数区间需首尾相接、不得重叠或留空。
      </p>
      <div className="flex justify-end gap-2">
        {editing ? (
          <>
            <Button variant="outline" onClick={cancelEdit}>
              <X className="mr-2 h-4 w-4" />
              取消
            </Button>
            <Button onClick={save}>
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
          </>
        ) : (
          <Button onClick={startEdit}>
            <Settings2 className="mr-2 h-4 w-4" />
            编辑配置
          </Button>
        )}
      </div>
    </div>
  );
}

export { GRADE_ORDER };
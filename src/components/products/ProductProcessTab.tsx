import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Save, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { nanoid } from '@/lib/utils';
import { toast } from 'sonner';
import { RouteCloneDialog } from './RouteCloneDialog';
import { ProcessStepDialog } from './ProcessStepDialog';
import type { Product, ProductProcessStep, ProcessRoute, ProcessItem } from '@/types';

interface ProductProcessTabProps {
  product: Partial<Product>;
  setProduct: React.Dispatch<React.SetStateAction<Partial<Product>>>;
  isEditing: boolean;
  routes: ProcessRoute[];
  processes: ProcessItem[];
  onSave?: () => void;
}

export function ProductProcessTab({ product, setProduct, isEditing, routes, processes, onSave }: ProductProcessTabProps) {
  const [cloneOpen, setCloneOpen] = useState(false);
  const [stepOpen, setStepOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<ProductProcessStep | null>(null);

  useEffect(() => {
    const list = product.process_steps || [];
    if (list.some((s) => !s.id)) {
      setProduct((p) => ({
        ...p,
        process_steps: list.map((s) => (s.id ? s : { ...s, id: nanoid() })),
      }));
    }
  }, [product.process_steps]);

  const steps = product.process_steps || [];

  function cloneRoute(routeId: string) {
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;
    const cloned: ProductProcessStep[] = route.steps.map((s, idx) => ({
      id: nanoid(),
      process_id: s.process_id || '',
      code: s.code,
      name: s.name,
      seq: s.seq || idx + 1,
      hours: s.hours,
      device: s.device || '',
      skill: s.skill || '',
      price: s.price,
      piece_price: s.piece_price,
      category: s.category,
      outsourcing_price: s.outsourcing_price,
      optional: s.optional || false,
      is_bottleneck: s.is_bottleneck || false,
    }));
    setProduct((p) => ({ ...p, process_steps: cloned }));
    toast.success(`已克隆工艺路线“${route.name}”，共 ${cloned.length} 道工序`);
    setCloneOpen(false);
  }

  function addStep() {
    setEditingStep(null);
    setStepOpen(true);
  }

  function editStep(step: ProductProcessStep) {
    setEditingStep(step);
    setStepOpen(true);
  }

  function saveStep(step: ProductProcessStep) {
    setProduct((p) => {
      const list = [...(p.process_steps || [])];
      if (editingStep) {
        const idx = list.findIndex((s) => s.id === editingStep.id);
        if (idx >= 0) list[idx] = step;
      } else {
        const maxSeq = list.reduce((m, s) => Math.max(m, s.seq), 0);
        step.seq = step.seq || maxSeq + 1;
        list.push(step);
      }
      list.sort((a, b) => a.seq - b.seq);
      return { ...p, process_steps: list };
    });
  }

  function removeStep(id: string) {
    setProduct((p) => {
      const list = (p.process_steps || []).filter((s) => s.id !== id);
      const newList = list.map((s, i) => ({ ...s, seq: i + 1 }));
      return { ...p, process_steps: newList };
    });
  }

  function moveStep(id: string, dir: -1 | 1) {
    setProduct((p) => {
      const list = [...(p.process_steps || [])];
      const idx = list.findIndex((s) => s.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= list.length) return p;
      [list[idx], list[target]] = [list[target], list[idx]];
      list.forEach((s, i) => {
        s.seq = i + 1;
      });
      return { ...p, process_steps: list };
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">工艺工序</CardTitle>
            <p className="text-xs text-muted-foreground">选择工艺路线后会生成本产品独立的工序副本，修改不会影响其他产品。</p>
          </div>
          {isEditing && (
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Button size="sm" variant="outline" onClick={() => setCloneOpen(true)}>
                选择工艺路线
              </Button>
              <Button size="sm" variant="outline" onClick={addStep}>
                <Plus className="mr-1 h-4 w-4" />
                新增工序
              </Button>
              <Button size="sm" onClick={onSave}>
                <Save className="mr-1 h-4 w-4" />
                保存
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="p-2 text-left whitespace-nowrap">工序编号</th>
                <th className="p-2 text-left whitespace-nowrap">工序名称</th>
                <th className="p-2 text-left whitespace-nowrap">类别</th>
                <th className="p-2 text-left whitespace-nowrap">顺序</th>
                <th className="p-2 text-left whitespace-nowrap">工时（小时）</th>
                <th className="p-2 text-left whitespace-nowrap">设备</th>
                <th className="p-2 text-left whitespace-nowrap">技能</th>
                <th className="p-2 text-left whitespace-nowrap">计件单价</th>
                <th className="p-2 text-left whitespace-nowrap">瓶颈</th>
                <th className="p-2 text-right whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={s.id} className="border-b">
                  <td className="p-2 whitespace-nowrap font-mono">{s.code}</td>
                  <td className="p-2 whitespace-nowrap">
                    {s.name}
                    {s.optional && <Badge variant="outline" className="ml-2">可选</Badge>}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <Badge variant={s.category === 'outsourcing' ? 'outline' : 'default'}>
                      {s.category === 'outsourcing' ? '外协' : '内部'}
                    </Badge>
                  </td>
                  <td className="p-2 whitespace-nowrap">{s.seq}</td>
                  <td className="p-2 whitespace-nowrap">{s.hours}</td>
                  <td className="p-2 whitespace-nowrap">{s.device || '-'}</td>
                  <td className="p-2 whitespace-nowrap">{s.skill || '-'}</td>
                  <td className="p-2 whitespace-nowrap">
                    {(() => {
                      if (s.piece_price != null) return s.piece_price;
                      if (s.price != null) return s.price;
                      const p = processes.find((x) => x.id === s.process_id);
                      if (p) return p.category === 'outsourcing' ? p.outsourcing_price : p.price;
                      return '-';
                    })()}
                  </td>
                  <td className="p-2 whitespace-nowrap">{s.is_bottleneck ? '是' : '否'}</td>
                  <td className="p-2 whitespace-nowrap text-right">
                    {isEditing && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => moveStep(s.id, -1)} disabled={i === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => moveStep(s.id, 1)} disabled={i === steps.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => editStep(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeStep(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {steps.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-sm text-muted-foreground">
                    该成品暂未配置工艺工序，请先选择工艺路线或手动新增工序。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <RouteCloneDialog open={cloneOpen} onClose={() => setCloneOpen(false)} routes={routes} onConfirm={cloneRoute} />
      <ProcessStepDialog
        open={stepOpen}
        onClose={() => setStepOpen(false)}
        editing={editingStep}
        processes={processes}
        onSave={saveStep}
      />
    </div>
  );
}

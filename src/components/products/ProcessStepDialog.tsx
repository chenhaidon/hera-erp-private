import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { nanoid } from '@/lib/utils';
import type { ProductProcessStep, ProcessItem } from '@/types';

interface ProcessStepDialogProps {
  open: boolean;
  onClose: () => void;
  editing: ProductProcessStep | null;
  processes: ProcessItem[];
  onSave: (step: ProductProcessStep) => void;
}

export function ProcessStepDialog({ open, onClose, editing, processes, onSave }: ProcessStepDialogProps) {
  const [form, setForm] = useState<Partial<ProductProcessStep>>({});

  useEffect(() => {
    if (open) {
      setForm(editing ? { ...editing } : {});
    }
  }, [open, editing]);

  function handleProcessChange(processId: string) {
    const p = processes.find((x) => x.id === processId);
    if (!p) return;
    setForm((d) => ({
      ...d,
      process_id: p.id,
      name: p.name,
      code: p.code,
      price: p.category === 'outsourcing' ? 0 : p.price,
      piece_price:
        p.piece_price || (p.category === 'internal' ? p.price : 0),
      outsourcing_price: p.category === 'outsourcing' ? p.outsourcing_price : undefined,
      hours: Number((p.standard_minutes / 60).toFixed(3)),
      device: p.device || '',
      skill: p.skill || '',
      category: p.category,
      is_bottleneck: p.name.includes('绗缝'),
    }));
  }

  function handleSave() {
    if (!form.process_id || !form.name || !form.code) return;
    const step: ProductProcessStep = {
      id: editing?.id || nanoid(),
      process_id: form.process_id,
      code: form.code,
      name: form.name,
      seq: Number(form.seq || 0),
      hours: Number(form.hours || 0),
      device: form.device || '',
      skill: form.skill || '',
      price: Number(form.price || 0),
      piece_price: Number(form.piece_price || 0),
      category: form.category,
      outsourcing_price: form.outsourcing_price,
      optional: form.optional || false,
      is_bottleneck: form.is_bottleneck || false,
    };
    onSave(step);
    onClose();
  }

  const activeProcesses = processes.filter((p) => p.status === 'active');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑工序' : '新增工序'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>工序</Label>
            <Select value={form.process_id} onValueChange={handleProcessChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择工序库工序" />
              </SelectTrigger>
              <SelectContent>
                {activeProcesses.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-mono">{p.code}</span> {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>工序顺序</Label>
            <Input type="number" min={1} value={form.seq || ''} onChange={(e) => setForm((d) => ({ ...d, seq: Number(e.target.value) }))} placeholder="如 1" />
          </div>
          <div className="space-y-2">
            <Label>工时定额（小时）</Label>
            <Input type="number" min={0} step={0.01} value={form.hours || ''} onChange={(e) => setForm((d) => ({ ...d, hours: Number(e.target.value) }))} placeholder="小时" />
          </div>
          <div className="space-y-2">
            <Label>所需设备</Label>
            <Input value={form.device || ''} onChange={(e) => setForm((d) => ({ ...d, device: e.target.value }))} placeholder="选填" />
          </div>
          <div className="space-y-2">
            <Label>所需技能</Label>
            <Input value={form.skill || ''} onChange={(e) => setForm((d) => ({ ...d, skill: e.target.value }))} placeholder="选填" />
          </div>
          <div className="space-y-2">
            <Label>计件单价（元/件）</Label>
            <Input type="number" min={0} step={0.01} value={form.piece_price || ''} onChange={(e) => setForm((d) => ({ ...d, piece_price: Number(e.target.value) }))} placeholder="选填" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={!form.process_id}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

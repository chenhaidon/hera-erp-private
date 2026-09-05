import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProcessRoute } from '@/types';

interface RouteCloneDialogProps {
  open: boolean;
  onClose: () => void;
  routes: ProcessRoute[];
  onConfirm: (routeId: string) => void;
}

export function RouteCloneDialog({ open, onClose, routes, onConfirm }: RouteCloneDialogProps) {
  const [selected, setSelected] = useState('');

  const activeRoutes = routes.filter((r) => r.status === 'active');

  function handleConfirm() {
    if (!selected) return;
    onConfirm(selected);
    setSelected('');
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle>选择工艺路线</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>工艺路线</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="请选择要克隆的工艺路线" />
            </SelectTrigger>
            <SelectContent>
              {activeRoutes.map((route) => (
                <SelectItem key={route.id} value={route.id}>
                  <span className="font-mono">{route.code}</span> {route.name}
                  <span className="ml-2 text-xs text-muted-foreground">({route.category})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            选择后，系统会把该工艺路线的工序克隆一份副本到本产品，后续修改不会影响原工艺路线。
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleConfirm} disabled={!selected}>确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

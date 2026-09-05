import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  PackageCheck,
  Search,
  Warehouse,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { useAuth } from '@/contexts/AuthContext';
import { nanoid } from '@/lib/utils';
import type { Inventory, StockRecord } from '@/types';

export function MobileInventory({ onBack }: { onBack?: () => void }) {
  const store = useAppStore();
  const { profile, user } = useAuth();
  const currentUserName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const [tab, setTab] = useState<'all' | 'warning'>('all');
  const [keyword, setKeyword] = useState('');
  const [actualMap, setActualMap] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 2000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const list = useMemo(() => {
    let data = store.inventory;
    if (tab === 'warning') {
      data = data.filter((i) => i.quantity < i.min_stock);
    }
    if (keyword.trim()) {
      const k = keyword.toLowerCase();
      data = data.filter((i) => {
        const name = i.product_id
          ? store.products.find((p) => p.id === i.product_id)?.name
          : store.materials.find((m) => m.id === i.material_id)?.name;
        return (
          (name || '').toLowerCase().includes(k) ||
          (i.warehouse || '').toLowerCase().includes(k)
        );
      });
    }
    return data;
  }, [store.inventory, store.products, store.materials, tab, keyword]);

  const warningCount = useMemo(
    () => store.inventory.filter((i) => i.quantity < i.min_stock).length,
    [store.inventory],
  );

  const getItemName = (item: Inventory) => {
    if (item.product_id) {
      return store.products.find((p) => p.id === item.product_id)?.name || '成品';
    }
    return (
      store.materials.find((m) => m.id === item.material_id)?.name || '物料'
    );
  };

  const getItemCode = (item: Inventory) => {
    if (item.product_id) {
      return (
        store.products.find((p) => p.id === item.product_id)?.code || '-'
      );
    }
    return (
      store.materials.find((m) => m.id === item.material_id)?.code || '-'
    );
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const entries = Object.entries(actualMap).filter(
      ([, v]) => v.trim() !== '',
    );
    if (entries.length === 0) {
      setToast('请至少填写一项实盘数量');
      return;
    }
    setSubmitting(true);
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
    for (const [id, raw] of entries) {
      const actual = parseFloat(raw);
      if (Number.isNaN(actual)) continue;
      const inv = store.inventory.find((i) => i.id === id);
      if (!inv) continue;
      const diff = actual - inv.quantity;
      await store.updateInventory({ ...inv, quantity: actual });
      const record: StockRecord = {
        id: nanoid(),
        record_no: `PD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(-3)}`,
        type: 'take',
        subtype: '库存盘点',
        product_id: inv.product_id,
        material_id: inv.material_id,
        quantity: Math.abs(diff),
        warehouse: inv.warehouse,
        location_id: inv.location_id,
        related_order: '',
        related_order_id: '',
        handler: currentUserName,
        record_date: now,
        remark: `移动端盘点：${getItemName(inv)} 账面 ${inv.quantity} → 实盘 ${actual}`,
        actual_qty: actual,
        profit_loss: diff,
      };
      await store.addStockRecord(record);
    }
    setActualMap({});
    setToast('盘点提交成功');
    setSubmitting(false);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-background px-4 pb-3 pt-6">
        <div className="mb-2 flex items-center gap-2">
          <button
            className="rounded-lg p-2 active:bg-muted"
            onClick={onBack}
            aria-label="返回"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <p className="text-xl font-bold text-foreground">库存管理</p>
            <p className="text-sm text-muted-foreground">盘点与库存预警</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border px-4 py-3">
        <button
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          onClick={() => setTab('all')}
        >
          全部库存
        </button>
        <button
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${tab === 'warning' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          onClick={() => setTab('warning')}
        >
          库存预警
          {warningCount > 0 && (
            <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground">
              {warningCount}
            </span>
          )}
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索物料 / 成品 / 仓库"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-6">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <PackageCheck className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              {tab === 'warning' ? '暂无库存预警' : '暂无库存记录'}
            </p>
          </div>
        ) : (
          list.map((item) => {
            const isWarning = item.quantity < item.min_stock;
            return (
              <Card key={item.id} className="p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {getItemName(item)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getItemCode(item)} · {item.warehouse}
                    </p>
                  </div>
                  {isWarning && (
                    <span className="ml-2 flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      预警
                    </span>
                  )}
                </div>
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    账面数量：{item.quantity}
                  </span>
                  <span className="text-muted-foreground">
                    安全库存：{item.min_stock}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    className="flex-1"
                    placeholder="输入实盘数量"
                    value={actualMap[item.id] || ''}
                    onChange={(e) =>
                      setActualMap((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div className="border-t border-border bg-card p-4">
        <Button
          className="w-full"
          disabled={submitting || Object.keys(actualMap).length === 0}
          onClick={handleSubmit}
        >
          {submitting ? '提交中...' : (
            <>
              <Check className="mr-2 h-4 w-4" />
              提交盘点
            </>
          )}
        </Button>
      </div>

      {toast && (
        <div className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

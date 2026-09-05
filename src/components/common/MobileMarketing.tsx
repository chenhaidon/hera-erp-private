import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  ClipboardList,
  Search,
  ShoppingCart,
  Truck,
  User,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store';

export function MobileMarketing({ onBack }: { onBack?: () => void }) {
  const store = useAppStore();
  const [view, setView] = useState<'customers' | 'orders'>('customers');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');

  const customers = useMemo(() => {
    if (!keyword.trim()) return store.customers;
    const k = keyword.toLowerCase();
    return store.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(k) ||
        (c.contact || '').toLowerCase().includes(k) ||
        (c.phone || '').toLowerCase().includes(k),
    );
  }, [store.customers, keyword]);

  const orders = useMemo(() => {
    let data = store.salesOrders;
    if (customerId) {
      data = data.filter((o) => o.customer_id === customerId);
    } else if (keyword.trim()) {
      const k = keyword.toLowerCase();
      data = data.filter(
        (o) =>
          o.order_no.toLowerCase().includes(k) ||
          o.customer_name.toLowerCase().includes(k),
      );
    }
    return data.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [store.salesOrders, customerId, keyword]);

  const statusLabel: Record<string, string> = {
    pending: '待审核',
    approved: '已审核',
    planned: '已排产',
    producing: '生产中',
    inspecting: '质检中',
    shipping: '待发货',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消',
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-500',
    approved: 'bg-blue-500',
    planned: 'bg-indigo-500',
    producing: 'bg-amber-500',
    inspecting: 'bg-purple-500',
    shipping: 'bg-cyan-500',
    shipped: 'bg-emerald-500',
    completed: 'bg-slate-500',
    cancelled: 'bg-destructive',
  };

  const getCustomerOrders = (id: string) =>
    store.salesOrders.filter((o) => o.customer_id === id).length;

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
            <p className="text-xl font-bold text-foreground">营销管理</p>
            <p className="text-sm text-muted-foreground">客户与订单入口</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border px-4 py-3">
        <button
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${view === 'customers' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          onClick={() => {
            setView('customers');
            setCustomerId(null);
            setKeyword('');
          }}
        >
          <Building2 className="mb-1 mx-auto h-4 w-4" />
          客户
        </button>
        <button
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${view === 'orders' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          onClick={() => {
            setView('orders');
            setCustomerId(null);
            setKeyword('');
          }}
        >
          <ClipboardList className="mb-1 mx-auto h-4 w-4" />
          订单
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={
              view === 'customers'
                ? '搜索客户名称 / 联系人 / 电话'
                : '搜索订单号 / 客户名称'
            }
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-6">
        {view === 'customers' ? (
          customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">暂无客户</p>
            </div>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                className="w-full text-left"
                onClick={() => {
                  setCustomerId(c.id);
                  setView('orders');
                  setKeyword('');
                }}
              >
                <Card className="p-4 active:opacity-90">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {c.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.contact || '-'} · {c.phone || '-'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-primary">
                        {getCustomerOrders(c.id)}
                      </p>
                      <p className="text-xs text-muted-foreground">订单</p>
                    </div>
                  </div>
                </Card>
              </button>
            ))
          )
        ) : (
          <>
            {customerId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <button
                  className="text-primary"
                  onClick={() => {
                    setCustomerId(null);
                    setKeyword('');
                  }}
                >
                  全部客户
                </button>
                <ChevronRight className="h-4 w-4" />
                <span>
                  {store.customers.find((c) => c.id === customerId)?.name}
                </span>
              </div>
            )}
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  {customerId ? '该客户暂无订单' : '暂无销售订单'}
                </p>
              </div>
            ) : (
              orders.map((o) => (
                <Card key={o.id} className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      {o.order_no}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs text-white ${statusColor[o.status] || 'bg-slate-500'}`}
                    >
                      {statusLabel[o.status] || o.status}
                    </span>
                  </div>
                  <p className="mb-1 text-sm text-foreground">
                    {o.customer_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    金额：{o.total_amount} {o.currency} · 交货：
                    {o.delivery_date}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      共 {o.items.length} 项 · 数量 {o.items.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                </Card>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

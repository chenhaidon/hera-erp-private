import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { withRouteGuard } from '@/components/RouteGuard';
import { getWorkOrders } from '@/db/api';
import type { WorkOrder } from '@/db/types';
import { withOfflineFallback } from '@/utils/cache';

const statusFilters = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待排产' },
  { key: 'issued', label: '已下发' },
  { key: 'producing', label: '生产中' },
  { key: 'pending_qc', label: '待质检' },
  { key: 'pending_inbound', label: '待入库' },
  { key: 'inbound', label: '已入库' },
];

const statusMap: Record<string, string> = {
  pending: '待排产',
  issued: '已下发',
  producing: '生产中',
  pending_qc: '待质检',
  pending_inbound: '待入库',
  inbound: '已入库',
  closed: '已结案',
};

function ProductionPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await withOfflineFallback(`work_orders_${status}_${search}`, () => getWorkOrders(status || undefined, search || undefined), 5);
      setOrders(data as WorkOrder[]);
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status, search]);
  useDidShow(() => { load(); });

  return (
    <View className="flex min-h-screen flex-col bg-background">
      <View className="p-4">
        <Input
          className="h-10 rounded bg-surface px-3 text-sm text-foreground hud-border"
          placeholder="搜索工单号"
          placeholderClass="text-muted"
          value={search}
          onInput={(e) => setSearch(e.detail.value)}
        />
      </View>
      <ScrollView className="flex-1 px-4 pb-4" scrollX>
        <View className="flex gap-2 pb-2">
          {statusFilters.map((item) => (
            <View
              key={item.key}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${status === item.key ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted hud-border'}`}
              onClick={() => setStatus(item.key)}
            >
              {item.label}
            </View>
          ))}
        </View>
      </ScrollView>
      <ScrollView className="flex-1 px-4 pb-20" scrollY>
        {loading ? (
          <Text className="py-10 text-center text-muted">加载中...</Text>
        ) : orders.length === 0 ? (
          <Text className="py-10 text-center text-muted">暂无工单</Text>
        ) : (
          orders.map((item) => {
            const progress = item.plan_quantity ? Math.round((item.completed_quantity / item.plan_quantity) * 100) : 0;
            return (
              <View
                key={item.id}
                className="mb-3 rounded-lg bg-surface p-4 hud-border active:opacity-80"
                onClick={() => Taro.navigateTo({ url: `/pages/production/detail?id=${item.id}` })}
              >
                <View className="mb-2 flex items-center justify-between">
                  <Text className="text-base font-semibold text-foreground">{item.work_no}</Text>
                  <Text className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{statusMap[item.status] || item.status}</Text>
                </View>
                <Text className="mb-1 text-sm text-muted">{item.product_name} ({item.product_code})</Text>
                <View className="mt-3 flex items-center gap-3">
                  <View className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                    <View className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                  </View>
                  <Text className="text-xs text-muted">{item.completed_quantity}/{item.plan_quantity}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

export default withRouteGuard(ProductionPage);

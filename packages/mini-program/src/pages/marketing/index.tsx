import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { withRouteGuard } from '@/components/RouteGuard';
import { getSalesOrders } from '@/db/api';
import { withOfflineFallback } from '@/utils/cache';

const statusFilters = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待确认' },
  { key: 'confirmed', label: '已确认' },
  { key: 'producing', label: '生产中' },
  { key: 'shipped', label: '已发货' },
  { key: 'closed', label: '已结案' },
];

const statusMap: Record<string, string> = {
  pending: '待确认', confirmed: '已确认', producing: '生产中', shipped: '已发货', closed: '已结案',
};

function MarketingPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await withOfflineFallback(`sales_${status || 'all'}`, () => getSalesOrders(status || undefined), 5);
      setOrders(data);
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]);
  useDidShow(() => { load(); });

  return (
    <View className="flex min-h-screen flex-col bg-background">
      <ScrollView className="px-4 pt-4 pb-2" scrollX>
        <View className="flex gap-2">
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
          <Text className="py-10 text-center text-muted">暂无销售订单</Text>
        ) : (
          orders.map((item) => (
            <View key={item.id} className="mb-3 rounded-lg bg-surface p-4 hud-border">
              <View className="mb-2 flex items-center justify-between">
                <Text className="text-base font-semibold text-foreground">{item.order_no}</Text>
                <Text className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{statusMap[item.status] || item.status}</Text>
              </View>
              <Text className="text-sm text-muted">客户：{item.customer_name || '-'}</Text>
              <Text className="text-sm text-muted">金额：¥{item.total_amount ?? '-'}</Text>
              <Text className="text-sm text-muted">产品数：{Array.isArray(item.items) ? item.items.length : 0} 项</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export default withRouteGuard(MarketingPage);

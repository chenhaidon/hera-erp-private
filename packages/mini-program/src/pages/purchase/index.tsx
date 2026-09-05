import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { withRouteGuard } from '@/components/RouteGuard';
import { getPurchaseOrders } from '@/db/api';
import { withOfflineFallback } from '@/utils/cache';

const statusFilters = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待审批' },
  { key: 'approved', label: '已审批' },
  { key: 'partial', label: '部分到货' },
  { key: 'received', label: '已到货' },
  { key: 'closed', label: '已结案' },
];

const statusMap: Record<string, string> = {
  pending: '待审批', approved: '已审批', partial: '部分到货', received: '已到货', closed: '已结案',
};

function PurchasePage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await withOfflineFallback(`purchase_${status || 'all'}`, () => getPurchaseOrders(status || undefined), 5);
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
          <Text className="py-10 text-center text-muted">暂无采购订单</Text>
        ) : (
          orders.map((item) => (
            <View key={item.id} className="mb-3 rounded-lg bg-surface p-4 hud-border">
              <View className="mb-2 flex items-center justify-between">
                <Text className="text-base font-semibold text-foreground">{item.order_no}</Text>
                <Text className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{statusMap[item.status] || item.status}</Text>
              </View>
              <Text className="text-sm text-muted">供应商：{item.supplier_name || '-'}</Text>
              <Text className="text-sm text-muted">总金额：¥{item.total_amount ?? '-'}</Text>
              <Text className="text-sm text-muted">预计到货：{item.expected_date || '-'}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export default withRouteGuard(PurchasePage);

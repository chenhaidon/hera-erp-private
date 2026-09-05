import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { withRouteGuard } from '@/components/RouteGuard';
import { getInventoryLowStock } from '@/db/api';
import { withOfflineFallback } from '@/utils/cache';

function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await withOfflineFallback('inventory_lowstock', getInventoryLowStock, 5);
      setItems(data);
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <ScrollView className="min-h-screen bg-background p-4" scrollY>
      <Text className="mb-4 text-xl font-bold text-foreground">库存预警</Text>
      {loading ? (
        <Text className="py-10 text-center text-muted">加载中...</Text>
      ) : items.length === 0 ? (
        <Text className="py-10 text-center text-muted">暂无库存预警</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} className="mb-3 rounded-lg bg-surface p-4 hud-border">
            <Text className="text-base font-semibold text-foreground">{item.warehouse || '默认仓库'}</Text>
            <Text className="text-sm text-muted">当前库存：{item.quantity} / 安全库存：{item.min_stock ?? '-'}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

export default withRouteGuard(InventoryPage);

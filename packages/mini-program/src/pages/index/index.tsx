import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { withRouteGuard } from '@/components/RouteGuard';
import { useAuth } from '@/contexts/AuthContext';
import { getTodoCounts, getTodayStats } from '@/db/api';
import { withOfflineFallback } from '@/utils/cache';

const shortcuts = [
  { key: 'production', label: '生产管理', path: '/pages/production/index' },
  { key: 'quality', label: '质量管理', path: '/pages/quality/index' },
  { key: 'inventory', label: '库存管理', path: '/pages/inventory/index' },
  { key: 'marketing', label: '营销管理', path: '/pages/marketing/index' },
  { key: 'purchase', label: '采购管理', path: '/pages/purchase/index' },
  { key: 'approval', label: '审批中心', path: '/pages/approval/index' },
];

const todoLabels = [
  { key: 'workOrders', label: '待处理工单', path: '/pages/production/index' },
  { key: 'inspections', label: '待检验', path: '/pages/quality/index' },
  { key: 'inbound', label: '库存预警', path: '/pages/inventory/index' },
  { key: 'approvals', label: '待审批', path: '/pages/approval/index' },
];

function HomePage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState({ workOrders: 0, inspections: 0, inbound: 0, approvals: 0 });
  const [stats, setStats] = useState({ productionDone: 0, passRate: 0, inbound: 0, outbound: 0 });
  const [loading, setLoading] = useState(true);

  const loadCounts = async () => {
    try {
      const data = await withOfflineFallback('todo_counts', getTodoCounts, 5);
      setCounts(data);
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  };

  const loadStats = async () => {
    try {
      const data = await withOfflineFallback('today_stats', getTodayStats, 5);
      setStats(data);
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadCounts(), loadStats()]);
  };

  useEffect(() => { loadAll(); }, []);
  useDidShow(() => { loadAll(); });

  const handleScan = () => {
    Taro.navigateTo({ url: '/pages/scan/index' });
  };

  return (
    <ScrollView className="min-h-screen bg-background p-4" scrollY>
      <View className="mb-6 flex items-center justify-between">
        <View>
          <Text className="text-xl font-bold text-foreground">早上好，{user?.username || user?.phone || '管理员'}</Text>
          <Text className="text-sm text-muted">今日工作一目了然</Text>
        </View>
        <View className="rounded-lg bg-primary/10 p-3" onClick={handleScan}>
          <Text className="text-2xl text-primary">扫一扫</Text>
        </View>
      </View>

      <View className="mb-6 grid grid-cols-2 gap-3">
        {todoLabels.map((item) => (
          <View
            key={item.key}
            className="rounded-lg bg-surface p-4 hud-border active:opacity-80"
            onClick={() => Taro.navigateTo({ url: item.path })}
          >
            <Text className="text-3xl font-bold text-primary">{loading ? '-' : counts[item.key as keyof typeof counts]}</Text>
            <Text className="mt-1 text-sm text-muted">{item.label}</Text>
          </View>
        ))}
      </View>

      <View className="mb-6 rounded-lg bg-surface p-4 hud-border">
        <Text className="mb-4 text-base font-semibold text-foreground">快捷入口</Text>
        <View className="grid grid-cols-3 gap-3">
          {shortcuts.map((item) => (
            <View
              key={item.key}
              className="rounded bg-background p-3 text-center active:opacity-80"
              onClick={() => Taro.navigateTo({ url: item.path })}
            >
              <View className="mx-auto mb-2 h-10 w-10 rounded-full bg-primary/10" />
              <Text className="text-xs text-foreground">{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="rounded-lg bg-surface p-4 hud-border">
        <Text className="mb-4 text-base font-semibold text-foreground">今日数据概览</Text>
        <View className="grid grid-cols-2 gap-4">
          <View>
            <Text className="text-xs text-muted">生产完成</Text>
            <Text className="text-xl font-bold text-foreground">{loading ? '-' : stats.productionDone}<Text className="text-xs font-normal text-muted">件</Text></Text>
          </View>
          <View>
            <Text className="text-xs text-muted">质检合格率</Text>
            <Text className="text-xl font-bold text-foreground">{loading ? '-' : `${stats.passRate}%`}</Text>
          </View>
          <View>
            <Text className="text-xs text-muted">今日入库</Text>
            <Text className="text-xl font-bold text-foreground">{loading ? '-' : stats.inbound}<Text className="text-xs font-normal text-muted">件</Text></Text>
          </View>
          <View>
            <Text className="text-xs text-muted">今日发货</Text>
            <Text className="text-xl font-bold text-foreground">{loading ? '-' : stats.outbound}<Text className="text-xs font-normal text-muted">件</Text></Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

export default withRouteGuard(HomePage);

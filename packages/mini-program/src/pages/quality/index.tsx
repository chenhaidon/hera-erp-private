import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { withRouteGuard } from '@/components/RouteGuard';
import { getQualityInspections } from '@/db/api';
import type { QualityInspection } from '@/db/types';
import { withOfflineFallback } from '@/utils/cache';

const typeFilters = [
  { key: '', label: '全部' },
  { key: 'incoming', label: '来料检验' },
  { key: 'process', label: '过程检验' },
  { key: 'finished', label: '成品检验' },
];

const resultMap: Record<string, string> = {
  pending: '待检验', qualified: '合格', unqualified: '不合格', partial: '部分合格',
};

function QualityPage() {
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await withOfflineFallback(`quality_${type || 'all'}`, () => getQualityInspections(type || undefined), 5);
      setInspections(data as QualityInspection[]);
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [type]);
  useDidShow(() => { load(); });

  return (
    <View className="flex min-h-screen flex-col bg-background">
      <ScrollView className="px-4 pt-4 pb-2" scrollX>
        <View className="flex gap-2">
          {typeFilters.map((item) => (
            <View
              key={item.key}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${type === item.key ? 'bg-primary text-primary-foreground' : 'bg-surface text-muted hud-border'}`}
              onClick={() => setType(item.key)}
            >
              {item.label}
            </View>
          ))}
        </View>
      </ScrollView>
      <ScrollView className="flex-1 px-4 pb-20" scrollY>
        {loading ? (
          <Text className="py-10 text-center text-muted">加载中...</Text>
        ) : inspections.length === 0 ? (
          <Text className="py-10 text-center text-muted">暂无质检记录</Text>
        ) : (
          inspections.map((item) => (
            <View
              key={item.id}
              className="mb-3 rounded-lg bg-surface p-4 hud-border active:opacity-80"
              onClick={() => Taro.navigateTo({ url: `/pages/quality/detail?id=${item.id}` })}
            >
              <View className="mb-2 flex items-center justify-between">
                <Text className="text-base font-semibold text-foreground">{item.inspection_no}</Text>
                <Text className={`rounded-full px-2.5 py-1 text-xs ${item.result === 'qualified' ? 'bg-primary/20 text-primary' : item.result === 'unqualified' ? 'bg-destructive/20 text-destructive' : 'bg-surface text-muted hud-border'}`}>
                  {resultMap[item.result || 'pending'] || item.result || '待检验'}
                </Text>
              </View>
              <Text className="text-sm text-muted">类型：{item.type}</Text>
              {(item.qualified_qty != null || item.unqualified_qty != null) && (
                <Text className="text-sm text-muted">合格 {item.qualified_qty ?? 0} / 不合格 {item.unqualified_qty ?? 0}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export default withRouteGuard(QualityPage);

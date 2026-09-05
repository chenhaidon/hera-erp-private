import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { withRouteGuard } from '@/components/RouteGuard';
import { getApprovalTasks } from '@/db/api';
import { withOfflineFallback } from '@/utils/cache';
import { supabase } from '@/client/supabase';

const statusFilters = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待审批' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已驳回' },
];

const moduleMap: Record<string, string> = {
  purchase: '采购', sales: '销售', production: '生产', quality: '质量', leave: '请假', expense: '报销',
};

function ApprovalPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await withOfflineFallback(`approval_${status || 'all'}`, () => getApprovalTasks(status || undefined), 5);
      setTasks(data);
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]);
  useDidShow(() => { load(); });

  const handleApprove = async (task: any, result: string) => {
    await supabase.from('approval_tasks').update({ status: result }).eq('id', task.id);
    Taro.showToast({ title: '已处理', icon: 'success' });
    load();
  };

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
        ) : tasks.length === 0 ? (
          <Text className="py-10 text-center text-muted">暂无审批任务</Text>
        ) : (
          tasks.map((item) => (
            <View key={item.id} className="mb-3 rounded-lg bg-surface p-4 hud-border">
              <View className="mb-2 flex items-center justify-between">
                <Text className="text-base font-semibold text-foreground">{item.title}</Text>
                <Text className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{item.status}</Text>
              </View>
              <Text className="text-sm text-muted">模块：{moduleMap[item.module] || item.module}</Text>
              <Text className="text-sm text-muted">提交人：{item.submitter_name || '-'}</Text>
              {item.status === 'pending' && (
                <View className="mt-3 flex gap-3">
                  <View className="flex-1 rounded bg-destructive/10 py-2 text-center text-sm text-destructive" onClick={() => handleApprove(item, 'rejected')}>驳回</View>
                  <View className="flex-1 rounded bg-primary/10 py-2 text-center text-sm text-primary" onClick={() => handleApprove(item, 'approved')}>通过</View>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export default withRouteGuard(ApprovalPage);

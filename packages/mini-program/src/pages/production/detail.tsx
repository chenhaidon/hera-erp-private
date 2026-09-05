import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, ScrollView, Input, Button } from '@tarojs/components';
import { withRouteGuard } from '@/components/RouteGuard';
import { getWorkOrderById, updateWorkOrder } from '@/db/api';
import { getCache } from '@/utils/cache';
import type { WorkOrder, Employee } from '@/db/types';

const statusMap: Record<string, string> = {
  pending: '待排产', issued: '已下发', producing: '生产中', pending_qc: '待质检', pending_inbound: '待入库', inbound: '已入库', closed: '已结案',
};

function ProductionDetailPage() {
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportQty, setReportQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);

  const id = Taro.getCurrentInstance().router?.params?.id || '';

  const load = async () => {
    setLoading(true);
    try {
      const data = await getWorkOrderById(id);
      setOrder(data as WorkOrder);
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const loadEmployee = () => {
    const current = getCache<Employee>('current_employee');
    setEmployee(current);
  };

  useEffect(() => {
    load();
    loadEmployee();
  }, [id]);

  const toggleOperation = async (index: number) => {
    if (!order || !order.operations) return;
    const next = [...order.operations];
    next[index] = { ...next[index], completed: !next[index].completed };
    try {
      await updateWorkOrder(order.id, { operations: next });
      setOrder({ ...order, operations: next });
    } catch (err: any) {
      Taro.showToast({ title: err.message || '更新失败', icon: 'none' });
    }
  };

  const handleReport = async () => {
    if (!order) return;
    if (!employee) {
      Taro.showModal({
        title: '未识别身份',
        content: '请先扫描工牌码识别员工身份后再报工',
        confirmText: '去扫码',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) Taro.navigateTo({ url: '/pages/scan/index' });
        },
      });
      return;
    }
    const qty = parseInt(reportQty, 10);
    if (!qty || qty <= 0) {
      Taro.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }
    setSaving(true);
    try {
      const nextCompleted = order.completed_quantity + qty;
      const nextProgress = Math.min(100, Math.round((nextCompleted / order.plan_quantity) * 100));
      const operations = (order.operations || []).map((op) => {
        if (op.completed) return op;
        const newCompletedQty = (op.completed_qty || 0) + qty;
        return {
          ...op,
          completed_qty: newCompletedQty,
          completed: newCompletedQty >= order.plan_quantity,
        };
      });
      await updateWorkOrder(order.id, {
        completed_quantity: nextCompleted,
        progress: nextProgress,
        status: nextProgress >= 100 ? 'pending_qc' : 'producing',
        operations,
        // 记录实名报工信息
        last_report_operator_id: employee.id,
        last_report_operator_name: employee.name,
      });
      setReportQty('');
      await load();
      Taro.showToast({ title: `报工成功：${employee.name}`, icon: 'success' });
    } catch (err: any) {
      Taro.showToast({ title: err.message || '报工失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View className="p-10 text-center text-muted">加载中...</View>;
  if (!order) return <View className="p-10 text-center text-muted">未找到工单</View>;

  const progress = order.plan_quantity ? Math.round((order.completed_quantity / order.plan_quantity) * 100) : 0;

  return (
    <ScrollView className="min-h-screen bg-background p-4" scrollY>
      <View className="mb-4 rounded-lg bg-primary/10 p-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Text className="text-sm text-foreground">
            {employee
              ? `当前身份：${employee.name}（${employee.code}）`
              : '未识别身份，请先扫描工牌码'}
          </Text>
        </View>
        <Button
          size="mini"
          className="ml-2 bg-primary text-primary-foreground"
          onClick={() => Taro.navigateTo({ url: '/pages/scan/index' })}
        >
          {employee ? '切换身份' : '扫码识别'}
        </Button>
      </View>
      <View className="mb-4 rounded-lg bg-surface p-4 hud-border">
        <Text className="text-xl font-bold text-foreground">{order.product_name}</Text>
        <Text className="text-sm text-muted">{order.product_code}</Text>
        <View className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <View><Text className="text-muted">工单号</Text><Text className="text-foreground">{order.work_no}</Text></View>
          <View><Text className="text-muted">状态</Text><Text className="text-foreground">{statusMap[order.status] || order.status}</Text></View>
          <View><Text className="text-muted">计划数量</Text><Text className="text-foreground">{order.plan_quantity}</Text></View>
          <View><Text className="text-muted">已完成</Text><Text className="text-foreground">{order.completed_quantity}</Text></View>
        </View>
        <View className="mt-4">
          <View className="mb-1 flex justify-between text-xs">
            <Text className="text-muted">完成进度</Text>
            <Text className="text-foreground">{progress}%</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-background">
            <View className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </View>
        </View>
      </View>

      <View className="mb-4 rounded-lg bg-surface p-4 hud-border">
        <Text className="mb-4 text-base font-semibold text-foreground">工序进度</Text>
        {(order.operations || []).map((op, index) => (
          <View
            key={op.name}
            className="mb-2 flex items-center justify-between rounded bg-background p-3 active:opacity-80"
            onClick={() => toggleOperation(index)}
          >
            <View className="flex items-center gap-3">
              <View className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${op.completed ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
                {op.completed && <Text className="text-xs">✓</Text>}
              </View>
              <View>
                <Text className={`text-sm ${op.completed ? 'text-muted line-through' : 'text-foreground'}`}>{op.name}</Text>
                {op.completed_qty != null && <Text className="text-xs text-muted">已完成 {op.completed_qty} 件</Text>}
              </View>
            </View>
            {op.is_bottleneck && <Text className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">瓶颈</Text>}
          </View>
        ))}
      </View>

      <View className="mb-4 rounded-lg bg-surface p-4 hud-border">
        <Text className="mb-4 text-base font-semibold text-foreground">报工</Text>
        <View className="flex gap-2">
          <Input
            className="h-12 flex-1 rounded bg-background px-3 text-foreground"
            placeholder="本次完成数量"
            placeholderClass="text-muted"
            type="number"
            value={reportQty}
            onInput={(e) => setReportQty(e.detail.value)}
          />
          <Button className="h-12 rounded bg-primary px-5 text-primary-foreground font-semibold" loading={saving} onClick={handleReport}>报工</Button>
        </View>
      </View>
    </ScrollView>
  );
}

export default withRouteGuard(ProductionDetailPage);

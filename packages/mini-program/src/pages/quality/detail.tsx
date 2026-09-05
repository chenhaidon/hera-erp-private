import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, ScrollView, Input, Button } from '@tarojs/components';
import { withRouteGuard } from '@/components/RouteGuard';
import { getQualityInspectionById, updateQualityInspection } from '@/db/api';
import type { QualityInspection } from '@/db/types';

const typeMap: Record<string, string> = { incoming: '来料检验', process: '过程检验', finished: '成品检验' };

function QualityDetailPage() {
  const [inspection, setInspection] = useState<QualityInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState('qualified');
  const [qualifiedQty, setQualifiedQty] = useState('');
  const [unqualifiedQty, setUnqualifiedQty] = useState('');
  const [defectReason, setDefectReason] = useState('');
  const [saving, setSaving] = useState(false);

  const id = Taro.getCurrentInstance().router?.params?.id || '';

  const load = async () => {
    setLoading(true);
    try {
      const data = await getQualityInspectionById(id);
      const item = data as QualityInspection;
      setInspection(item);
      if (item) {
        setResult(item.result || 'qualified');
        setQualifiedQty(item.qualified_qty != null ? String(item.qualified_qty) : '');
        setUnqualifiedQty(item.unqualified_qty != null ? String(item.unqualified_qty) : '');
        setDefectReason(item.defect_reason || '');
      }
    } catch (err: any) {
      Taro.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSubmit = async () => {
    if (!inspection) return;
    const qualified = parseInt(qualifiedQty, 10) || 0;
    const unqualified = parseInt(unqualifiedQty, 10) || 0;
    setSaving(true);
    try {
      await updateQualityInspection(inspection.id, {
        result: qualified > 0 && unqualified === 0 ? 'qualified' : unqualified > 0 && qualified === 0 ? 'unqualified' : 'partial',
        qualified_qty: qualified,
        unqualified_qty: unqualified,
        defect_reason: unqualified > 0 ? defectReason : null,
      });
      await load();
      Taro.showToast({ title: '录入成功', icon: 'success' });
    } catch (err: any) {
      Taro.showToast({ title: err.message || '录入失败', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View className="p-10 text-center text-muted">加载中...</View>;
  if (!inspection) return <View className="p-10 text-center text-muted">未找到质检记录</View>;

  return (
    <ScrollView className="min-h-screen bg-background p-4" scrollY>
      <View className="mb-4 rounded-lg bg-surface p-4 hud-border">
        <Text className="text-xl font-bold text-foreground">{inspection.inspection_no}</Text>
        <Text className="text-sm text-muted">{typeMap[inspection.type] || inspection.type}</Text>
      </View>

      <View className="mb-4 rounded-lg bg-surface p-4 hud-border">
        <Text className="mb-4 text-base font-semibold text-foreground">录入质检结果</Text>
        <View className="mb-4 flex gap-2">
          {['qualified', 'unqualified', 'partial'].map((r) => (
            <View
              key={r}
              className={`flex-1 rounded py-2 text-center text-sm font-medium ${result === r ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'}`}
              onClick={() => setResult(r)}
            >
              {r === 'qualified' ? '合格' : r === 'unqualified' ? '不合格' : '部分合格'}
            </View>
          ))}
        </View>
        <View className="mb-4">
          <Text className="mb-1 text-sm text-muted">合格数量</Text>
          <Input className="h-12 rounded bg-background px-3 text-foreground" type="number" value={qualifiedQty} onInput={(e) => setQualifiedQty(e.detail.value)} placeholder="请输入" placeholderClass="text-muted" />
        </View>
        <View className="mb-4">
          <Text className="mb-1 text-sm text-muted">不合格数量</Text>
          <Input className="h-12 rounded bg-background px-3 text-foreground" type="number" value={unqualifiedQty} onInput={(e) => setUnqualifiedQty(e.detail.value)} placeholder="请输入" placeholderClass="text-muted" />
        </View>
        {(result === 'unqualified' || result === 'partial') && (
          <View className="mb-4">
            <Text className="mb-1 text-sm text-muted">不良原因</Text>
            <Input className="h-12 rounded bg-background px-3 text-foreground" value={defectReason} onInput={(e) => setDefectReason(e.detail.value)} placeholder="请输入不良原因" placeholderClass="text-muted" />
          </View>
        )}
        <Button className="h-12 w-full rounded bg-primary text-primary-foreground font-semibold" loading={saving} onClick={handleSubmit}>提交质检结果</Button>
      </View>
    </ScrollView>
  );
}

export default withRouteGuard(QualityDetailPage);

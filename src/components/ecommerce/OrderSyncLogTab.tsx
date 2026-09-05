import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, RefreshCw, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import type { EcommerceOrderSyncLog } from '@/types';

const PLATFORM_OPTIONS = [
  { code: 'all', name: '全部' },
  { code: 'taobao', name: '淘宝' },
  { code: 'pinduoduo', name: '拼多多' },
  { code: 'douyin', name: '抖店' },
];

const STATUS_OPTIONS = [
  { code: 'all', name: '全部' },
  { code: 'success', name: '成功' },
  { code: 'failed', name: '失败' },
];

export default function OrderSyncLogTab() {
  const [logs, setLogs] = useState<EcommerceOrderSyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    platformCode: 'all',
    status: 'all',
  });
  const [detail, setDetail] = useState<EcommerceOrderSyncLog | null>(null);

  const defaultRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, []);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      ...defaultRange,
    }));
  }, [defaultRange]);

  async function loadLogs() {
    setLoading(true);
    let query = supabase.from('ecommerce_order_sync_log').select('*');
    if (filters.startDate) {
      query = query.gte('created_at', `${filters.startDate}T00:00:00.000Z`);
    }
    if (filters.endDate) {
      query = query.lte('created_at', `${filters.endDate}T23:59:59.999Z`);
    }
    if (filters.platformCode !== 'all') {
      query = query.eq('platform_code', filters.platformCode);
    }
    if (filters.status !== 'all') {
      query = query.eq('sync_status', filters.status);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      toast.error('加载日志失败');
      console.error(error);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      loadLogs();
    }
  }, [filters.startDate, filters.endDate]);

  function handleSearch() {
    loadLogs();
  }

  function formatDuration(ms?: number) {
    if (ms === undefined || ms === null) return '-';
    return `${ms} ms`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">订单拉取日志</h3>
        <Button variant="outline" onClick={loadLogs}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-md border bg-card p-4">
        <div className="space-y-2">
          <Label className="text-xs">开始日期</Label>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">结束日期</Label>
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">平台名称</Label>
          <Select
            value={filters.platformCode}
            onValueChange={(v) => setFilters({ ...filters, platformCode: v })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">拉取结果</Label>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters({ ...filters, status: v })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.code} value={s.code}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSearch}>
          <Search className="mr-2 h-4 w-4" />
          筛选
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>拉取时间</TableHead>
              <TableHead>平台</TableHead>
              <TableHead>店铺</TableHead>
              <TableHead>结果</TableHead>
              <TableHead>拉取订单数</TableHead>
              <TableHead>新增/更新</TableHead>
              <TableHead>耗时</TableHead>
              <TableHead>失败原因</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  加载中...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString('zh-CN')
                      : '-'}
                  </TableCell>
                  <TableCell>{log.platform_name}</TableCell>
                  <TableCell>{log.shop_name}</TableCell>
                  <TableCell>
                    <Badge variant={log.sync_status === 'success' ? 'default' : 'destructive'}>
                      {log.sync_status === 'success' ? '成功' : '失败'}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.synced_orders}</TableCell>
                  <TableCell>
                    {log.new_orders}/{log.updated_orders}
                  </TableCell>
                  <TableCell>{formatDuration(log.execution_time_ms)}</TableCell>
                  <TableCell className="max-w-xs truncate" title={log.failed_reason || ''}>
                    {log.failed_reason || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setDetail(log)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>日志详情</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground">拉取时间：</span>
                  {detail.created_at
                    ? new Date(detail.created_at).toLocaleString('zh-CN')
                    : '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">平台：</span>
                  {detail.platform_name}
                </div>
                <div>
                  <span className="text-muted-foreground">店铺：</span>
                  {detail.shop_name}
                </div>
                <div>
                  <span className="text-muted-foreground">结果：</span>
                  {detail.sync_status === 'success' ? '成功' : '失败'}
                </div>
                <div>
                  <span className="text-muted-foreground">拉取订单数：</span>
                  {detail.synced_orders}
                </div>
                <div>
                  <span className="text-muted-foreground">新增/更新：</span>
                  {detail.new_orders}/{detail.updated_orders}
                </div>
                <div>
                  <span className="text-muted-foreground">执行耗时：</span>
                  {formatDuration(detail.execution_time_ms)}
                </div>
                <div>
                  <span className="text-muted-foreground">失败原因：</span>
                  {detail.failed_reason || '-'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">请求参数：</span>
                <pre className="mt-1 rounded-md bg-muted p-2 overflow-x-auto">
                  {JSON.stringify(detail.request_params, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-muted-foreground">响应数据：</span>
                <pre className="mt-1 rounded-md bg-muted p-2 overflow-x-auto">
                  {JSON.stringify(detail.response_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

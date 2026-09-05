import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePagination } from '@/lib/pagination';
import { Pagination } from '@/components/common/Pagination';
import { useAppStore } from '@/store';
import { fetchEntities } from '@/lib/api';
import { useRealtimeLog } from '@/hooks/use-realtime-log';
import type { OperationLog } from '@/types';
import {
  Search,
  Download,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface OperationLogPageProps {
  embedded?: boolean;
}

type SortField = 'time' | 'operator' | 'module' | 'action' | 'result';

const ACTION_OPTIONS: { value: OperationLog['action'] | 'all'; label: string }[] = [
  { value: 'all', label: '全部操作' },
  { value: 'create', label: '创建' },
  { value: 'update', label: '更新' },
  { value: 'delete', label: '删除' },
  { value: 'approve', label: '审批通过' },
  { value: 'reject', label: '审批驳回' },
  { value: 'export', label: '导出' },
  { value: 'print', label: '打印' },
  { value: 'login', label: '登录' },
  { value: 'logout', label: '登出' },
  { value: 'other', label: '其他' },
];

const RESULT_OPTIONS: { value: OperationLog['result'] | 'all'; label: string }[] = [
  { value: 'all', label: '全部结果' },
  { value: 'success', label: '成功' },
  { value: 'fail', label: '失败' },
];

export function OperationLogPage({ embedded }: OperationLogPageProps = {}) {
  const store = useAppStore();
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(false);

  // 筛选状态
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<OperationLog['action'] | 'all'>('all');
  const [resultFilter, setResultFilter] = useState<OperationLog['result'] | 'all'>('all');
  const [operatorFilter, setOperatorFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // 排序
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortAsc, setSortAsc] = useState(false);

  const [newCount, setNewCount] = useState(0);
  const loadSeqRef = useRef(0);

  // 详情弹窗
  const [detailLog, setDetailLog] = useState<OperationLog | null>(null);

  // 手动刷新
  const handleRefresh = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    const data = await fetchEntities('operation_logs');
    if (seq !== loadSeqRef.current) return;
    const typed = (data as unknown as OperationLog[]).sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );
    setLogs(typed);
    store.setOperationLogs(typed);
    setNewCount(0);
    setLoading(false);
  }, [store]);

  // 实时订阅：新操作记录写入时自动更新
  const realtimeStatus = useRealtimeLog({
    entityType: 'operation_logs',
    onInsert: (record) => {
      const newLog = record as unknown as OperationLog;
      if (!newLog || !newLog.id) return;
      setLogs((prev) => {
        if (prev.some((l) => l.id === newLog.id)) return prev;
        return [newLog, ...prev].sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
        );
      });
      if (currentPageRef.current !== 1) {
        setNewCount((c) => c + 1);
      }
    },
    onUpdate: (record) => {
      const updated = record as unknown as OperationLog;
      if (!updated || !updated.id) return;
      setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    },
  });

  // 初始加载：store 优先，若为空则从数据库加载
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (store.operationLogs.length > 0) {
        setLogs(store.operationLogs);
        return;
      }
      setLoading(true);
      const data = await fetchEntities('operation_logs');
      const typed = (data as unknown as OperationLog[]).sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      if (mounted) {
        setLogs(typed);
        store.setOperationLogs(typed);
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [store]);

  // 同步 store 更新
  useEffect(() => {
    if (store.operationLogs.length > 0) {
      setLogs(store.operationLogs);
    }
  }, [store.operationLogs]);

  // 筛选选项
  const operators = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      if (l.operator) map.set(l.operator, l.operator_name || l.operator);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'));
  }, [logs]);

  const modules = useMemo(
    () => Array.from(new Set(logs.map((l) => l.module).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [logs]
  );

  const filtered = useMemo(() => {
    let data = [...logs];
    if (actionFilter !== 'all') data = data.filter((l) => l.action === actionFilter);
    if (resultFilter !== 'all') data = data.filter((l) => l.result === resultFilter);
    if (operatorFilter !== 'all') data = data.filter((l) => l.operator === operatorFilter);
    if (moduleFilter !== 'all') data = data.filter((l) => l.module === moduleFilter);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      data = data.filter((l) => new Date(l.time) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      data = data.filter((l) => new Date(l.time) <= end);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        (l) =>
          l.operator?.toLowerCase().includes(q) ||
          l.operator_name?.toLowerCase().includes(q) ||
          l.module?.toLowerCase().includes(q) ||
          l.action_label?.toLowerCase().includes(q) ||
          l.target?.toLowerCase().includes(q) ||
          l.result_message?.toLowerCase().includes(q) ||
          l.ip?.toLowerCase().includes(q) ||
          l.detail?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [logs, actionFilter, resultFilter, operatorFilter, moduleFilter, startDate, endDate, search]);

  const sorted = useMemo(() => {
    const data = [...filtered];
    data.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'time':
          cmp = new Date(a.time).getTime() - new Date(b.time).getTime();
          break;
        case 'operator':
          cmp = (a.operator_name || a.operator || '').localeCompare(b.operator_name || b.operator || '', 'zh-CN');
          break;
        case 'module':
          cmp = (a.module || '').localeCompare(b.module || '', 'zh-CN');
          break;
        case 'action':
          cmp = (a.action_label || a.action || '').localeCompare(b.action_label || b.action || '', 'zh-CN');
          break;
        case 'result':
          cmp = (a.result || '').localeCompare(b.result || '', 'zh-CN');
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return data;
  }, [filtered, sortField, sortAsc]);

  const {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    startItem,
    endItem,
    setPage,
    setPageSize,
  } = usePagination(sorted);

  // 供实时回调读取当前页码（避免闭包过期）
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setActionFilter('all');
    setResultFilter('all');
    setOperatorFilter('all');
    setModuleFilter('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const exportCSV = () => {
    const headers = [
      '时间',
      '操作人',
      '角色',
      '模块',
      '操作类型',
      '操作对象',
      '结果',
      '结果说明',
      'IP',
      '设备',
      '详情',
    ];
    const rows = filtered.map((l) => [
      l.time,
      l.operator_name || l.operator,
      l.role || '',
      l.module || '',
      l.action_label || l.action,
      l.target || '',
      l.result === 'success' ? '成功' : l.result === 'fail' ? '失败' : l.result || '',
      l.result_message || '',
      l.ip || '',
      l.device || '',
      l.detail || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `操作日志_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = [
    actionFilter !== 'all',
    resultFilter !== 'all',
    operatorFilter !== 'all',
    moduleFilter !== 'all',
    startDate,
    endDate,
    search.trim(),
  ].filter(Boolean).length;

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50" />;
    return sortAsc ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
  };

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title="操作日志"
          description="记录用户在系统中的关键操作行为，支持多维筛选、排序与导出"
        />
      )}
      {newCount > 0 && (
        <div
          className="flex cursor-pointer items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary"
          onClick={() => {
            setPage(1);
            setNewCount(0);
          }}
        >
          <span className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            有 {newCount} 条新的操作记录，点击查看
          </span>
          <X
            className="h-4 w-4"
            onClick={(e) => {
              e.stopPropagation();
              setNewCount(0);
            }}
          />
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">日志列表</CardTitle>
              <CardDescription>
                共 {totalItems} 条记录
                {activeFilterCount > 0 && ` · 已启用 ${activeFilterCount} 个筛选条件`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                title={`实时订阅状态：${realtimeStatus === 'connected' ? '实时已连接' : realtimeStatus === 'connecting' ? '连接中' : '连接断开'}`}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    realtimeStatus === 'connected' ? 'bg-green-500' : realtimeStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                />
                {realtimeStatus === 'connected' ? '实时已连接' : realtimeStatus === 'connecting' ? '连接中' : '连接断开'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className={`gap-1 ${realtimeStatus === 'disconnected' ? 'border-destructive/50 text-destructive' : ''}`}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
                <Download className="h-4 w-4" />
                导出
              </Button>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1">
                  <X className="h-4 w-4" />
                  重置
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索用户/模块/操作/对象"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as OperationLog['action'] | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="操作类型" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resultFilter} onValueChange={(v) => setResultFilter(v as OperationLog['result'] | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="操作结果" />
              </SelectTrigger>
              <SelectContent>
                {RESULT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={operatorFilter} onValueChange={setOperatorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="操作人" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部操作人</SelectItem>
                {operators.map(([account, name]) => (
                  <SelectItem key={account} value={account}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="业务模块" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部模块</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 md:col-span-2 lg:col-span-4 xl:col-span-5">
              <Label className="text-sm text-muted-foreground shrink-0">时间范围</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-40 justify-start gap-1">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    {startDate ? format(startDate, 'yyyy-MM-dd') : '开始日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={zhCN} />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">—</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-40 justify-start gap-1">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    {endDate ? format(endDate, 'yyyy-MM-dd') : '结束日期'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={zhCN} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">
                    <button
                      onClick={() => handleSort('time')}
                      className="group flex items-center gap-1 font-medium"
                    >
                      时间 {renderSortIcon('time')}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button
                      onClick={() => handleSort('operator')}
                      className="group flex items-center gap-1 font-medium"
                    >
                      操作人 {renderSortIcon('operator')}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button
                      onClick={() => handleSort('module')}
                      className="group flex items-center gap-1 font-medium"
                    >
                      模块 {renderSortIcon('module')}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button
                      onClick={() => handleSort('action')}
                      className="group flex items-center gap-1 font-medium"
                    >
                      操作类型 {renderSortIcon('action')}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">操作对象</TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button
                      onClick={() => handleSort('result')}
                      className="group flex items-center gap-1 font-medium"
                    >
                      结果 {renderSortIcon('result')}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">IP</TableHead>
                  <TableHead className="whitespace-nowrap">设备</TableHead>
                  <TableHead className="whitespace-nowrap">详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && paginatedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                )}
                {paginatedItems.map((l) => (
                  <TableRow
                    key={l.id}
                    onClick={() => setDetailLog(l)}
                    className="cursor-pointer hover:bg-muted/60"
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {l.time}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium">{l.operator_name || l.operator}</div>
                      {l.role && <div className="text-xs text-muted-foreground">{l.role}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="secondary">{l.module}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{l.action_label || l.action}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.target || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {l.result === 'success' ? (
                        <Badge variant="default">成功</Badge>
                      ) : l.result === 'fail' ? (
                        <Badge variant="destructive">失败</Badge>
                      ) : (
                        <Badge variant="outline">{l.result || '-'}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{l.ip || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{l.device || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate" title={l.detail || ''}>
                      {l.detail || '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && paginatedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                      暂无日志
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="border-t-0 rounded-t-none"
        />
      </Card>

      {/* 日志详情弹窗 */}
      <Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>操作日志详情</DialogTitle>
            <DialogDescription>
              {detailLog ? `${detailLog.module} · ${detailLog.action_label || detailLog.action}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 text-sm">
                <DetailRow label="操作时间" value={detailLog.time} />
                <DetailRow label="操作人" value={detailLog.operator_name || detailLog.operator} />
                {detailLog.role && <DetailRow label="角色" value={detailLog.role} />}
                <DetailRow label="业务模块" value={detailLog.module} />
                <DetailRow label="操作类型" value={detailLog.action_label || detailLog.action} />
                <DetailRow label="操作对象" value={detailLog.target || '-'} />
                {detailLog.target_type && <DetailRow label="对象类型" value={detailLog.target_type} />}
                {detailLog.target_id && <DetailRow label="目标 ID" value={detailLog.target_id} mono />}
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-muted-foreground">操作结果</span>
                  {detailLog.result === 'success' ? (
                    <Badge variant="default">成功</Badge>
                  ) : detailLog.result === 'fail' ? (
                    <Badge variant="destructive">失败</Badge>
                  ) : (
                    <Badge variant="outline">{detailLog.result || '-'}</Badge>
                  )}
                </div>
                {detailLog.result_message && (
                  <DetailRow label="结果说明" value={detailLog.result_message} block />
                )}
                {detailLog.ip && <DetailRow label="操作 IP" value={detailLog.ip} mono />}
                {detailLog.device && <DetailRow label="操作设备" value={detailLog.device} />}
              </div>
              {detailLog.detail && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">详细信息</div>
                  <div className="rounded-md border bg-muted/50 p-3 text-sm break-all whitespace-pre-wrap">
                    {formatDetail(detailLog.detail)}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 详情行：label + value 单行展示 */
function DetailRow({
  label,
  value,
  mono,
  block,
}: {
  label: string;
  value: string;
  mono?: boolean;
  block?: boolean;
}) {
  return (
    <div className={block ? 'space-y-1' : 'flex items-start gap-3'}>
      <span className={`shrink-0 text-muted-foreground ${block ? '' : 'min-w-20'}`}>{label}</span>
      <span
        className={`text-foreground break-all ${mono ? 'font-mono text-xs' : ''} ${
          block ? 'whitespace-pre-wrap' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/** 尝试格式化 JSON 详情，失败则原样返回 */
function formatDetail(detail: string): string {
  try {
    const parsed = JSON.parse(detail);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return detail;
  }
}

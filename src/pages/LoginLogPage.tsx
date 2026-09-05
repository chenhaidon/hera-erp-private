import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
import { usePagination } from '@/lib/pagination';
import { Pagination } from '@/components/common/Pagination';
import { useAppStore } from '@/store';
import { fetchEntities } from '@/lib/api';
import { useRealtimeLog } from '@/hooks/use-realtime-log';
import type { LoginLog } from '@/types';
import {
  Search,
  Download,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  X,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface LoginLogPageProps {
  embedded?: boolean;
}

type SortField = 'time' | 'account' | 'status' | 'ip' | 'is_abnormal';

const STATUS_OPTIONS: { value: LoginLog['status'] | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
  { value: 'locked', label: '已锁定' },
  { value: 'expired', label: '会话过期' },
  { value: 'logout', label: '登出' },
];

export function LoginLogPage({ embedded }: LoginLogPageProps = {}) {
  const store = useAppStore();
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const loadSeqRef = useRef(0);

  // 筛选状态
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LoginLog['status'] | 'all'>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [abnormalOnly, setAbnormalOnly] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // 排序
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortAsc, setSortAsc] = useState(false);

  // 手动刷新
  const handleRefresh = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    const data = await fetchEntities('login_logs');
    if (seq !== loadSeqRef.current) return;
    const typed = (data as unknown as LoginLog[]).sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );
    setLogs(typed);
    store.setLoginLogs(typed);
    setNewCount(0);
    setLoading(false);
  }, [store]);

  // 实时订阅：新登录记录写入时自动更新
  const realtimeStatus = useRealtimeLog({
    entityType: 'login_logs',
    onInsert: (record) => {
      const newLog = record as unknown as LoginLog;
      if (!newLog || !newLog.id) return;
      setLogs((prev) => {
        if (prev.some((l) => l.id === newLog.id)) return prev;
        return [newLog, ...prev].sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
        );
      });
      // 当前不在第一页时仅提示，不自动刷新列表
      if (currentPageRef.current !== 1) {
        setNewCount((c) => c + 1);
      }
    },
    onUpdate: (record) => {
      const updated = record as unknown as LoginLog;
      if (!updated || !updated.id) return;
      setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    },
  });

  // 初始加载：store 优先，若为空则从数据库加载
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (store.loginLogs.length > 0) {
        setLogs(store.loginLogs);
        return;
      }
      setLoading(true);
      const data = await fetchEntities('login_logs');
      const typed = (data as unknown as LoginLog[]).sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      if (mounted) {
        setLogs(typed);
        store.setLoginLogs(typed);
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
    if (store.loginLogs.length > 0) {
      setLogs(store.loginLogs);
    }
  }, [store.loginLogs]);

  const accounts = useMemo(
    () =>
      Array.from(new Set(logs.map((l) => l.account).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [logs]
  );

  const filtered = useMemo(() => {
    let data = [...logs];
    if (statusFilter !== 'all') data = data.filter((l) => l.status === statusFilter);
    if (accountFilter !== 'all') data = data.filter((l) => l.account === accountFilter);
    if (abnormalOnly) data = data.filter((l) => l.is_abnormal);
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
          l.account?.toLowerCase().includes(q) ||
          l.user_name?.toLowerCase().includes(q) ||
          l.ip?.toLowerCase().includes(q) ||
          l.device?.toLowerCase().includes(q) ||
          l.reason?.toLowerCase().includes(q) ||
          l.abnormal_reason?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [logs, statusFilter, accountFilter, abnormalOnly, startDate, endDate, search]);

  const sorted = useMemo(() => {
    const data = [...filtered];
    data.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'time':
          cmp = new Date(a.time).getTime() - new Date(b.time).getTime();
          break;
        case 'account':
          cmp = (a.user_name || a.account || '').localeCompare(b.user_name || b.account || '', 'zh-CN');
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '', 'zh-CN');
          break;
        case 'ip':
          cmp = (a.ip || '').localeCompare(b.ip || '', 'zh-CN');
          break;
        case 'is_abnormal':
          cmp = (a.is_abnormal ? 1 : 0) - (b.is_abnormal ? 1 : 0);
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

  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter((l) => l.status === 'success').length;
    const failed = logs.filter((l) => l.status === 'failed').length;
    const abnormal = logs.filter((l) => l.is_abnormal).length;
    return { total, success, failed, abnormal };
  }, [logs]);

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
    setStatusFilter('all');
    setAccountFilter('all');
    setAbnormalOnly(false);
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const exportCSV = () => {
    const headers = ['时间', '登录账号', '用户姓名', '状态', '登录IP', '登录设备', '结果说明', '异常', '异常原因'];
    const rows = filtered.map((l) => [
      l.time,
      l.account,
      l.user_name || '',
      l.status === 'success' ? '成功' : l.status === 'failed' ? '失败' : l.status === 'locked' ? '已锁定' : l.status === 'expired' ? '会话过期' : l.status === 'logout' ? '登出' : l.status,
      l.ip || '',
      l.device || '',
      l.reason || '',
      l.is_abnormal ? '是' : '否',
      l.abnormal_reason || '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `登录日志_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = [
    statusFilter !== 'all',
    accountFilter !== 'all',
    abnormalOnly,
    startDate,
    endDate,
    search.trim(),
  ].filter(Boolean).length;

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-50" />;
    return sortAsc ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />;
  };

  const renderStatusBadge = (status: LoginLog['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default"><ShieldCheck className="mr-1 h-3 w-3" />成功</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />失败</Badge>;
      case 'locked':
        return <Badge variant="destructive">已锁定</Badge>;
      case 'expired':
        return <Badge variant="secondary">会话过期</Badge>;
      case 'logout':
        return <Badge variant="secondary">登出</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const realtimeLabel =
    realtimeStatus === 'connected' ? '实时已连接' :
    realtimeStatus === 'connecting' ? '连接中' : '连接断开';
  const realtimeDotClass =
    realtimeStatus === 'connected' ? 'bg-green-500' :
    realtimeStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title="登录日志"
          description="记录用户登录、登出与异常登录行为，支持多维筛选与告警"
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
            有 {newCount} 条新的登录记录，点击查看
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription>总登录次数</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-green-50/50 border-green-200/50">
          <CardHeader className="pb-2">
            <CardDescription>成功</CardDescription>
            <CardTitle className="text-2xl text-green-700">{stats.success}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-red-50/50 border-red-200/50">
          <CardHeader className="pb-2">
            <CardDescription>失败</CardDescription>
            <CardTitle className="text-2xl text-red-700">{stats.failed}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-orange-50/50 border-orange-200/50">
          <CardHeader className="pb-2">
            <CardDescription>异常登录</CardDescription>
            <CardTitle className="text-2xl text-orange-700">{stats.abnormal}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">登录列表</CardTitle>
              <CardDescription>
                共 {totalItems} 条记录
                {activeFilterCount > 0 && ` · 已启用 ${activeFilterCount} 个筛选条件`}
                {abnormalOnly === false && stats.abnormal > 0 && (
                  <span className="ml-2 text-orange-600">
                    检测到 {stats.abnormal} 条异常登录
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title={`实时订阅状态：${realtimeLabel}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${realtimeDotClass}`} />
                {realtimeLabel}
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
                placeholder="搜索账号/IP/设备"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LoginLog['status'] | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="登录状态" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger>
                <SelectValue placeholder="登录账号" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部账号</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={abnormalOnly ? 'abnormal' : 'all'} onValueChange={(v) => setAbnormalOnly(v === 'abnormal')}>
              <SelectTrigger>
                <SelectValue placeholder="异常标识" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="abnormal">仅异常登录</SelectItem>
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
                      onClick={() => handleSort('account')}
                      className="group flex items-center gap-1 font-medium"
                    >
                      账号 {renderSortIcon('account')}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button
                      onClick={() => handleSort('status')}
                      className="group flex items-center gap-1 font-medium"
                    >
                      状态 {renderSortIcon('status')}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button
                      onClick={() => handleSort('ip')}
                      className="group flex items-center gap-1 font-medium"
                    >
                      登录IP {renderSortIcon('ip')}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">登录设备</TableHead>
                  <TableHead className="whitespace-nowrap">结果说明</TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button
                      onClick={() => handleSort('is_abnormal')}
                      className="group flex items-center gap-1 font-medium"
                    >
                      异常 {renderSortIcon('is_abnormal')}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && paginatedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                )}
                {paginatedItems.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{l.time}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium">{l.user_name || l.account}</div>
                      {l.user_name && l.user_name !== l.account && (
                        <div className="text-xs text-muted-foreground">{l.account}</div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{renderStatusBadge(l.status)}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-muted-foreground">{l.ip || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{l.device || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.reason || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {l.is_abnormal ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="destructive" className="w-fit">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            异常
                          </Badge>
                          {l.abnormal_reason && (
                            <span className="text-xs text-muted-foreground">{l.abnormal_reason}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && paginatedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      暂无日志
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-0 border-t p-0">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            className="border-0"
          />
        </CardFooter>
      </Card>
    </div>
  );
}

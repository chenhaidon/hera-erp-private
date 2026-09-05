import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Plus, RotateCw, Unlink, Eye, AlertCircle, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import type { EcommercePlatformAuth, EcommercePlatformCode } from '@/types';

const PLATFORM_OPTIONS: { code: EcommercePlatformCode; name: string }[] = [
  { code: 'taobao', name: '淘宝' },
  { code: 'pinduoduo', name: '拼多多' },
  { code: 'douyin', name: '抖店' },
];

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  authorized: { label: '已授权', variant: 'default' },
  unauthorized: { label: '未授权', variant: 'secondary' },
  expired: { label: '已过期', variant: 'destructive' },
};

function maskSecret(value = '') {
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function generateAuthUrl(platform: EcommercePlatformCode, appKey: string) {
  // 实际授权跳转链接需按平台 OAuth 规范生成，此处为占位
  return `https://oauth.example.com/${platform}?app_key=${encodeURIComponent(appKey)}`;
}

export default function PlatformAuthTab() {
  const [auths, setAuths] = useState<EcommercePlatformAuth[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [form, setForm] = useState<Partial<EcommercePlatformAuth>>({
    platform_code: 'taobao',
  });
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokens, setTokens] = useState({ accessToken: '', refreshToken: '', expiresIn: '7200' });

  async function loadAuths() {
    setLoading(true);
    const { data, error } = await supabase
      .from('ecommerce_platform_auth')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('加载授权列表失败');
      console.error(error);
    } else {
      setAuths(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAuths();
  }, []);

  const platformOptions = useMemo(() => PLATFORM_OPTIONS, []);

  function handleGenerateAuthUrl() {
    if (!form.platform_code || !form.app_key) {
      toast.error('请填写平台和 AppKey');
      return;
    }
    const url = generateAuthUrl(form.platform_code, form.app_key);
    setAuthUrl(url);
    setQrOpen(true);
  }

  async function handleTokenSave() {
    if (!form.platform_code || !form.shop_name) {
      toast.error('请填写平台和店铺名称');
      return;
    }
    if (!tokens.accessToken || !tokens.refreshToken) {
      toast.error('请填写 Access Token 和 Refresh Token');
      return;
    }
    const platform = PLATFORM_OPTIONS.find((p) => p.code === form.platform_code);
    const now = new Date();
    const expiresInSeconds = parseInt(tokens.expiresIn || '7200', 10);
    const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();
    const payload: Partial<EcommercePlatformAuth> = {
      platform_code: form.platform_code,
      platform_name: platform?.name || form.platform_name || '',
      shop_name: form.shop_name,
      app_key: form.app_key,
      app_secret: form.app_secret,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: expiresAt,
      auth_status: 'authorized',
      authorized_at: now.toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from('ecommerce_platform_auth')
      .insert(payload as any)
      .select()
      .single();
    if (error) {
      toast.error('保存授权失败');
      console.error(error);
      return;
    }
    toast.success('授权已保存');

    // 新授权成功后，将同店铺/平台的待处理告警置为已处理
    if (inserted?.id) {
      await supabase
        .from('ecommerce_alert_log')
        .update({ alert_status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('alert_status', 'pending')
        .or(`auth_id.eq.${inserted.id},platform_code.eq.${inserted.platform_code}`);
    }

    setTokenOpen(false);
    setQrOpen(false);
    setOpen(false);
    setTokens({ accessToken: '', refreshToken: '', expiresIn: '7200' });
    setForm({ platform_code: 'taobao' });
    await loadAuths();
  }

  async function handleUnbind(id: string) {
    if (!confirm('确认解除该店铺的授权吗？解除后将无法自动拉取订单')) return;
    const { error } = await supabase.from('ecommerce_platform_auth').delete().eq('id', id);
    if (error) {
      toast.error('解除授权失败');
      return;
    }
    toast.success('已解除授权');
    await loadAuths();
  }

  async function handleRefresh(id: string) {
    toast.info('已触发 Token 刷新，稍后请查看状态');
    // 调用刷新 Edge Function 或刷新页面，实际可扩展
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">平台授权管理</h3>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          绑定店铺
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>平台名称</TableHead>
              <TableHead>店铺名称</TableHead>
              <TableHead>授权状态</TableHead>
              <TableHead>授权时间</TableHead>
              <TableHead>Token 过期时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  加载中...
                </TableCell>
              </TableRow>
            ) : auths.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  暂无授权店铺，请点击绑定店铺按钮添加
                </TableCell>
              </TableRow>
            ) : (
              auths.map((auth) => {
                const status = STATUS_MAP[auth.auth_status] || {
                  label: auth.auth_status,
                  variant: 'secondary',
                };
                return (
                  <TableRow key={auth.id}>
                    <TableCell>{auth.platform_name}</TableCell>
                    <TableCell>{auth.shop_name}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {auth.authorized_at
                        ? new Date(auth.authorized_at).toLocaleString('zh-CN')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {auth.token_expires_at
                        ? new Date(auth.token_expires_at).toLocaleString('zh-CN')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleRefresh(auth.id)}>
                          <RotateCw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleUnbind(auth.id)}>
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 绑定店铺 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>绑定店铺</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>平台名称</Label>
              <Select
                value={form.platform_code}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    platform_code: v as EcommercePlatformCode,
                    platform_name: platformOptions.find((p) => p.code === v)?.name,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择平台" />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>店铺名称</Label>
              <Input
                value={form.shop_name || ''}
                onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                placeholder="请输入店铺名称"
              />
            </div>
            <div className="space-y-2">
              <Label>AppKey</Label>
              <Input
                value={form.app_key || ''}
                onChange={(e) => setForm({ ...form, app_key: e.target.value })}
                placeholder="请输入平台分配的 AppKey"
              />
            </div>
            <div className="space-y-2">
              <Label>AppSecret</Label>
              <Input
                type="password"
                value={form.app_secret || ''}
                onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
                placeholder="请输入平台分配的 AppSecret"
              />
            </div>
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                请确保 AppKey / AppSecret 正确。生成授权链接后，使用平台账号扫码完成授权，并在下一步回填返回的
                Access Token 和 Refresh Token。
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleGenerateAuthUrl}>生成授权链接</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 授权二维码 */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>扫码完成授权</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="border rounded-md p-4 bg-white">
              <QrCode className="h-40 w-40 text-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              请使用平台官方 App 扫描上方二维码完成授权。授权完成后，点击下方按钮回填 Token。
            </p>
            <Button
              onClick={() => {
                setTokenOpen(true);
                setQrOpen(false);
              }}
            >
              已授权，回填 Token
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 回填 Token */}
      <Dialog open={tokenOpen} onOpenChange={setTokenOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>回填 Access Token</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Access Token</Label>
              <Input
                value={tokens.accessToken}
                onChange={(e) => setTokens({ ...tokens, accessToken: e.target.value })}
                placeholder="请输入平台返回的 Access Token"
              />
            </div>
            <div className="space-y-2">
              <Label>Refresh Token</Label>
              <Input
                value={tokens.refreshToken}
                onChange={(e) => setTokens({ ...tokens, refreshToken: e.target.value })}
                placeholder="请输入平台返回的 Refresh Token"
              />
            </div>
            <div className="space-y-2">
              <Label>过期时间（秒）</Label>
              <Input
                value={tokens.expiresIn}
                onChange={(e) => setTokens({ ...tokens, expiresIn: e.target.value })}
                placeholder="默认 7200 秒"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenOpen(false)}>
              取消
            </Button>
            <Button onClick={handleTokenSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

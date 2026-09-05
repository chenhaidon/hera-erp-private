import { useState } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';

export default function MobileLoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      toast.error('请输入用户名和密码');
      return;
    }
    if (!agreed) {
      toast.error('请同意用户协议与隐私政策');
      return;
    }
    setLoading(true);
    const { error } = await signIn(username, password);
    setLoading(false);
    if (error) {
      toast.error(error.message || '登录失败');
      return;
    }
    toast.success('登录成功');
    const stateFrom = (location.state as { from?: string })?.from;
    const queryFrom = searchParams.get('from') || undefined;
    const from = stateFrom || queryFrom;
    navigate(from && from !== '/mobile/login' ? from : '/mobile/home', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-10">
      <div className="mb-10 flex flex-col items-center pt-8">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary">
          <span className="text-2xl font-bold text-primary-foreground">龙</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">金龙工艺移动端</h1>
        <p className="mt-2 text-sm text-muted-foreground">浦江家纺智造管理平台</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">用户名</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">密码</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="mobile-login-agree"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
          />
          <label htmlFor="mobile-login-agree" className="text-sm leading-5 text-muted-foreground">
            我已阅读并同意
            <span className="text-primary">《用户协议》</span>
            与
            <span className="text-primary">《隐私政策》</span>
          </label>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '登录中...' : '登录'}
          {!loading && <ChevronRight className="ml-2 h-4 w-4" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        还没有账号？{' '}
        <Link to="/register" className="text-primary hover:underline">
          立即注册
        </Link>
      </p>

      <div className="mt-auto pt-6 text-center">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          返回电脑端首页
        </Link>
      </div>
    </div>
  );
}

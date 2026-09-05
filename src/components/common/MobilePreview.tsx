import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { MobileApp } from './MobileApp';

interface MobilePreviewProps {
  onLoginSuccess?: () => void;
}

export function MobilePreview({ onLoginSuccess }: MobilePreviewProps) {
  const { user, signInWithOtp, signInWithPhone } = useAuth();
  const [page, setPage] = useState<'landing' | 'login'>('landing');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }
    if (!agreed) {
      setError('请先勾选用户协议与隐私政策');
      return;
    }
    setError('');
    setLoading(true);
    const { error: sendError } = await signInWithOtp(phone);
    setLoading(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    startCountdown();
  };

  const handleLogin = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError('请输入6位验证码');
      return;
    }
    if (!agreed) {
      setError('请先勾选用户协议与隐私政策');
      return;
    }
    setError('');
    setLoading(true);
    const { error: loginError } = await signInWithPhone(phone, otp);
    setLoading(false);
    if (loginError) {
      setError(loginError.message);
      return;
    }
    onLoginSuccess?.();
  };

  if (user) {
    return <MobileApp onLogout={() => setPage('landing')} />;
  }

  if (page === 'landing') {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex flex-1 flex-col items-center justify-center px-8">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-2xl bg-primary">
            <span className="text-3xl font-bold text-primary-foreground">龙</span>
          </div>
          <h1 className="mb-3 text-2xl font-bold text-foreground">金龙工艺移动端</h1>
          <p className="text-center text-base leading-6 text-muted-foreground">
            面向浦江绗缝家纺生产企业的移动化管理应用
            <br />
            随时随地高效协同
          </p>
        </div>
        <div className="px-6 pb-10">
          <Button className="w-full rounded-xl py-6 text-base" onClick={() => setPage('login')}>
            <span>开始使用</span>
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">登录即表示您已阅读并同意相关协议</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background px-6 py-10">
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-foreground">欢迎登录</h2>
        <p className="text-base text-muted-foreground">手机号验证码登录，与 Web 端共享账号</p>
      </div>

      <div className="mb-4 space-y-2">
        <label className="text-sm font-medium text-foreground">手机号</label>
        <Input
          placeholder="请输入手机号"
          maxLength={11}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div className="mb-4 space-y-2">
        <label className="text-sm font-medium text-foreground">验证码</label>
        <div className="flex gap-3">
          <Input
            placeholder="请输入验证码"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="outline"
            disabled={countdown > 0 || loading}
            onClick={handleSendOtp}
          >
            {countdown > 0 ? `${countdown}s` : loading ? '发送中...' : '获取验证码'}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-2">
        <Checkbox
          id="mobile-preview-agree"
          checked={agreed}
          onCheckedChange={(checked) => setAgreed(checked === true)}
        />
        <label htmlFor="mobile-preview-agree" className="text-sm leading-5 text-muted-foreground">
          我已阅读并同意
          <span className="text-primary">《用户协议》</span>
          与
          <span className="text-primary">《隐私政策》</span>
        </label>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      <Button
        className="mt-2 w-full"
        disabled={!agreed || phone.length < 11 || otp.length < 6 || loading}
        onClick={handleLogin}
      >
        {loading ? '登录中...' : '登录'}
      </Button>

      <p className="mt-6 text-center text-xs text-muted-foreground">未注册手机号验证通过后将自动创建账号</p>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <button className="text-primary" onClick={() => setPage('landing')}>返回首页</button>
      </p>
    </div>
  );
}

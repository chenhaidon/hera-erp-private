import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Input, Button } from '@tarojs/components';
import { useAuth } from '@/contexts/AuthContext';
import { PrivacyModal } from '@/components/PrivacyModal';

export default function LoginPage() {
  const { session, agreed, setAgreed, signInWithUsername, signUpWithUsername, signInWithWechat } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    if (session) {
      const redirect = Taro.getStorageSync('loginRedirectPath') || '/pages/index/index';
      Taro.removeStorageSync('loginRedirectPath');
      if (['/pages/index/index', '/pages/production/index', '/pages/quality/index', '/pages/profile/index'].includes(redirect)) {
        Taro.switchTab({ url: redirect });
      } else {
        Taro.redirectTo({ url: redirect });
      }
    }
  }, [session]);

  const handleSubmit = async () => {
    if (!agreed) {
      setShowPrivacy(true);
      return;
    }
    if (!username || !password) {
      Taro.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }
    setLoading(true);
    const { error } = mode === 'login'
      ? await signInWithUsername(username, password)
      : await signUpWithUsername(username, password);
    setLoading(false);
    if (error) {
      Taro.showToast({ title: error.message, icon: 'none' });
    } else {
      Taro.showToast({ title: mode === 'login' ? '登录成功' : '注册成功', icon: 'success' });
    }
  };

  const handleWechat = async () => {
    if (!agreed) {
      setShowPrivacy(true);
      return;
    }
    setLoading(true);
    const { error } = await signInWithWechat();
    setLoading(false);
    if (error) {
      Taro.showToast({ title: error.message, icon: 'none' });
    }
  };

  return (
    <View className="min-h-screen bg-background p-6">
      <View className="pt-20 pb-10">
        <Text className="text-3xl font-bold text-foreground">金龙工艺</Text>
        <Text className="mt-2 text-muted">浦江家纺智造管理平台</Text>
      </View>

      <View className="rounded-lg bg-surface p-5 hud-border">
        <Text className="mb-6 text-xl font-semibold text-foreground">{mode === 'login' ? '账号登录' : '账号注册'}</Text>
        <Input
          className="mb-4 h-12 rounded bg-background px-3 text-foreground"
          placeholder="用户名"
          placeholderClass="text-muted"
          value={username}
          onInput={(e) => setUsername(e.detail.value)}
        />
        <Input
          className="mb-6 h-12 rounded bg-background px-3 text-foreground"
          placeholder="密码"
          placeholderClass="text-muted"
          password
          value={password}
          onInput={(e) => setPassword(e.detail.value)}
        />

        <View className="mb-6 flex items-center" onClick={() => setAgreed(!agreed)}>
          <View className={`mr-2 h-5 w-5 rounded border ${agreed ? 'border-primary bg-primary' : 'border-muted'}`}>
            {agreed && <Text className="text-center text-xs text-primary-foreground">✓</Text>}
          </View>
          <Text className="text-sm text-muted">
            我已阅读并同意
            <Text className="text-primary" onClick={() => Taro.navigateTo({ url: '/pages/privacy/index' })}>《用户协议》</Text>
            和
            <Text className="text-primary" onClick={() => Taro.navigateTo({ url: '/pages/privacy/index' })}>《隐私政策》</Text>
          </Text>
        </View>

        <Button
          className="mb-4 h-12 rounded bg-primary text-primary-foreground font-semibold"
          loading={loading}
          onClick={handleSubmit}
        >
          {mode === 'login' ? '登录' : '注册'}
        </Button>

        <Button
          className="h-12 rounded bg-[#07C160] text-white font-semibold"
          loading={loading}
          onClick={handleWechat}
        >
          微信一键登录
        </Button>

        <View className="mt-4 text-center" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          <Text className="text-sm text-primary">{mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}</Text>
        </View>
      </View>

      <PrivacyModal visible={showPrivacy} onClose={() => setShowPrivacy(false)} onAgree={() => { setAgreed(true); setShowPrivacy(false); }} />
    </View>
  );
}

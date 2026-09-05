import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { withRouteGuard } from '@/components/RouteGuard';
import { useAuth } from '@/contexts/AuthContext';
import { clearCache } from '@/utils/cache';

function ProfilePage() {
  const { user, signOut } = useAuth();

  const menus = [
    { label: '隐私政策', path: '/pages/privacy/index' },
    { label: '个人信息收集清单', path: '/pages/double-list/index?type=collect' },
    { label: '第三方信息共享清单', path: '/pages/double-list/index?type=share' },
    { label: '清空缓存', action: () => { clearCache(); Taro.showToast({ title: '已清空', icon: 'success' }); } },
  ];

  return (
    <ScrollView className="min-h-screen bg-background p-4" scrollY>
      <View className="mb-6 rounded-lg bg-surface p-5 hud-border">
        <View className="mb-3 h-16 w-16 rounded-full bg-primary/10" />
        <Text className="text-xl font-bold text-foreground">{user?.full_name || user?.username || user?.phone || '未命名用户'}</Text>
        <Text className="text-sm text-muted">角色：{user?.role || '-'}</Text>
      </View>

      <View className="rounded-lg bg-surface hud-border overflow-hidden">
        {menus.map((item, index) => (
          <View
            key={item.label}
            className={`flex items-center justify-between p-4 active:opacity-80 ${index !== menus.length - 1 ? 'border-b border-border' : ''}`}
            onClick={() => item.path ? Taro.navigateTo({ url: item.path }) : item.action?.()}
          >
            <Text className="text-base text-foreground">{item.label}</Text>
            <Text className="text-muted">›</Text>
          </View>
        ))}
      </View>

      <Button className="mt-8 h-12 w-full rounded bg-destructive/10 text-destructive font-semibold" onClick={signOut}>退出登录</Button>
    </ScrollView>
  );
}

export default withRouteGuard(ProfilePage);

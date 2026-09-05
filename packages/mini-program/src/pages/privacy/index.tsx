import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAuth } from '@/contexts/AuthContext';

export default function PrivacyPage() {
  const { agreed, setAgreed } = useAuth();

  return (
    <ScrollView className="min-h-screen bg-background p-4" scrollY>
      <Text className="mb-4 text-xl font-bold text-foreground">用户协议与隐私政策</Text>
      <View className="rounded-lg bg-surface p-4 hud-border text-sm leading-relaxed text-muted">
        <Text className="mb-2 block text-foreground font-semibold">1. 信息收集</Text>
        <Text className="mb-4 block">我们仅收集实现业务功能所必需的个人信息，包括您的账号信息、联系方式以及设备信息，用于身份验证、业务处理和消息推送。</Text>

        <Text className="mb-2 block text-foreground font-semibold">2. 信息使用</Text>
        <Text className="mb-4 block">您的信息将用于生产报工、质检录入、库存管理、审批流转等业务场景，并存储在符合安全标准的服务器中。</Text>

        <Text className="mb-2 block text-foreground font-semibold">3. 信息共享</Text>
        <Text className="mb-4 block">我们不会将您的个人信息出售给第三方。仅在法律法规要求或获得您授权的情况下，与必要的第三方共享。</Text>

        <Text className="mb-2 block text-foreground font-semibold">4. 账号注销</Text>
        <Text className="mb-4 block">您可通过联系管理员申请注销账号，注销后我们将依法删除或匿名化您的个人信息。</Text>

        <Text className="mb-2 block text-foreground font-semibold">5. 未成年人保护</Text>
        <Text className="mb-4 block">本应用仅面向企业用户，不向未成年人提供服务。</Text>
      </View>

      {!agreed && (
        <Button className="mt-6 h-12 w-full rounded bg-primary text-primary-foreground font-semibold" onClick={() => { setAgreed(true); Taro.showToast({ title: '已同意', icon: 'success' }); }}>
          同意并继续
        </Button>
      )}
    </ScrollView>
  );
}

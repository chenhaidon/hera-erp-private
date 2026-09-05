import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';

const collectItems = [
  { name: '账号信息', purpose: '用户身份识别与登录', type: '用户主动提供' },
  { name: '手机号', purpose: '账号安全与业务通知', type: '用户主动提供' },
  { name: '微信 OpenID', purpose: '微信授权登录', type: '微信 SDK 收集' },
  { name: '设备信息', purpose: '保障账号安全与运行稳定性', type: '系统自动采集' },
  { name: '业务操作数据', purpose: '生产报工、质检、库存等业务处理', type: '用户主动提交' },
];

const shareItems = [
  { name: '微信开放平台', purpose: '微信登录与消息推送', info: 'OpenID、UnionID' },
  { name: 'Supabase 云服务', purpose: '数据存储与认证服务', info: '加密后的业务数据' },
];

export default function DoubleListPage() {
  const type = Taro.getCurrentInstance().router?.params?.type || 'collect';
  const isCollect = type === 'collect';

  return (
    <ScrollView className="min-h-screen bg-background p-4" scrollY>
      <Text className="mb-4 text-xl font-bold text-foreground">{isCollect ? '个人信息收集清单' : '第三方信息共享清单'}</Text>
      {(isCollect ? collectItems : shareItems).map((item, index) => (
        <View key={index} className="mb-3 rounded-lg bg-surface p-4 hud-border">
          <Text className="text-base font-semibold text-foreground">{(item as any).name}</Text>
          <Text className="mt-1 text-sm text-muted">用途：{(item as any).purpose}</Text>
          <Text className="text-sm text-muted">{isCollect ? `收集方式：${(item as any).type}` : `共享信息：${(item as any).info}`}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

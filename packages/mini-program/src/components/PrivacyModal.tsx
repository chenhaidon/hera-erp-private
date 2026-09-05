import { View, Text, Button } from '@tarojs/components';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAgree: () => void;
}

export function PrivacyModal({ visible, onClose, onAgree }: Props) {
  if (!visible) return null;
  return (
    <View className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <View className="w-full max-w-sm rounded-lg bg-surface p-5 hud-border">
        <Text className="mb-4 text-lg font-bold text-foreground">隐私政策提示</Text>
        <Text className="mb-6 text-sm text-muted leading-relaxed">
          欢迎使用金龙工艺小程序。我们重视您的隐私保护，在使用前请您阅读并同意
          <Text className="text-primary">《用户协议》</Text>和
          <Text className="text-primary">《隐私政策》</Text>。
          我们会依法保护您的个人信息安全。
        </Text>
        <View className="flex gap-3">
          <Button className="flex-1 h-11 rounded bg-background text-foreground font-medium" onClick={onClose}>不同意</Button>
          <Button className="flex-1 h-11 rounded bg-primary text-primary-foreground font-medium" onClick={onAgree}>同意</Button>
        </View>
      </View>
    </View>
  );
}

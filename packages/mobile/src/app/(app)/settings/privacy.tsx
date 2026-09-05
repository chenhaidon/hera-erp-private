import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function PrivacySettingsScreen() {
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 pt-6 pb-3 bg-background border-b border-border">
        <Pressable
          className="p-2 -ml-2 active:opacity-70"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="hsl(222 47% 11%)" />
        </Pressable>
        <Text className="text-lg font-bold text-foreground ml-2">隐私设置</Text>
      </View>
      <ScrollView contentContainerClassName="p-4 pb-24">
        <Text className="text-base font-semibold text-foreground mb-3">
          隐私政策
        </Text>
        <Text className="text-sm text-muted-foreground leading-5 mb-6">
          金龙工艺移动端尊重并保护您的个人信息。我们仅收集为您提供服务所必要的个人信息，包括手机号、设备信息等。您可以随时查看完整的《隐私政策》与《用户协议》。
        </Text>

        <Text className="text-base font-semibold text-foreground mb-3">
          权限管理
        </Text>
        <Text className="text-sm text-muted-foreground leading-5 mb-6">
          本应用涉及的系统权限包括：相机（用于扫码报工、拍摄照片）、相册（用于选择图片上传）。您可以在手机系统设置中管理这些权限。
        </Text>

        <Text className="text-base font-semibold text-foreground mb-3">
          第三方共享
        </Text>
        <Text className="text-sm text-muted-foreground leading-5">
          我们不会将您的个人信息共享给第三方，除非获得您的明确同意或法律法规另有要求。
        </Text>
      </ScrollView>
    </View>
  );
}

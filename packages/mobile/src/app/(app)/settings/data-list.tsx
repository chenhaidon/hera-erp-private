import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function DataListScreen() {
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 pt-6 pb-3 bg-background border-b border-border">
        <Pressable
          className="p-2 -ml-2 active:opacity-70"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="hsl(222 47% 11%)" />
        </Pressable>
        <Text className="text-lg font-bold text-foreground ml-2">双清单</Text>
      </View>
      <ScrollView contentContainerClassName="p-4 pb-24">
        <Text className="text-base font-semibold text-foreground mb-3">
          已收集个人信息清单
        </Text>
        <View className="bg-card rounded-2xl border border-border p-4 mb-6">
          <InfoRow title="信息类型" value="个人基本资料" />
          <InfoRow title="信息名称" value="手机号" />
          <InfoRow title="使用目的" value="身份认证、登录账号" />
          <InfoRow title="使用场景" value="登录与账号管理" />
          <InfoRow title="收集情况" value="登录时收集" />
          <InfoRow title="信息内容" value="11位手机号码" />
        </View>

        <Text className="text-base font-semibold text-foreground mb-3">
          第三方信息共享清单
        </Text>
        <View className="bg-card rounded-2xl border border-border p-4">
          <Text className="text-sm text-muted-foreground leading-5">
            当前版本暂未向第三方共享您的个人信息。后续如有共享，将在此清单中更新并重新征得您的同意。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ title, value }: { title: string; value: string }) {
  return (
    <View className="flex-row py-2 border-b border-border last:border-b-0">
      <Text className="text-sm text-muted-foreground w-20">{title}</Text>
      <Text className="flex-1 text-sm text-foreground">{value}</Text>
    </View>
  );
}

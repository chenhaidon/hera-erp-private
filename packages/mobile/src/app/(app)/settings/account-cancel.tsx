import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/ctx";

export default function AccountCancelScreen() {
  const { signOut } = useSession();
  const [loading, setLoading] = useState(false);

  const handleCancel = () => {
    Alert.alert("账号注销", "注销后将无法恢复账号及相关数据，是否继续？", [
      { text: "再想想", style: "cancel" },
      {
        text: "确认注销",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          // 实际业务中应调用 Edge Function 处理注销
          await signOut();
          setLoading(false);
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 pt-6 pb-3 bg-background border-b border-border">
        <Pressable
          className="p-2 -ml-2 active:opacity-70"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="hsl(222 47% 11%)" />
        </Pressable>
        <Text className="text-lg font-bold text-foreground ml-2">账号注销</Text>
      </View>
      <ScrollView contentContainerClassName="p-4 pb-24">
        <Text className="text-base font-semibold text-foreground mb-3">
          注销说明
        </Text>
        <Text className="text-sm text-muted-foreground leading-5 mb-4">
          注销账号后，您的登录信息将被清除，App 中的本地缓存数据也将被删除。根据相关法律法规要求，部分业务数据可能会在后台保留一定期限。
        </Text>
        <Text className="text-sm text-muted-foreground leading-5 mb-6">
          注销操作不可逆，请谨慎操作。
        </Text>
        <Button
          variant="destructive"
          loading={loading}
          onPress={handleCancel}
        >
          确认注销
        </Button>
      </ScrollView>
    </View>
  );
}

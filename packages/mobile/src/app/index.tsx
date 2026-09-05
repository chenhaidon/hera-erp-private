import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

export default function LandingScreen() {

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="dark" />
      <View className="flex-1 items-center justify-center px-8">
        <View className="w-24 h-24 rounded-2xl bg-primary items-center justify-center mb-8">
          <Text className="text-primary-foreground text-3xl font-bold">龙</Text>
        </View>
        <Text className="text-2xl font-bold text-foreground mb-3">
          金龙工艺移动端
        </Text>
        <Text className="text-base text-muted-foreground text-center leading-6">
          面向浦江绗缝家纺生产企业的移动化管理应用{"\n"}
          随时随地高效协同
        </Text>
      </View>
      <View className="px-6 pb-10" style={{ paddingBottom: 40 }}>
        <Pressable
          className="flex-row items-center justify-center bg-primary rounded-xl py-4 active:opacity-90"
          onPress={() => router.push("/(auth)/sign-in")}
        >
          <Text className="text-primary-foreground font-semibold text-base mr-2">
            开始使用
          </Text>
          <ChevronRight size={20} color="white" />
        </Pressable>
        <Text className="text-xs text-muted-foreground text-center mt-4">
          登录即表示您已阅读并同意相关协议
        </Text>
      </View>
    </View>
  );
}

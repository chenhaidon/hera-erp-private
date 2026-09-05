import { router } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Shield,
  UserX,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function SettingsScreen() {
  const menuItems = [
    {
      icon: Shield,
      label: "隐私设置",
      route: "/(app)/settings/privacy",
    },
    {
      icon: FileText,
      label: "双清单",
      route: "/(app)/settings/data-list",
    },
    {
      icon: UserX,
      label: "账号注销",
      route: "/(app)/settings/account-cancel",
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 pt-6 pb-3 bg-background border-b border-border">
        <Pressable
          className="p-2 -ml-2 active:opacity-70"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="hsl(222 47% 11%)" />
        </Pressable>
        <Text className="text-lg font-bold text-foreground ml-2">设置</Text>
      </View>
      <ScrollView contentContainerClassName="p-4 pb-24">
        {menuItems.map((item, index) => (
          <Pressable
            key={item.label}
            className="flex-row items-center bg-card rounded-2xl px-4 py-4 mb-3 active:opacity-90"
            onPress={() => router.push(item.route as any)}
          >
            <item.icon size={20} color="hsl(221 83% 53%)" />
            <Text className="flex-1 text-base text-foreground ml-3">
              {item.label}
            </Text>
            <ChevronRight size={18} color="hsl(215 16% 47%)" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

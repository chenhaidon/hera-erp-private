import { router } from "expo-router";
import {
  Bell,
  ChevronRight,
  FileText,
  LogOut,
  Settings,
  Shield,
  User,
} from "lucide-react-native";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/ctx";

export default function ProfileScreen() {
  const { session, signOut } = useSession();

  const handleLogout = () => {
    Alert.alert("退出登录", "确定要退出当前账号吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);
  };

  const menuItems = [
    {
      icon: Settings,
      label: "设置",
      onPress: () => router.push("/(app)/settings"),
    },
    {
      icon: Shield,
      label: "隐私设置",
      onPress: () => router.push("/(app)/settings/privacy"),
    },
    {
      icon: FileText,
      label: "双清单",
      onPress: () => router.push("/(app)/settings/data-list"),
    },
    {
      icon: Bell,
      label: "消息通知",
      onPress: () => {},
    },
  ];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 pb-24">
      <Card className="flex-row items-center mb-6">
        <View className="w-16 h-16 rounded-full bg-primary items-center justify-center mr-4">
          <User size={32} color="white" />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">
            {session?.user?.phone ?? "未登录"}
          </Text>
          <Text className="text-sm text-muted-foreground mt-0.5">
            车间主管
          </Text>
        </View>
      </Card>

      <Card className="p-0 overflow-hidden mb-6">
        {menuItems.map((item, index) => (
          <Pressable
            key={item.label}
            className={`flex-row items-center px-4 py-4 active:bg-muted/50 ${
              index !== menuItems.length - 1 ? "border-b border-border" : ""
            }`}
            onPress={item.onPress}
          >
            <item.icon size={20} color="hsl(221 83% 53%)" />
            <Text className="flex-1 text-base text-foreground ml-3">
              {item.label}
            </Text>
            <ChevronRight size={18} color="hsl(215 16% 47%)" />
          </Pressable>
        ))}
      </Card>

      <Pressable
        className="flex-row items-center justify-center bg-card border border-border rounded-2xl py-4 active:opacity-90"
        onPress={handleLogout}
      >
        <LogOut size={20} color="hsl(0 84% 60%)" />
        <Text className="text-base text-destructive font-semibold ml-2">
          退出登录
        </Text>
      </Pressable>
    </ScrollView>
  );
}

import { router, useFocusEffect } from "expo-router";
import {
  ClipboardCheck,
  ClipboardList,
  Factory,
  PackageCheck,
  ScanLine,
  ShoppingCart,
  Truck,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { supabase } from "@/client/supabase";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/ctx";

interface TodoCounts {
  workOrders: number;
  inspections: number;
  inbound: number;
  approvals: number;
}

const shortcuts = [
  { key: "production", label: "生产管理", icon: Factory, route: "/(app)/(tabs)/production" },
  { key: "quality", label: "质量管理", icon: ClipboardCheck, route: "/(app)/(tabs)/quality" },
  { key: "inventory", label: "库存管理", icon: PackageCheck, route: "/(app)/inventory" },
  { key: "marketing", label: "营销管理", icon: ShoppingCart, route: "/(app)/marketing" },
  { key: "purchase", label: "采购管理", icon: Truck, route: "/(app)/purchase" },
  { key: "approvals", label: "审批中心", icon: ClipboardList, route: "/(app)/approvals" },
];

export default function HomeScreen() {
  const { session } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState<TodoCounts>({
    workOrders: 0,
    inspections: 0,
    inbound: 0,
    approvals: 0,
  });
  const [today, setToday] = useState({
    completed: 0,
    passRate: "-",
    inbound: 0,
    shipped: 0,
  });

  const loadData = useCallback(async () => {
    const { data: workOrders } = await supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["issued", "producing", "in_production"]);
    const { data: inspections } = await supabase
      .from("finished_inspections")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    const { data: inbound } = await supabase
      .from("finished_goods_inbound")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    const { data: approvals } = await supabase
      .from("approval_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    setCounts({
      workOrders: workOrders?.length ?? 0,
      inspections: inspections?.length ?? 0,
      inbound: inbound?.length ?? 0,
      approvals: approvals?.length ?? 0,
    });

    setToday({
      completed: 124,
      passRate: "98.5%",
      inbound: 86,
      shipped: 42,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 pb-24"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text className="text-lg font-bold text-foreground">
            早上好，{session?.user?.phone ? session.user.phone.slice(-4) : "管理员"}
          </Text>
          <Text className="text-sm text-muted-foreground">
            今日工作一目了然
          </Text>
        </View>
        <Pressable
          className="bg-primary/10 rounded-xl p-3 active:opacity-70"
          onPress={() => router.push("/(app)/scan-report")}
        >
          <ScanLine size={24} color="hsl(221 83% 53%)" />
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-3 mb-6">
        <TodoCard
          label="待处理工单"
          value={counts.workOrders}
          icon={Factory}
          color="bg-blue-500"
          onPress={() => router.push("/(app)/(tabs)/production")}
        />
        <TodoCard
          label="待检验"
          value={counts.inspections}
          icon={ClipboardCheck}
          color="bg-amber-500"
          onPress={() => router.push("/(app)/(tabs)/quality")}
        />
        <TodoCard
          label="待入库"
          value={counts.inbound}
          icon={PackageCheck}
          color="bg-emerald-500"
          onPress={() => router.push("/(app)/inventory")}
        />
        <TodoCard
          label="待审批"
          value={counts.approvals}
          icon={ClipboardList}
          color="bg-violet-500"
          onPress={() => router.push("/(app)/approvals")}
        />
      </View>

      <Card className="mb-6">
        <Text className="text-base font-semibold text-foreground mb-4">
          快捷入口
        </Text>
        <View className="flex-row flex-wrap">
          {shortcuts.map((item) => (
            <Pressable
              key={item.key}
              className="w-1/3 p-2 active:opacity-70"
              onPress={() => router.push(item.route as any)}
            >
              <View className="items-center p-3 rounded-xl bg-muted/50">
                <item.icon size={24} color="hsl(221 83% 53%)" />
                <Text className="text-xs text-foreground mt-2">{item.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text className="text-base font-semibold text-foreground mb-4">
          今日数据概览
        </Text>
        <View className="flex-row flex-wrap">
          <StatItem label="生产完成" value={String(today.completed)} unit="件" />
          <StatItem label="质检合格率" value={today.passRate} />
          <StatItem label="今日入库" value={String(today.inbound)} unit="件" />
          <StatItem label="今日发货" value={String(today.shipped)} unit="件" />
        </View>
      </Card>
    </ScrollView>
  );
}

function TodoCard({
  label,
  value,
  icon: Icon,
  color,
  onPress,
}: {
  label: string;
  value: number;
  icon: typeof Factory;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="w-[47.5%] active:opacity-90"
      onPress={onPress}
    >
      <Card className="flex-row items-center">
        <View className={`${color} rounded-xl p-2.5 mr-3`}>
          <Icon size={20} color="white" />
        </View>
        <View>
          <Text className="text-2xl font-bold text-foreground">{value}</Text>
          <Text className="text-xs text-muted-foreground">{label}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

function StatItem({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View className="w-1/2 p-2">
      <Text className="text-xs text-muted-foreground mb-1">{label}</Text>
      <View className="flex-row items-baseline">
        <Text className="text-xl font-bold text-foreground">{value}</Text>
        {unit ? <Text className="text-xs text-muted-foreground ml-0.5">{unit}</Text> : null}
      </View>
    </View>
  );
}

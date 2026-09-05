import { router, useFocusEffect } from "expo-router";
import { ChevronRight, Factory, User, ScanLine } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { WorkOrder } from "@/types";
import { getCurrentEmployee, setCurrentEmployee } from "@/lib/utils";
import type { CurrentEmployee } from "@/lib/utils";

const statusMap: Record<string, { label: string; color: string }> = {
  pending_scheduling: { label: "待排产", color: "bg-slate-500" },
  pending: { label: "待排产", color: "bg-slate-500" },
  issued: { label: "已下发", color: "bg-blue-500" },
  producing: { label: "生产中", color: "bg-amber-500" },
  in_production: { label: "生产中", color: "bg-amber-500" },
  pending_qc: { label: "待质检", color: "bg-purple-500" },
  pending_inbound: { label: "待入库", color: "bg-emerald-500" },
  inbound: { label: "已入库", color: "bg-green-600" },
  closed: { label: "已结案", color: "bg-slate-400" },
};

export default function ProductionScreen() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [employee, setEmployee] = useState<CurrentEmployee | null>(null);

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from("work_orders")
      .select("id, work_no, product_code, product_name, plan_quantity, completed_quantity, progress, status")
      .order("created_at", { ascending: false })
      .limit(50);
    setOrders((data as WorkOrder[]) ?? []);
  }, []);

  const loadEmployee = useCallback(async () => {
    const current = await getCurrentEmployee();
    setEmployee(current);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
      loadEmployee();
    }, [loadOrders, loadEmployee]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const renderItem = ({ item }: { item: WorkOrder }) => {
    const progress = item.plan_quantity
      ? Math.round((item.completed_quantity / item.plan_quantity) * 100)
      : 0;
    const status = statusMap[item.status] ?? { label: item.status, color: "bg-slate-500" };

    return (
      <Pressable
        className="mb-3 active:opacity-90"
        onPress={() => router.push(`/(app)/production/${item.id}`)}
      >
        <Card>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-base font-semibold text-foreground">
              {item.work_no}
            </Text>
            <View className={`${status.color} rounded-full px-2.5 py-1`}>
              <Text className="text-xs text-white">{status.label}</Text>
            </View>
          </View>
          <Text className="text-sm text-foreground mb-1">
            {item.product_name} ({item.product_code})
          </Text>
          <View className="flex-row items-center justify-between mt-3">
            <View className="flex-1 mr-4">
              <View className="h-2 bg-muted rounded-full overflow-hidden">
                <View
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </View>
            </View>
            <Text className="text-sm text-muted-foreground">
              {item.completed_quantity}/{item.plan_quantity} ({progress}%)
            </Text>
          </View>
          <View className="flex-row items-center justify-between mt-3">
            <Text className="text-xs text-muted-foreground">
              状态：{status.label}
            </Text>
            <ChevronRight size={18} color="hsl(215 16% 47%)" />
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-6 pb-3 bg-background border-b border-border">
        <Text className="text-xl font-bold text-foreground">生产工单</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          查看工单、执行领料与报工
        </Text>
      </View>
      <View className="px-4 py-3 bg-primary/10 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <User size={18} color="hsl(221 83% 53%)" />
          <Text className="text-sm text-foreground ml-2 flex-1" numberOfLines={1}>
            {employee
              ? `当前身份：${employee.name}（${employee.code}）`
              : "未识别身份，请先扫描工牌码"}
          </Text>
        </View>
        {employee ? (
          <Button
            size="sm"
            variant="ghost"
            onPress={async () => {
              await setCurrentEmployee(null);
              setEmployee(null);
            }}
          >
            切换
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onPress={() => router.push("/(app)/scan-report")}
          >
            <ScanLine size={16} color="hsl(221 83% 53%)" />
            <Text className="ml-1 text-sm">扫码识别</Text>
          </Button>
        )}
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerClassName="p-4 pb-24"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Factory size={48} color="hsl(215 16% 47%)" />
            <Text className="text-muted-foreground mt-4">暂无工单</Text>
          </View>
        }
      />
    </View>
  );
}

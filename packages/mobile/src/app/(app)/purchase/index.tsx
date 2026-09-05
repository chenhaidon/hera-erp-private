import { router, useFocusEffect } from "expo-router";
import { ChevronRight, Truck } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Card } from "@/components/ui/Card";
import type { PurchaseOrder } from "@/types";

const statusMap: Record<string, { label: string; color: string }> = {
  pending_confirm: { label: "待确认", color: "bg-slate-500" },
  confirmed: { label: "已确认", color: "bg-blue-500" },
  pending_arrival: { label: "待到货", color: "bg-amber-500" },
  arrived: { label: "已到货", color: "bg-purple-500" },
  inbound: { label: "已入库", color: "bg-emerald-500" },
};

export default function PurchaseScreen() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("purchase_orders")
      .select("id, order_no, supplier_name, material_name, quantity, amount, order_date, arrival_date, status")
      .order("order_date", { ascending: false })
      .limit(50);
    setOrders((data as PurchaseOrder[]) ?? []);
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

  const renderItem = ({ item }: { item: PurchaseOrder }) => {
    const status = statusMap[item.status] ?? { label: item.status, color: "bg-slate-500" };
    return (
      <Pressable
        className="mb-3 active:opacity-90"
        onPress={() => router.push(`/(app)/purchase/${item.id}`)}
      >
        <Card>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm text-muted-foreground">{item.order_no}</Text>
            <View className={`${status.color} rounded-full px-2.5 py-1`}>
              <Text className="text-xs text-white">{status.label}</Text>
            </View>
          </View>
          <Text className="text-base font-semibold text-foreground mb-1">
            {item.material_name}
          </Text>
          <Text className="text-sm text-muted-foreground mb-2">
            供应商：{item.supplier_name}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-foreground">数量：{item.quantity}</Text>
            <ChevronRight size={18} color="hsl(215 16% 47%)" />
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-6 pb-3 bg-background border-b border-border">
        <Text className="text-xl font-bold text-foreground">采购订单</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          查看采购订单与到货质检
        </Text>
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
            <Truck size={48} color="hsl(215 16% 47%)" />
            <Text className="text-muted-foreground mt-4">暂无采购订单</Text>
          </View>
        }
      />
    </View>
  );
}

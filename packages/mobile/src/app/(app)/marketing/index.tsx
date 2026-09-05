import { router, useFocusEffect } from "expo-router";
import { ChevronRight, ShoppingCart } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Card } from "@/components/ui/Card";
import type { SalesOrder } from "@/types";

const statusMap: Record<string, { label: string; color: string }> = {
  pending_confirm: { label: "待确认", color: "bg-slate-500" },
  confirmed: { label: "已确认", color: "bg-blue-500" },
  in_production: { label: "生产中", color: "bg-amber-500" },
  pending_shipment: { label: "待发货", color: "bg-purple-500" },
  shipped: { label: "已发货", color: "bg-emerald-500" },
  completed: { label: "已完成", color: "bg-green-600" },
  cancelled: { label: "已取消", color: "bg-slate-400" },
};

export default function MarketingScreen() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("sales_orders")
      .select("id, order_no, customer_name, product_code, product_name, quantity, amount, order_date, delivery_date, status")
      .order("order_date", { ascending: false })
      .limit(50);
    setOrders((data as SalesOrder[]) ?? []);
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

  const renderItem = ({ item }: { item: SalesOrder }) => {
    const status = statusMap[item.status] ?? { label: item.status, color: "bg-slate-500" };
    return (
      <Pressable
        className="mb-3 active:opacity-90"
        onPress={() => router.push(`/(app)/marketing/${item.id}`)}
      >
        <Card>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm text-muted-foreground">{item.order_no}</Text>
            <View className={`${status.color} rounded-full px-2.5 py-1`}>
              <Text className="text-xs text-white">{status.label}</Text>
            </View>
          </View>
          <Text className="text-base font-semibold text-foreground mb-1">
            {item.product_name} ({item.product_code})
          </Text>
          <Text className="text-sm text-muted-foreground mb-2">
            客户：{item.customer_name}
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
        <Text className="text-xl font-bold text-foreground">销售订单</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          查看订单与执行发货
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
            <ShoppingCart size={48} color="hsl(215 16% 47%)" />
            <Text className="text-muted-foreground mt-4">暂无销售订单</Text>
          </View>
        }
      />
    </View>
  );
}

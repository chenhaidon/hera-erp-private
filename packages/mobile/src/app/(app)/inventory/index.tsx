import { router, useFocusEffect } from "expo-router";
import { ChevronRight, PackageCheck } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Card } from "@/components/ui/Card";

interface InboundOrder {
  id: string;
  inbound_no: string;
  order_no: string;
  product_code: string;
  product_name: string;
  quantity: number;
  status: "pending" | "inbound";
}

export default function InventoryScreen() {
  const [orders, setOrders] = useState<InboundOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("finished_goods_inbound")
      .select("id, inbound_no, order_no, product_code, product_name, quantity, status")
      .order("created_at", { ascending: false })
      .limit(50);
    setOrders((data as InboundOrder[]) ?? []);
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

  const renderItem = ({ item }: { item: InboundOrder }) => (
    <Pressable
      className="mb-3 active:opacity-90"
      onPress={() => router.push(`/(app)/inventory/${item.id}`)}
    >
      <Card>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm text-muted-foreground">{item.inbound_no}</Text>
          <View
            className={`rounded-full px-2.5 py-1 ${
              item.status === "pending" ? "bg-amber-500" : "bg-emerald-500"
            }`}
          >
            <Text className="text-xs text-white">
              {item.status === "pending" ? "待入库" : "已入库"}
            </Text>
          </View>
        </View>
        <Text className="text-base font-semibold text-foreground mb-1">
          {item.product_name} ({item.product_code})
        </Text>
        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-sm text-muted-foreground">
            数量：{item.quantity}
          </Text>
          <ChevronRight size={18} color="hsl(215 16% 47%)" />
        </View>
      </Card>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-6 pb-3 bg-background border-b border-border">
        <Text className="text-xl font-bold text-foreground">成品入库</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          确认入库与库位分配
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
            <PackageCheck size={48} color="hsl(215 16% 47%)" />
            <Text className="text-muted-foreground mt-4">暂无入库单</Text>
          </View>
        }
      />
    </View>
  );
}

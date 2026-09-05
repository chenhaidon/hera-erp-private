import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Truck } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDate, formatMoney } from "@/lib/utils";
import type { PurchaseOrder } from "@/types";

export default function PurchaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setOrder((data as PurchaseOrder) ?? null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleInspect = () => {
    Alert.alert("发起质检", "确认发起来料质检？", [
      { text: "取消", style: "cancel" },
      {
        text: "确认",
        onPress: async () => {
          await supabase.from("incoming_inspections").insert({
            purchase_order_id: id,
            material_name: order?.material_name,
            supplier_name: order?.supplier_name,
            status: "pending",
            created_at: new Date().toISOString(),
          });
          await supabase.from("purchase_orders").update({ status: "arrived" }).eq("id", id);
          Alert.alert("已发起", "质检单已生成", [
            { text: "确定", onPress: () => router.back() },
          ]);
        },
      },
    ]);
  };

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Truck size={48} color="hsl(215 16% 47%)" />
        <Text className="text-muted-foreground mt-4">加载中...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 pt-6 pb-3 bg-background border-b border-border">
        <Pressable
          className="p-2 -ml-2 active:opacity-70"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="hsl(222 47% 11%)" />
        </Pressable>
        <Text className="text-lg font-bold text-foreground ml-2">采购详情</Text>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-24">
        <Card className="mb-4">
          <InfoRow label="采购单号" value={order.order_no} />
          <InfoRow label="供应商" value={order.supplier_name} />
          <InfoRow label="物料名称" value={order.material_name} />
          <InfoRow label="采购数量" value={String(order.quantity)} />
          <InfoRow label="采购金额" value={formatMoney(order.amount)} />
          <InfoRow label="订单日期" value={formatDate(order.order_date)} />
          <InfoRow label="到货日期" value={formatDate(order.arrival_date)} />
        </Card>

        {(order.status === "confirmed" || order.status === "pending_arrival") && (
          <Button onPress={handleInspect}>发起质检</Button>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row py-2 border-b border-border last:border-b-0">
      <Text className="text-sm text-muted-foreground w-24">{label}</Text>
      <Text className="flex-1 text-sm text-foreground">{value}</Text>
    </View>
  );
}

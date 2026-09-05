import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, PackageCheck } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface InboundOrder {
  id: string;
  inbound_no: string;
  order_no: string;
  product_code: string;
  product_name: string;
  quantity: number;
  warehouse?: string;
  location?: string;
  status: "pending" | "inbound";
}

export default function InboundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<InboundOrder | null>(null);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("finished_goods_inbound")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setOrder((data as InboundOrder) ?? null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleConfirm = () => {
    Alert.alert("确认入库", "确认该成品已入库？", [
      { text: "取消", style: "cancel" },
      {
        text: "确认",
        onPress: async () => {
          await supabase
            .from("finished_goods_inbound")
            .update({
              status: "inbound",
              warehouse: "A1成品仓",
              location: "A-01-02",
              inbound_at: new Date().toISOString(),
            })
            .eq("id", id);
          loadData();
        },
      },
    ]);
  };

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <PackageCheck size={48} color="hsl(215 16% 47%)" />
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
        <Text className="text-lg font-bold text-foreground ml-2">入库详情</Text>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-24">
        <Card className="mb-4">
          <InfoRow label="入库单号" value={order.inbound_no} />
          <InfoRow label="工单编号" value={order.order_no} />
          <InfoRow label="产品款号" value={order.product_code} />
          <InfoRow label="产品名称" value={order.product_name} />
          <InfoRow label="入库数量" value={String(order.quantity)} />
          <InfoRow label="入库仓库" value={order.warehouse ?? "待选择"} />
          <InfoRow label="入库库位" value={order.location ?? "待选择"} />
          <InfoRow
            label="入库状态"
            value={order.status === "pending" ? "待入库" : "已入库"}
          />
        </Card>

        {order.status === "pending" && (
          <Button onPress={handleConfirm}>确认入库</Button>
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

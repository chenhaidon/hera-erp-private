import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ShoppingCart } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDate, formatMoney } from "@/lib/utils";
import type { SalesOrder } from "@/types";

export default function SalesOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [logistics, setLogistics] = useState("");
  const [trackingNo, setTrackingNo] = useState("");

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("sales_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setOrder((data as SalesOrder) ?? null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleShip = () => {
    if (!logistics.trim() || !trackingNo.trim()) {
      Alert.alert("提示", "请填写物流公司和物流单号");
      return;
    }
    Alert.alert("确认发货", "确认提交发货信息？", [
      { text: "取消", style: "cancel" },
      {
        text: "确认",
        onPress: async () => {
          await supabase
            .from("sales_orders")
            .update({ status: "shipped" })
            .eq("id", id);
          await supabase.from("shipments").insert({
            order_id: id,
            logistics_company: logistics,
            tracking_no: trackingNo,
            shipped_at: new Date().toISOString(),
          });
          Alert.alert("发货成功", "发货信息已记录", [
            { text: "确定", onPress: () => router.back() },
          ]);
        },
      },
    ]);
  };

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ShoppingCart size={48} color="hsl(215 16% 47%)" />
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
        <Text className="text-lg font-bold text-foreground ml-2">订单详情</Text>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-24">
        <Card className="mb-4">
          <InfoRow label="订单编号" value={order.order_no} />
          <InfoRow label="客户名称" value={order.customer_name} />
          <InfoRow label="产品款号" value={order.product_code} />
          <InfoRow label="产品名称" value={order.product_name} />
          <InfoRow label="订单数量" value={String(order.quantity)} />
          <InfoRow label="订单金额" value={formatMoney(order.amount)} />
          <InfoRow label="订单日期" value={formatDate(order.order_date)} />
          <InfoRow label="交货日期" value={formatDate(order.delivery_date)} />
        </Card>

        {order.status === "pending_shipment" && (
          <Card>
            <Text className="text-base font-semibold text-foreground mb-3">
              发货信息
            </Text>
            <Text className="text-sm text-muted-foreground mb-1">物流公司</Text>
            <TextInput
              className="border border-border bg-background rounded-xl px-4 py-3.5 text-base text-foreground mb-4"
              placeholder="请输入物流公司"
              placeholderTextColor="#94a3b8"
              value={logistics}
              onChangeText={setLogistics}
            />
            <Text className="text-sm text-muted-foreground mb-1">物流单号</Text>
            <TextInput
              className="border border-border bg-background rounded-xl px-4 py-3.5 text-base text-foreground mb-4"
              placeholder="请输入物流单号"
              placeholderTextColor="#94a3b8"
              value={trackingNo}
              onChangeText={setTrackingNo}
            />
            <Button onPress={handleShip}>确认发货</Button>
          </Card>
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

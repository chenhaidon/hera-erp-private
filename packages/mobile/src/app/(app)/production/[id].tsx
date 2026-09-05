import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Factory, ScanLine, User } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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

export default function WorkOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [employee, setEmployee] = useState<CurrentEmployee | null>(null);

  const loadOrder = useCallback(async () => {
    const { data } = await supabase
      .from("work_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setOrder((data as WorkOrder) ?? null);
  }, [id]);

  const loadEmployee = useCallback(async () => {
    const current = await getCurrentEmployee();
    setEmployee(current);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
      loadEmployee();
    }, [loadOrder, loadEmployee]),
  );

  const handleReport = () => {
    if (!employee) {
      Alert.alert("未识别身份", "请先扫描工牌码识别员工身份", [
        { text: "取消", style: "cancel" },
        {
          text: "扫码识别",
          onPress: () => router.push(`/(app)/scan-report?orderId=${id}`),
        },
      ]);
      return;
    }
    router.push(`/(app)/scan-report?orderId=${id}`);
  };

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Factory size={48} color="hsl(215 16% 47%)" />
        <Text className="text-muted-foreground mt-4">加载中...</Text>
      </View>
    );
  }

  const progress = order.plan_quantity
    ? Math.round((order.completed_quantity / order.plan_quantity) * 100)
    : 0;
  const status = statusMap[order.status] ?? { label: order.status, color: "bg-slate-500" };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 pt-6 pb-3 bg-background border-b border-border">
        <Pressable
          className="p-2 -ml-2 active:opacity-70"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="hsl(222 47% 11%)" />
        </Pressable>
        <Text className="text-lg font-bold text-foreground ml-2">工单详情</Text>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-24">
        <Card className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-foreground">
              {order.work_no}
            </Text>
            <View className={`${status.color} rounded-full px-2.5 py-1`}>
              <Text className="text-xs text-white">{status.label}</Text>
            </View>
          </View>
          <InfoRow label="产品款号" value={order.product_code} />
          <InfoRow label="产品名称" value={order.product_name} />
          <InfoRow label="计划产量" value={String(order.plan_quantity)} />
          <InfoRow label="已完成" value={String(order.completed_quantity)} />
          <InfoRow label="完成进度" value={`${progress}%`} />
          <InfoRow label="工单来源" value={order.source ?? "-"} />
        </Card>

        <View className="flex-row items-center gap-2 mb-3">
          <User size={18} color="hsl(221 83% 53%)" />
          <Text className="text-sm text-foreground flex-1">
            {employee
              ? `当前身份：${employee.name}（${employee.code}）`
              : "未识别身份，报工前请先扫码识别"}
          </Text>
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
              onPress={() => router.push(`/(app)/scan-report?orderId=${id}`)}
            >
              <ScanLine size={16} color="hsl(221 83% 53%)" />
              <Text className="ml-1 text-sm">扫码识别</Text>
            </Button>
          )}
        </View>
        {(order.status === "issued" || order.status === "producing" || order.status === "in_production") && (
          <Button variant="outline" onPress={handleReport}>
            扫码报工
          </Button>
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

import { router, useFocusEffect } from "expo-router";
import { ChevronRight, ClipboardList } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Card } from "@/components/ui/Card";
import type { ApprovalStatus, ApprovalTask, ApprovalType } from "@/types";

const typeMap: Record<ApprovalType, string> = {
  plan: "生产计划",
  quotation: "报价审批",
  contract: "合同审批",
};

const statusMap: Record<ApprovalStatus, { label: string; color: string }> = {
  pending: { label: "待审批", color: "bg-amber-500" },
  approved: { label: "已通过", color: "bg-emerald-500" },
  rejected: { label: "已驳回", color: "bg-destructive" },
};

export default function ApprovalsScreen() {
  const [activeTab, setActiveTab] = useState<"pending" | "processed">("pending");
  const [tasks, setTasks] = useState<ApprovalTask[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const query = supabase
      .from("approval_tasks")
      .select("id, type, doc_no, submitter, submitted_at, status, result_at")
      .order("submitted_at", { ascending: false })
      .limit(50);
    if (activeTab === "pending") {
      query.eq("status", "pending");
    } else {
      query.in("status", ["approved", "rejected"]);
    }
    const { data } = await query;
    setTasks((data as ApprovalTask[]) ?? []);
  }, [activeTab]);

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

  const renderItem = ({ item }: { item: ApprovalTask }) => {
    const status = statusMap[item.status];
    return (
      <Pressable
        className="mb-3 active:opacity-90"
        onPress={() => router.push(`/(app)/approvals/${item.id}`)}
      >
        <Card>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm text-muted-foreground">{item.doc_no}</Text>
            <View className={`${status.color} rounded-full px-2.5 py-1`}>
              <Text className="text-xs text-white">{status.label}</Text>
            </View>
          </View>
          <Text className="text-base font-semibold text-foreground mb-1">
            {typeMap[item.type]}
          </Text>
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-sm text-muted-foreground">
              提交人：{item.submitter}
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
        <Text className="text-xl font-bold text-foreground">审批中心</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          处理待审批与已审批事项
        </Text>
      </View>

      <View className="flex-row mx-4 mt-4 mb-2 bg-muted rounded-xl p-1">
        <Pressable
          className={`flex-1 py-2 rounded-lg items-center ${
            activeTab === "pending" ? "bg-background shadow-sm" : ""
          }`}
          onPress={() => setActiveTab("pending")}
        >
          <Text
            className={`text-sm font-medium ${
              activeTab === "pending" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            待审批
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 py-2 rounded-lg items-center ${
            activeTab === "processed" ? "bg-background shadow-sm" : ""
          }`}
          onPress={() => setActiveTab("processed")}
        >
          <Text
            className={`text-sm font-medium ${
              activeTab === "processed" ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            已审批
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerClassName="p-4 pb-24"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <ClipboardList size={48} color="hsl(215 16% 47%)" />
            <Text className="text-muted-foreground mt-4">
              暂无{activeTab === "pending" ? "待审批" : "已审批"}事项
            </Text>
          </View>
        }
      />
    </View>
  );
}

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ClipboardList } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/utils";
import type { ApprovalTask } from "@/types";

const typeMap: Record<string, string> = {
  plan: "生产计划",
  quotation: "报价审批",
  contract: "合同审批",
};

export default function ApprovalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<ApprovalTask | null>(null);
  const [comment, setComment] = useState("");

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("approval_tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setTask((data as ApprovalTask) ?? null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleApprove = async (approved: boolean) => {
    await supabase
      .from("approval_tasks")
      .update({
        status: approved ? "approved" : "rejected",
        comment,
        result_at: new Date().toISOString(),
      })
      .eq("id", id);
    Alert.alert("提交成功", approved ? "已通过" : "已驳回", [
      { text: "确定", onPress: () => router.back() },
    ]);
  };

  if (!task) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ClipboardList size={48} color="hsl(215 16% 47%)" />
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
        <Text className="text-lg font-bold text-foreground ml-2">审批详情</Text>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-24">
        <Card className="mb-4">
          <InfoRow label="单据编号" value={task.doc_no} />
          <InfoRow label="审批类型" value={typeMap[task.type] ?? task.type} />
          <InfoRow label="提交人" value={task.submitter} />
          <InfoRow label="提交时间" value={formatDateTime(task.submitted_at)} />
          <InfoRow
            label="审批状态"
            value={
              task.status === "pending"
                ? "待审批"
                : task.status === "approved"
                  ? "已通过"
                  : "已驳回"
            }
          />
          {task.result_at && (
            <InfoRow label="审批时间" value={formatDateTime(task.result_at)} />
          )}
        </Card>

        {task.status === "pending" && (
          <Card>
            <Text className="text-base font-semibold text-foreground mb-3">
              审批意见
            </Text>
            <TextInput
              className="border border-border bg-background rounded-xl px-4 py-3.5 text-base text-foreground mb-4"
              placeholder="请输入审批意见（可选）"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              value={comment}
              onChangeText={setComment}
            />
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => handleApprove(false)}
              >
                驳回
              </Button>
              <Button className="flex-1" onPress={() => handleApprove(true)}>
                通过
              </Button>
            </View>
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

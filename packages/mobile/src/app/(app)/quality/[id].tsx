import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ClipboardCheck } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { QualityInspection } from "@/types";

const typeMap: Record<string, string> = {
  incoming: "来料检验",
  process: "过程巡检",
  finished: "成品检验",
};

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inspection, setInspection] = useState<QualityInspection | null>(null);
  const [actualValue, setActualValue] = useState("");
  const [result, setResult] = useState<"passed" | "failed" | null>(null);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("quality_inspections")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setInspection((data as QualityInspection) ?? null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleSubmit = async () => {
    if (!result) {
      Alert.alert("提示", "请选择判定结果");
      return;
    }
    await supabase
      .from("quality_inspections")
      .update({ status: result, actual_value: actualValue, inspected_at: new Date().toISOString() })
      .eq("id", id);
    Alert.alert("提交成功", "检验结果已记录", [
      { text: "确定", onPress: () => router.back() },
    ]);
  };

  if (!inspection) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ClipboardCheck size={48} color="hsl(215 16% 47%)" />
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
        <Text className="text-lg font-bold text-foreground ml-2">检验详情</Text>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-24">
        <Card className="mb-4">
          <InfoRow label="检验单号" value={inspection.inspection_no} />
          <InfoRow label="检验类型" value={typeMap[inspection.type] ?? inspection.type} />
          <InfoRow label="检验对象" value={inspection.target_name} />
          <InfoRow label="当前状态" value={inspection.status === "pending" ? "待检验" : inspection.status === "passed" ? "合格" : "不合格"} />
        </Card>

        {inspection.status === "pending" && (
          <Card>
            <Text className="text-base font-semibold text-foreground mb-3">
              填写检验结果
            </Text>
            <Text className="text-sm text-muted-foreground mb-1">实测值</Text>
            <TextInput
              className="border border-border bg-background rounded-xl px-4 py-3.5 text-base text-foreground mb-4"
              placeholder="请输入实测值"
              placeholderTextColor="#94a3b8"
              value={actualValue}
              onChangeText={setActualValue}
            />
            <Text className="text-sm text-muted-foreground mb-2">判定结果</Text>
            <View className="flex-row gap-3 mb-4">
              <Pressable
                className={`flex-1 py-3 rounded-xl items-center border ${
                  result === "passed"
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-border bg-background"
                }`}
                onPress={() => setResult("passed")}
              >
                <Text
                  className={
                    result === "passed" ? "text-white font-semibold" : "text-foreground"
                  }
                >
                  合格
                </Text>
              </Pressable>
              <Pressable
                className={`flex-1 py-3 rounded-xl items-center border ${
                  result === "failed"
                    ? "bg-destructive border-destructive"
                    : "border-border bg-background"
                }`}
                onPress={() => setResult("failed")}
              >
                <Text
                  className={
                    result === "failed" ? "text-white font-semibold" : "text-foreground"
                  }
                >
                  不合格
                </Text>
              </Pressable>
            </View>
            <Button onPress={handleSubmit}>提交结果</Button>
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

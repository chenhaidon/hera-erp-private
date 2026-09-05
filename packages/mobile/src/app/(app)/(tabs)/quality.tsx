import { router, useFocusEffect } from "expo-router";
import { ChevronRight, ClipboardCheck } from "lucide-react-native";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { supabase } from "@/client/supabase";
import { Card } from "@/components/ui/Card";
import type { QualityInspection } from "@/types";

const typeMap: Record<string, string> = {
  incoming: "来料检验",
  process: "过程巡检",
  finished: "成品检验",
};

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "待检验", color: "bg-amber-500" },
  passed: { label: "合格", color: "bg-emerald-500" },
  failed: { label: "不合格", color: "bg-destructive" },
};

export default function QualityScreen() {
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("quality_inspections")
      .select("id, inspection_no, type, target_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setInspections((data as QualityInspection[]) ?? []);
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

  const renderItem = ({ item }: { item: QualityInspection }) => {
    const status = statusMap[item.status] ?? { label: item.status, color: "bg-slate-500" };
    return (
      <Pressable
        className="mb-3 active:opacity-90"
        onPress={() => router.push(`/(app)/quality/${item.id}`)}
      >
        <Card>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm text-muted-foreground">
              {item.inspection_no}
            </Text>
            <View className={`${status.color} rounded-full px-2.5 py-1`}>
              <Text className="text-xs text-white">{status.label}</Text>
            </View>
          </View>
          <Text className="text-base font-semibold text-foreground mb-1">
            {item.target_name}
          </Text>
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-xs text-muted-foreground">
              {typeMap[item.type] ?? item.type}
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
        <Text className="text-xl font-bold text-foreground">质量检验</Text>
        <Text className="text-sm text-muted-foreground mt-1">
          来料 / 过程 / 成品检验
        </Text>
      </View>
      <FlatList
        data={inspections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerClassName="p-4 pb-24"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <ClipboardCheck size={48} color="hsl(215 16% 47%)" />
            <Text className="text-muted-foreground mt-4">暂无检验单</Text>
          </View>
        }
      />
    </View>
  );
}

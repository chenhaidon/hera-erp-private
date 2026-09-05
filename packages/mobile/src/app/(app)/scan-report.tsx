import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ScanLine, User } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "@/client/supabase";
import { Button } from "@/components/ui/Button";
import {
  getCurrentEmployee,
  setCurrentEmployee,
  parseEmployeeCode,
} from "@/lib/utils";
import type { CurrentEmployee } from "@/lib/utils";

export default function ScanReportScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<CurrentEmployee | null>(null);
  const [identified, setIdentified] = useState(false);

  const loadEmployee = useCallback(async () => {
    const current = await getCurrentEmployee();
    setEmployee(current);
    setIdentified(!!current);
  }, []);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" className="text-primary" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <ScanLine size={64} color="hsl(221 83% 53%)" />
        <Text className="text-lg font-bold text-foreground mt-4 mb-2">
          需要相机权限
        </Text>
        <Text className="text-sm text-muted-foreground text-center mb-6">
          扫码报工需要访问相机以识别二维码
        </Text>
        <Button onPress={requestPermission}>授予权限</Button>
      </View>
    );
  }

  const identifyEmployee = async (data: string) => {
    const employeeId = parseEmployeeCode(data);
    if (!employeeId) {
      Alert.alert("识别失败", "请扫描正确的员工工牌码");
      return;
    }
    const { data: emp } = await supabase
      .from("employees")
      .select("id, code, name, department, position")
      .eq("id", employeeId)
      .maybeSingle();
    if (!emp) {
      Alert.alert("识别失败", "未找到该员工档案");
      return;
    }
    const current: CurrentEmployee = {
      id: emp.id,
      code: emp.code,
      name: emp.name,
      department: emp.department || undefined,
      position: emp.position || undefined,
    };
    await setCurrentEmployee(current);
    setEmployee(current);
    setIdentified(true);
    Alert.alert("身份识别成功", `当前操作人：${emp.name}（${emp.code}）`, [
      { text: "继续扫描工单" },
    ]);
  };

  const handleBarcodeScanned = (result: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    if (!identified) {
      identifyEmployee(result.data).finally(() => setScanned(false));
      return;
    }
    Alert.alert("识别成功", `二维码内容：${result.data}`, [
      { text: "继续扫描", onPress: () => setScanned(false) },
      { text: "确认报工", onPress: () => submitReport(result.data) },
    ]);
  };

  const submitReport = async (code?: string) => {
    const qty = Number.parseInt(quantity || "1", 10);
    if (Number.isNaN(qty) || qty <= 0) {
      Alert.alert("提示", "请输入有效数量");
      return;
    }
    if (!employee) {
      Alert.alert("提示", "请先扫描工牌码识别身份");
      return;
    }
    if (!orderId) {
      Alert.alert("提示", "未指定报工工单");
      return;
    }
    setLoading(true);
    await supabase.rpc("report_work_order", {
      p_order_id: orderId,
      p_quantity: qty,
      p_operator_id: employee.id,
      p_operator_name: employee.name,
    });
    setLoading(false);
    Alert.alert("报工成功", `数量：${qty}${code ? "\n二维码：" + code : ""}`, [
      { text: "确定", onPress: () => router.back() },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 pt-6 pb-3 bg-background border-b border-border">
        <Pressable
          className="p-2 -ml-2 active:opacity-70"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="hsl(222 47% 11%)" />
        </Pressable>
        <Text className="text-lg font-bold text-foreground ml-2">扫码报工</Text>
      </View>

      <View className="bg-primary/10 px-4 py-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <User size={18} color="hsl(221 83% 53%)" />
          <Text className="text-sm text-foreground ml-2">
            {employee
              ? `当前身份：${employee.name}（${employee.code}）`
              : "未识别身份，请先扫描工牌码"}
          </Text>
        </View>
        {employee && (
          <Button
            size="sm"
            variant="ghost"
            onPress={async () => {
              await setCurrentEmployee(null);
              setEmployee(null);
              setIdentified(false);
            }}
          >
            切换身份
          </Button>
        )}
      </View>

      <View className="flex-1">
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />
        <View className="absolute inset-0 items-center justify-center pointer-events-none">
          <View className="w-48 h-48 border-2 border-white/70 rounded-2xl" />
        </View>
        {!identified && (
          <View className="absolute bottom-8 left-0 right-0 items-center pointer-events-none">
            <Text className="text-white text-base font-medium bg-black/50 px-4 py-2 rounded-full">
              请将员工工牌码对准框内
            </Text>
          </View>
        )}
      </View>

      <View className="bg-background p-4 pb-8">
        <Text className="text-sm text-muted-foreground mb-2">本次报工数量</Text>
        <TextInput
          className="border border-border bg-background rounded-xl px-4 py-3.5 text-base text-foreground mb-4"
          placeholder="请输入数量"
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          value={quantity}
          onChangeText={setQuantity}
        />
        <Button loading={loading} onPress={() => submitReport()}>
          手动报工
        </Button>
      </View>
    </View>
  );
}

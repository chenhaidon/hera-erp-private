import { Checkbox } from "expo-checkbox";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  PrivacyConsentModal,
  RetainModal,
  usePrivacyConsent,
} from "@/components/compliance/PrivacyConsentModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSession } from "@/ctx";

export default function SignInScreen() {
  const { signInWithOtp, signInWithPhone } = useSession();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const otpRef = useRef<TextInput>(null);

  const { consented, showRetain, agree, disagree, retainDisagree } =
    usePrivacyConsent();

  const startCountdown = useCallback(() => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendOtp = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    if (!agreed) {
      setError("请先勾选用户协议与隐私政策");
      return;
    }
    setError("");
    setLoading(true);
    const { error } = await signInWithOtp(phone);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    startCountdown();
    otpRef.current?.focus();
  };

  const handleLogin = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError("请输入6位验证码");
      return;
    }
    if (!agreed) {
      setError("请先勾选用户协议与隐私政策");
      return;
    }
    setError("");
    setLoading(true);
    const { error } = await signInWithPhone(phone, otp);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/(app)");
  };

  const showPrivacyModal = consented === false && !showRetain;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8">
          <Text className="text-2xl font-bold text-foreground mb-2">
            欢迎登录
          </Text>
          <Text className="text-base text-muted-foreground">
            手机号验证码登录，与 Web 端共享账号
          </Text>
        </View>

        <Input
          label="手机号"
          placeholder="请输入手机号"
          keyboardType="phone-pad"
          maxLength={11}
          value={phone}
          onChangeText={setPhone}
        />

        <View className="flex-row gap-3 items-start">
          <Input
            ref={otpRef}
            label="验证码"
            placeholder="请输入验证码"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
            containerClassName="flex-1 mb-0"
          />
          <Button
            variant="outline"
            size="default"
            className="mt-6"
            disabled={countdown > 0 || loading}
            onPress={handleSendOtp}
          >
            {countdown > 0 ? `${countdown}s` : "获取验证码"}
          </Button>
        </View>

        <View className="flex-row items-center mt-4 mb-2">
          <Checkbox
            value={agreed}
            onValueChange={setAgreed}
            color={agreed ? "hsl(221 83% 53%)" : undefined}
          />
          <Text className="text-sm text-muted-foreground ml-2 flex-1">
            我已阅读并同意
            <Text className="text-primary">《用户协议》</Text>
            与
            <Text className="text-primary">《隐私政策》</Text>
          </Text>
        </View>

        {error ? (
          <Text className="text-sm text-destructive mb-4">{error}</Text>
        ) : null}

        <Button
          className="mt-6"
          loading={loading}
          disabled={!agreed || phone.length < 11 || otp.length < 6}
          onPress={handleLogin}
        >
          登录
        </Button>

        <Text className="text-xs text-muted-foreground text-center mt-6">
          未注册手机号验证通过后将自动创建账号
        </Text>
      </ScrollView>

      <PrivacyConsentModal
        visible={showPrivacyModal}
        onAgree={agree}
        onDisagree={disagree}
      />
      <RetainModal visible={showRetain} onKnow={retainDisagree} />
    </KeyboardAvoidingView>
  );
}

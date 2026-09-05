import { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Button } from "@/components/ui/Button";
import { secureStorage } from "@/lib/storage";

const PRIVACY_CONSENT_KEY = "privacy_consented_v1";

export function usePrivacyConsent() {
  const [consented, setConsented] = useState<boolean | null>(null);
  const [showRetain, setShowRetain] = useState(false);

  useEffect(() => {
    secureStorage.getItem(PRIVACY_CONSENT_KEY).then((value) => {
      setConsented(value === "true");
    });
  }, []);

  const agree = async () => {
    await secureStorage.setItem(PRIVACY_CONSENT_KEY, "true");
    setConsented(true);
    setShowRetain(false);
  };

  const disagree = () => {
    setShowRetain(true);
  };

  const retainDisagree = () => {
    setShowRetain(false);
    setConsented(false);
  };

  return { consented, showRetain, agree, disagree, retainDisagree };
}

interface PrivacyConsentModalProps {
  visible: boolean;
  onAgree: () => void;
  onDisagree: () => void;
}

export function PrivacyConsentModal({
  visible,
  onAgree,
  onDisagree,
}: PrivacyConsentModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-background w-full max-w-sm rounded-2xl p-5">
          <Text className="text-lg font-bold text-foreground text-center mb-3">
            服务协议与隐私政策
          </Text>
          <ScrollView className="max-h-64 mb-5">
            <Text className="text-sm text-muted-foreground leading-5">
              在使用金龙工艺移动端基本功能或服务前，请您仔细阅读《用户协议》及《隐私政策》。本产品会收集您的手机号等必要个人信息，用于身份认证与服务提供。您可以点击阅读上述协议进一步了解全部内容。
            </Text>
            <Text className="text-sm text-muted-foreground leading-5 mt-3">
              您同意本产品的基本功能隐私政策，仅代表您已了解本产品提供的基本业务功能及其运行所需的必要个人信息。对于附加业务功能的个人信息处理，会在您使用过程中单独征求您的同意。
            </Text>
          </ScrollView>
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onPress={onDisagree}
            >
              不同意
            </Button>
            <Button className="flex-1" onPress={onAgree}>
              同意
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface RetainModalProps {
  visible: boolean;
  onKnow: () => void;
}

export function RetainModal({ visible, onKnow }: RetainModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-background w-full max-w-sm rounded-2xl p-5">
          <Text className="text-lg font-bold text-foreground text-center mb-3">
            温馨提示
          </Text>
          <Text className="text-sm text-muted-foreground leading-5 mb-5 text-center">
            金龙工艺移动端仅会将信息用于提供服务和改善体验，我们将全力保障您的信息安全，请同意协议后使用。
          </Text>
          <Button onPress={onKnow}>知道了</Button>
        </View>
      </View>
    </Modal>
  );
}

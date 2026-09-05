import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="production/[id]"
        options={{ presentation: "card", headerShown: false }}
      />
      <Stack.Screen
        name="quality/[id]"
        options={{ presentation: "card", headerShown: false }}
      />
      <Stack.Screen
        name="inventory/[id]"
        options={{ presentation: "card", headerShown: false }}
      />
      <Stack.Screen
        name="marketing/[id]"
        options={{ presentation: "card", headerShown: false }}
      />
      <Stack.Screen
        name="purchase/[id]"
        options={{ presentation: "card", headerShown: false }}
      />
      <Stack.Screen
        name="approvals/[id]"
        options={{ presentation: "card", headerShown: false }}
      />
      <Stack.Screen
        name="settings/index"
        options={{ presentation: "card", headerShown: false }}
      />
      <Stack.Screen
        name="settings/privacy"
        options={{ presentation: "card", headerShown: false }}
      />
      <Stack.Screen
        name="settings/data-list"
        options={{ presentation: "card", headerShown: false }}
      />
      <Stack.Screen
        name="settings/account-cancel"
        options={{ presentation: "card", headerShown: false }}
      />
    </Stack>
  );
}

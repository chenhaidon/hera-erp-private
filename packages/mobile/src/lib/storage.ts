import * as SecureStore from "expo-secure-store";

declare const process: { env: Record<string, string | undefined> };

const setItem = async (key: string, value: string) => {
  if (process.env.EXPO_OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

const getItem = async (key: string) => {
  if (process.env.EXPO_OS === "web") {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
};

export const secureStorage = { setItem, getItem };

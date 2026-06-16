import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { theme } from "../theme";
import { wakeServer } from "../services/api";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    wakeServer();
    AsyncStorage.getItem("cropguard_token").then((token) => {
      if (!token) {
        router.replace("/auth");
      }
    });
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

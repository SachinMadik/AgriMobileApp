import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { theme } from "../theme";
import { wakeServer } from "../services/api";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    wakeServer();
    AsyncStorage.getItem("cropguard_token").then((token) => {
      const inTabs = segments[0] === "(tabs)";
      if (!token && inTabs) router.replace("/auth");
      else if (token && !inTabs && segments[0] !== undefined) router.replace("/(tabs)");
      setChecked(true);
    });
  }, []);

  if (!checked) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

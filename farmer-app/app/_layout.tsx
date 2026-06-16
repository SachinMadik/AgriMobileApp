import { Stack } from "expo-router";
import { useEffect } from "react";
import { theme } from "../theme";
import { wakeServer } from "../services/api";

export default function RootLayout() {
  useEffect(() => {
    wakeServer(); // ping /health immediately on launch to wake Render cold start
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

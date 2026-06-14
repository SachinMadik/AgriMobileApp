import Constants from "expo-constants";

const isExpoGo = Constants.appOwnership === "expo";

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function sendLocalNotification(_title: string, _body: string, _data?: object) {
  if (isExpoGo) return;
  const N = await import("expo-notifications");
  const { status } = await N.requestPermissionsAsync();
  if (status !== "granted") return;
  await N.scheduleNotificationAsync({
    content: { title: _title, body: _body, data: _data ?? {}, sound: true },
    trigger: null,
  });
}

export async function sendAlertNotification(alert: { severity: string; title: string; description: string }) {
  const emoji = alert.severity === "CRITICAL" ? "🚨" : alert.severity === "HIGH" ? "⚠️" : "ℹ️";
  await sendLocalNotification(`${emoji} ${alert.title}`, alert.description);
}

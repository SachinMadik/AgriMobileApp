import { Platform } from "react-native";

// Lazy-load expo-notifications so it never auto-registers push tokens on import
async function N() {
  return import("expo-notifications");
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const n = await N();
  n.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
  const { status: existing } = await n.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await n.requestPermissionsAsync();
  return status === "granted";
}

export async function sendLocalNotification(title: string, body: string, data?: object) {
  if (!await ensurePermission()) return;
  const n = await N();
  await n.scheduleNotificationAsync({
    content: { title, body, data: data ?? {}, sound: true },
    trigger: null,
  });
}

export async function scheduleReminderNotification(id: string, title: string, datetime: string, note?: string): Promise<void> {
  if (!await ensurePermission()) return;
  const n = await N();
  const date = new Date(datetime);
  if (isNaN(date.getTime()) || date <= new Date()) return;
  await n.cancelScheduledNotificationAsync(id).catch(() => {});
  await n.scheduleNotificationAsync({
    identifier: id,
    content: { title: `🔔 ${title}`, body: note || "Your farm reminder is due.", sound: true, data: { reminderId: id } },
    trigger: { type: n.SchedulableTriggerInputTypes.DATE, date },
  });
}

export async function cancelReminderNotification(id: string) {
  const n = await N();
  await n.cancelScheduledNotificationAsync(id).catch(() => {});
}

export async function sendAlertNotification(alert: { severity: string; title: string; description: string }) {
  const emoji = alert.severity === "CRITICAL" ? "🚨" : alert.severity === "HIGH" ? "⚠️" : "ℹ️";
  await sendLocalNotification(`${emoji} ${alert.title}`, alert.description);
}

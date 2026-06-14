import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function sendLocalNotification(title: string, body: string, data?: object) {
  if (!await ensurePermission()) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: data ?? {}, sound: true },
    trigger: null, // immediate
  });
}

export async function scheduleReminderNotification(
  id: string,
  title: string,
  datetime: string, // "2026-06-15 08:00 AM"
  note?: string
): Promise<string | null> {
  if (!await ensurePermission()) return null;

  const date = new Date(datetime);
  if (isNaN(date.getTime()) || date <= new Date()) return null;

  // Cancel existing notification for this reminder if any
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});

  const notifId = await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: `🔔 ${title}`,
      body: note || "Your farm reminder is due.",
      sound: true,
      data: { reminderId: id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
  return notifId;
}

export async function cancelReminderNotification(id: string) {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export async function sendAlertNotification(alert: { severity: string; title: string; description: string }) {
  const emoji = alert.severity === "CRITICAL" ? "🚨" : alert.severity === "HIGH" ? "⚠️" : "ℹ️";
  await sendLocalNotification(`${emoji} ${alert.title}`, alert.description);
}

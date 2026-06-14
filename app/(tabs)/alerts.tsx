import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { sendAlertNotification, scheduleReminderNotification, cancelReminderNotification } from "../../services/notifications";
import { getAlerts, acknowledgeAlert, acknowledgeAll as acknowledgeAllApi, runRiskCheck as runRiskCheckApi, getReminders, createReminder, markReminderDone as markReminderDoneApi, deleteReminder as deleteReminderApi } from "../../services/alerts";
import { getProfile } from "../../services/profile";
import { theme } from "../../theme";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type FilterKey = "ALL" | Severity;
type TabKey = "alerts" | "reminders";
type CropType = "tomato" | "rice" | "wheat" | "cotton" | "maize";
type Season = "kharif" | "rabi" | "summer";

interface FarmAlert {
  id: string; severity: Severity; title: string; description: string;
  recommendation: string; timeline: string; activity: string;
  timestamp: string; source: string; acknowledged: boolean;
}
interface Reminder { id: string; title: string; datetime: string; note: string; done: boolean; }
interface WeatherSnap { temperature: number; humidity: number; rainfall: number; windSpeed: number; }

const SEV: Record<Severity, { color: string; bg: string }> = {
  CRITICAL: { color: "#ef5350", bg: "#3a0f0f" },
  HIGH:     { color: "#ff8a65", bg: "#2e1a0f" },
  MEDIUM:   { color: "#f9a825", bg: "#2e250f" },
  LOW:      { color: "#66bb6a", bg: "#0f2e14" },
};
const FILTERS: FilterKey[] = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
const CROPS: CropType[] = ["tomato", "rice", "wheat", "cotton", "maize"];
const SEASONS: Season[] = ["kharif", "rabi", "summer"];

function fmt(d: Date) {
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Alerts() {
  const [activeTab, setActiveTab] = useState<TabKey>("alerts");
  const [alerts, setAlerts] = useState<FarmAlert[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [weather, setWeather] = useState<WeatherSnap | null>(null);
  const [cropType, setCropType] = useState<CropType>("tomato");
  const [season, setSeason] = useState<Season>("kharif");
  const [soilType, setSoilType] = useState("loam");
  const [showFarmPicker, setShowFarmPicker] = useState(false);

  // Reminder form
  const [showForm, setShowForm] = useState(false);
  const [rTitle, setRTitle] = useState("");
  const [rNote, setRNote] = useState("");
  const [rDateTime, setRDateTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return d;
  });
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAlerts();
    fetchReminders();
    getProfile().then((p) => {
      if (!p) return;
      const c = p.primaryCrop?.toLowerCase().split(" ")[0] as CropType;
      if (CROPS.includes(c)) setCropType(c);
      const s = p.season?.toLowerCase().split(" ")[0] as Season;
      if (SEASONS.includes(s)) setSeason(s);
      if (p.soilType) setSoilType(p.soilType.toLowerCase());
    }).catch(() => {});
  }, []);

  async function fetchAlerts() {
    setLoading(true);
    try { setAlerts(Array.isArray(await getAlerts()) ? await getAlerts() : []); }
    catch (e) { console.log(e); }
    finally { setLoading(false); }
  }

  async function fetchReminders() {
    try { const d = await getReminders(); setReminders(Array.isArray(d) ? d : []); }
    catch (e) { console.log(e); }
  }

  async function runRiskCheck() {
    setChecking(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission Denied", "Location needed for risk check."); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const data = await runRiskCheckApi({ lat: loc.coords.latitude, lon: loc.coords.longitude, cropType, season, soilType }) ?? {};
      if (data.weather) setWeather(data.weather);
      if (Array.isArray(data.alerts) && data.alerts.length > 0) {
        setAlerts((prev) => [...data.alerts, ...prev]);
        Alert.alert("Risk Check Complete", `${data.alerts.length} new alert${data.alerts.length > 1 ? "s" : ""} generated.`);
        for (const a of data.alerts) sendAlertNotification(a).catch(() => {});
      } else {
        Alert.alert("All Clear ✅", "No significant risks for your current conditions.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not complete risk check.");
    } finally { setChecking(false); }
  }

  async function acknowledge(id: string) {
    try {
      const updated = await acknowledgeAlert(id);
      if (updated) setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, ...updated } : a));
    } catch (e) { console.log(e); }
  }

  async function acknowledgeAll() {
    try {
      await acknowledgeAllApi();
      setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    } catch (e) { console.log(e); }
  }

  async function saveReminder() {
    if (!rTitle.trim()) { Alert.alert("Required", "Please enter a reminder title."); return; }
    if (rDateTime <= new Date()) { Alert.alert("Invalid Time", "Please select a future date and time."); return; }
    setSaving(true);
    try {
      const datetime = rDateTime.toISOString();
      const created = await createReminder({ title: rTitle.trim(), datetime, note: rNote.trim() });
      setReminders((prev) => [...prev, created]);
      await scheduleReminderNotification(created.id, rTitle.trim(), datetime, rNote.trim());
      setShowForm(false);
      setRTitle(""); setRNote("");
      const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0);
      setRDateTime(d);
      Alert.alert("✅ Reminder Set", `You'll be notified at ${fmt(rDateTime)}`);
    } catch (e) {
      Alert.alert("Error", "Could not save reminder.");
    } finally { setSaving(false); }
  }

  async function markDone(id: string) {
    try {
      await markReminderDoneApi(id);
      await cancelReminderNotification(id);
      setReminders((prev) => prev.map((r) => r.id === id ? { ...r, done: true } : r));
    } catch (e) { console.log(e); }
  }

  async function deleteReminder(id: string) {
    try {
      await deleteReminderApi(id);
      await cancelReminderNotification(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { console.log(e); }
  }

  const filtered = filter === "ALL" ? alerts : alerts.filter((a) => a.severity === filter);
  const unread = alerts.filter((a) => !a.acknowledged).length;
  const pending = reminders.filter((r) => !r.done).length;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alerts & Prevention</Text>
          <Text style={styles.sub}>{unread > 0 ? `${unread} unreviewed` : "All reviewed"} · {pending} reminder{pending !== 1 ? "s" : ""}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowFarmPicker(true)}>
            <Ionicons name="leaf-outline" size={18} color={theme.colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={fetchAlerts}>
            <Ionicons name="refresh-outline" size={20} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {weather && (
        <View style={styles.weatherStrip}>
          {[["thermometer", `${Math.round(weather.temperature)}°C`, "Temp"], ["water", `${weather.humidity}%`, "Humidity"], ["rainy", `${weather.rainfall}mm`, "Rain"], ["speedometer", `${Math.round(weather.windSpeed)}km/h`, "Wind"]].map(([icon, val, lbl], i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 10 }}>
              <Ionicons name={icon as any} size={14} color={theme.colors.accent} />
              <Text style={styles.wVal}>{val}</Text>
              <Text style={styles.wLbl}>{lbl}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.farmBar} onPress={() => setShowFarmPicker(true)}>
        <Ionicons name="leaf" size={13} color={theme.colors.accent} />
        <Text style={styles.farmBarText}>{cropType} · {season} · {soilType}</Text>
        <Ionicons name="chevron-down" size={13} color="#3d6e64" />
      </TouchableOpacity>

      <View style={styles.tabRow}>
        {(["alerts", "reminders"] as TabKey[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === "alerts" ? `Alerts (${alerts.length})` : `Reminders (${pending})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "alerts" && (
        <>
          <View style={styles.statsRow}>
            {(["CRITICAL","HIGH","MEDIUM","LOW"] as Severity[]).map((s) => (
              <View key={s} style={[styles.statPill, { borderColor: `${SEV[s].color}30` }]}>
                <Text style={[styles.statCount, { color: SEV[s].color }]}>{alerts.filter((a) => a.severity === s).length}</Text>
                <Text style={styles.statLbl}>{s.slice(0,3)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.primaryBtn, checking && { opacity: 0.7 }]} onPress={runRiskCheck} disabled={checking}>
              {checking ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="pulse-outline" size={16} color="white" />}
              <Text style={styles.primaryText}>{checking ? "Checking..." : "Run Risk Check"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={acknowledgeAll}>
              <Ionicons name="checkmark-done-outline" size={16} color={theme.colors.accent} />
              <Text style={styles.secondaryText}>Acknowledge All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {FILTERS.map((f) => (
              <TouchableOpacity key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
                <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {loading && <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 40 }} />}
            {!loading && filtered.map((a) => <AlertCard key={a.id} alert={a} onAcknowledge={() => acknowledge(a.id)} />)}
            {!loading && filtered.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="shield-checkmark-outline" size={48} color="#1a4036" />
                <Text style={styles.emptyText}>No alerts</Text>
                <Text style={styles.emptySub}>Tap "Run Risk Check" to analyse current conditions</Text>
              </View>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      )}

      {activeTab === "reminders" && (
        <>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="add-circle-outline" size={18} color="white" />
            <Text style={styles.addText}>Add Reminder</Text>
          </TouchableOpacity>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {reminders.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="alarm-outline" size={48} color="#1a4036" />
                <Text style={styles.emptyText}>No reminders yet</Text>
                <Text style={styles.emptySub}>Add spray schedules, irrigation tasks and more</Text>
              </View>
            )}
            {reminders.map((r) => <ReminderCard key={r.id} reminder={r} onDone={() => markDone(r.id)} onDelete={() => deleteReminder(r.id)} />)}
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      )}

      {/* Farm Picker */}
      <Modal visible={showFarmPicker} transparent animationType="slide" onRequestClose={() => setShowFarmPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowFarmPicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>Farm Context</Text>
            <Text style={styles.fieldLbl}>Crop</Text>
            <View style={styles.chipRow}>
              {CROPS.map((c) => <TouchableOpacity key={c} style={[styles.chip, cropType === c && styles.chipActive]} onPress={() => setCropType(c)}><Text style={[styles.chipText, cropType === c && styles.chipTextActive]}>{c}</Text></TouchableOpacity>)}
            </View>
            <Text style={styles.fieldLbl}>Season</Text>
            <View style={styles.chipRow}>
              {SEASONS.map((s) => <TouchableOpacity key={s} style={[styles.chip, season === s && styles.chipActive]} onPress={() => setSeason(s)}><Text style={[styles.chipText, season === s && styles.chipTextActive]}>{s}</Text></TouchableOpacity>)}
            </View>
            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowFarmPicker(false)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Reminder */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: "flex-end" }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.overlay} onPress={() => setShowForm(false)} />
          <View style={styles.modalCard}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>New Reminder</Text>

            <Text style={styles.fieldLbl}>Title *</Text>
            <TextInput style={styles.input} placeholder="e.g. Spray fungicide on Zone B" placeholderTextColor="#3d6e64" value={rTitle} onChangeText={setRTitle} autoFocus />

            <Text style={styles.fieldLbl}>Date & Time *</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              <TouchableOpacity style={styles.dtBtn} onPress={() => setPickerMode("date")}>
                <Ionicons name="calendar-outline" size={16} color={theme.colors.accent} />
                <Text style={styles.dtText}>{rDateTime.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dtBtn} onPress={() => setPickerMode("time")}>
                <Ionicons name="time-outline" size={16} color={theme.colors.accent} />
                <Text style={styles.dtText}>{rDateTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</Text>
              </TouchableOpacity>
            </View>

            {pickerMode && (
              <DateTimePicker
                value={rDateTime}
                mode={pickerMode}
                minimumDate={new Date()}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, selected) => {
                  setPickerMode(null);
                  if (selected) setRDateTime(selected);
                }}
              />
            )}

            <Text style={styles.fieldLbl}>Note (optional)</Text>
            <TextInput style={[styles.input, { height: 64, textAlignVertical: "top" }]} placeholder="Additional details..." placeholderTextColor="#3d6e64" value={rNote} onChangeText={setRNote} multiline />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 2 }, saving && { opacity: 0.6 }]} onPress={saveReminder} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.primaryText}>Set Reminder</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function AlertCard({ alert, onAcknowledge }: { alert: FarmAlert; onAcknowledge: () => void }) {
  const cfg = SEV[alert.severity] ?? SEV.LOW;
  const [expanded, setExpanded] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  function handleAck() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(onAcknowledge);
  }

  return (
    <Animated.View style={[styles.card, alert.acknowledged && { opacity: 0.6 }, { transform: [{ scale }] }]}>
      <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />
      <View style={{ flex: 1, padding: 13 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 }}>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <View style={[styles.badgeDot, { backgroundColor: cfg.color }]} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>{alert.severity}</Text>
          </View>
          {alert.acknowledged && <Text style={{ color: "#44c2a8", fontSize: 11 }}>✓ Reviewed</Text>}
          <TouchableOpacity onPress={() => setExpanded(!expanded)} style={{ marginLeft: "auto" }}>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#3d6e64" />
          </TouchableOpacity>
        </View>
        <Text style={[styles.cardTitle, alert.acknowledged && { color: "#5a8a82" }]}>{alert.title}</Text>
        <Text style={styles.cardDesc}>{alert.description}</Text>
        {expanded && alert.recommendation ? (
          <View style={styles.prevention}>
            <Text style={styles.preventionLabel}>🛡 Action</Text>
            <Text style={styles.preventionText}>{alert.recommendation}</Text>
            {alert.timeline ? <Text style={{ color: "#f9a825", fontSize: 11, marginTop: 4 }}>⏱ {alert.timeline}</Text> : null}
            {alert.activity ? <Text style={{ color: "#66bb6a", fontSize: 11, marginTop: 2 }}>🌿 {alert.activity}</Text> : null}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <Text style={{ color: "#3d6e64", fontSize: 10 }}>{alert.timestamp} · {alert.source}</Text>
          {!alert.acknowledged && (
            <TouchableOpacity style={styles.ackBtn} onPress={handleAck}>
              <Text style={styles.ackText}>Acknowledge</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function ReminderCard({ reminder, onDone, onDelete }: { reminder: Reminder; onDone: () => void; onDelete: () => void }) {
  const d = new Date(reminder.datetime);
  const display = isNaN(d.getTime()) ? reminder.datetime : fmt(d);
  const isOverdue = !reminder.done && d < new Date();
  return (
    <View style={[styles.reminderCard, reminder.done && { opacity: 0.5 }]}>
      <TouchableOpacity onPress={onDone} disabled={reminder.done} style={{ paddingTop: 2 }}>
        <Ionicons name={reminder.done ? "checkmark-circle" : "ellipse-outline"} size={24} color={reminder.done ? "#44c2a8" : "#3d6e64"} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, reminder.done && { color: "#5a8a82" }]}>{reminder.title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
          <Ionicons name="alarm-outline" size={12} color={isOverdue ? "#ef5350" : "#3d6e64"} />
          <Text style={{ color: isOverdue ? "#ef5350" : "#3d6e64", fontSize: 11 }}>{display}{isOverdue ? " · Overdue" : ""}</Text>
        </View>
        {reminder.note ? <Text style={{ color: "#5a7a72", fontSize: 12, marginTop: 3 }}>{reminder.note}</Text> : null}
      </View>
      <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
        <Ionicons name="trash-outline" size={16} color="#3d6e64" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingTop: Platform.OS === "ios" ? 60 : 48, paddingHorizontal: 20, paddingBottom: 12 },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: "800" },
  sub: { color: "#3d6e64", fontSize: 12, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#0c2b24", borderWidth: 1, borderColor: "#123a32", alignItems: "center", justifyContent: "center" },
  weatherStrip: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(68,194,168,0.12)", overflow: "hidden" },
  wVal: { color: "white", fontSize: 12, fontWeight: "700" },
  wLbl: { color: "#3d6e64", fontSize: 9 },
  farmBar: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginBottom: 10, backgroundColor: "#0c2b24", borderRadius: 10, borderWidth: 1, borderColor: "#123a32", paddingHorizontal: 12, paddingVertical: 8 },
  farmBarText: { flex: 1, color: theme.colors.text, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  tabRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, backgroundColor: "#071912", borderRadius: 12, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#0c2b24" },
  tabText: { color: "#3d6e64", fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: theme.colors.accent },
  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  statPill: { flex: 1, backgroundColor: "#0c2b24", borderRadius: 12, borderWidth: 1, paddingVertical: 8, alignItems: "center" },
  statCount: { fontSize: 18, fontWeight: "800" },
  statLbl: { fontSize: 9, color: "#3d6e64", fontWeight: "600" },
  actions: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  primaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#1b5e20", paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: "#2E7D32" },
  primaryText: { color: "white", fontWeight: "700", fontSize: 14 },
  secondaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#0c2b24", paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: "#123a32" },
  secondaryText: { color: theme.colors.accent, fontWeight: "700", fontSize: 14 },
  list: { flex: 1, paddingHorizontal: 16 },
  card: { flexDirection: "row", backgroundColor: "#0c2b24", borderRadius: 16, borderWidth: 1, borderColor: "#123a32", marginBottom: 10, overflow: "hidden" },
  cardAccent: { width: 4 },
  cardTitle: { color: theme.colors.text, fontSize: 14, fontWeight: "700", marginBottom: 3 },
  cardDesc: { color: "#5a7a72", fontSize: 12, lineHeight: 17, marginBottom: 4 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 9, fontWeight: "800" },
  prevention: { backgroundColor: "rgba(68,194,168,0.06)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(68,194,168,0.15)", padding: 10, marginBottom: 6 },
  preventionLabel: { color: "#44c2a8", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  preventionText: { color: "#9fbdb5", fontSize: 12, lineHeight: 17 },
  ackBtn: { backgroundColor: "rgba(68,194,168,0.1)", borderWidth: 1, borderColor: "rgba(68,194,168,0.25)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  ackText: { color: theme.colors.accent, fontSize: 11, fontWeight: "700" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginBottom: 12, paddingVertical: 13, borderRadius: 12, backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32" },
  addText: { color: "white", fontWeight: "700", fontSize: 14 },
  reminderCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#0c2b24", borderRadius: 14, borderWidth: 1, borderColor: "#123a32", marginBottom: 10, padding: 14, gap: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#1a4036", backgroundColor: "#071912" },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { color: "#3d6e64", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "white" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  empty: { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyText: { color: "#1a4036", fontSize: 15, fontWeight: "600" },
  emptySub: { color: "#1a3d35", fontSize: 12, textAlign: "center" },
  // Modals
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#0c2b24", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24, borderWidth: 1, borderColor: "#1a4036" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#1a4036", alignSelf: "center", marginBottom: 16 },
  modalTitle: { color: theme.colors.text, fontSize: 20, fontWeight: "800", marginBottom: 12 },
  fieldLbl: { color: "#9fbdb5", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: "#071912", borderRadius: 12, borderWidth: 1, borderColor: "#1a4036", padding: 12, color: "white", fontSize: 14 },
  dtBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#071912", borderRadius: 12, borderWidth: 1, borderColor: "#1a4036", padding: 12 },
  dtText: { color: "white", fontSize: 13, fontWeight: "600" },
  doneBtn: { marginTop: 20, paddingVertical: 14, borderRadius: 12, backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32", alignItems: "center" },
  doneBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#1a4036", alignItems: "center" },
  cancelText: { color: "#3d6e64", fontWeight: "700" },
});

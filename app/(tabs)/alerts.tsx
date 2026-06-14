import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../../services/api";
import { sendAlertNotification, requestNotificationPermission } from "../../services/notifications";
import { getAlerts, acknowledgeAlert, acknowledgeAll as acknowledgeAllApi, runRiskCheck as runRiskCheckApi, getReminders, createReminder, markReminderDone as markReminderDoneApi, deleteReminder as deleteReminderApi } from "../../services/alerts";
import { getProfile } from "../../services/profile";
import { theme } from "../../theme";

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type FilterKey = "ALL" | Severity;
type TabKey = "alerts" | "reminders";
type CropType = "tomato" | "rice" | "wheat" | "cotton" | "maize";
type Season = "kharif" | "rabi" | "summer";

interface FarmAlert {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  timeline: string;
  activity: string;
  timestamp: string;
  source: string;
  acknowledged: boolean;
}

interface Reminder {
  id: string;
  title: string;
  datetime: string;
  note: string;
  done: boolean;
}

interface WeatherSnap {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; dot: string }> = {
  CRITICAL: { color: "#ef5350", bg: "#3a0f0f", dot: "#ef5350" },
  HIGH:     { color: "#ff8a65", bg: "#2e1a0f", dot: "#ff8a65" },
  MEDIUM:   { color: "#f9a825", bg: "#2e250f", dot: "#f9a825" },
  LOW:      { color: "#66bb6a", bg: "#0f2e14", dot: "#66bb6a" },
};

const FILTERS: FilterKey[] = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
const CROPS: CropType[] = ["tomato", "rice", "wheat", "cotton", "maize"];
const SEASONS: Season[] = ["kharif", "rabi", "summer"];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Alerts() {
  const [activeTab, setActiveTab] = useState<TabKey>("alerts");
  const [alerts, setAlerts] = useState<FarmAlert[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("ALL");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [banner, setBanner] = useState<FarmAlert | null>(null);
  const bannerAnim = useRef(new Animated.Value(-80)).current;
  const [weather, setWeather] = useState<WeatherSnap | null>(null);

  // Farm context
  const [cropType, setCropType] = useState<CropType>("tomato");
  const [season, setSeason] = useState<Season>("kharif");
  const [soilType, setSoilType] = useState("loam");
  const [showFarmPicker, setShowFarmPicker] = useState(false);

  // Reminder form
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchAlerts() {
    setLoading(true);
    try {
      const data = await getAlerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log("Fetch alerts error", e);
    } finally {
      setLoading(false);
    }
  }


  function showBanner(alert: FarmAlert) {
    setBanner(alert);
    bannerAnim.setValue(-80);
    Animated.sequence([
      Animated.spring(bannerAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.delay(4000),
      Animated.timing(bannerAnim, { toValue: -80, duration: 300, useNativeDriver: true }),
    ]).start(() => setBanner(null));
  }

  async function fetchReminders() {
    try {
      const data = await getReminders();
      setReminders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log("Fetch reminders error", e);
    }
  }

  useEffect(() => {
    fetchAlerts();
    fetchReminders();
    // Pre-fill farm context from profile
    getProfile().then((p) => {
      if (!p) return;
      const crop = p.primaryCrop?.toLowerCase().split(" ")[0] as CropType;
      if (CROPS.includes(crop)) setCropType(crop);
      const s = p.season?.toLowerCase().split(" ")[0] as Season;
      if (SEASONS.includes(s)) setSeason(s);
      if (p.soilType) setSoilType(p.soilType.toLowerCase());
    }).catch(() => {});
  }, []);

  // ── Risk Check ─────────────────────────────────────────────────────────────

  async function runRiskCheck() {
    setChecking(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is needed to check local weather risks.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const data = await runRiskCheckApi({ lat: loc.coords.latitude, lon: loc.coords.longitude, cropType, season, soilType }) ?? {};
      if (data.weather) setWeather(data.weather);
      if (Array.isArray(data.alerts) && data.alerts.length > 0) {
        setAlerts((prev) => [...data.alerts, ...prev]);
        Alert.alert("Risk Check Complete", `${data.alerts.length} new alert${data.alerts.length > 1 ? "s" : ""} generated.`);
        for (const a of data.alerts) { sendAlertNotification(a).catch(() => {}); }
      } else {
        Alert.alert("All Clear", "No significant risks detected for your current conditions.");
      }
    } catch (e) {
      console.log("Risk check error", e);
      Alert.alert("Error", "Could not complete risk check. Is the backend running?");
    } finally {
      setChecking(false);
    }
  }

  // ── Acknowledge ────────────────────────────────────────────────────────────

  async function acknowledge(id: string) {
    try {
      const updated = await acknowledgeAlert(id);
      if (updated) setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
    } catch (e) { console.log(e); }
  }

  async function acknowledgeAll() {
    try {
      await acknowledgeAllApi();
      setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    } catch (e) { console.log(e); }
  }

  // ── Reminders ──────────────────────────────────────────────────────────────

  async function saveReminder() {
    if (!reminderTitle.trim() || !reminderDate.trim() || !reminderTime.trim()) {
      Alert.alert("Required", "Please enter a title and select a date and time.");
      return;
    }
    setSavingReminder(true);
    try {
      const datetime = `${reminderDate.trim()} ${reminderTime.trim()}`;
      const created = await createReminder({ title: reminderTitle.trim(), datetime, note: reminderNote.trim() });
      setReminders((prev) => [...prev, created]);
      setShowReminderForm(false);
      setReminderTitle(""); setReminderDate(""); setReminderTime(""); setReminderNote("");
    } catch (e) {
      Alert.alert("Error", "Could not save reminder.");
    } finally {
      setSavingReminder(false);
    }
  }

  async function markReminderDone(id: string) {
    try {
      await markReminderDoneApi(id);
      setReminders((prev) => prev.map((r) => r.id === id ? { ...r, done: true } : r));
    } catch (e) { console.log(e); }
  }

  async function deleteReminder(id: string) {
    try {
      await deleteReminderApi(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { console.log(e); }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = activeFilter === "ALL"
    ? alerts
    : alerts.filter((a) => a.severity === activeFilter);

  const unacknowledged = alerts.filter((a) => !a.acknowledged).length;
  const pendingReminders = reminders.filter((r) => !r.done).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Alerts & Prevention</Text>
          <Text style={styles.headerSub}>
            {unacknowledged > 0 ? `${unacknowledged} unreviewed` : "All reviewed"} · {pendingReminders} reminder{pendingReminders !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowFarmPicker(true)} activeOpacity={0.7}>
            <Ionicons name="leaf-outline" size={18} color={theme.colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={fetchAlerts} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={20} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Weather Strip ── */}
      {weather && (
        <View style={styles.weatherStrip}>
          <WeatherPill icon="thermometer" value={`${Math.round(weather.temperature)}°C`} label="Temp" />
          <View style={styles.weatherDivider} />
          <WeatherPill icon="water" value={`${weather.humidity}%`} label="Humidity" />
          <View style={styles.weatherDivider} />
          <WeatherPill icon="rainy" value={`${weather.rainfall}mm`} label="Rain" />
          <View style={styles.weatherDivider} />
          <WeatherPill icon="speedometer" value={`${Math.round(weather.windSpeed)}km/h`} label="Wind" />
        </View>
      )}

      {/* ── Farm Context Bar ── */}
      <TouchableOpacity style={styles.farmBar} onPress={() => setShowFarmPicker(true)} activeOpacity={0.7}>
        <Ionicons name="leaf" size={13} color={theme.colors.accent} />
        <Text style={styles.farmBarText}>
          {cropType.charAt(0).toUpperCase() + cropType.slice(1)} · {season.charAt(0).toUpperCase() + season.slice(1)}
        </Text>
        <Ionicons name="chevron-down" size={13} color="#3d6e64" />
      </TouchableOpacity>

      {/* ── Tabs ── */}
      <View style={styles.tabRow}>
        {(["alerts", "reminders"] as TabKey[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === "alerts" ? `Alerts (${alerts.length})` : `Reminders (${pendingReminders})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── ALERTS TAB ── */}
      {activeTab === "alerts" && (
        <>
          {/* Stats */}
          <View style={styles.statsRow}>
            {(["CRITICAL","HIGH","MEDIUM","LOW"] as Severity[]).map((s) => (
              <StatPill key={s} count={alerts.filter((a) => a.severity === s).length} label={s} color={SEVERITY_CONFIG[s].color} />
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryBtn, checking && { opacity: 0.7 }]}
              onPress={runRiskCheck}
              disabled={checking}
              activeOpacity={0.7}
            >
              {checking
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name="pulse-outline" size={16} color="white" />}
              <Text style={styles.primaryText}>{checking ? "Checking..." : "Run Risk Check"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={acknowledgeAll} activeOpacity={0.7}>
              <Ionicons name="checkmark-done-outline" size={16} color={theme.colors.accent} />
              <Text style={styles.secondaryText}>Acknowledge All</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
                onPress={() => setActiveFilter(f)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Alert List */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {loading && <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 40 }} />}
            {!loading && filtered.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onAcknowledge={() => acknowledge(alert.id)} />
            ))}
            {!loading && filtered.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="shield-checkmark-outline" size={48} color="#1a4036" />
                <Text style={styles.emptyText}>No {activeFilter !== "ALL" ? activeFilter.toLowerCase() : ""} alerts</Text>
                <Text style={styles.emptySubText}>Tap "Run Risk Check" to analyse current conditions</Text>
              </View>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      )}

      {/* ── REMINDERS TAB ── */}
      {activeTab === "reminders" && (
        <>
          <TouchableOpacity style={styles.addReminderBtn} onPress={() => setShowReminderForm(true)} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color="white" />
            <Text style={styles.addReminderText}>Add Reminder</Text>
          </TouchableOpacity>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {reminders.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="alarm-outline" size={48} color="#1a4036" />
                <Text style={styles.emptyText}>No reminders yet</Text>
                <Text style={styles.emptySubText}>Add spray schedules, irrigation tasks and more</Text>
              </View>
            )}
            {reminders.map((r) => (
              <ReminderCard key={r.id} reminder={r} onDone={() => markReminderDone(r.id)} onDelete={() => deleteReminder(r.id)} />
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      )}

      {/* ── Farm Picker Modal ── */}
      <Modal visible={showFarmPicker} transparent animationType="slide" onRequestClose={() => setShowFarmPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFarmPicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Farm Context</Text>
            <Text style={styles.modalSubtitle}>Used to personalise risk calculations</Text>

            <Text style={styles.fieldLabel}>Crop Type</Text>
            <View style={styles.chipRow}>
              {CROPS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, cropType === c && styles.chipActive]}
                  onPress={() => setCropType(c)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, cropType === c && styles.chipTextActive]}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Season</Text>
            <View style={styles.chipRow}>
              {SEASONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, season === s && styles.chipActive]}
                  onPress={() => setSeason(s)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, season === s && styles.chipTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowFarmPicker(false)} activeOpacity={0.7}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Add Reminder Modal ── */}
      <Modal visible={showReminderForm} transparent animationType="slide" onRequestClose={() => setShowReminderForm(false)}>
        <KeyboardAvoidingView style={styles.modalWrapper} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowReminderForm(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Reminder</Text>

            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput style={styles.input} placeholder="e.g. Spray fungicide on Zone B" placeholderTextColor="#3d6e64" value={reminderTitle} onChangeText={setReminderTitle} />

            <Text style={styles.fieldLabel}>Date *</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {[0,1,2,3,4,5,6].map((offset) => {
                const d = new Date(); d.setDate(d.getDate() + offset);
                const val = d.toISOString().split("T")[0];
                const label = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
                const active = reminderDate === val;
                return (
                  <TouchableOpacity key={offset} style={[styles.chip, active && styles.chipActive, { flex: 1, alignItems: "center", paddingHorizontal: 4 }]} onPress={() => setReminderDate(val)}>
                    <Text style={[styles.chipText, active && styles.chipTextActive, { fontSize: 10, textAlign: "center" }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Time *</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {["06:00 AM","07:00 AM","08:00 AM","09:00 AM","12:00 PM","03:00 PM","05:00 PM","06:00 PM"].map((t) => (
                <TouchableOpacity key={t} style={[styles.chip, reminderTime === t && styles.chipActive]} onPress={() => setReminderTime(t)}>
                  <Text style={[styles.chipText, reminderTime === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput style={[styles.input, { height: 70, textAlignVertical: "top" }]} placeholder="Additional details..." placeholderTextColor="#3d6e64" value={reminderNote} onChangeText={setReminderNote} multiline />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReminderForm(false)} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, savingReminder && { opacity: 0.6 }]} onPress={saveReminder} disabled={savingReminder} activeOpacity={0.7}>
                {savingReminder ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.submitText}>Save Reminder</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeatherPill({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.weatherPill}>
      <Ionicons name={icon as any} size={14} color={theme.colors.accent} />
      <Text style={styles.weatherValue}>{value}</Text>
      <Text style={styles.weatherLabel}>{label}</Text>
    </View>
  );
}

function StatPill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View style={[styles.statPill, { borderColor: `${color}30` }]}>
      <Text style={[styles.statCount, { color }]}>{count}</Text>
      <Text style={styles.statLabel}>{label.slice(0, 3)}</Text>
    </View>
  );
}

function AlertCard({ alert, onAcknowledge }: { alert: FarmAlert; onAcknowledge: () => void }) {
  const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.LOW;
  const [expanded, setExpanded] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  function handleAck() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(onAcknowledge);
  }

  return (
    <Animated.View style={[styles.alertCard, alert.acknowledged && styles.alertCardAck, { transform: [{ scale }] }]}>
      <View style={[styles.alertAccent, { backgroundColor: cfg.dot }]} />
      <View style={styles.alertBody}>
        {/* Top row */}
        <View style={styles.alertTop}>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>{alert.severity}</Text>
          </View>
          {alert.acknowledged && (
            <View style={styles.ackBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#44c2a8" />
              <Text style={styles.ackText}>Reviewed</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7} style={{ marginLeft: "auto" }}>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#3d6e64" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.alertTitle, alert.acknowledged && styles.textMuted]}>{alert.title}</Text>
        <Text style={styles.alertDesc}>{alert.description}</Text>

        {/* Prevention section — expanded */}
        {expanded && alert.recommendation ? (
          <View style={styles.preventionBox}>
            <View style={styles.preventionRow}>
              <Ionicons name="shield-checkmark" size={13} color="#44c2a8" />
              <Text style={styles.preventionLabel}>Action</Text>
            </View>
            <Text style={styles.preventionText}>{alert.recommendation}</Text>
            {alert.timeline ? (
              <View style={styles.timelineRow}>
                <Ionicons name="time-outline" size={12} color="#f9a825" />
                <Text style={styles.timelineText}>{alert.timeline}</Text>
              </View>
            ) : null}
            {alert.activity ? (
              <View style={styles.activityRow}>
                <Ionicons name="leaf-outline" size={12} color="#66bb6a" />
                <Text style={styles.activityText}>{alert.activity}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.alertFooter}>
          <View style={styles.alertMeta}>
            <Ionicons name="time-outline" size={11} color="#3d6e64" />
            <Text style={styles.alertTime}>{alert.timestamp}</Text>
            <Text style={styles.alertDot}>·</Text>
            <Text style={styles.alertTime}>{alert.source}</Text>
          </View>
          {!alert.acknowledged && (
            <TouchableOpacity style={styles.ackBtn} onPress={handleAck} activeOpacity={0.7}>
              <Text style={styles.ackBtnText}>Acknowledge</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function ReminderCard({ reminder, onDone, onDelete }: { reminder: Reminder; onDone: () => void; onDelete: () => void }) {
  return (
    <View style={[styles.reminderCard, reminder.done && styles.reminderDone]}>
      <View style={styles.reminderLeft}>
        <TouchableOpacity onPress={onDone} disabled={reminder.done} activeOpacity={0.7}>
          <Ionicons
            name={reminder.done ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={reminder.done ? "#44c2a8" : "#3d6e64"}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.reminderBody}>
        <Text style={[styles.reminderTitle, reminder.done && styles.textMuted]}>{reminder.title}</Text>
        <View style={styles.reminderMeta}>
          <Ionicons name="calendar-outline" size={11} color="#3d6e64" />
          <Text style={styles.reminderTime}>{reminder.datetime}</Text>
        </View>
        {reminder.note ? <Text style={styles.reminderNote}>{reminder.note}</Text> : null}
      </View>
      <TouchableOpacity onPress={onDelete} activeOpacity={0.7} style={styles.reminderDelete}>
        <Ionicons name="trash-outline" size={16} color="#3d6e64" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingTop: Platform.OS === "ios" ? 60 : 48, paddingHorizontal: 20, paddingBottom: 12,
  },
  headerTitle: { color: theme.colors.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  headerSub: { color: "#3d6e64", fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#0c2b24", borderWidth: 1, borderColor: "#123a32",
    alignItems: "center", justifyContent: "center",
  },

  weatherStrip: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(68,194,168,0.12)", overflow: "hidden",
  },
  weatherPill: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 2 },
  weatherValue: { color: "white", fontSize: 12, fontWeight: "700" },
  weatherLabel: { color: "#3d6e64", fontSize: 9 },
  weatherDivider: { width: 1, backgroundColor: "rgba(68,194,168,0.1)", marginVertical: 8 },

  farmBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "#0c2b24", borderRadius: 10, borderWidth: 1, borderColor: "#123a32",
    paddingHorizontal: 12, paddingVertical: 8,
  },
  farmBarText: { flex: 1, color: theme.colors.text, fontSize: 13, fontWeight: "600" },

  tabRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, backgroundColor: "#071912", borderRadius: 12, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#0c2b24" },
  tabText: { color: "#3d6e64", fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: theme.colors.accent },

  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  statPill: {
    flex: 1, backgroundColor: "#0c2b24", borderRadius: 12, borderWidth: 1,
    paddingVertical: 8, alignItems: "center",
  },
  statCount: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 9, color: "#3d6e64", fontWeight: "600", marginTop: 1 },

  actions: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  primaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#1b5e20", paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: "#2E7D32",
  },
  primaryText: { color: "white", fontWeight: "700", fontSize: 14 },
  secondaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#0c2b24", paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: "#123a32",
  },
  secondaryText: { color: theme.colors.accent, fontWeight: "700", fontSize: 14 },

  filterScroll: { flexGrow: 0, marginBottom: 10 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#0c2b24", borderWidth: 1, borderColor: "#123a32",
  },
  filterTabActive: { backgroundColor: "#1a4036", borderColor: theme.colors.accent },
  filterText: { color: "#3d6e64", fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: theme.colors.accent },

  list: { flex: 1, paddingHorizontal: 16 },

  alertCard: {
    flexDirection: "row", backgroundColor: "#0c2b24", borderRadius: 16,
    borderWidth: 1, borderColor: "#123a32", marginBottom: 10, overflow: "hidden",
  },
  alertCardAck: { opacity: 0.6 },
  alertAccent: { width: 4 },
  alertBody: { flex: 1, padding: 13 },
  alertTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  ackBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  ackText: { color: "#44c2a8", fontSize: 11, fontWeight: "600" },
  alertTitle: { color: theme.colors.text, fontSize: 14, fontWeight: "700", marginBottom: 3 },
  textMuted: { color: "#5a8a82" },
  alertDesc: { color: "#5a7a72", fontSize: 12, lineHeight: 17, marginBottom: 8 },

  preventionBox: {
    backgroundColor: "rgba(68,194,168,0.06)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(68,194,168,0.15)", padding: 10, marginBottom: 8,
  },
  preventionRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  preventionLabel: { color: "#44c2a8", fontSize: 11, fontWeight: "700" },
  preventionText: { color: "#9fbdb5", fontSize: 12, lineHeight: 17, marginBottom: 6 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  timelineText: { color: "#f9a825", fontSize: 11 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  activityText: { color: "#66bb6a", fontSize: 11 },

  alertFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  alertMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  alertTime: { color: "#3d6e64", fontSize: 10 },
  alertDot: { color: "#1a4036", fontSize: 10 },
  ackBtn: {
    backgroundColor: "rgba(68,194,168,0.1)", borderWidth: 1,
    borderColor: "rgba(68,194,168,0.25)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  ackBtnText: { color: theme.colors.accent, fontSize: 11, fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyText: { color: "#1a4036", fontSize: 15, fontWeight: "600" },
  emptySubText: { color: "#1a3d35", fontSize: 12, textAlign: "center" },

  addReminderBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 12, paddingVertical: 13, borderRadius: 12,
    backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32",
  },
  addReminderText: { color: "white", fontWeight: "700", fontSize: 14 },

  reminderCard: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: "#0c2b24",
    borderRadius: 14, borderWidth: 1, borderColor: "#123a32", marginBottom: 10, padding: 14, gap: 12,
  },
  reminderDone: { opacity: 0.55 },
  reminderLeft: { paddingTop: 2 },
  reminderBody: { flex: 1 },
  reminderTitle: { color: theme.colors.text, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  reminderMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  reminderTime: { color: "#3d6e64", fontSize: 11 },
  reminderNote: { color: "#5a7a72", fontSize: 12, marginTop: 4 },
  reminderDelete: { padding: 4 },

  // Modals
  modalWrapper: { flex: 1, justifyContent: "flex-end" },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  modalCard: {
    backgroundColor: "#0c2b24", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderWidth: 1, borderColor: "#1a4036",
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#1a4036", alignSelf: "center", marginBottom: 16 },
  modalTitle: { color: theme.colors.text, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  modalSubtitle: { color: "#3d6e64", fontSize: 13, marginBottom: 12 },
  fieldLabel: { color: "#9fbdb5", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#071912", borderRadius: 12, borderWidth: 1, borderColor: "#1a4036",
    padding: 12, color: "white", fontSize: 14,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: "#1a4036", backgroundColor: "#071912",
  },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { color: "#3d6e64", fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "white" },
  doneBtn: {
    marginTop: 20, paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32", alignItems: "center",
  },
  doneBtnText: { color: "white", fontWeight: "700", fontSize: 15 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#1a4036", alignItems: "center" },
  cancelText: { color: "#3d6e64", fontWeight: "700" },
  submitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32",
    alignItems: "center", justifyContent: "center",
  },
  submitText: { color: "white", fontWeight: "700", fontSize: 15 },
});

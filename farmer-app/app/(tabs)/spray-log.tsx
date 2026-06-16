import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView,
  Modal, Platform, Pressable, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import {
  SprayLog, SprayStats,
  createSprayLog, deleteSprayLog, getSprayLogs, getSprayStats, markSprayDone,
} from "../../services/sprayLog";
import { theme } from "../../theme";

const CHEMICAL_TYPES = ["fungicide", "insecticide", "herbicide", "fertilizer", "other"];
const ZONES = ["Full Farm", "Zone A", "Zone B", "Zone C", "Nursery", "Greenhouse"];
const WEATHER_OPTIONS = ["Sunny", "Partly Cloudy", "Cloudy", "Low Wind", "High Wind", "After Rain"];

const TYPE_CONFIG: Record<string, { color: string; icon: string; bg: string }> = {
  fungicide:  { color: "#44c2a8", icon: "shield-checkmark", bg: "rgba(68,194,168,0.12)" },
  insecticide:{ color: "#f9a825", icon: "bug",              bg: "rgba(249,168,37,0.12)" },
  herbicide:  { color: "#66bb6a", icon: "leaf",             bg: "rgba(102,187,106,0.12)" },
  fertilizer: { color: "#42a5f5", icon: "flask",            bg: "rgba(66,165,245,0.12)" },
  other:      { color: "#ab47bc", icon: "ellipsis-horizontal-circle", bg: "rgba(171,71,188,0.12)" },
};

function formatDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff} days ago`;
}

export default function SprayLogScreen() {
  const [logs, setLogs] = useState<SprayLog[]>([]);
  const [stats, setStats] = useState<SprayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    time: "07:00 AM",
    chemical: "",
    chemicalType: "fungicide",
    dose: "",
    area: "",
    zone: "Full Farm",
    weather: "Sunny",
    notes: "",
  });

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    load();
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  async function load() {
    try {
      const [l, s] = await Promise.all([getSprayLogs(), getSprayStats()]);
      setLogs(l);
      setStats(s);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleSubmit() {
    if (!form.chemical.trim() || !form.dose.trim() || !form.date.trim()) {
      Alert.alert("Required", "Chemical name, dose and date are required.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createSprayLog(form);
      if (created) {
        setLogs((prev) => [created, ...prev]);
        setStats((prev) => prev ? { ...prev, total: prev.total + 1, pending: prev.pending + 1 } : prev);
        closeForm();
        Alert.alert("✅ Logged", `${form.chemical} spray scheduled for ${formatDate(form.date)}.`);
      } else {
        Alert.alert("Error", "Could not save spray log. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkDone(log: SprayLog) {
    const updated = await markSprayDone(log.id);
    if (updated) {
      setLogs((prev) => prev.map((l) => l.id === log.id ? { ...l, done: true } : l));
      setStats((prev) => prev ? { ...prev, done: prev.done + 1, pending: Math.max(0, prev.pending - 1) } : prev);
    }
  }

  async function handleDelete(log: SprayLog) {
    Alert.alert("Delete Spray Log", `Remove "${log.chemical}" entry?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        const ok = await deleteSprayLog(log.id);
        if (ok) {
          setLogs((prev) => prev.filter((l) => l.id !== log.id));
          setStats((prev) => prev ? {
            ...prev,
            total: prev.total - 1,
            done: log.done ? prev.done - 1 : prev.done,
            pending: !log.done ? prev.pending - 1 : prev.pending,
          } : prev);
        }
      }},
    ]);
  }

  function closeForm() {
    setShowForm(false);
    setForm({ date: new Date().toISOString().split("T")[0], time: "07:00 AM", chemical: "", chemicalType: "fungicide", dose: "", area: "", zone: "Full Farm", weather: "Sunny", notes: "" });
  }

  const filtered = filterType === "all" ? logs : logs.filter((l) => l.chemicalType === filterType);
  const pending = logs.filter((l) => !l.done);
  const completed = logs.filter((l) => l.done);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <View>
          <Text style={styles.headerLabel}>FARM MANAGEMENT</Text>
          <Text style={styles.title}>Spray Log</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={22} color="white" />
          <Text style={styles.addBtnText}>Log Spray</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.accent} colors={[theme.colors.accent]} />}
      >
        {/* Stats Row */}
        {stats && (
          <View style={styles.statsRow}>
            <StatCard icon="list" color="#44c2a8" value={stats.total} label="Total Sprays" />
            <StatCard icon="checkmark-circle" color="#66bb6a" value={stats.done} label="Completed" />
            <StatCard icon="time" color="#f9a825" value={stats.pending} label="Pending" />
            <StatCard icon="calendar" color="#42a5f5" value={stats.lastSprayDate ? daysAgo(stats.lastSprayDate) : "—"} label="Last Spray" isText />
          </View>
        )}

        {/* Type breakdown */}
        {stats?.byType && Object.keys(stats.byType).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>By Chemical Type</Text>
            <View style={styles.typeRow}>
              {Object.entries(stats.byType).map(([type, count]) => {
                const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.other;
                return (
                  <View key={type} style={[styles.typeChip, { backgroundColor: cfg.bg, borderColor: `${cfg.color}33` }]}>
                    <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
                    <Text style={[styles.typeChipText, { color: cfg.color }]}>{type} ({count})</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Filter tabs */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {["all", ...CHEMICAL_TYPES].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.filterTab, filterType === t && styles.filterTabActive]}
                  onPress={() => setFilterType(t)}
                >
                  <Text style={[styles.filterTabText, filterType === t && styles.filterTabTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Pending sprays */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Pending</Text>
              <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{pending.length}</Text></View>
            </View>
            {pending.filter((l) => filterType === "all" || l.chemicalType === filterType).map((log) => (
              <SprayCard key={log.id} log={log} onDone={() => handleMarkDone(log)} onDelete={() => handleDelete(log)} />
            ))}
          </View>
        )}

        {/* Completed sprays */}
        {completed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed</Text>
            {completed.filter((l) => filterType === "all" || l.chemicalType === filterType).map((log) => (
              <SprayCard key={log.id} log={log} onDone={() => {}} onDelete={() => handleDelete(log)} />
            ))}
          </View>
        )}

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        )}

        {!loading && filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="flask-outline" size={48} color="#1a4036" />
            <Text style={styles.emptyTitle}>No spray logs yet</Text>
            <Text style={styles.emptySub}>Tap "Log Spray" to record your first spray.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Spray Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.modalOverlay} onPress={closeForm} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Log Spray Application</Text>
            <Text style={styles.modalSub}>Record chemical, dose, area and conditions</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Chemical Type */}
              <Text style={styles.fieldLabel}>Chemical Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={styles.chipRow}>
                  {CHEMICAL_TYPES.map((t) => {
                    const cfg = TYPE_CONFIG[t];
                    const active = form.chemicalType === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeSelectBtn, active && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                        onPress={() => setForm((p) => ({ ...p, chemicalType: t }))}
                      >
                        <Ionicons name={cfg.icon as any} size={13} color={active ? cfg.color : "#3d6e64"} />
                        <Text style={[styles.typeSelectText, active && { color: cfg.color }]}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <FormField label="Chemical Name *" placeholder="e.g. Mancozeb 75% WP" value={form.chemical} onChangeText={(t) => setForm((p) => ({ ...p, chemical: t }))} />
              <FormField label="Dose *" placeholder="e.g. 2.5 g/L or 2 mL/L" value={form.dose} onChangeText={(t) => setForm((p) => ({ ...p, dose: t }))} />
              <FormField label="Area Covered" placeholder="e.g. 4.2 ha" value={form.area} onChangeText={(t) => setForm((p) => ({ ...p, area: t }))} />

              {/* Zone */}
              <Text style={styles.fieldLabel}>Zone</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={styles.chipRow}>
                  {ZONES.map((z) => (
                    <TouchableOpacity
                      key={z}
                      style={[styles.chipBtn, form.zone === z && styles.chipActive]}
                      onPress={() => setForm((p) => ({ ...p, zone: z }))}
                    >
                      <Text style={[styles.chipText, form.zone === z && styles.chipTextActive]}>{z}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.fieldLabel}>Date *</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {[0, 1, 2, 3].map((offset) => {
                  const d = new Date(); d.setDate(d.getDate() + offset);
                  const val = d.toISOString().split("T")[0];
                  const label = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                  const active = form.date === val;
                  return (
                    <TouchableOpacity key={offset} style={[styles.chipBtn, active && styles.chipActive, { flex: 1, alignItems: "center" }]} onPress={() => setForm((p) => ({ ...p, date: val }))}>
                      <Text style={[styles.chipText, active && styles.chipTextActive, { fontSize: 11 }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.fieldLabel}>Time</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {["06:00 AM","07:00 AM","08:00 AM","05:00 PM","06:00 PM"].map((t) => (
                  <TouchableOpacity key={t} style={[styles.chipBtn, form.time === t && styles.chipActive, { paddingHorizontal: 8 }]} onPress={() => setForm((p) => ({ ...p, time: t }))}>
                    <Text style={[styles.chipText, form.time === t && styles.chipTextActive, { fontSize: 10 }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Weather */}
              <Text style={styles.fieldLabel}>Weather Conditions</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={styles.chipRow}>
                  {WEATHER_OPTIONS.map((w) => (
                    <TouchableOpacity
                      key={w}
                      style={[styles.chipBtn, form.weather === w && styles.chipActive]}
                      onPress={() => setForm((p) => ({ ...p, weather: w }))}
                    >
                      <Text style={[styles.chipText, form.weather === w && styles.chipTextActive]}>{w}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <FormField label="Notes" placeholder="Optional notes..." value={form.notes} onChangeText={(t) => setForm((p) => ({ ...p, notes: t }))} multiline />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeForm}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="white" /> : <><Ionicons name="checkmark-circle" size={18} color="white" /><Text style={styles.submitText}>Save Log</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StatCard({ icon, color, value, label, isText }: any) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>{isText ? value : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SprayCard({ log, onDone, onDelete }: { log: SprayLog; onDone: () => void; onDelete: () => void }) {
  const cfg = TYPE_CONFIG[log.chemicalType] ?? TYPE_CONFIG.other;
  return (
    <View style={[styles.sprayCard, log.done && styles.sprayCardDone]}>
      <View style={[styles.sprayAccent, { backgroundColor: cfg.color }]} />
      <View style={styles.sprayBody}>
        <View style={styles.sprayTop}>
          <View style={[styles.typeIcon, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sprayChemical}>{log.chemical}</Text>
            <Text style={styles.sprayMeta}>{log.dose} · {log.area || "—"} · {log.zone}</Text>
          </View>
          {log.done ? (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#66bb6a" />
              <Text style={styles.doneBadgeText}>Done</Text>
            </View>
          ) : (
            <View style={styles.pendingDot} />
          )}
        </View>

        <View style={styles.sprayDetails}>
          <DetailChip icon="calendar-outline" text={formatDate(log.date)} />
          <DetailChip icon="time-outline" text={log.time} />
          {log.weather ? <DetailChip icon="partly-sunny-outline" text={log.weather} /> : null}
        </View>

        {log.notes ? <Text style={styles.sprayNotes}>{log.notes}</Text> : null}

        <View style={styles.sprayActions}>
          {!log.done && (
            <TouchableOpacity style={styles.doneBtn} onPress={onDone}>
              <Ionicons name="checkmark" size={14} color="#66bb6a" />
              <Text style={styles.doneBtnText}>Mark Done</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Ionicons name="trash-outline" size={14} color="#ef5350" />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function DetailChip({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.detailChip}>
      <Ionicons name={icon as any} size={11} color="#3d6e64" />
      <Text style={styles.detailChipText}>{text}</Text>
    </View>
  );
}

function FormField({ label, placeholder, value, onChangeText, multiline }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        placeholder={placeholder}
        placeholderTextColor="#3d6e64"
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingTop: Platform.OS === "ios" ? 60 : 48, paddingHorizontal: 20, paddingBottom: 16,
  },
  headerLabel: { color: theme.colors.accent, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: "800" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32",
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  addBtnText: { color: "white", fontWeight: "700", fontSize: 14 },

  statsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 4 },
  statCard: {
    flex: 1, backgroundColor: "#0c2b24", borderRadius: 14, borderWidth: 1,
    borderColor: "#123a32", padding: 12, alignItems: "center", gap: 4,
  },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statValue: { color: theme.colors.text, fontSize: 14, fontWeight: "800", textAlign: "center" },
  statLabel: { color: "#3d6e64", fontSize: 9, fontWeight: "600", textAlign: "center" },

  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "700", marginBottom: 12 },
  pendingBadge: { backgroundColor: "rgba(249,168,37,0.15)", borderWidth: 1, borderColor: "rgba(249,168,37,0.3)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  pendingBadgeText: { color: "#f9a825", fontSize: 11, fontWeight: "700" },

  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  typeChipText: { fontSize: 12, fontWeight: "600" },

  filterRow: { flexDirection: "row", gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#1a4036", backgroundColor: "#0c2b24" },
  filterTabActive: { backgroundColor: "rgba(68,194,168,0.15)", borderColor: theme.colors.accent },
  filterTabText: { color: "#3d6e64", fontSize: 12, fontWeight: "600" },
  filterTabTextActive: { color: theme.colors.accent },

  sprayCard: {
    flexDirection: "row", backgroundColor: "#0c2b24", borderRadius: 16,
    borderWidth: 1, borderColor: "#123a32", marginBottom: 12, overflow: "hidden",
  },
  sprayCardDone: { opacity: 0.7 },
  sprayAccent: { width: 4 },
  sprayBody: { flex: 1, padding: 14 },
  sprayTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  typeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sprayChemical: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  sprayMeta: { color: "#5a7a72", fontSize: 12, marginTop: 2 },
  doneBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(102,187,106,0.1)", borderWidth: 1, borderColor: "rgba(102,187,106,0.3)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  doneBadgeText: { color: "#66bb6a", fontSize: 11, fontWeight: "700" },
  pendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#f9a825", marginTop: 4 },

  sprayDetails: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  detailChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#071912", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  detailChipText: { color: "#3d6e64", fontSize: 11 },
  sprayNotes: { color: "#5a7a72", fontSize: 12, lineHeight: 16, marginBottom: 10 },

  sprayActions: { flexDirection: "row", gap: 8 },
  doneBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(102,187,106,0.08)", borderWidth: 1, borderColor: "rgba(102,187,106,0.25)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  doneBtnText: { color: "#66bb6a", fontSize: 12, fontWeight: "700" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(239,83,80,0.08)", borderWidth: 1, borderColor: "rgba(239,83,80,0.2)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  deleteBtnText: { color: "#ef5350", fontSize: 12, fontWeight: "700" },

  loadingWrap: { alignItems: "center", paddingVertical: 40 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { color: "#3d6e64", fontSize: 16, fontWeight: "700" },
  emptySub: { color: "#1a4036", fontSize: 13 },

  // Modal
  modalWrap: { flex: 1, justifyContent: "flex-end" },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  modalCard: {
    backgroundColor: "#0c2b24", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderWidth: 1, borderColor: "#1a4036",
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#1a4036", alignSelf: "center", marginBottom: 16 },
  modalTitle: { color: theme.colors.text, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  modalSub: { color: "#3d6e64", fontSize: 13, marginBottom: 16 },

  fieldLabel: { color: "#9fbdb5", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "#071912", borderRadius: 12, borderWidth: 1, borderColor: "#1a4036", padding: 12, color: "white", fontSize: 14 },
  inputMulti: { height: 72, textAlignVertical: "top" },

  chipRow: { flexDirection: "row", gap: 8 },
  chipBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#1a4036", backgroundColor: "#071912" },
  chipActive: { backgroundColor: "rgba(68,194,168,0.12)", borderColor: theme.colors.accent },
  chipText: { color: "#3d6e64", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: theme.colors.accent },
  typeSelectBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#1a4036", backgroundColor: "#071912" },
  typeSelectText: { color: "#3d6e64", fontSize: 12, fontWeight: "600" },

  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#1a4036", alignItems: "center" },
  cancelText: { color: "#3d6e64", fontWeight: "700" },
  submitBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32" },
  submitText: { color: "white", fontWeight: "700", fontSize: 15 },
});

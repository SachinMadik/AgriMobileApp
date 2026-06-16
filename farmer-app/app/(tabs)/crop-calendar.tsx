import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView,
  Modal, Platform, Pressable, RefreshControl, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import {
  CropCycle, ALL_STAGES,
  getActiveCycle, getAllCycles, createCycle, advanceStage, deleteCycle,
} from "../../services/cropCalendar";
import { theme } from "../../theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string; task: string }> = {
  sowing:       { icon: "seed-outline",        color: "#ab47bc", bg: "rgba(171,71,188,0.12)",  label: "Sowing",        task: "Prepare beds, sow seeds at correct depth" },
  germination:  { icon: "leaf-outline",         color: "#66bb6a", bg: "rgba(102,187,106,0.12)", label: "Germination",   task: "Monitor moisture, protect from pests" },
  transplanting:{ icon: "arrow-up-outline",     color: "#42a5f5", bg: "rgba(66,165,245,0.12)",  label: "Transplanting", task: "Move seedlings, water immediately after" },
  vegetative:   { icon: "nutrition-outline",    color: "#44c2a8", bg: "rgba(68,194,168,0.12)",  label: "Vegetative",    task: "Apply nitrogen fertilizer, weed control" },
  flowering:    { icon: "flower-outline",       color: "#f9a825", bg: "rgba(249,168,37,0.12)",  label: "Flowering",     task: "Reduce nitrogen, increase potassium" },
  fruiting:     { icon: "ellipse-outline",      color: "#ff8a65", bg: "rgba(255,138,101,0.12)", label: "Fruiting",      task: "Maintain irrigation, watch for blight" },
  maturity:     { icon: "checkmark-circle-outline", color: "#5ee4a1", bg: "rgba(94,228,161,0.12)", label: "Maturity",  task: "Reduce irrigation, prepare for harvest" },
  harvest:      { icon: "basket-outline",       color: "#ef5350", bg: "rgba(239,83,80,0.12)",   label: "Harvest",       task: "Harvest at peak ripeness, grade produce" },
};

const CROPS = ["Tomato", "Rice", "Wheat", "Cotton", "Maize", "Onion", "Potato", "Sugarcane", "Groundnut"];

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysFromNow(d: string) {
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  return `${diff} days left`;
}

function progressPct(currentStage: string): number {
  const idx = ALL_STAGES.indexOf(currentStage);
  return idx < 0 ? 0 : Math.round(((idx + 1) / ALL_STAGES.length) * 100);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CropCalendarScreen() {
  const [cycle, setCycle] = useState<CropCycle | null>(null);
  const [allCycles, setAllCycles] = useState<CropCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showAdvance, setShowAdvance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");

  const [form, setForm] = useState({
    crop: "Tomato", variety: "", field: "Main Field",
    area: "", sowingDate: "", expectedHarvest: "", notes: "",
  });
  const [advanceStageVal, setAdvanceStageVal] = useState("");
  const [advanceNotes, setAdvanceNotes] = useState("");

  const progressAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    load();
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (cycle) {
      const pct = progressPct(cycle.currentStage);
      Animated.timing(progressAnim, { toValue: pct / 100, duration: 1000, useNativeDriver: false }).start();
    }
  }, [cycle]);

  async function load() {
    try {
      const [active, all] = await Promise.all([getActiveCycle(), getAllCycles()]);
      setCycle(active);
      setAllCycles(all);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleCreate() {
    if (!form.crop || !form.sowingDate || !form.expectedHarvest) {
      Alert.alert("Required", "Crop, sowing date and expected harvest are required.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createCycle(form);
      if (created) {
        setCycle(created);
        setAllCycles((prev) => [created, ...prev]);
        setShowNewForm(false);
        setForm({ crop: "Tomato", variety: "", field: "Main Field", area: "", sowingDate: "", expectedHarvest: "", notes: "" });
      } else {
        Alert.alert("Error", "Could not create crop cycle. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdvance() {
    if (!cycle || !advanceStageVal) return;
    setSubmitting(true);
    try {
      const updated = await advanceStage(cycle.id, advanceStageVal, advanceNotes);
      if (updated) {
        setCycle(updated);
        setShowAdvance(false);
        setAdvanceStageVal("");
        setAdvanceNotes("");
        Alert.alert("✅ Stage Updated", `Crop advanced to ${STAGE_CONFIG[advanceStageVal]?.label ?? advanceStageVal}.`);
      } else {
        Alert.alert("Error", "Could not update stage. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!cycle) return;
    Alert.alert("End Crop Cycle", "This will permanently delete this crop cycle and all stage history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        const ok = await deleteCycle(cycle.id);
        if (ok) {
          setCycle(null);
          setAllCycles((prev) => prev.filter((c) => c.id !== cycle.id));
        }
      }},
    ]);
  }

  const nextStage = cycle ? ALL_STAGES[ALL_STAGES.indexOf(cycle.currentStage) + 1] : null;
  const pct = cycle ? progressPct(cycle.currentStage) : 0;
  const currentCfg = cycle ? (STAGE_CONFIG[cycle.currentStage] ?? STAGE_CONFIG.sowing) : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <View>
          <Text style={styles.headerLabel}>FARM MANAGEMENT</Text>
          <Text style={styles.title}>Crop Calendar</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowNewForm(true)}>
          <Ionicons name="add" size={22} color="white" />
          <Text style={styles.addBtnText}>New Cycle</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["current", "history"] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === "current" ? "Current Cycle" : "History"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.accent} colors={[theme.colors.accent]} />}
      >
        {loading && <View style={styles.loadingWrap}><ActivityIndicator size="large" color={theme.colors.accent} /></View>}

        {!loading && activeTab === "current" && (
          <>
            {!cycle ? (
              <View style={styles.emptyState}>
                <Ionicons name="leaf-outline" size={56} color="#1a4036" />
                <Text style={styles.emptyTitle}>No Active Crop Cycle</Text>
                <Text style={styles.emptySub}>Start tracking your crop from sowing to harvest.</Text>
                <TouchableOpacity style={styles.startBtn} onPress={() => setShowNewForm(true)}>
                  <Ionicons name="add-circle" size={18} color="white" />
                  <Text style={styles.startBtnText}>Start New Cycle</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Hero Card */}
                <View style={styles.heroCard}>
                  <View style={styles.heroTop}>
                    <View style={[styles.cropIcon, { backgroundColor: currentCfg?.bg }]}>
                      <Ionicons name={currentCfg?.icon as any} size={28} color={currentCfg?.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cropName}>{cycle.crop}</Text>
                      {cycle.variety ? <Text style={styles.cropVariety}>{cycle.variety}</Text> : null}
                      <Text style={styles.cropField}>{cycle.field} · {cycle.area}</Text>
                    </View>
                    <TouchableOpacity onPress={handleDelete} style={styles.deleteIconBtn}>
                      <Ionicons name="trash-outline" size={16} color="#ef5350" />
                    </TouchableOpacity>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressLabel}>Season Progress</Text>
                      <Text style={[styles.progressPct, { color: currentCfg?.color }]}>{pct}%</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <Animated.View style={[styles.progressFill, {
                        backgroundColor: currentCfg?.color ?? theme.colors.accent,
                        width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                      }]} />
                    </View>
                  </View>

                  {/* Current Stage Badge */}
                  <View style={[styles.stageBadge, { backgroundColor: currentCfg?.bg, borderColor: `${currentCfg?.color}44` }]}>
                    <Ionicons name={currentCfg?.icon as any} size={14} color={currentCfg?.color} />
                    <Text style={[styles.stageBadgeText, { color: currentCfg?.color }]}>
                      Current: {currentCfg?.label}
                    </Text>
                  </View>

                  {/* Task for current stage */}
                  <View style={styles.taskBox}>
                    <Ionicons name="bulb-outline" size={14} color="#f9a825" />
                    <Text style={styles.taskText}>{currentCfg?.task}</Text>
                  </View>

                  {/* Dates */}
                  <View style={styles.datesRow}>
                    <View style={styles.dateItem}>
                      <Text style={styles.dateLabel}>Sowing Date</Text>
                      <Text style={styles.dateValue}>{formatDate(cycle.sowingDate)}</Text>
                    </View>
                    <View style={styles.dateDivider} />
                    <View style={styles.dateItem}>
                      <Text style={styles.dateLabel}>Expected Harvest</Text>
                      <Text style={[styles.dateValue, { color: theme.colors.accent }]}>{formatDate(cycle.expectedHarvest)}</Text>
                      <Text style={styles.daysLeft}>{daysFromNow(cycle.expectedHarvest)}</Text>
                    </View>
                  </View>

                  {/* Advance Stage Button */}
                  {nextStage && (
                    <TouchableOpacity style={styles.advanceBtn} onPress={() => { setAdvanceStageVal(nextStage); setShowAdvance(true); }}>
                      <Ionicons name="arrow-forward-circle" size={18} color="white" />
                      <Text style={styles.advanceBtnText}>Advance to {STAGE_CONFIG[nextStage]?.label}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* All Stages Timeline */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Growth Stages</Text>
                  <View style={styles.timelineCard}>
                    {ALL_STAGES.map((stage, i) => {
                      const cfg = STAGE_CONFIG[stage];
                      const completedIdx = ALL_STAGES.indexOf(cycle.currentStage);
                      const isCompleted = i < completedIdx;
                      const isCurrent = stage === cycle.currentStage;
                      const isPending = i > completedIdx;
                      const stageLog = cycle.stageLogs?.find((l) => l.stage === stage);
                      return (
                        <View key={stage} style={styles.timelineRow}>
                          <View style={styles.timelineLeft}>
                            <View style={[
                              styles.timelineDot,
                              isCompleted && { backgroundColor: "#66bb6a", borderColor: "#66bb6a" },
                              isCurrent && { backgroundColor: cfg.color, borderColor: cfg.color },
                              isPending && { backgroundColor: "#071912", borderColor: "#1a4036" },
                            ]}>
                              {isCompleted
                                ? <Ionicons name="checkmark" size={12} color="white" />
                                : isCurrent
                                  ? <Ionicons name={cfg.icon as any} size={12} color="white" />
                                  : <View style={styles.timelineDotInner} />
                              }
                            </View>
                            {i < ALL_STAGES.length - 1 && (
                              <View style={[styles.timelineLine, isCompleted && { backgroundColor: "#66bb6a" }]} />
                            )}
                          </View>
                          <View style={[styles.timelineContent, isCurrent && { backgroundColor: `${cfg.color}0a`, borderColor: `${cfg.color}22`, borderWidth: 1 }]}>
                            <View style={styles.timelineHeader}>
                              <Text style={[styles.timelineStageName, isCurrent && { color: cfg.color }, isPending && { color: "#2d5a52" }]}>
                                {cfg.label}
                              </Text>
                              {isCurrent && <View style={[styles.currentTag, { backgroundColor: `${cfg.color}22` }]}><Text style={[styles.currentTagText, { color: cfg.color }]}>Current</Text></View>}
                            </View>
                            {stageLog ? (
                              <>
                                <Text style={styles.timelineDate}>{formatDate(stageLog.date)}</Text>
                                {stageLog.notes ? <Text style={styles.timelineNotes}>{stageLog.notes}</Text> : null}
                              </>
                            ) : (
                              <Text style={styles.timelinePending}>{isPending ? "Not started" : ""}</Text>
                            )}
                            <Text style={styles.timelineTask}>{cfg.task}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {!loading && activeTab === "history" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Crop Cycles</Text>
            {allCycles.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No cycles recorded yet</Text>
              </View>
            ) : allCycles.map((c) => {
              const cfg = STAGE_CONFIG[c.currentStage] ?? STAGE_CONFIG.sowing;
              const p = progressPct(c.currentStage);
              return (
                <View key={c.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <View style={[styles.historyIcon, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyCrop}>{c.crop} {c.variety ? `· ${c.variety}` : ""}</Text>
                      <Text style={styles.historyField}>{c.field} · {c.area}</Text>
                    </View>
                    <View style={[styles.historyBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.historyBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <View style={styles.historyDates}>
                    <Text style={styles.historyDate}>Sown: {formatDate(c.sowingDate)}</Text>
                    <Text style={styles.historyDate}>Harvest: {formatDate(c.expectedHarvest)}</Text>
                  </View>
                  <View style={styles.historyProgress}>
                    <View style={styles.historyTrack}>
                      <View style={[styles.historyFill, { width: `${p}%`, backgroundColor: cfg.color }]} />
                    </View>
                    <Text style={[styles.historyPct, { color: cfg.color }]}>{p}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* New Cycle Modal */}
      <Modal visible={showNewForm} transparent animationType="slide" onRequestClose={() => setShowNewForm(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowNewForm(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Crop Cycle</Text>
            <Text style={styles.modalSub}>Track your crop from sowing to harvest</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Text style={styles.fieldLabel}>Crop *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {CROPS.map((c) => (
                    <TouchableOpacity key={c} style={[styles.chipBtn, form.crop === c && styles.chipActive]} onPress={() => setForm((p) => ({ ...p, crop: c }))}>
                      <Text style={[styles.chipText, form.crop === c && styles.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <CField label="Variety" placeholder="e.g. Hybrid F1, Arka Rakshak" value={form.variety} onChange={(t) => setForm((p) => ({ ...p, variety: t }))} />
              <CField label="Field Name" placeholder="e.g. Main Field, Plot B" value={form.field} onChange={(t) => setForm((p) => ({ ...p, field: t }))} />
              <CField label="Area" placeholder="e.g. 4.2 ha" value={form.area} onChange={(t) => setForm((p) => ({ ...p, area: t }))} />
              <CField label="Sowing Date * (YYYY-MM-DD)" placeholder="2026-03-01" value={form.sowingDate} onChange={(t) => setForm((p) => ({ ...p, sowingDate: t }))} />
              <CField label="Expected Harvest * (YYYY-MM-DD)" placeholder="2026-06-15" value={form.expectedHarvest} onChange={(t) => setForm((p) => ({ ...p, expectedHarvest: t }))} />
              <CField label="Notes" placeholder="Season notes..." value={form.notes} onChange={(t) => setForm((p) => ({ ...p, notes: t }))} multiline />
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNewForm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleCreate} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="white" /> : <><Ionicons name="leaf" size={16} color="white" /><Text style={styles.submitText}>Start Cycle</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Advance Stage Modal */}
      <Modal visible={showAdvance} transparent animationType="slide" onRequestClose={() => setShowAdvance(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowAdvance(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Advance Growth Stage</Text>
            <Text style={styles.modalSub}>Select the stage your crop has reached</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {ALL_STAGES.map((stage) => {
                const cfg = STAGE_CONFIG[stage];
                const currentIdx = cycle ? ALL_STAGES.indexOf(cycle.currentStage) : -1;
                const stageIdx = ALL_STAGES.indexOf(stage);
                const isSelectable = stageIdx > currentIdx;
                const isSelected = advanceStageVal === stage;
                return (
                  <TouchableOpacity
                    key={stage}
                    style={[styles.stageOption, !isSelectable && styles.stageOptionDisabled, isSelected && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                    onPress={() => isSelectable && setAdvanceStageVal(stage)}
                    disabled={!isSelectable}
                  >
                    <View style={[styles.stageOptionIcon, { backgroundColor: isSelectable ? cfg.bg : "#071912" }]}>
                      <Ionicons name={cfg.icon as any} size={18} color={isSelectable ? cfg.color : "#1a4036"} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stageOptionLabel, !isSelectable && { color: "#1a4036" }, isSelected && { color: cfg.color }]}>{cfg.label}</Text>
                      <Text style={styles.stageOptionTask}>{cfg.task}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={cfg.color} />}
                  </TouchableOpacity>
                );
              })}
              <CField label="Notes (optional)" placeholder="Observations at this stage..." value={advanceNotes} onChange={setAdvanceNotes} multiline />
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdvance(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, (!advanceStageVal || submitting) && { opacity: 0.5 }]} onPress={handleAdvance} disabled={!advanceStageVal || submitting}>
                {submitting ? <ActivityIndicator size="small" color="white" /> : <><Ionicons name="arrow-forward-circle" size={16} color="white" /><Text style={styles.submitText}>Update Stage</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function CField({ label, placeholder, value, onChange, multiline }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.input, multiline && styles.inputMulti]} placeholder={placeholder} placeholderTextColor="#3d6e64" value={value} onChangeText={onChange} multiline={multiline} numberOfLines={multiline ? 3 : 1} textAlignVertical={multiline ? "top" : "center"} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingTop: Platform.OS === "ios" ? 60 : 48, paddingHorizontal: 20, paddingBottom: 12,
  },
  headerLabel: { color: theme.colors.accent, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: "800" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32",
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
  },
  addBtnText: { color: "white", fontWeight: "700", fontSize: 14 },

  tabRow: { flexDirection: "row", marginHorizontal: 20, marginBottom: 4, backgroundColor: "#0c2b24", borderRadius: 12, padding: 4, borderWidth: 1, borderColor: "#123a32" },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: "rgba(68,194,168,0.15)" },
  tabText: { color: "#3d6e64", fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: theme.colors.accent, fontWeight: "700" },

  loadingWrap: { alignItems: "center", paddingVertical: 60 },

  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { color: "#3d6e64", fontSize: 18, fontWeight: "700" },
  emptySub: { color: "#1a4036", fontSize: 13, textAlign: "center", lineHeight: 18 },
  startBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32",
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8,
  },
  startBtnText: { color: "white", fontWeight: "700", fontSize: 14 },

  heroCard: {
    marginHorizontal: 20, marginTop: 16, backgroundColor: "#0c2b24",
    borderRadius: 20, borderWidth: 1, borderColor: "#123a32", padding: 18,
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 16 },
  cropIcon: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cropName: { color: theme.colors.text, fontSize: 20, fontWeight: "800" },
  cropVariety: { color: "#5a7a72", fontSize: 13, marginTop: 2 },
  cropField: { color: "#3d6e64", fontSize: 12, marginTop: 2 },
  deleteIconBtn: { padding: 6, backgroundColor: "rgba(239,83,80,0.08)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(239,83,80,0.2)" },

  progressSection: { marginBottom: 14 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { color: "#9fbdb5", fontSize: 12, fontWeight: "600" },
  progressPct: { fontSize: 12, fontWeight: "800" },
  progressTrack: { height: 8, backgroundColor: "#071912", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },

  stageBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 10,
  },
  stageBadgeText: { fontSize: 13, fontWeight: "700" },

  taskBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "rgba(249,168,37,0.06)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(249,168,37,0.15)",
    padding: 10, marginBottom: 14,
  },
  taskText: { flex: 1, color: "#c8a84b", fontSize: 12, lineHeight: 17 },

  datesRow: { flexDirection: "row", backgroundColor: "#071912", borderRadius: 12, padding: 14, marginBottom: 14 },
  dateItem: { flex: 1, alignItems: "center" },
  dateDivider: { width: 1, backgroundColor: "#1a4036", marginVertical: 4 },
  dateLabel: { color: "#3d6e64", fontSize: 11, fontWeight: "600", marginBottom: 4 },
  dateValue: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  daysLeft: { color: theme.colors.accent, fontSize: 11, marginTop: 2 },

  advanceBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32",
    paddingVertical: 13, borderRadius: 12,
  },
  advanceBtnText: { color: "white", fontWeight: "700", fontSize: 14 },

  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "700", marginBottom: 14 },

  timelineCard: { backgroundColor: "#0c2b24", borderRadius: 18, borderWidth: 1, borderColor: "#123a32", padding: 16 },
  timelineRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  timelineLeft: { alignItems: "center", width: 28 },
  timelineDot: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "#1a4036",
    alignItems: "center", justifyContent: "center", backgroundColor: "#071912",
  },
  timelineDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1a4036" },
  timelineLine: { width: 2, flex: 1, backgroundColor: "#1a4036", marginVertical: 2, minHeight: 16 },
  timelineContent: { flex: 1, paddingBottom: 16, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginBottom: 4 },
  timelineHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  timelineStageName: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  currentTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  currentTagText: { fontSize: 10, fontWeight: "800" },
  timelineDate: { color: "#5a7a72", fontSize: 11, marginBottom: 2 },
  timelineNotes: { color: "#9fbdb5", fontSize: 12, lineHeight: 16, marginBottom: 4 },
  timelinePending: { color: "#1a4036", fontSize: 11 },
  timelineTask: { color: "#2d5a52", fontSize: 11, lineHeight: 15, marginTop: 2 },

  historyCard: {
    backgroundColor: "#0c2b24", borderRadius: 16, borderWidth: 1,
    borderColor: "#123a32", padding: 14, marginBottom: 12,
  },
  historyTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  historyIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  historyCrop: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  historyField: { color: "#3d6e64", fontSize: 12, marginTop: 1 },
  historyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  historyBadgeText: { fontSize: 11, fontWeight: "700" },
  historyDates: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  historyDate: { color: "#5a7a72", fontSize: 12 },
  historyProgress: { flexDirection: "row", alignItems: "center", gap: 8 },
  historyTrack: { flex: 1, height: 6, backgroundColor: "#071912", borderRadius: 3, overflow: "hidden" },
  historyFill: { height: "100%", borderRadius: 3 },
  historyPct: { fontSize: 12, fontWeight: "700", width: 36, textAlign: "right" },

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
  chipBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#1a4036", backgroundColor: "#071912" },
  chipActive: { backgroundColor: "rgba(68,194,168,0.12)", borderColor: theme.colors.accent },
  chipText: { color: "#3d6e64", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: theme.colors.accent },

  stageOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#071912", borderRadius: 12, borderWidth: 1,
    borderColor: "#1a4036", padding: 12, marginBottom: 8,
  },
  stageOptionDisabled: { opacity: 0.4 },
  stageOptionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stageOptionLabel: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  stageOptionTask: { color: "#3d6e64", fontSize: 11, marginTop: 2 },

  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#1a4036", alignItems: "center" },
  cancelText: { color: "#3d6e64", fontWeight: "700" },
  submitBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32" },
  submitText: { color: "white", fontWeight: "700", fontSize: 15 },
});

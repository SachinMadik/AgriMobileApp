import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../../services/api";
import { getSoilNutrients, getSoilHealthScore, getSoilTrend, getSoilRecommendations, updateSoilNutrient } from "../../services/soil";
import { getProfile } from "../../services/profile";
import { theme } from "../../theme";

type Status = "SAFE" | "WARNING" | "CRITICAL" | "LOW";

interface Nutrient {
  id: string;
  name: string;
  symbol: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  optimal: number;
  status: Status;
  description: string;
  action?: string;
}

const STATUS_CONFIG: Record<
  Status,
  { color: string; bg: string; icon: string }
> = {
  SAFE: {
    color: "#66bb6a",
    bg: "rgba(102,187,106,0.12)",
    icon: "checkmark-circle",
  },
  WARNING: { color: "#f9a825", bg: "rgba(249,168,37,0.12)", icon: "warning" },
  CRITICAL: {
    color: "#ef5350",
    bg: "rgba(239,83,80,0.12)",
    icon: "alert-circle",
  },
  LOW: {
    color: "#42a5f5",
    bg: "rgba(66,165,245,0.12)",
    icon: "arrow-down-circle",
  },
};

const NUTRIENTS_SEED: Nutrient[] = [];
const SOIL_HEALTH_SCORE_SEED = 0;
const LEACHING_HISTORY_SEED: any[] = [];

export default function Soil() {
  const [nutrients, setNutrients] = useState<Nutrient[]>([]);
  const [healthScore, setHealthScore] = useState(0);
  const [trend, setTrend] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [soilType, setSoilType] = useState("Soil");
  const [editNutrient, setEditNutrient] = useState<Nutrient | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [n, h, t, r] = await Promise.all([
          getSoilNutrients(),
          getSoilHealthScore(),
          getSoilTrend(),
          getSoilRecommendations(),
        ]);
        setNutrients(n);
        setHealthScore((h as any).score ?? h ?? 0);
        setTrend(t);
        setRecommendations(r);
        getProfile().then((p: any) => { if (p?.soilType) setSoilType(p.soilType); }).catch(() => {});
      } catch (e) {
        console.log("Soil fetch error", e);
      }
    }
    load();
  }, []);

  async function saveReading() {
    if (!editNutrient) return;
    const v = parseFloat(editValue);
    if (isNaN(v)) { Alert.alert("Invalid", "Enter a valid number."); return; }
    setSaving(true);
    try {
      const updated = await updateSoilNutrient(editNutrient.id, v);
      setNutrients((prev) => prev.map((n: any) => n.id === editNutrient.id ? { ...n, ...updated } : n));
      setEditNutrient(null);
      getSoilHealthScore().then((h: any) => setHealthScore(h.score ?? h ?? 0)).catch(() => {});
    } catch { Alert.alert("Error", "Could not update reading."); }
    finally { setSaving(false); }
  }

  async function runSoilTest() {
    try {
      const { data } = await api.post("/soil/test");
      Alert.alert("Soil Test", data.message);
    } catch (e) {
      Alert.alert("Error", "Could not trigger soil test.");
    }
  }

  const safeCount = nutrients.filter((n) => n.status === "SAFE").length;
  const warnCount = nutrients.filter((n) => n.status === "WARNING").length;
  const lowCount = nutrients.filter((n) => n.status === "LOW").length;

  // ── Leaching Report ────────────────────────────────────────────────────────
  const [leachingReport, setLeachingReport] = useState<any>(null);
  const [leachingLoading, setLeachingLoading] = useState(false);
  const [showLeaching, setShowLeaching] = useState(false);

  async function generateLeachingReport() {
    setLeachingLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location is needed to fetch live weather for the report.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { data } = await api.post("/leaching-report", {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          cropType: "tomato",
          soilType: "sandy loam",
          season: "kharif",
          fieldSize: "4.2 ha",
      });
      setLeachingReport(data);
      setShowLeaching(true);
    } catch (e) {
      console.log("Leaching report error", e);
      Alert.alert("Error", "Could not generate report. Make sure the backend is running.");
    } finally {
      setLeachingLoading(false);
    }
  }


  async function downloadPDF() {
    if (!leachingReport) return;
    try {
      const html = `
        <html><head><style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; }
          h1 { color: #1b5e20; font-size: 22px; margin-bottom: 4px; }
          h2 { color: #2e7d32; font-size: 16px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 13px; }
          .high { background: #ffebee; color: #c62828; }
          .medium { background: #fff8e1; color: #f57f17; }
          .low { background: #e8f5e9; color: #2e7d32; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          td, th { padding: 8px 12px; border: 1px solid #e0e0e0; font-size: 13px; }
          th { background: #f5f5f5; font-weight: bold; }
          .rec { background: #f9f9f9; border-left: 4px solid #2e7d32; padding: 10px 14px; margin: 8px 0; border-radius: 4px; }
          .footer { margin-top: 32px; color: #888; font-size: 11px; text-align: center; }
        </style></head><body>
          <h1>🌱 CropGuard Soil Intelligence Report</h1>
          <p style="color:#666;font-size:13px;">Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Crop: ${leachingReport.inputs?.cropType ?? 'N/A'} &nbsp;|&nbsp; Soil: ${leachingReport.inputs?.soilType ?? 'N/A'}</p>
          <h2>Nutrient Leaching Risk</h2>
          <p>Risk Score: <strong>${leachingReport.riskScore}/100</strong> &nbsp; <span class="${leachingReport.riskLevel}">${leachingReport.riskLevel?.toUpperCase()}</span></p>
          <table>
            <tr><th>Nutrient</th><th>Estimated Loss</th></tr>
            <tr><td>Nitrogen (N)</td><td>${leachingReport.nitrogenLossPercent}%</td></tr>
            <tr><td>Phosphorus (P)</td><td>${leachingReport.phosphorusLossPercent}%</td></tr>
            <tr><td>Potassium (K)</td><td>${leachingReport.potassiumLossPercent}%</td></tr>
          </table>
          <h2>Weather Conditions</h2>
          <table>
            <tr><th>Parameter</th><th>Value</th></tr>
            <tr><td>Rainfall</td><td>${leachingReport.weather?.rainfall ?? 0} mm</td></tr>
            <tr><td>Temperature</td><td>${leachingReport.weather?.temperature ?? 0}°C</td></tr>
            <tr><td>Humidity</td><td>${leachingReport.weather?.humidity ?? 0}%</td></tr>
          </table>
          <h2>Recommendations</h2>
          ${(leachingReport.recommendations ?? []).map((r: any) => `<div class="rec"><strong>${r.category}</strong> [${r.priority}]<br/>${r.action}<br/><small style="color:#666">${r.detail}</small></div>`).join('')}
          <div class="footer">CropGuard AI · Soil Intelligence Report · ${new Date().getFullYear()}</div>
        </body></html>
      `;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Save Soil Report" });
      } else {
        Alert.alert("Saved", `Report saved to: ${uri}`);
      }
    } catch (e) {
      console.log("PDF error", e);
      Alert.alert("Error", "Could not generate PDF.");
    }
  }

  async function reload() {
    setNutrients([]);
    setHealthScore(0);
    setTrend([]);
    setRecommendations([]);
    try {
      const [n, h, t, r] = await Promise.all([
        getSoilNutrients(),
        getSoilHealthScore(),
        getSoilTrend(),
        getSoilRecommendations(),
      ]);
      setNutrients(n);
      setHealthScore(h.score ?? 0);
      setTrend(t);
      setRecommendations(r);
    } catch (e) {
      console.log("Soil reload error", e);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Soil Intelligence</Text>
          <Text style={styles.subtitle}>
            {soilType} · Tap nutrient to update reading
          </Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={reload}>
          <Ionicons
            name="refresh-outline"
            size={20}
            color={theme.colors.accent}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Health Score */}
        <View style={styles.scoreSection}>
          <HealthGauge score={healthScore} />
          <View style={styles.scoreMeta}>
            <Text style={styles.scoreLabel}>Overall Soil Health</Text>
            <Text style={styles.scoreSub}>{warnCount + lowCount} nutrients need attention</Text>
            <View style={styles.scoreStatusRow}>
              <StatusPill count={safeCount} label="Optimal" color="#66bb6a" />
              <StatusPill count={warnCount} label="Warning" color="#f9a825" />
              <StatusPill count={lowCount} label="Low" color="#42a5f5" />
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={runSoilTest}>
            <Ionicons name="flask-outline" size={16} color="white" />
            <Text style={styles.primaryBtnText}>Run Soil Test</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, leachingLoading && { opacity: 0.6 }]}
            onPress={generateLeachingReport}
            disabled={leachingLoading}
            activeOpacity={0.7}
          >
            {leachingLoading
              ? <ActivityIndicator size="small" color={theme.colors.accent} />
              : <Ionicons name="document-text-outline" size={16} color={theme.colors.accent} />}
            <Text style={styles.secondaryBtnText}>
              {leachingLoading ? "Generating..." : "Leaching Report"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nutrients */}
        <View style={styles.section}>
          <SectionHeader title="Nutrient Analysis" />
          {nutrients.map((n) => (
            <NutrientCard key={n.id} nutrient={n} onEdit={() => { setEditNutrient(n); setEditValue(String(n.value)); }} />
          ))}
        </View>

        {/* Trend Chart */}
        <View style={styles.section}>
          <SectionHeader title="7-Day Trend" />
          <View style={styles.chartCard}>
            <View style={styles.chartLegend}>
              <LegendItem color="#44c2a8" label="Nitrogen (N)" />
              <LegendItem color="#f9a825" label="Phosphorus (P)" />
              <LegendItem color="#42a5f5" label="Potassium (K)" />
            </View>
            <View style={styles.chartBody}>
              {trend.map((entry, i) => (
                <View key={i} style={styles.chartCol}>
                  <MiniBar value={entry.n} max={100} color="#44c2a8" />
                  <MiniBar value={entry.p} max={100} color="#f9a825" />
                  <MiniBar value={entry.k} max={100} color="#42a5f5" />
                  <Text style={styles.chartLabel}>{entry.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Recommendations */}
        <View style={styles.section}>
          <SectionHeader title="AI Recommendations" />
          <View style={styles.recCard}>
            {recommendations.map((r) => (
              <View key={r.nutrientId} style={styles.recRow}>
                <View
                  style={[
                    styles.recIcon,
                    { backgroundColor: STATUS_CONFIG[r.status as Status].bg },
                  ]}
                >
                  <Ionicons
                    name={STATUS_CONFIG[r.status as Status].icon as any}
                    size={16}
                    color={STATUS_CONFIG[r.status as Status].color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recTitle}>{r.nutrientName}</Text>
                  <Text style={styles.recAction}>{r.action}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Edit Nutrient Modal ── */}
      <Modal visible={!!editNutrient} transparent animationType="slide" onRequestClose={() => setEditNutrient(null)}>
        <Pressable style={lStyles.overlay} onPress={() => setEditNutrient(null)} />
        <View style={[lStyles.sheet, { paddingBottom: 40 }]}>
          <View style={lStyles.handle} />
          <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 4 }}>Update Reading</Text>
          <Text style={{ color: "#3d6e64", fontSize: 13, marginBottom: 16 }}>{editNutrient?.name} {editNutrient?.unit ? `(${editNutrient.unit})` : ""}</Text>
          <TextInput
            style={{ backgroundColor: "#071912", borderRadius: 12, borderWidth: 1, borderColor: "#1a4036", padding: 14, color: "white", fontSize: 22, fontWeight: "700", textAlign: "center" }}
            value={editValue}
            onChangeText={setEditValue}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
          />
          <Text style={{ color: "#3d6e64", fontSize: 11, textAlign: "center", marginTop: 8 }}>
            Range: {editNutrient?.min} – {editNutrient?.max} · Optimal: {editNutrient?.optimal}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: "#1b5e20", borderRadius: 12, paddingVertical: 14, alignItems: "center", opacity: saving ? 0.6 : 1 }}
            onPress={saveReading} disabled={saving}
          >
            {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Save Reading</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Leaching Report Modal ── */}
      <Modal visible={showLeaching} transparent animationType="slide" onRequestClose={() => setShowLeaching(false)}>
        <Pressable style={lStyles.overlay} onPress={() => setShowLeaching(false)} />
        <View style={lStyles.sheet}>
          <View style={lStyles.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {leachingReport && <LeachingReportView report={leachingReport} onClose={() => setShowLeaching(false)} onDownload={downloadPDF} />}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function HealthGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#66bb6a" : score >= 60 ? "#f9a825" : "#ef5350";
  return (
    <View style={styles.gauge}>
      <View style={[styles.gaugeRing, { borderColor: `${color}40` }]}>
        <View style={[styles.gaugeInner, { borderColor: color }]}>
          <Text style={[styles.gaugeScore, { color }]}>{score}</Text>
          <Text style={styles.gaugeUnit}>/ 100</Text>
        </View>
      </View>
    </View>
  );
}

function NutrientCard({ nutrient: n, onEdit }: { nutrient: Nutrient; onEdit: () => void }) {
  const cfg = STATUS_CONFIG[n.status];
  const pct = (n.value - n.min) / (n.max - n.min);
  const optPct = (n.optimal - n.min) / (n.max - n.min);
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: Math.max(0, Math.min(1, pct)),
      duration: 800,
      delay: 200,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={styles.nutrientCard}>
      <View style={styles.nutrientTop}>
        <View style={styles.nutrientLeft}>
          <View style={[styles.symbolBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.symbol, { color: cfg.color }]}>
              {n.symbol}
            </Text>
          </View>
          <View>
            <Text style={styles.nutrientName}>{n.name}</Text>
            <Text style={styles.nutrientValue}>
              {n.value}
              {n.unit}{" "}
              <Text style={{ color: "#3d6e64", fontWeight: "400" }}>
                ({n.min}–{n.max}
                {n.unit})
              </Text>
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{n.status}</Text>
          </View>
          <TouchableOpacity onPress={onEdit} style={{ padding: 4 }}>
            <Ionicons name="pencil-outline" size={15} color="#3d6e64" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bar */}
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: cfg.color,
              width: barAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
        {/* Optimal marker */}
        <View style={[styles.optimalMark, { left: `${optPct * 100}%` }]} />
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.barLabelText}>Min</Text>
        <Text style={styles.barLabelOptimal}>
          ▲ Optimal: {n.optimal}
          {n.unit}
        </Text>
        <Text style={styles.barLabelText}>Max</Text>
      </View>

      <Text style={styles.nutrientDesc}>{n.description}</Text>
    </View>
  );
}

function MiniBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const h = Math.round((value / max) * 80);
  return (
    <View style={[styles.miniBar, { height: h, backgroundColor: color }]} />
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <View style={[styles.statusPill, { borderColor: `${color}30` }]}>
      <Text style={[styles.statusPillCount, { color }]}>{count}</Text>
      <Text style={styles.statusPillLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

/* ── STYLES ── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: { color: "#3d6e64", fontSize: 13, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0c2b24",
    borderWidth: 1,
    borderColor: "#123a32",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  scoreSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 20,
    backgroundColor: "#0c2b24",
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#123a32",
    marginBottom: 16,
  },
  gauge: { padding: 4 },
  gaugeRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeScore: { fontSize: 26, fontWeight: "900" },
  gaugeUnit: { color: "#3d6e64", fontSize: 10 },
  scoreMeta: { flex: 1 },
  scoreLabel: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  scoreSub: { color: "#3d6e64", fontSize: 12, marginTop: 2, marginBottom: 8 },
  scoreStatusRow: { flexDirection: "row", gap: 6 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#0a2018",
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillCount: { fontSize: 13, fontWeight: "800" },
  statusPillLabel: { color: "#3d6e64", fontSize: 10, fontWeight: "600" },

  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#1b5e20",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2E7D32",
  },
  primaryBtnText: { color: "white", fontWeight: "700", fontSize: 14 },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0c2b24",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#123a32",
  },
  secondaryBtnText: {
    color: theme.colors.accent,
    fontWeight: "700",
    fontSize: 14,
  },

  section: { paddingHorizontal: 20, marginBottom: 8 },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 12,
  },

  nutrientCard: {
    backgroundColor: "#0c2b24",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#123a32",
    padding: 16,
    marginBottom: 10,
  },
  nutrientTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  nutrientLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  symbolBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  symbol: { fontSize: 18, fontWeight: "900" },
  nutrientName: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  nutrientValue: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  barTrack: {
    height: 8,
    backgroundColor: "#1a3d35",
    borderRadius: 4,
    overflow: "visible",
    marginBottom: 4,
    position: "relative",
  },
  barFill: { height: "100%", borderRadius: 4 },
  optimalMark: {
    position: "absolute",
    top: -3,
    width: 2,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderRadius: 1,
  },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  barLabelText: { color: "#2d5a52", fontSize: 9 },
  barLabelOptimal: { color: "rgba(255,255,255,0.3)", fontSize: 9 },
  nutrientDesc: { color: "#5a7a72", fontSize: 12, lineHeight: 17 },

  chartCard: {
    backgroundColor: "#0c2b24",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#123a32",
    padding: 16,
    marginBottom: 10,
  },
  chartLegend: { flexDirection: "row", gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: "#5a8a82", fontSize: 11 },
  chartBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 100,
  },
  chartCol: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    justifyContent: "flex-end",
  },
  miniBar: { width: 8, borderRadius: 4 },
  chartLabel: { color: "#2d5a52", fontSize: 9, marginTop: 6 },

  recCard: {
    backgroundColor: "#0c2b24",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#123a32",
    padding: 4,
  },
  recRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#0f2e28",
  },
  recIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  recTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  recAction: { color: "#5a7a72", fontSize: 12, lineHeight: 17 },
});

// ─── Leaching Report Component ────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  high: "#ef5350",
  medium: "#f9a825",
  low: "#66bb6a",
};

const RISK_BG: Record<string, string> = {
  high: "#3a0f0f",
  medium: "#2e250f",
  low: "#0f2e14",
};

function LeachingReportView({ report, onClose, onDownload }: { report: any; onClose: () => void; onDownload: () => void }) {
  const riskColor = RISK_COLOR[report.riskLevel] ?? "#66bb6a";
  const riskBg    = RISK_BG[report.riskLevel]    ?? "#0f2e14";

  return (
    <View style={lStyles.container}>
      {/* Title */}
      <View style={lStyles.titleRow}>
        <View>
          <Text style={lStyles.title}>Leaching Report</Text>
          <Text style={lStyles.subtitle}>{report.inputs?.cropType} · {report.inputs?.soilType} · {report.inputs?.season}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            onPress={onDownload}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(68,194,168,0.12)", borderWidth: 1, borderColor: "rgba(68,194,168,0.3)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 }}
          >
            <Ionicons name="download-outline" size={16} color="#44c2a8" />
            <Text style={{ color: "#44c2a8", fontSize: 12, fontWeight: "700" }}>Download PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={26} color="#3d6e64" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Risk Score Card */}
      <View style={[lStyles.riskCard, { backgroundColor: riskBg, borderColor: `${riskColor}40` }]}>
        <View style={lStyles.riskLeft}>
          <Text style={[lStyles.riskLevel, { color: riskColor }]}>{report.riskLevel.toUpperCase()} RISK</Text>
          <Text style={lStyles.riskScore}>{report.riskScore}<Text style={lStyles.riskScoreUnit}>/100</Text></Text>
          <Text style={lStyles.riskDesc}>Nutrient Leaching Risk Score</Text>
        </View>
        <View style={lStyles.riskRight}>
          <Ionicons name={report.riskLevel === "high" ? "warning" : report.riskLevel === "medium" ? "alert-circle" : "checkmark-circle"} size={52} color={`${riskColor}66`} />
        </View>
      </View>

      {/* Nutrient Loss Estimates */}
      <Text style={lStyles.sectionTitle}>Estimated Nutrient Loss</Text>
      <View style={lStyles.lossRow}>
        <LossCard label="Nitrogen (N)" value={report.nitrogenLossPercent} color="#44c2a8" />
        <LossCard label="Phosphorus (P)" value={report.phosphorusLossPercent} color="#f9a825" />
        <LossCard label="Potassium (K)" value={report.potassiumLossPercent} color="#42a5f5" />
      </View>

      {/* Live Weather */}
      <Text style={lStyles.sectionTitle}>Live Weather Used</Text>
      <View style={lStyles.weatherRow}>
        <WeatherChip icon="rainy" label="Rainfall" value={`${report.weather?.rainfall ?? 0} mm`} />
        <WeatherChip icon="thermometer" label="Temp" value={`${Math.round(report.weather?.temperature ?? 0)}°C`} />
        <WeatherChip icon="water" label="Humidity" value={`${report.weather?.humidity ?? 0}%`} />
      </View>

      {/* Contributing Factors */}
      <Text style={lStyles.sectionTitle}>Contributing Factors</Text>
      <View style={lStyles.factorsCard}>
        {report.factors && Object.entries(report.factors).filter(([k]) => k !== "corrections").map(([key, val]: any) => (
          <View key={key} style={lStyles.factorRow}>
            <View style={lStyles.factorLeft}>
              <Text style={lStyles.factorName}>{key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase())}</Text>
              <Text style={lStyles.factorValue}>{val.value}</Text>
            </View>
            <View style={lStyles.factorRight}>
              <View style={lStyles.factorBar}>
                <View style={[lStyles.factorFill, { width: `${Math.round(val.factor * 100)}%`, backgroundColor: val.factor >= 0.7 ? "#ef5350" : val.factor >= 0.4 ? "#f9a825" : "#66bb6a" }]} />
              </View>
              <Text style={lStyles.factorWeight}>{val.weight}</Text>
            </View>
          </View>
        ))}
        {report.factors?.corrections && (
          <View style={lStyles.correctionRow}>
            <Ionicons name="thermometer" size={12} color="#3d6e64" />
            <Text style={lStyles.correctionText}>Temp: {report.factors.corrections.temperature} · Humidity: {report.factors.corrections.humidity} · Season: {report.factors.corrections.season}</Text>
          </View>
        )}
      </View>

      {/* Recommendations */}
      <Text style={lStyles.sectionTitle}>Recommendations</Text>
      {(report.recommendations ?? []).map((rec: any, i: number) => {
        const pColor = rec.priority === "Urgent" ? "#ef5350" : rec.priority === "High" ? "#ff8a65" : rec.priority === "Medium" ? "#f9a825" : "#66bb6a";
        return (
          <View key={i} style={lStyles.recCard}>
            <View style={lStyles.recHeader}>
              <View style={[lStyles.recIcon, { backgroundColor: `${pColor}18` }]}>
                <Ionicons name={rec.icon as any} size={16} color={pColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={lStyles.recCategory}>{rec.category}</Text>
                <View style={[lStyles.priorityBadge, { backgroundColor: `${pColor}18` }]}>
                  <Text style={[lStyles.priorityText, { color: pColor }]}>{rec.priority}</Text>
                </View>
              </View>
            </View>
            <Text style={lStyles.recAction}>{rec.action}</Text>
            <Text style={lStyles.recDetail}>{rec.detail}</Text>
          </View>
        );
      })}

      <Text style={lStyles.generatedAt}>Generated: {new Date(report.generatedAt).toLocaleString()}</Text>
      <View style={{ height: 40 }} />
    </View>
  );
}

function LossCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[lStyles.lossCard, { borderColor: `${color}30` }]}>
      <Text style={[lStyles.lossValue, { color }]}>{value}%</Text>
      <Text style={lStyles.lossLabel}>{label}</Text>
    </View>
  );
}

function WeatherChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={lStyles.weatherChip}>
      <Ionicons name={icon as any} size={14} color={theme.colors.accent} />
      <Text style={lStyles.weatherValue}>{value}</Text>
      <Text style={lStyles.weatherLabel}>{label}</Text>
    </View>
  );
}

// ─── Leaching Modal Styles ────────────────────────────────────────────────────

const lStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#061c17", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "92%", borderWidth: 1, borderColor: "#1a4036",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#1a4036", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  container: { padding: 20 },

  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { color: theme.colors.text, fontSize: 20, fontWeight: "800" },
  subtitle: { color: "#3d6e64", fontSize: 12, marginTop: 2 },

  riskCard: {
    flexDirection: "row", borderRadius: 18, borderWidth: 1,
    padding: 18, marginBottom: 20, alignItems: "center",
  },
  riskLeft: { flex: 1 },
  riskLevel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
  riskScore: { fontSize: 48, fontWeight: "900", color: "white", lineHeight: 52 },
  riskScoreUnit: { fontSize: 18, fontWeight: "400", color: "#5a8a82" },
  riskDesc: { color: "#5a8a82", fontSize: 12, marginTop: 4 },
  riskRight: { paddingLeft: 12 },

  sectionTitle: { color: theme.colors.text, fontSize: 14, fontWeight: "700", marginBottom: 10, marginTop: 4 },

  lossRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  lossCard: {
    flex: 1, backgroundColor: "#0c2b24", borderRadius: 14, borderWidth: 1,
    padding: 12, alignItems: "center",
  },
  lossValue: { fontSize: 22, fontWeight: "900" },
  lossLabel: { color: "#3d6e64", fontSize: 9, fontWeight: "600", textAlign: "center", marginTop: 3 },

  weatherRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  weatherChip: {
    flex: 1, backgroundColor: "#0c2b24", borderRadius: 12, borderWidth: 1,
    borderColor: "#123a32", padding: 10, alignItems: "center", gap: 3,
  },
  weatherValue: { color: "white", fontSize: 13, fontWeight: "700" },
  weatherLabel: { color: "#3d6e64", fontSize: 9 },

  factorsCard: { backgroundColor: "#0c2b24", borderRadius: 16, borderWidth: 1, borderColor: "#123a32", padding: 14, marginBottom: 16 },
  factorRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  factorLeft: { width: 120 },
  factorName: { color: theme.colors.text, fontSize: 12, fontWeight: "600" },
  factorValue: { color: "#3d6e64", fontSize: 10, marginTop: 1 },
  factorRight: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  factorBar: { flex: 1, height: 6, backgroundColor: "#1a3d35", borderRadius: 3, overflow: "hidden" },
  factorFill: { height: "100%", borderRadius: 3 },
  factorWeight: { color: "#3d6e64", fontSize: 10, width: 28, textAlign: "right" },
  correctionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#0f2e28" },
  correctionText: { color: "#3d6e64", fontSize: 10, flex: 1 },

  recCard: { backgroundColor: "#0c2b24", borderRadius: 14, borderWidth: 1, borderColor: "#123a32", padding: 14, marginBottom: 10 },
  recHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  recIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  recCategory: { color: theme.colors.text, fontSize: 13, fontWeight: "700", marginBottom: 4 },
  priorityBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  priorityText: { fontSize: 10, fontWeight: "800" },
  recAction: { color: "#9fbdb5", fontSize: 13, lineHeight: 18, marginBottom: 4 },
  recDetail: { color: "#5a7a72", fontSize: 11, lineHeight: 16 },

  generatedAt: { color: "#1a4036", fontSize: 10, textAlign: "center", marginTop: 8 },
});

import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import WebView from "react-native-webview";
import { api } from "../../services/api";
import { getDiseaseZones } from "../../services/diseaseZones";
import { theme } from "../../theme";

type Severity = "low" | "moderate" | "high" | "critical";

interface DiseaseZone {
  id: string;
  disease: string;
  risk?: string;
  severity?: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lastUpdated?: string;
  cases?: number;
  pathogen?: string;
  trend?: string;
}

const SEV_COLOR: Record<Severity, string> = {
  low: "#66bb6a", moderate: "#f9a825", high: "#ff8a65", critical: "#ef5350",
};
const SEVERITY_OPTIONS: Severity[] = ["low", "moderate", "high", "critical"];

const DEFAULT_LAT = 12.9716;
const DEFAULT_LON = 77.5946;
const OFFSETS = [
  { lat: 12.9716, lon: 77.5946 }, { lat: 13.0200, lon: 77.6500 },
  { lat: 12.9200, lon: 77.5200 }, { lat: 13.0500, lon: 77.5400 },
  { lat: 12.8800, lon: 77.6200 }, { lat: 13.0800, lon: 77.7000 },
  { lat: 12.9400, lon: 77.7200 }, { lat: 12.8500, lon: 77.5000 },
];

function getSeverity(z: DiseaseZone): Severity {
  const r = (z.severity ?? z.risk ?? "low").toLowerCase();
  if (r === "critical") return "critical";
  if (r === "high") return "high";
  if (r === "moderate" || r === "medium") return "moderate";
  return "low";
}


function LeafletMap({ zones, userLat, userLon }: { zones: DiseaseZone[]; userLat: number; userLon: number }) {
  const markers = zones.map((z) => ({
    lat: z.latitude ?? userLat + (Math.random() - 0.5) * 0.1,
    lon: z.longitude ?? userLon + (Math.random() - 0.5) * 0.1,
    color: SEV_COLOR[getSeverity(z)],
    label: z.disease,
    severity: getSeverity(z),
    cases: z.cases ?? 1,
  }));

  const html = `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>html,body,#map{height:100%;margin:0;padding:0;background:#071912;}</style>
  </head><body><div id="map"></div><script>
  var map = L.map('map', {zoomControl:true}).setView([${userLat},${userLon}], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'© OpenStreetMap', maxZoom:18
  }).addTo(map);
  // User location
  L.circleMarker([${userLat},${userLon}],{radius:8,color:'#44c2a8',fillColor:'#44c2a8',fillOpacity:0.9}).addTo(map).bindPopup('Your Location');
  // Disease zones
  var zones = ${JSON.stringify(markers)};
  zones.forEach(function(z){
    var r = z.severity==='critical'?28:z.severity==='high'?22:z.severity==='moderate'?16:12;
    L.circle([z.lat,z.lon],{radius:r*100,color:z.color,fillColor:z.color,fillOpacity:0.25,weight:2}).addTo(map)
      .bindPopup('<b>'+z.label+'</b><br>Severity: '+z.severity.toUpperCase()+'<br>Cases: '+z.cases);
    L.circleMarker([z.lat,z.lon],{radius:6,color:z.color,fillColor:z.color,fillOpacity:1}).addTo(map);
  });
  </script></body></html>`;

  return <WebView source={{ html }} style={{ flex: 1 }} scrollEnabled={false} />;
}

export default function Heatmap() {
  const [zones, setZones] = useState<DiseaseZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
  const [pinLoc, setPinLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formDisease, setFormDisease] = useState("");
  const [formSeverity, setFormSeverity] = useState<Severity>("low");
  const [formDesc, setFormDesc] = useState("");

  useEffect(() => {
    fetchZones();
    requestLocation();
  }, []);

  async function fetchZones() {
    setLoading(true);
    try {
      const data = await getDiseaseZones();
      setZones(Array.isArray(data) ? data : []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  }

  async function requestLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setUserLoc({ lat: loc.coords.latitude, lon: loc.coords.longitude });
    } catch (e) { console.log(e); }
  }


  async function submitZone() {
    if (!formDisease.trim()) { Alert.alert("Required", "Enter a disease name."); return; }
    setSubmitting(true);
    try {
      const lat = pinLoc?.lat ?? userLoc.lat;
      const lon = pinLoc?.lon ?? userLoc.lon;
      await api.post("/disease-zones", {
        disease: formDisease.trim(), severity: formSeverity,
        description: formDesc.trim() || null, latitude: lat, longitude: lon,
      });
      closeForm();
      await fetchZones();
      Alert.alert("✅ Reported", "Disease zone added to the map.");
    } catch { Alert.alert("Error", "Could not submit. Check connection."); }
    finally { setSubmitting(false); }
  }

  function closeForm() {
    setShowForm(false); setFormDisease(""); setFormSeverity("low");
    setFormDesc(""); setPinLoc(null);
  }


  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>DISEASE MONITORING</Text>
          <Text style={styles.title}>Disease Heatmap</Text>
          <Text style={styles.subtitle}>
            {loading ? "Loading zones..." : `${zones.length} zones · Tap map to report`}
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.iconBtn} onPress={requestLocation}>
            <Ionicons name="locate" size={18} color={theme.colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={fetchZones} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color={theme.colors.accent} />
              : <Ionicons name="refresh" size={18} color={theme.colors.accent} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Leaflet Map */}
      <View style={styles.mapWrap}>
        <LeafletMap zones={zones} userLat={userLoc.lat} userLon={userLoc.lon} />
        {/* Legend */}
        <View style={styles.legend}>
          {(["critical", "high", "moderate", "low"] as Severity[]).map((s) => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: SEV_COLOR[s] }]} />
              <Text style={styles.legendText}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.tapHint} onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle-outline" size={12} color="#9fbdb5" />
          <Text style={styles.tapHintText}>Report a zone</Text>
        </TouchableOpacity>
      </View>

      {/* Zone list */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Active Zones</Text>
        <Text style={styles.listCount}>{zones.length}</Text>
      </View>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {zones.length === 0 && !loading && (
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={36} color="#1a4036" />
            <Text style={styles.emptyText}>No zones reported yet</Text>
            <Text style={styles.emptySub}>Tap anywhere on the map to report one</Text>
          </View>
        )}
        {zones.map((zone) => {
          const color = SEV_COLOR[getSeverity(zone) as Severity];
          return (
            <View key={zone.id} style={[styles.zoneRow, { borderLeftColor: color }]}>
              <View style={[styles.zoneDot, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.zoneDisease}>{zone.disease}</Text>
                <Text style={styles.zoneMeta}>
                  {zone.cases ? `${zone.cases} cases · ` : ""}
                  {zone.trend ? `${zone.trend} · ` : ""}
                  {zone.lastUpdated ?? ""}
                </Text>
              </View>
              <View style={[styles.sevChip, { backgroundColor: `${color}18` }]}>
                <Text style={[styles.sevChipText, { color }]}>{getSeverity(zone).toUpperCase()}</Text>
              </View>
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Report Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.overlay} onPress={closeForm} />
          <View style={styles.modalCard}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>Report Disease Zone</Text>
            <Text style={styles.modalSub}>
              {pinLoc
                ? `📍 ${pinLoc.lat.toFixed(5)}, ${pinLoc.lon.toFixed(5)}`
                : "📍 Using your current location"}
            </Text>

            <Text style={styles.fieldLabel}>Disease Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Late Blight, Powdery Mildew"
              placeholderTextColor="#3d6e64"
              value={formDisease}
              onChangeText={setFormDisease}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Severity *</Text>
            <View style={styles.sevRow}>
              {SEVERITY_OPTIONS.map((s) => {
                const active = formSeverity === s;
                const c = SEV_COLOR[s];
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sevBtn, active && { backgroundColor: `${c}18`, borderColor: c }]}
                    onPress={() => setFormSeverity(s)}
                  >
                    <Text style={[styles.sevBtnText, active && { color: c }]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 64, textAlignVertical: "top" }]}
              placeholder="Symptoms, affected area..."
              placeholderTextColor="#3d6e64"
              value={formDesc}
              onChangeText={setFormDesc}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeForm}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submitZone}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="white" />
                  : <Text style={styles.submitText}>Submit Report</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingTop: Platform.OS === "ios" ? 56 : 44, paddingHorizontal: 20, paddingBottom: 10,
  },
  headerLabel: { color: theme.colors.accent, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 2 },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#3d6e64", fontSize: 11, marginTop: 2 },
  headerBtns: { flexDirection: "row", gap: 8, marginTop: 4 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: "#0c2b24",
    borderWidth: 1, borderColor: "#123a32", alignItems: "center", justifyContent: "center",
  },

  mapWrap: { height: 320, position: "relative" },

  legend: {
    position: "absolute", bottom: 10, left: 10,
    backgroundColor: "rgba(6,28,23,0.9)", borderRadius: 10, padding: 8,
    flexDirection: "row", gap: 10, borderWidth: 1, borderColor: "#1a4036",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: "#9fbdb5", fontSize: 10, fontWeight: "600" },

  tapHint: {
    position: "absolute", bottom: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(6,28,23,0.9)", borderRadius: 10, padding: 8,
    borderWidth: 1, borderColor: "#1a4036",
  },
  tapHintText: { color: "#9fbdb5", fontSize: 10 },

  listHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "#0f2e28",
  },
  listTitle: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  listCount: {
    color: theme.colors.accent, fontSize: 12, fontWeight: "700",
    backgroundColor: "rgba(68,194,168,0.1)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  list: { flex: 1 },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { color: "#3d6e64", fontSize: 14, fontWeight: "600" },
  emptySub: { color: "#1a4036", fontSize: 12 },

  zoneRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#0a2420", borderLeftWidth: 3,
  },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneDisease: { color: theme.colors.text, fontSize: 13, fontWeight: "700" },
  zoneMeta: { color: "#3d6e64", fontSize: 11, marginTop: 1 },
  sevChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sevChipText: { fontSize: 9, fontWeight: "800" },

  modalWrap: { flex: 1, justifyContent: "flex-end" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  modalCard: {
    backgroundColor: "#0c2b24", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderWidth: 1, borderColor: "#1a4036",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#1a4036", alignSelf: "center", marginBottom: 16 },
  modalTitle: { color: theme.colors.text, fontSize: 20, fontWeight: "800", marginBottom: 4 },
  modalSub: { color: "#3d6e64", fontSize: 12, marginBottom: 14 },
  fieldLabel: { color: "#9fbdb5", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: "#071912", borderRadius: 12, borderWidth: 1,
    borderColor: "#1a4036", padding: 12, color: "white", fontSize: 14,
  },
  sevRow: { flexDirection: "row", gap: 8 },
  sevBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
    borderColor: "#1a4036", backgroundColor: "#071912", alignItems: "center",
  },
  sevBtnText: { color: "#3d6e64", fontSize: 11, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: "#1a4036", alignItems: "center",
  },
  cancelText: { color: "#3d6e64", fontWeight: "700" },
  submitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32", alignItems: "center",
  },
  submitText: { color: "white", fontWeight: "700", fontSize: 15 },
});

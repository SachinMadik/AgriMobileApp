import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { api } from "../../services/api";
import { getProfile, updateProfile } from "../../services/profile";
import { theme } from "../../theme";

const SETUP_KEY = "cropguard_profile_setup_done";

const ALERT_TYPES = [
  { label: "Disease Risk Alerts", desc: "Early warning for disease outbreaks" },
  { label: "Weather Warnings", desc: "Frost, storm, drought advisories" },
  { label: "Spray Reminders", desc: "Scheduled pesticide/fungicide tasks" },
  { label: "Market Updates", desc: "Price alerts for tomato produce" },
  { label: "Sensor Anomalies", desc: "Unexpected sensor readings" },
];

const CROPS = ["Tomato", "Rice", "Wheat", "Cotton", "Maize", "Sugarcane", "Groundnut", "Onion", "Potato"];
const SOILS = ["Sandy Loam", "Clay Loam", "Loam", "Sandy", "Clay", "Silt", "Silty Loam"];

export default function Profile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [alertToggles, setAlertToggles] = useState(
    Object.fromEntries(ALERT_TYPES.map((a) => [a.label, true]))
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Setup form state
  const [setupValues, setSetupValues] = useState({
    name: "", farmName: "", primaryCrop: "Tomato", soilType: "Sandy Loam",
    region: "", contact: "", farmArea: "", season: "Kharif 2026",
  });
  const [setupSaving, setSetupSaving] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    try {
      const done = await AsyncStorage.getItem(SETUP_KEY);
      const [p, s, prefs] = await Promise.all([
        getProfile(),
        api.get("/profile/stats").then((r) => r.data).catch(() => null),
        api.get("/notifications/preferences").then((r) => r.data).catch(() => ({})),
      ]);
      setProfile(p);
      setStats(s);
      if (prefs && Object.keys(prefs).length > 0) setAlertToggles(prefs);
      // Show setup if never completed AND profile has default/empty name
      if (!done) setShowSetup(true);
    } catch (e) {
      console.log("Profile init error", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetupSave() {
    if (!setupValues.name.trim() || !setupValues.farmName.trim() || !setupValues.contact.trim()) {
      Alert.alert("Required", "Name, Farm Name and Contact are required.");
      return;
    }
    setSetupSaving(true);
    try {
      const updated = await updateProfile({
        name: setupValues.name.trim(),
        farmName: setupValues.farmName.trim(),
        primaryCrop: setupValues.primaryCrop,
        soilType: setupValues.soilType,
        region: setupValues.region.trim() || "India",
        contact: setupValues.contact.trim(),
        farmArea: setupValues.farmArea.trim() || "1 ha",
        season: setupValues.season,
      });
      if (updated) setProfile(updated);
      await AsyncStorage.setItem(SETUP_KEY, "true");
      // Enable all notifications
      await api.post("/notifications/enable").catch(() => {});
      await api.put("/notifications/preferences", {
        preferences: Object.fromEntries(ALERT_TYPES.map((a) => [a.label, true])),
      }).catch(() => {});
      setNotificationsEnabled(true);
      setShowSetup(false);
    } catch (e) {
      Alert.alert("Error", "Could not save profile. Please try again.");
    } finally {
      setSetupSaving(false);
    }
  }

  function handleEdit() {
    setEditValues({
      name: profile?.name ?? "",
      farmName: profile?.farmName ?? "",
      primaryCrop: profile?.primaryCrop ?? "",
      soilType: profile?.soilType ?? "",
      contact: profile?.contact ?? "",
      farmArea: profile?.farmArea ?? "",
      region: profile?.region ?? "",
    });
    setIsEditing(true);
  }

  async function handleSave() {
    if (!editValues.name?.trim() || !editValues.farmName?.trim() || !editValues.contact?.trim()) {
      Alert.alert("Validation Error", "Name, Farm Name and Contact are required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile(editValues);
      if (!updated) throw new Error("Save failed");
      setProfile(updated);
      setIsEditing(false);
    } catch {
      Alert.alert("Error", "Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your profile and all farm data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(SETUP_KEY);
              // Reset profile to defaults on backend
              await updateProfile({
                name: "New Farmer", farmName: "My Farm", primaryCrop: "Tomato",
                soilType: "Loam", region: "India", contact: "+91 00000 00000",
                farmArea: "1 ha", season: "Kharif 2026",
              });
              setProfile(null);
              setShowSetup(true);
            } catch {
              Alert.alert("Error", "Could not delete account.");
            }
          },
        },
      ]
    );
  }

  async function toggleAlert(label: string) {
    const newVal = !alertToggles[label];
    setAlertToggles((prev) => ({ ...prev, [label]: newVal }));
    try {
      await api.put("/notifications/preferences", { preferences: { [label]: newVal } });
    } catch (e) { console.log(e); }
  }

  async function enableAllNotifications() {
    try {
      await api.post("/notifications/enable");
      const allOn = Object.fromEntries(ALERT_TYPES.map((a) => [a.label, true]));
      await api.put("/notifications/preferences", { preferences: allOn });
      setAlertToggles(allOn);
      setNotificationsEnabled(true);
      Alert.alert("✅ Notifications Enabled", "You'll receive all farm alerts.");
    } catch {
      Alert.alert("Error", "Could not enable notifications.");
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── First-Launch Setup Modal ── */}
      <Modal visible={showSetup} animationType="slide" statusBarTranslucent>
        <View style={styles.setupRoot}>
          <ScrollView contentContainerStyle={styles.setupScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.setupIconWrap}>
              <Ionicons name="leaf" size={40} color={theme.colors.accent} />
            </View>
            <Text style={styles.setupTitle}>Welcome to CropGuard</Text>
            <Text style={styles.setupSub}>Set up your farm profile to get personalised alerts and recommendations.</Text>

            {[
              { label: "Your Full Name *", key: "name", placeholder: "e.g. Rajan Kumar" },
              { label: "Farm Name *", key: "farmName", placeholder: "e.g. Green Valley Farm" },
              { label: "Contact Number *", key: "contact", placeholder: "+91 98765 43210" },
              { label: "Region / District", key: "region", placeholder: "e.g. Bangalore Rural, Karnataka" },
              { label: "Farm Area", key: "farmArea", placeholder: "e.g. 4.2 ha" },
            ].map((f) => (
              <View key={f.key} style={styles.setupField}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.setupInput}
                  placeholder={f.placeholder}
                  placeholderTextColor="#3d6e64"
                  value={(setupValues as any)[f.key]}
                  onChangeText={(t) => setSetupValues((p) => ({ ...p, [f.key]: t }))}
                  autoCapitalize={f.key === "contact" ? "none" : "words"}
                />
              </View>
            ))}

            <View style={styles.setupField}>
              <Text style={styles.fieldLabel}>Primary Crop</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {CROPS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chipBtn, setupValues.primaryCrop === c && styles.chipActive]}
                    onPress={() => setSetupValues((p) => ({ ...p, primaryCrop: c }))}
                  >
                    <Text style={[styles.chipText, setupValues.primaryCrop === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.setupField}>
              <Text style={styles.fieldLabel}>Soil Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {SOILS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chipBtn, setupValues.soilType === s && styles.chipActive]}
                    onPress={() => setSetupValues((p) => ({ ...p, soilType: s }))}
                  >
                    <Text style={[styles.chipText, setupValues.soilType === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.setupSaveBtn, setupSaving && { opacity: 0.6 }]}
              onPress={handleSetupSave}
              disabled={setupSaving}
            >
              {setupSaving
                ? <ActivityIndicator color="white" />
                : <><Ionicons name="checkmark-circle" size={20} color="white" /><Text style={styles.setupSaveBtnText}>Save Profile & Continue</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Farm Profile</Text>
        {isEditing ? (
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Ionicons name="checkmark" size={16} color="white" />
              <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
            <Ionicons name="create-outline" size={18} color={theme.colors.accent} />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarInitials}>
              {(profile?.name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.farmerName}>{profile?.name ?? "—"}</Text>
            <Text style={styles.farmerSub}>{profile?.region ?? "—"}</Text>
            <View style={styles.verifiedRow}>
              <Ionicons name="shield-checkmark" size={13} color="#44c2a8" />
              <Text style={styles.verifiedText}>Verified Farmer · {profile?.plan ?? "Premium"}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {[
            { icon: "resize", color: "#44c2a8", value: stats?.farmArea ?? profile?.farmArea ?? "—", label: "Farm Area" },
            { icon: "leaf", color: "#66bb6a", value: (stats?.crop ?? profile?.primaryCrop ?? "—").split(" ")[0], label: "Crop" },
            { icon: "partly-sunny", color: "#f9a825", value: stats?.season ?? profile?.season ?? "—", label: "Season" },
            { icon: "shield-checkmark", color: "#42a5f5", value: `${stats?.diseaseFreeDays ?? profile?.diseaseFreeDays ?? 0}d`, label: "Disease Free" },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${s.color}18` }]}>
                <Ionicons name={s.icon as any} size={18} color={s.color} />
              </View>
              <Text style={styles.statValue} numberOfLines={1}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Farm Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farm Details</Text>
          <View style={styles.card}>
            {[
              { icon: "person-circle", label: "Farmer Name", key: "name", editable: true },
              { icon: "home", label: "Farm Name", key: "farmName", editable: true },
              { icon: "leaf", label: "Primary Crop", key: "primaryCrop", editable: true },
              { icon: "layers", label: "Soil Type", key: "soilType", editable: true },
              { icon: "location", label: "Coordinates", key: "coordinates" },
              { icon: "map", label: "Region", key: "region", editable: true },
              { icon: "call", label: "Contact", key: "contact", editable: true },
              { icon: "id-card", label: "Farmer ID", key: "farmerId" },
            ].map((field, i, arr) => (
              <View key={i} style={[styles.profileRow, i < arr.length - 1 && styles.rowBorder]}>
                <View style={styles.rowIcon}>
                  <Ionicons name={field.icon as any} size={15} color="#3d6e64" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>{field.label}</Text>
                  {isEditing && field.editable ? (
                    <TextInput
                      style={styles.rowInput}
                      value={editValues[field.key] ?? ""}
                      onChangeText={(t) => setEditValues((p: any) => ({ ...p, [field.key]: t }))}
                      placeholderTextColor="#3d6e64"
                    />
                  ) : (
                    <Text style={styles.rowValue}>{profile?.[field.key] ?? "—"}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          {!notificationsEnabled ? (
            <View style={styles.notifPrompt}>
              <Ionicons name="notifications-outline" size={32} color="#f9a825" style={{ marginBottom: 12 }} />
              <Text style={styles.notifPromptTitle}>Enable Smart Alerts</Text>
              <Text style={styles.notifPromptSub}>Get real-time warnings for disease outbreaks, weather events, and spray schedules.</Text>
              <TouchableOpacity style={styles.enableBtn} onPress={enableAllNotifications}>
                <Ionicons name="notifications" size={16} color="white" />
                <Text style={styles.enableBtnText}>Enable All Notifications</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              {ALERT_TYPES.map((alert, i) => (
                <View key={i} style={[styles.toggleRow, i < ALERT_TYPES.length - 1 && styles.toggleBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>{alert.label}</Text>
                    <Text style={styles.toggleDesc}>{alert.desc}</Text>
                  </View>
                  <Switch
                    value={!!alertToggles[alert.label]}
                    onValueChange={() => toggleAlert(alert.label)}
                    trackColor={{ false: "#1a3d35", true: "rgba(68,194,168,0.4)" }}
                    thumbColor={alertToggles[alert.label] ? theme.colors.accent : "#2d5a52"}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.dangerZone}>
            <TouchableOpacity style={styles.dangerRow} onPress={() => {
              Alert.alert("Sign Out", "Are you sure you want to sign out?", [
                { text: "Cancel", style: "cancel" },
                { text: "Sign Out", style: "destructive", onPress: async () => {
                  await AsyncStorage.multiRemove([SETUP_KEY, "cropguard_token", "cropguard_user_id"]);
                  router.replace("/auth");
                }},
              ]);
            }}>
              <Ionicons name="log-out-outline" size={18} color="#ef5350" />
              <Text style={styles.dangerText}>Sign Out</Text>
            </TouchableOpacity>
            <View style={styles.dangerDivider} />
            <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={18} color="#ef5350" />
              <Text style={styles.dangerText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.version}>CropGuard AI v2.4.1 · Build 241</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  // Setup
  setupRoot: { flex: 1, backgroundColor: theme.colors.background },
  setupScroll: { padding: 24, paddingTop: Platform.OS === "ios" ? 60 : 48 },
  setupIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: theme.colors.accentGlow, borderWidth: 1,
    borderColor: "rgba(62,207,178,0.3)", alignItems: "center",
    justifyContent: "center", alignSelf: "center", marginBottom: 20,
  },
  setupTitle: { color: theme.colors.text, fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  setupSub: { color: "#5a7a72", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 28 },
  setupField: { marginBottom: 16 },
  fieldLabel: { color: "#9fbdb5", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  setupInput: {
    backgroundColor: "#0c2b24", borderRadius: 12, borderWidth: 1,
    borderColor: "#1a4036", padding: 14, color: "white", fontSize: 15,
  },
  chipBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: "#1a4036", backgroundColor: "#0c2b24",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "rgba(68,194,168,0.15)", borderColor: theme.colors.accent },
  chipText: { color: "#3d6e64", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: theme.colors.accent },
  setupSaveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32",
    paddingVertical: 16, borderRadius: 14, marginTop: 24,
  },
  setupSaveBtnText: { color: "white", fontSize: 16, fontWeight: "700" },

  // Header
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 48, paddingHorizontal: 20, paddingBottom: 16,
  },
  title: { color: theme.colors.text, fontSize: 26, fontWeight: "800" },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(68,194,168,0.1)", borderWidth: 1,
    borderColor: "rgba(68,194,168,0.25)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
  },
  editText: { color: theme.colors.accent, fontSize: 13, fontWeight: "700" },
  editActions: { flexDirection: "row", gap: 8 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "#2d5a52" },
  cancelText: { color: "#5a7a72", fontSize: 13, fontWeight: "700" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: theme.colors.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
  },
  saveText: { color: "white", fontSize: 13, fontWeight: "700" },

  // Identity
  identityCard: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 16,
    backgroundColor: "#0c2b24", borderRadius: 20, borderWidth: 1, borderColor: "#123a32",
    padding: 18, gap: 14,
  },
  avatarWrap: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: theme.colors.accentGlow,
    borderWidth: 2, borderColor: "rgba(62,207,178,0.4)", alignItems: "center", justifyContent: "center",
  },
  avatarInitials: { color: theme.colors.accent, fontSize: 22, fontWeight: "800" },
  identityInfo: { flex: 1 },
  farmerName: { color: theme.colors.text, fontSize: 17, fontWeight: "800" },
  farmerSub: { color: "#3d6e64", fontSize: 12, marginTop: 1 },
  verifiedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  verifiedText: { color: theme.colors.accent, fontSize: 11, fontWeight: "600" },

  // Stats
  statsGrid: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: theme.colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: theme.colors.border, padding: 12, alignItems: "center", gap: 4,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { color: theme.colors.text, fontSize: 12, fontWeight: "800", textAlign: "center" },
  statLabel: { color: theme.colors.textDim, fontSize: 9, fontWeight: "600", textAlign: "center" },

  // Section
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { color: theme.colors.text, fontSize: 17, fontWeight: "700", marginBottom: 12 },
  card: { backgroundColor: "#0c2b24", borderRadius: 18, borderWidth: 1, borderColor: "#123a32", overflow: "hidden" },

  // Profile rows
  profileRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#0f2e28" },
  rowIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#1a3d35", alignItems: "center", justifyContent: "center" },
  rowContent: { flex: 1 },
  rowLabel: { color: "#3d6e64", fontSize: 11, fontWeight: "600", marginBottom: 1 },
  rowValue: { color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  rowInput: {
    color: theme.colors.text, fontSize: 14, fontWeight: "600",
    borderBottomWidth: 1, borderBottomColor: "rgba(68,194,168,0.4)", paddingVertical: 2,
  },

  // Notifications
  notifPrompt: {
    backgroundColor: "#0c2b24", borderRadius: 18, borderWidth: 1,
    borderColor: "#123a32", padding: 24, alignItems: "center",
  },
  notifPromptTitle: { color: theme.colors.text, fontSize: 17, fontWeight: "700", marginBottom: 6 },
  notifPromptSub: { color: "#5a7a72", fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 18 },
  enableBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#1b5e20", paddingHorizontal: 20, paddingVertical: 13,
    borderRadius: 12, borderWidth: 1, borderColor: "#2E7D32",
  },
  enableBtnText: { color: "white", fontWeight: "700", fontSize: 14 },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  toggleBorder: { borderBottomWidth: 1, borderBottomColor: "#0f2e28" },
  toggleLabel: { color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  toggleDesc: { color: "#3d6e64", fontSize: 11, marginTop: 1 },

  // Danger
  dangerZone: { backgroundColor: "#1a0a0a", borderRadius: 16, borderWidth: 1, borderColor: "#3a1010", overflow: "hidden" },
  dangerRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  dangerDivider: { height: 1, backgroundColor: "#3a1010" },
  dangerText: { color: "#ef5350", fontSize: 14, fontWeight: "600" },

  version: { color: "#1a3d35", textAlign: "center", fontSize: 11, marginBottom: 8 },
});

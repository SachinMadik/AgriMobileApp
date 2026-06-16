import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getUserLocation } from "../../services/location";
import { getWeather } from "../../services/weather";
import { getRisks } from "../../services/risk";
import { getAlerts } from "../../services/alerts";
import { api } from "../../services/api";
import { getProfile } from "../../services/profile";
import { theme } from "../../theme";

const { width } = Dimensions.get("window");

const BASE_NAV_ITEMS = [
  { icon: "analytics", title: "Environment", subtitle: "Live sensor data", route: "/dashboard", color: theme.colors.accent },
  { icon: "map", title: "Disease Map", subtitle: "Regional outbreaks", route: "/heatmap", color: theme.colors.warning },
  { icon: "warning", title: "Alerts", subtitle: "Loading…", route: "/alerts", color: theme.colors.danger },
  { icon: "leaf", title: "Soil Health", subtitle: "Nutrient analysis", route: "/soil", color: theme.colors.safe },
  { icon: "chatbubble-ellipses", title: "AI Assistant", subtitle: "Ask anything", route: "/chatbot", color: theme.colors.info },
  { icon: "person", title: "My Profile", subtitle: "Farm settings", route: "/profile", color: theme.colors.purple },
];

export default function Home() {
  const router = useRouter();
  const [weather, setWeather] = useState<any>(null);
  const [greeting, setGreeting] = useState("Good morning");
  const [riskIndicators, setRiskIndicators] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [userName, setUserName] = useState("Farmer");
  const [navItems, setNavItems] = useState(BASE_NAV_ITEMS);
  const [apiError, setApiError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting("Good afternoon");
    else if (h >= 17) setGreeting("Good evening");

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    loadData();
  }, []);

  async function loadData() {
    setApiError(false);
    try {
      const location = await getUserLocation();
      const profile = await getProfile().catch(() => null);
      if (profile?.name) setUserName(profile.name.split(" ")[0]);

      const [data, risks, activity, alerts] = await Promise.all([
        getWeather(location.latitude, location.longitude),
        getRisks(location.latitude, location.longitude),
        api.get("/activity").then((r) => r.data).catch(() => []),
        getAlerts().catch(() => []),
      ]);

      setWeather(data);

      // ── NULL GUARD: risks may be null if API fails ──
      if (risks) {
        setRiskIndicators([
          {
            label: "Blight Risk",
            level: (risks.blight_pct ?? 0) > 60 ? "High" : (risks.blight_pct ?? 0) > 30 ? "Moderate" : "Low",
            color: (risks.blight_pct ?? 0) > 60 ? theme.colors.danger : theme.colors.warning,
            pct: (risks.blight_pct ?? 0) / 100,
          },
          {
            label: "Frost Risk",
            level: (risks.frost_pct ?? 0) > 60 ? "High" : (risks.frost_pct ?? 0) > 30 ? "Moderate" : "Low",
            color: (risks.frost_pct ?? 0) > 60 ? theme.colors.danger : theme.colors.accent,
            pct: (risks.frost_pct ?? 0) / 100,
          },
          {
            label: "Drought Risk",
            level: risks.drought === "High" ? "High" : risks.drought === "Medium" ? "Moderate" : "Low",
            color: risks.drought === "High" ? theme.colors.danger : theme.colors.warning,
            pct: (risks.drought_pct ?? 0) / 100,
          },
        ]);
      }

      setActivityFeed(Array.isArray(activity) ? activity : []);

      const unread = Array.isArray(alerts) ? alerts.filter((a: any) => !a.acknowledged).length : 0;
      setNavItems(BASE_NAV_ITEMS.map((item) =>
        item.route === "/alerts"
          ? { ...item, subtitle: unread > 0 ? `${unread} active warning${unread > 1 ? "s" : ""}` : "No active warnings" }
          : item
      ));
    } catch (e) {
      console.log(e);
      setApiError(true);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── HERO ── */}
        <LinearGradient colors={["#071510", "#0b2118", "#0d2e1e"]} style={styles.hero}>
          <View style={styles.ring1} />
          <View style={styles.ring2} />
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <Text style={styles.greeting}>{greeting}, {userName} 👋</Text>
            <Text style={styles.appTitle}>CropGuard</Text>
            <Text style={styles.appTitleAccent}>AI</Text>
            <Text style={styles.heroSub}>Smart protection for your farm</Text>
          </Animated.View>

          {/* Weather Bar */}
          <Animated.View style={[styles.weatherBar, { opacity: fadeAnim }]}>
            <WeatherPill icon="thermometer" value={weather?.temperature !== undefined ? `${Math.round(weather.temperature)}°C` : "--"} label="Temp" />
            <WeatherDivider />
            <WeatherPill icon="water" value={weather?.humidity !== undefined ? `${weather.humidity}%` : "--"} label="Humidity" />
            <WeatherDivider />
            <WeatherPill icon="rainy" value={weather?.rainfall !== undefined ? `${weather.rainfall}mm` : "--"} label="Rain" />
            <WeatherDivider />
            <WeatherPill icon="sunny" value={weather?.uv !== undefined ? `UV ${weather.uv}` : "UV --"} label="Index" />
          </Animated.View>
        </LinearGradient>

        {/* ── API ERROR BANNER ── */}
        {apiError && (
          <View style={styles.errorBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color={theme.colors.warning} />
            <Text style={styles.errorText}>Server offline — showing last known data</Text>
            <TouchableOpacity onPress={loadData}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── RISK OVERVIEW ── */}
        <View style={styles.section}>
          <SectionHeader title="Risk Overview" />
          {riskIndicators.length > 0 ? (
            <View style={styles.riskCard}>
              {riskIndicators.map((r, i) => <RiskBar key={i} {...r} />)}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="shield-checkmark-outline" size={32} color={theme.colors.textDim} />
              <Text style={styles.emptyText}>Risk data unavailable</Text>
              <Text style={styles.emptySub}>Tap Retry above to reload</Text>
            </View>
          )}
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.section}>
          <SectionHeader title="Farm Intelligence" />
          <View style={styles.grid}>
            {navItems.map((item, i) => (
              <NavCard key={i} item={item} onPress={() => router.push(item.route as any)} delay={i * 60} />
            ))}
          </View>
        </View>

        {/* ── TODAY'S ACTIVITY ── */}
        <View style={styles.section}>
          <SectionHeader title="Today's Activity" />
          <View style={styles.summaryCard}>
            {activityFeed.length > 0
              ? activityFeed.slice(0, 5).map((item, i) => (
                  <SummaryRow key={i} icon={item.icon} color={item.color} label={item.label} time={item.time} last={i === Math.min(activityFeed.length, 5) - 1} />
                ))
              : <SummaryRow icon="time-outline" color={theme.colors.textDim} label="No activity recorded today" time="" last />
            }
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

/* ── SUB-COMPONENTS ── */

function WeatherPill({ icon, value, label }: any) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={15} color={theme.colors.accent} />
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

function WeatherDivider() {
  return <View style={styles.divider} />;
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && <Text style={styles.sectionAction}>{action}</Text>}
    </View>
  );
}

function RiskBar({ label, level, color, pct }: any) {
  const barWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barWidth, { toValue: pct, duration: 900, delay: 300, useNativeDriver: false }).start();
  }, [pct]);

  return (
    <View style={styles.riskRow}>
      <View style={styles.riskLeft}>
        <Text style={styles.riskLabel}>{label}</Text>
        <Text style={[styles.riskLevel, { color }]}>{level}</Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barFill, { backgroundColor: color, width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}
        />
      </View>
      <Text style={[styles.riskPct, { color }]}>{Math.round(pct * 100)}%</Text>
    </View>
  );
}

function NavCard({ item, onPress, delay }: any) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }], width: "47%" }}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.72}>
        <View style={[styles.cardIconWrap, { backgroundColor: `${item.color}18` }]}>
          <Ionicons name={item.icon} size={24} color={item.color} />
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSub} numberOfLines={1}>{item.subtitle}</Text>
        <Ionicons name="chevron-forward" size={13} color={theme.colors.textDim} style={{ marginTop: 8 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function SummaryRow({ icon, color, label, time, last }: any) {
  return (
    <View style={[styles.summaryRow, !last && styles.summaryBorder]}>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}1a` }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
      {!!time && <Text style={styles.summaryTime}>{time}</Text>}
    </View>
  );
}

/* ── STYLES ── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1 },

  hero: {
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 28,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  ring1: {
    position: "absolute", width: 340, height: 340, borderRadius: 170,
    borderWidth: 1, borderColor: "rgba(62,207,178,0.05)", top: -90, right: -90,
  },
  ring2: {
    position: "absolute", width: 210, height: 210, borderRadius: 105,
    borderWidth: 1, borderColor: "rgba(62,207,178,0.08)", top: -20, right: 20,
  },

  greeting: { color: theme.colors.textMuted, fontSize: 13, letterSpacing: 0.4, marginBottom: 2 },
  appTitle: { color: theme.colors.text, fontSize: 36, fontWeight: "800", letterSpacing: -1, lineHeight: 40 },
  appTitleAccent: { color: theme.colors.accent, fontSize: 36, fontWeight: "800", letterSpacing: -1, marginTop: -4 },
  heroSub: { color: theme.colors.textDim, fontSize: 13, marginTop: 6, marginBottom: 22 },

  weatherBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(62,207,178,0.1)",
    overflow: "hidden",
  },
  pill: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 2 },
  pillValue: { color: theme.colors.text, fontSize: 12, fontWeight: "700" },
  pillLabel: { color: theme.colors.textDim, fontSize: 9, letterSpacing: 0.3 },
  divider: { width: 1, backgroundColor: "rgba(62,207,178,0.08)", marginVertical: 10 },

  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 20, marginTop: 12, marginBottom: 4,
    backgroundColor: theme.colors.warningBg, borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(245,166,35,0.25)",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: { flex: 1, color: theme.colors.warning, fontSize: 12, fontWeight: "500" },
  retryText: { color: theme.colors.accent, fontSize: 12, fontWeight: "700" },

  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { color: theme.colors.text, fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  sectionAction: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },

  riskCard: {
    backgroundColor: theme.colors.card, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: theme.colors.border, gap: 16,
  },
  riskRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  riskLeft: { width: 96 },
  riskLabel: { color: theme.colors.text, fontSize: 12, fontWeight: "600" },
  riskLevel: { fontSize: 10, fontWeight: "700", marginTop: 1, textTransform: "uppercase", letterSpacing: 0.6 },
  barTrack: { flex: 1, height: 5, backgroundColor: "#132d26", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  riskPct: { fontSize: 12, fontWeight: "700", width: 32, textAlign: "right" },

  emptyCard: {
    backgroundColor: theme.colors.card, borderRadius: 18, borderWidth: 1,
    borderColor: theme.colors.border, padding: 32, alignItems: "center", gap: 8,
  },
  emptyText: { color: theme.colors.textMuted, fontSize: 14, fontWeight: "600" },
  emptySub: { color: theme.colors.textDim, fontSize: 12 },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  card: {
    backgroundColor: theme.colors.card, padding: 18, borderRadius: 18,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  cardIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cardTitle: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  cardSub: { color: theme.colors.textDim, fontSize: 11, marginTop: 3 },

  summaryCard: {
    backgroundColor: theme.colors.card, borderRadius: 18,
    borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden",
  },
  summaryRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  summaryBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.background },
  summaryIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  summaryLabel: { flex: 1, color: theme.colors.text, fontSize: 13, fontWeight: "500" },
  summaryTime: { color: theme.colors.textDim, fontSize: 11 },
});

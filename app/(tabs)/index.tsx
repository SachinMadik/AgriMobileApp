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
  { icon: "analytics", title: "Environment", subtitle: "Live sensor data", route: "/dashboard", color: "#44c2a8" },
  { icon: "map", title: "Disease Map", subtitle: "Regional outbreaks", route: "/heatmap", color: "#f9a825" },
  { icon: "warning", title: "Alerts", subtitle: "Loading…", route: "/alerts", color: "#ef5350" },
  { icon: "leaf", title: "Soil Health", subtitle: "Nutrient analysis", route: "/soil", color: "#66bb6a" },
  { icon: "chatbubble-ellipses", title: "AI Assistant", subtitle: "Ask anything", route: "/chatbot", color: "#42a5f5" },
  { icon: "person", title: "My Profile", subtitle: "Farm settings", route: "/profile", color: "#ab47bc" },
];

export default function Home() {
  const router = useRouter();
  const [weather, setWeather] = useState<any>(null);
  const [greeting, setGreeting] = useState("Good morning");
  const [riskIndicators, setRiskIndicators] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [userName, setUserName] = useState("Farmer");
  const [navItems, setNavItems] = useState(BASE_NAV_ITEMS);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting("Good afternoon");
    else if (h >= 17) setGreeting("Good evening");

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    async function loadData() {
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
        setRiskIndicators([
          { label: "Blight Risk", level: risks.blight_pct > 60 ? "High" : risks.blight_pct > 30 ? "Moderate" : "Low", color: risks.blight_pct > 60 ? "#ef5350" : "#f9a825", pct: risks.blight_pct / 100 },
          { label: "Frost Risk", level: risks.frost_pct > 60 ? "High" : risks.frost_pct > 30 ? "Moderate" : "Low", color: risks.frost_pct > 60 ? "#ef5350" : "#44c2a8", pct: risks.frost_pct / 100 },
          { label: "Drought Risk", level: risks.drought === "High" ? "High" : risks.drought === "Medium" ? "Moderate" : "Low", color: risks.drought === "High" ? "#ef5350" : "#f9a825", pct: risks.drought_pct / 100 },
        ]);
        setActivityFeed(activity);
        const unread = alerts.filter((a: any) => !a.acknowledged).length;
        setNavItems(BASE_NAV_ITEMS.map((item) =>
          item.route === "/alerts"
            ? { ...item, subtitle: unread > 0 ? `${unread} active warning${unread > 1 ? "s" : ""}` : "No active warnings" }
            : item
        ));
      } catch (e) {
        console.log(e);
      }
    }
    loadData();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#071912" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* ── HERO ── */}
        <LinearGradient
          colors={["#071912", "#0c2b24", "#0f3f34"]}
          style={styles.hero}
        >
          {/* Decorative rings */}
          <View style={styles.ring1} />
          <View style={styles.ring2} />

          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <Text style={styles.greeting}>{greeting}, {userName} 👋</Text>
            <Text style={styles.appTitle}>CropGuard AI</Text>
            <Text style={styles.heroSub}>
              Smart environmental intelligence for modern farming
            </Text>
          </Animated.View>

          {/* Weather Bar */}
          <Animated.View style={[styles.weatherBar, { opacity: fadeAnim }]}>
            <WeatherPill
              icon="thermometer"
              value={
                weather?.temperature !== undefined
                  ? `${Math.round(weather.temperature)}°C`
                  : "--"
              }
              label="Temp"
            />
            <WeatherDivider />
            <WeatherPill
              icon="water"
              value={
                weather?.humidity !== undefined ? `${weather.humidity}%` : "--"
              }
              label="Humidity"
            />
            <WeatherDivider />
            <WeatherPill
              icon="rainy"
              value={
                weather?.rainfall !== undefined ? `${weather.rainfall}mm` : "--"
              }
              label="Rainfall"
            />
            <WeatherDivider />
            <WeatherPill
              icon="sunny"
              value={weather?.uv !== undefined ? `UV ${weather.uv}` : "UV --"}
              label="Index"
            />
          </Animated.View>
        </LinearGradient>

        {/* ── RISK OVERVIEW ── */}
        <View style={styles.section}>
          <SectionHeader title="Risk Overview" action="View All" />
          <View style={styles.riskCard}>
            {riskIndicators.map((r, i) => (
              <RiskBar key={i} {...r} />
            ))}
          </View>
        </View>

        {/* ── QUICK ACTIONS ── */}
        <View style={styles.section}>
          <SectionHeader title="Farm Intelligence" />
          <View style={styles.grid}>
            {navItems.map((item, i) => (
              <NavCard
                key={i}
                item={item}
                onPress={() => router.push(item.route as any)}
                delay={i * 60}
              />
            ))}
          </View>
        </View>

        {/* ── TODAY'S ACTIVITY SUMMARY ── */}
        <View style={styles.section}>
          <SectionHeader title="Today's Summary" />
          <View style={styles.summaryCard}>
            {activityFeed.length > 0 ? activityFeed.map((item, i) => (
              <SummaryRow key={i} icon={item.icon} color={item.color} label={item.label} time={item.time} />
            )) : (
              <SummaryRow icon="time-outline" color="#3d6e64" label="No activity recorded today" time="" />
            )}
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
      <Ionicons name={icon} size={16} color="#44c2a8" />
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
      {action && (
        <TouchableOpacity>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function RiskBar({ label, level, color, pct }: any) {
  const barWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barWidth, {
      toValue: pct,
      duration: 900,
      delay: 300,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={styles.riskRow}>
      <View style={styles.riskLeft}>
        <Text style={styles.riskLabel}>{label}</Text>
        <Text style={[styles.riskLevel, { color }]}>{level}</Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: barWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
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
      Animated.timing(fade, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [{ translateY: slide }],
        width: "47%",
      }}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <View
          style={[styles.cardIconWrap, { backgroundColor: `${item.color}18` }]}
        >
          <Ionicons name={item.icon} size={24} color={item.color} />
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSub}>{item.subtitle}</Text>
        <Ionicons
          name="chevron-forward"
          size={14}
          color="#3d6e64"
          style={{ marginTop: 8 }}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

function SummaryRow({ icon, color, label, time }: any) {
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryTime}>{time}</Text>
    </View>
  );
}

/* ── STYLES ── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, backgroundColor: theme.colors.background },

  hero: {
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 32,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  ring1: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: "rgba(68,194,168,0.06)",
    top: -80,
    right: -80,
  },
  ring2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(68,194,168,0.1)",
    top: -20,
    right: 20,
  },

  greeting: {
    color: "#5a9e94",
    fontSize: 13,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  appTitle: {
    color: "white",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSub: { color: "#5a8a82", fontSize: 13, marginTop: 4, marginBottom: 24 },

  weatherBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(68,194,168,0.12)",
    overflow: "hidden",
  },
  pill: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 2 },
  pillValue: { color: "white", fontSize: 13, fontWeight: "700" },
  pillLabel: { color: "#3d6e64", fontSize: 10, letterSpacing: 0.3 },
  divider: {
    width: 1,
    backgroundColor: "rgba(68,194,168,0.1)",
    marginVertical: 10,
  },

  section: { paddingHorizontal: 20, paddingTop: 28 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sectionAction: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },

  riskCard: {
    backgroundColor: "#0c2b24",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#123a32",
    gap: 16,
  },
  riskRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  riskLeft: { width: 96 },
  riskLabel: { color: theme.colors.text, fontSize: 12, fontWeight: "600" },
  riskLevel: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "#1a3d35",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
  riskPct: { fontSize: 12, fontWeight: "700", width: 32, textAlign: "right" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
  },
  card: {
    backgroundColor: "#0c2b24",
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#123a32",
    marginBottom: 0,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardTitle: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  cardSub: { color: "#3d6e64", fontSize: 11, marginTop: 3 },

  summaryCard: {
    backgroundColor: "#0c2b24",
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    borderColor: "#123a32",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#0f2e28",
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
  summaryTime: { color: "#3d6e64", fontSize: 11 },
});

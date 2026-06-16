import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { getUserLocation } from "../../services/location";
import { getRisks } from "../../services/risk";
import { getWeather, getForecast } from "../../services/weather";
import { theme } from "../../theme";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 48;

/* ─── Types ─── */
interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
}

interface RiskData {
  fungal: string;
  drought: string;
  flood: string;
}

/* ─── Skeleton Block ─── */
function SkeletonBlock({
  width: w,
  height: h,
  borderRadius = 8,
  style,
}: {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: w ?? "100%",
          height: h,
          borderRadius,
          backgroundColor: "#1a4036",
          opacity,
        },
        style,
      ]}
    />
  );
}

/* ─── Animated Number ─── */
function AnimatedNumber({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState("--");

  useEffect(() => {
    if (value === undefined || value === null) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: value,
      duration: 1200,
      useNativeDriver: false,
    }).start();
    const id = anim.addListener(({ value: v }) => {
      setDisplay(Math.round(v) + suffix);
    });
    return () => anim.removeListener(id);
  }, [value]);

  return <Text style={styles.metricValue}>{display}</Text>;
}

/* ─── Risk Meter ─── */
function RiskMeter({ label, level }: { label: string; level: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  const config: Record<
    string,
    { pct: number; color: string; bg: string; icon: string }
  > = {
    Low: {
      pct: 0.2,
      color: "#5ee4a1",
      bg: "#0d3d2a",
      icon: "checkmark-circle",
    },
    Medium: {
      pct: 0.55,
      color: "#ffcc66",
      bg: "#3d2e00",
      icon: "alert-circle",
    },
    High: { pct: 0.9, color: "#ff6b6b", bg: "#3d0f0f", icon: "warning" },
  };

  const cfg = config[level] ?? config["Low"];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: cfg.pct,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [level]);

  const barWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.riskItem, { backgroundColor: cfg.bg }]}>
      <View style={styles.riskHeader}>
        <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
        <Text style={[styles.riskLabel, { color: cfg.color }]}>{label}</Text>
        <Text
          style={[
            styles.riskBadge,
            { color: cfg.color, borderColor: cfg.color },
          ]}
        >
          {level ?? "--"}
        </Text>
      </View>
      <View style={styles.riskTrack}>
        <Animated.View
          style={[
            styles.riskBar,
            { width: barWidth, backgroundColor: cfg.color },
          ]}
        />
      </View>
    </View>
  );
}

/* ─── Weather Stat Card ─── */
function StatCard({
  icon,
  label,
  value,
  suffix,
  loading,
}: {
  icon: string;
  label: string;
  value: number;
  suffix: string;
  loading: boolean;
}) {
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!loading) {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 6,
      }).start();
    }
  }, [loading]);

  return (
    <Animated.View style={[styles.statCard, { transform: [{ scale }] }]}>
      <View style={styles.statIconWrap}>
        <Ionicons name={icon as any} size={22} color={theme.colors.accent} />
      </View>
      {loading ? (
        <>
          <SkeletonBlock height={22} width={60} style={{ marginTop: 10 }} />
          <SkeletonBlock height={12} width={50} style={{ marginTop: 6 }} />
        </>
      ) : (
        <>
          <AnimatedNumber value={value} suffix={suffix} />
          <Text style={styles.statLabel}>{label}</Text>
        </>
      )}
    </Animated.View>
  );
}

function ForecastStrip({ forecast }: { forecast: any[] }) {
  if (forecast.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
      {forecast.map((f, i) => (
        <View key={i} style={styles.forecastItem}>
          <Text style={styles.forecastDay}>{f.day}</Text>
          <Ionicons
            name={f.icon as any}
            size={22}
            color={theme.colors.accent}
            style={{ marginVertical: 6 }}
          />
          <Text style={styles.forecastHigh}>{f.high}°</Text>
          <Text style={styles.forecastLow}>{f.low}°</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─── AI Advisory ─── */
const ADVISORIES: Record<string, string[]> = {
  High: [
    "⚠️ High fungal risk detected. Apply preventive fungicide spray within 24 hours.",
    "🌧️ Excess moisture favors blight. Ensure proper field drainage today.",
  ],
  Medium: [
    "🔍 Monitor crop leaves for early signs of disease. Conditions are borderline.",
    "💧 Humidity is elevated. Avoid overhead irrigation for the next 48 hours.",
  ],
  Low: [
    "✅ Conditions look healthy today. A great day for field inspection.",
    "🌱 Low risk environment. Focus on fertilisation and growth monitoring.",
  ],
};

function AIAdvisory({
  risks,
  loading,
}: {
  risks: RiskData | null;
  loading: boolean;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading && risks) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, risks]);

  const topRisk = risks
    ? [risks.fungal, risks.drought, risks.flood].includes("High")
      ? "High"
      : [risks.fungal, risks.drought, risks.flood].includes("Medium")
        ? "Medium"
        : "Low"
    : "Low";

  const tips = ADVISORIES[topRisk] ?? ADVISORIES["Low"];

  return (
    <View style={styles.advisoryCard}>
      <View style={styles.advisoryHeader}>
        <Ionicons name="sparkles" size={18} color="#a78bfa" />
        <Text style={styles.advisoryTitle}>AI Farm Advisory</Text>
        <View style={styles.advisoryBadge}>
          <Text style={styles.advisoryBadgeText}>Live</Text>
        </View>
      </View>
      {loading ? (
        <>
          <SkeletonBlock height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock height={14} width="80%" />
        </>
      ) : (
        <Animated.View style={{ opacity: fadeAnim }}>
          {tips.map((tip, i) => (
            <Text key={i} style={styles.advisoryTip}>
              {tip}
            </Text>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

/* ─── Main Dashboard ─── */
export default function Dashboard() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [risks, setRisks] = useState<RiskData | null>(null);
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  const headerAnim = useRef(new Animated.Value(-30)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  async function loadData() {
    setError(false);
    try {
      const location = await getUserLocation();
      const [data, risksData, forecastData] = await Promise.all([
        getWeather(location.latitude, location.longitude),
        getRisks(location.latitude, location.longitude),
        getForecast(location.latitude, location.longitude),
      ]);
      setWeather(data);
      setRisks(risksData);
      setForecast(forecastData);
      setLastUpdated(new Date());
    } catch (e) {
      console.log(e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  function onRefresh() {
    setRefreshing(true);
    loadData();
  }

  // Real forecast-based chart data
  const tempData = {
    labels: forecast.length > 0 ? forecast.map((f: any) => f.day) : [],
    datasets: [{ data: forecast.length > 0 ? forecast.map((f: any) => f.high) : [0], strokeWidth: 2 }],
  };

  const rainfallData = {
    labels: forecast.length > 0 ? forecast.map((f: any) => f.day) : [],
    datasets: [{ data: forecast.length > 0 ? forecast.map((f: any) => f.low) : [0] }],
  };

  const chartConfig = {
    backgroundGradientFrom: "#0c2b24",
    backgroundGradientTo: "#0c2b24",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(68, 194, 168, ${opacity})`,
    labelColor: () => "#9fbdb5",
    propsForDots: { r: "4", strokeWidth: "2", stroke: theme.colors.accent },
    propsForBackgroundLines: { stroke: "#1a4036" },
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.accent}
          colors={[theme.colors.accent]}
        />
      }
    >
      {/* ── Header ── */}
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{ translateY: headerAnim }],
            opacity: headerOpacity,
          },
        ]}
      >
        <View>
          <Text style={styles.headerLabel}>ENVIRONMENTAL INTELLIGENCE</Text>
          <Text style={styles.headerTitle}>Farm Dashboard</Text>
          {lastUpdated && (
            <Text style={styles.headerSub}>
              Updated{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color={theme.colors.accent} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Error Banner ── */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="cloud-offline-outline" size={15} color={theme.colors.warning} />
          <Text style={styles.errorText}>Server offline — data may be outdated</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Stat Cards ── */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="thermometer"
          label="Temperature"
          value={weather?.temperature ?? 0}
          suffix="°C"
          loading={loading}
        />
        <StatCard
          icon="water"
          label="Humidity"
          value={weather?.humidity ?? 0}
          suffix="%"
          loading={loading}
        />
        <StatCard
          icon="rainy"
          label="Rainfall"
          value={weather?.rainfall ?? 0}
          suffix="mm"
          loading={loading}
        />
        <StatCard
          icon="speedometer"
          label="Wind"
          value={weather?.windSpeed ?? 0}
          suffix=" km/h"
          loading={loading}
        />
      </View>

      {/* ── AI Advisory ── */}
      <AIAdvisory risks={risks} loading={loading} />

      {/* ── Temperature Chart ── */}
      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>7-Day High Temperature (°C)</Text>
        {loading ? (
          <SkeletonBlock
            height={180}
            borderRadius={12}
            style={{ marginTop: 8 }}
          />
        ) : (
          <LineChart
            data={tempData}
            width={CHART_WIDTH}
            height={180}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withInnerLines
            withOuterLines={false}
          />
        )}
      </View>

      {/* ── Low Temp Chart ── */}
      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>7-Day Low Temperature (°C)</Text>
        {loading ? (
          <SkeletonBlock height={180} borderRadius={12} style={{ marginTop: 8 }} />
        ) : (
          <BarChart
            data={rainfallData}
            width={CHART_WIDTH}
            height={180}
            chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(255, 204, 102, ${opacity})` }}
            style={styles.chart}
            withInnerLines
            showValuesOnTopOfBars
            yAxisLabel=""
            yAxisSuffix=""
          />
        )}
      </View>

      {/* ── Risk Meters ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Risk Analysis</Text>
        {loading ? (
          <>
            <SkeletonBlock
              height={64}
              borderRadius={12}
              style={{ marginBottom: 10 }}
            />
            <SkeletonBlock
              height={64}
              borderRadius={12}
              style={{ marginBottom: 10 }}
            />
            <SkeletonBlock height={64} borderRadius={12} />
          </>
        ) : (
          <>
            <RiskMeter label="Fungal Disease" level={risks?.fungal ?? "Low"} />
            <RiskMeter label="Drought Risk" level={risks?.drought ?? "Low"} />
            <RiskMeter label="Flood Risk" level={risks?.flood ?? "Low"} />
          </>
        )}
      </View>

      {/* ── 7-Day Forecast ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>7-Day Forecast</Text>
        <View style={styles.forecastCard}>
          <ForecastStrip forecast={forecast} />
        </View>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 16,
  },

  /* Error Banner */
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: "rgba(245,166,35,0.1)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(245,166,35,0.2)",
    paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: { flex: 1, color: "#f5a623", fontSize: 12, fontWeight: "500" },
  retryText: { color: theme.colors.accent, fontSize: 12, fontWeight: "700" },

  /* Header */
  header: {    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 56,
    paddingBottom: 20,
  },
  headerLabel: {
    color: theme.colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "700",
  },
  headerSub: {
    color: "#9fbdb5",
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    backgroundColor: "#0c2b24",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f4d43",
    marginTop: 8,
  },

  /* Stat Cards */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#0c2b24",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f4d43",
  },
  statIconWrap: {
    backgroundColor: "#123a32",
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 10,
  },
  statLabel: {
    color: "#9fbdb5",
    fontSize: 12,
    marginTop: 2,
  },

  /* Advisory */
  advisoryCard: {
    backgroundColor: "#160e2e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2e1f5e",
  },
  advisoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  advisoryTitle: {
    color: "#a78bfa",
    fontWeight: "700",
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  advisoryBadge: {
    backgroundColor: "#2e1f5e",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  advisoryBadgeText: {
    color: "#a78bfa",
    fontSize: 10,
    fontWeight: "700",
  },
  advisoryTip: {
    color: "#d4c5f9",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },

  /* Charts */
  chartCard: {
    backgroundColor: "#0c2b24",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1f4d43",
  },
  chart: {
    marginTop: 8,
    borderRadius: 12,
    marginLeft: -8,
  },

  /* Section */
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
    letterSpacing: 0.3,
  },

  /* Risk Meters */
  riskItem: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  riskHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  riskLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  riskBadge: {
    fontSize: 11,
    fontWeight: "700",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  riskTrack: {
    height: 6,
    backgroundColor: "#ffffff18",
    borderRadius: 3,
    overflow: "hidden",
  },
  riskBar: {
    height: 6,
    borderRadius: 3,
  },

  /* Forecast */
  forecastCard: {
    backgroundColor: "#0c2b24",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f4d43",
  },
  forecastItem: {
    alignItems: "center",
    marginRight: 20,
    minWidth: 52,
  },
  forecastDay: {
    color: "#9fbdb5",
    fontSize: 12,
    fontWeight: "600",
  },
  forecastHigh: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  forecastLow: {
    color: "#9fbdb5",
    fontSize: 12,
  },
});

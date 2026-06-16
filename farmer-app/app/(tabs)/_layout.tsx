import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Tabs } from "expo-router";
import { theme } from "../../theme";

function MoreSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const items = [
    { icon: "flask", label: "Spray Log", route: "/spray-log", color: "#44c2a8", desc: "Record chemical applications" },
    { icon: "calendar", label: "Crop Calendar", route: "/crop-calendar", color: "#f9a825", desc: "Track growth stages" },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheet.overlay} onPress={onClose} />
      <View style={sheet.card}>
        <View style={sheet.handle} />
        <Text style={sheet.title}>Farm Tools</Text>
        {items.map((item) => (
          <TouchableOpacity key={item.route} style={sheet.row} onPress={() => { onClose(); router.push(item.route as any); }} activeOpacity={0.7}>
            <View style={[sheet.iconWrap, { backgroundColor: `${item.color}18` }]}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sheet.rowLabel}>{item.label}</Text>
              <Text style={sheet.rowDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#3d6e64" />
          </TouchableOpacity>
        ))}
        <View style={{ height: Platform.OS === "ios" ? 24 : 8 }} />
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  card: {
    backgroundColor: "#0c2b24", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, borderWidth: 1, borderColor: "#1a4036",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#1a4036", alignSelf: "center", marginBottom: 16 },
  title: { color: "#9fbdb5", fontSize: 12, fontWeight: "700", letterSpacing: 1.5, marginBottom: 12 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#0f2e28",
  },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowLabel: { color: "#e6f2ef", fontSize: 15, fontWeight: "700" },
  rowDesc: { color: "#3d6e64", fontSize: 12, marginTop: 1 },
});

export default function TabsLayout() {
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#07201a",
            borderTopWidth: 1,
            borderTopColor: "#0f3329",
            height: Platform.OS === "ios" ? 84 : 62,
            paddingBottom: Platform.OS === "ios" ? 24 : 8,
            paddingTop: 8,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: "#3d6e64",
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 2 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} /> }} />
        <Tabs.Screen name="dashboard" options={{ title: "Monitor", tabBarIcon: ({ color, focused }) => <TabIcon name="analytics" color={color} focused={focused} /> }} />
        <Tabs.Screen name="alerts" options={{ title: "Alerts", tabBarIcon: ({ color, focused }) => <TabIcon name="warning" color={color} focused={focused} /> }} />
        <Tabs.Screen name="soil" options={{ title: "Soil", tabBarIcon: ({ color, focused }) => <TabIcon name="leaf" color={color} focused={focused} /> }} />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} />,
          }}
        />
        {/* Hidden tabs — accessible via More sheet */}
        <Tabs.Screen name="heatmap" options={{ href: null, title: "Heatmap" }} />
        <Tabs.Screen name="chatbot" options={{ href: null, title: "AI Chat" }} />
        <Tabs.Screen name="spray-log" options={{ href: null, title: "Spray Log" }} />
        <Tabs.Screen name="crop-calendar" options={{ href: null, title: "Calendar" }} />
      </Tabs>

      {/* Floating More Button */}
      <TouchableOpacity style={fab.btn} onPress={() => setShowMore(true)} activeOpacity={0.85}>
        <Ionicons name="grid-outline" size={22} color={theme.colors.accent} />
      </TouchableOpacity>

      <MoreSheet visible={showMore} onClose={() => setShowMore(false)} />
    </>
  );
}

const fab = StyleSheet.create({
  btn: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 96 : 70,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0c2b24",
    borderWidth: 1,
    borderColor: "rgba(68,194,168,0.4)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  return (
    <View style={{
      alignItems: "center", justifyContent: "center",
      width: 38, height: 30, borderRadius: 10,
      backgroundColor: focused ? "rgba(68,194,168,0.12)" : "transparent",
    }}>
      <Ionicons name={focused ? (name as any) : (`${name}-outline` as any)} size={focused ? 22 : 21} color={color} />
    </View>
  );
}

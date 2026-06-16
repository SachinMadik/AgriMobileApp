import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useRouter } from "expo-router";
import { login, register, resetPassword } from "../services/auth";
import { theme } from "../theme";

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (mode === "forgot") {
      if (!phone.trim() || !newPassword.trim()) {
        Alert.alert("Required", "Phone number and new password are required.");
        return;
      }
      if (newPassword.length < 6) {
        Alert.alert("Weak password", "Password must be at least 6 characters.");
        return;
      }
      setLoading(true);
      try {
        await resetPassword(phone.trim(), newPassword);
        Alert.alert("Success", "Password reset successfully.", [{ text: "OK", onPress: () => setMode("login") }]);
      } catch (err: any) {
        Alert.alert("Error", err?.response?.data?.error ?? "Something went wrong.");
      } finally { setLoading(false); }
      return;
    }

    if (!phone.trim() || !password.trim()) {
      Alert.alert("Required", "Phone number and password are required.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      Alert.alert("Required", "Please enter your name.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") await register(phone.trim(), password, name.trim());
      else await login(phone.trim(), password);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error ?? "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  const isPasswordMode = mode !== "forgot";

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── HERO ── */}
        <LinearGradient colors={["#071510", "#0b2118", "#050f0c"]} style={styles.hero}>
          <View style={styles.ring} />
          <View style={styles.logoWrap}>
            <Ionicons name="leaf" size={38} color={theme.colors.accent} />
          </View>
          <Text style={styles.appName}>CropGuard</Text>
          <Text style={styles.tagline}>Smart farming starts here</Text>
        </LinearGradient>

        {/* ── FORM CARD ── */}
        <View style={styles.card}>
          <Text style={styles.modeTitle}>
            {mode === "login" ? "Welcome back" : mode === "register" ? "Create account" : "Reset password"}
          </Text>
          <Text style={styles.modeSub}>
            {mode === "login" ? "Sign in to your farm account" : mode === "register" ? "Start protecting your crops today" : "Enter your phone and a new password"}
          </Text>

          {mode === "register" && (
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={17} color={theme.colors.textDim} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Rajesh Kumar"
                  placeholderTextColor={theme.colors.textDim}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={17} color={theme.colors.textDim} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                placeholderTextColor={theme.colors.textDim}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{mode === "forgot" ? "New Password" : "Password"}</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={17} color={theme.colors.textDim} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={theme.colors.textDim}
                value={mode === "forgot" ? newPassword : password}
                onChangeText={mode === "forgot" ? setNewPassword : setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            {mode === "login" && (
              <TouchableOpacity onPress={() => setMode("forgot")} style={styles.forgotRow}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.82}
          >
            <LinearGradient colors={[theme.colors.accent, theme.colors.accentDark]} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {loading
                ? <ActivityIndicator color="#071510" />
                : <Text style={styles.btnText}>
                    {mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Reset Password"}
                  </Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          {mode === "forgot" ? (
            <TouchableOpacity style={styles.switchRow} onPress={() => setMode("login")}>
              <Text style={styles.switchText}><Text style={styles.switchLink}>← Back to Sign In</Text></Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.switchRow} onPress={() => setMode(mode === "login" ? "register" : "login")}>
              <Text style={styles.switchText}>
                {mode === "login" ? "New to CropGuard? " : "Already have an account? "}
                <Text style={styles.switchLink}>{mode === "login" ? "Register" : "Sign In"}</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1 },

  hero: {
    paddingTop: Platform.OS === "ios" ? 70 : 56,
    paddingBottom: 40,
    alignItems: "center",
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    width: 280, height: 280, borderRadius: 140,
    borderWidth: 1, borderColor: "rgba(62,207,178,0.07)",
    top: -60, right: -60,
  },
  logoWrap: {
    width: 86, height: 86, borderRadius: 28,
    backgroundColor: theme.colors.accentGlow,
    borderWidth: 1, borderColor: "rgba(62,207,178,0.3)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 18,
  },
  appName: { color: theme.colors.text, fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  tagline: { color: theme.colors.textMuted, fontSize: 14, marginTop: 5 },

  card: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    flex: 1, padding: 28, paddingBottom: 48,
    borderTopWidth: 1, borderColor: theme.colors.border,
  },
  modeTitle: { color: theme.colors.text, fontSize: 24, fontWeight: "800", marginBottom: 4 },
  modeSub: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 28 },

  field: { marginBottom: 18 },
  label: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 8, letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.colors.background, borderRadius: 14,
    borderWidth: 1, borderColor: theme.colors.borderLight,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, paddingVertical: 14,
    color: theme.colors.text, fontSize: 15,
  },
  eyeBtn: { padding: 6 },

  forgotRow: { alignItems: "flex-end", marginTop: 10 },
  forgotText: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },

  btn: { borderRadius: 14, overflow: "hidden", marginTop: 8 },
  btnGradient: { paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#071510", fontSize: 16, fontWeight: "800" },

  switchRow: { marginTop: 22, alignItems: "center" },
  switchText: { color: theme.colors.textMuted, fontSize: 14 },
  switchLink: { color: theme.colors.accent, fontWeight: "700" },
});

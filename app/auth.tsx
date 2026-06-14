import { Ionicons } from "@expo/vector-icons";
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
        Alert.alert("Success", "Password reset successfully. Please sign in.", [
          { text: "OK", onPress: () => setMode("login") },
        ]);
      } catch (err: any) {
        Alert.alert("Error", err?.response?.data?.error ?? "Something went wrong.");
      } finally {
        setLoading(false);
      }
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
      if (mode === "register") {
        await register(phone.trim(), password, name.trim());
      } else {
        await login(phone.trim(), password);
      }
      // Navigate directly — token is now in storage
      router.replace("/(tabs)");
    } catch (err: any) {
      const message = err?.response?.data?.error ?? "Something went wrong. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Ionicons name="leaf" size={48} color={theme.colors.accent} />
        </View>
        <Text style={styles.title}>CropGuard</Text>
        <Text style={styles.subtitle}>
          {mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : "Reset Password"}
        </Text>

        {mode === "register" && (
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Rajesh Kumar"
              placeholderTextColor="#3d6e64"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="+91 98765 43210"
            placeholderTextColor="#3d6e64"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
        </View>

        {mode === "forgot" ? (
          <View style={styles.field}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#3d6e64"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#3d6e64"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {mode === "login" && (
              <TouchableOpacity onPress={() => setMode("forgot")} style={styles.forgotRow}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="white" />
            : <Text style={styles.btnText}>
                {mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Reset Password"}
              </Text>
          }
        </TouchableOpacity>

        {mode === "forgot" ? (
          <TouchableOpacity style={styles.switchRow} onPress={() => setMode("login")}>
            <Text style={styles.switchText}>
              <Text style={styles.switchLink}>← Back to Sign In</Text>
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.switchRow} onPress={() => setMode(mode === "login" ? "register" : "login")}>
            <Text style={styles.switchText}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <Text style={styles.switchLink}>{mode === "login" ? "Register" : "Sign In"}</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { flexGrow: 1, justifyContent: "center", padding: 28, paddingBottom: 48 },
  logoWrap: {
    width: 90, height: 90, borderRadius: 26, alignSelf: "center",
    backgroundColor: "rgba(68,194,168,0.1)", borderWidth: 1,
    borderColor: "rgba(68,194,168,0.3)", alignItems: "center",
    justifyContent: "center", marginBottom: 20,
  },
  title: { color: theme.colors.text, fontSize: 32, fontWeight: "800", textAlign: "center" },
  subtitle: { color: "#5a7a72", fontSize: 15, textAlign: "center", marginBottom: 36, marginTop: 6 },
  field: { marginBottom: 18 },
  label: { color: "#9fbdb5", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: "#0c2b24", borderRadius: 12, borderWidth: 1,
    borderColor: "#1a4036", padding: 14, color: "white", fontSize: 15,
  },
  forgotRow: { alignItems: "flex-end", marginTop: 8 },
  forgotText: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },
  btn: {
    backgroundColor: "#1b5e20", borderWidth: 1, borderColor: "#2E7D32",
    paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 8,
  },
  btnText: { color: "white", fontSize: 16, fontWeight: "700" },
  switchRow: { marginTop: 20, alignItems: "center" },
  switchText: { color: "#5a7a72", fontSize: 14 },
  switchLink: { color: theme.colors.accent, fontWeight: "700" },
});

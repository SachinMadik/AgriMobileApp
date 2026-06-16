import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { sendChat } from "../../services/chat";
import { theme } from "../../theme";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  { icon: "🍅", text: "Signs of tomato late blight?" },
  { icon: "💊", text: "When to apply fungicide?" },
  { icon: "🌱", text: "Improve soil nitrogen?" },
  { icon: "💧", text: "Best time to irrigate this week?" },
];

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hello! I'm CropGuard AI, your farming assistant. I can help with crop diseases, soil health, weather-based advice, and more. What's on your mind today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: msg,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const history = updatedMessages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.text }));

      const messages_to_send = history.length > 0 ? history : [{ role: "user", content: msg }];
      const data = await sendChat(messages_to_send);
      const reply = data.reply ?? "Sorry, I couldn't process that. Please try again.";

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: reply,
          timestamp: new Date(),
        },
      ]);
    } catch (e: any) {
      const errorText = e?.name === "AbortError"
        ? "Request timed out. The server may be slow — please try again."
        : e?.message?.includes("Network request failed")
        ? "Cannot reach the server. Make sure the backend is running on the same WiFi."
        : "Something went wrong. Please try again.";

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          text: errorText,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [messages, loading]);

  function formatTime(date: Date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarWrap}>
            <Ionicons name="leaf" size={18} color="#44c2a8" />
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={styles.headerTitle}>CropGuard AI</Text>
            <Text style={styles.headerStatus}>
              <View style={styles.statusDotInline} /> Active · Agricultural
              Expert
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const isUser = item.role === "user";
            const prevRole = index > 0 ? messages[index - 1].role : null;
            const isGrouped = prevRole === item.role;

            return (
              <View
                style={[
                  styles.msgWrap,
                  isUser ? styles.msgWrapUser : styles.msgWrapBot,
                  isGrouped && styles.grouped,
                ]}
              >
                {!isUser && !isGrouped && (
                  <View style={styles.botAvatar}>
                    <Ionicons name="leaf" size={12} color="#44c2a8" />
                  </View>
                )}
                {!isUser && isGrouped && <View style={styles.avatarSpacer} />}

                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.userBubble : styles.botBubble,
                  ]}
                >
                  <Text style={[styles.bubbleText, isUser && styles.userText]}>
                    {item.text}
                  </Text>
                  <Text
                    style={[styles.timestamp, isUser && styles.timestampUser]}
                  >
                    {formatTime(item.timestamp)}
                  </Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            loading ? (
              <View style={[styles.msgWrap, styles.msgWrapBot]}>
                <View style={styles.botAvatar}>
                  <Ionicons name="leaf" size={12} color="#44c2a8" />
                </View>
                <View style={styles.botBubble}>
                  <TypingIndicator />
                </View>
              </View>
            ) : null
          }
        />

        {/* Suggestions (only shown before any user message) */}
        {messages.length === 1 && (
          <View style={styles.suggestions}>
            <Text style={styles.suggestLabel}>Quick questions</Text>
            <View style={styles.suggestRow}>
              {SUGGESTIONS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestChip}
                  onPress={() => sendMessage(s.text)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.suggestEmoji}>{s.icon}</Text>
                  <Text style={styles.suggestText}>{s.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputWrap}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask about crops, soil, weather…"
              placeholderTextColor="#3d6e64"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              onSubmitEditing={() => sendMessage()}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!input.trim() || loading) && styles.sendBtnDisabled,
              ]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#071510" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.disclaimer}>
            Powered by Mistral AI · Responses are advisory only
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function TypingIndicator() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 320,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 4,
      }}
    >
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: "#44c2a8",
            opacity: dot,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#0f2e28",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#0c2b24",
    borderWidth: 1,
    borderColor: "rgba(68,194,168,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#44c2a8",
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  headerTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  headerStatus: { color: "#3d6e64", fontSize: 12, marginTop: 1 },
  statusDotInline: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#44c2a8",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0c2b24",
    borderWidth: 1,
    borderColor: "#123a32",
    alignItems: "center",
    justifyContent: "center",
  },

  listContent: { padding: 16, paddingBottom: 8 },

  msgWrap: { flexDirection: "row", marginBottom: 8, alignItems: "flex-end" },
  msgWrapUser: { justifyContent: "flex-end" },
  msgWrapBot: { justifyContent: "flex-start" },
  grouped: { marginBottom: 4 },

  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#0c2b24",
    borderWidth: 1,
    borderColor: "rgba(68,194,168,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 2,
  },
  avatarSpacer: { width: 36 },

  bubble: { maxWidth: "78%", borderRadius: 18, padding: 12 },
  userBubble: {
    backgroundColor: "#1b5e20",
    borderWidth: 1,
    borderColor: "#2E7D32",
    borderBottomRightRadius: 6,
  },
  botBubble: {
    backgroundColor: "#0c2b24",
    borderWidth: 1,
    borderColor: "#123a32",
    borderBottomLeftRadius: 6,
  },
  bubbleText: { color: "#9fbdb5", fontSize: 14, lineHeight: 20 },
  userText: { color: "white" },
  timestamp: {
    color: "#3d6e64",
    fontSize: 10,
    marginTop: 6,
    textAlign: "left",
  },
  timestampUser: { textAlign: "right", color: "rgba(255,255,255,0.4)" },

  suggestions: { paddingHorizontal: 16, paddingBottom: 10 },
  suggestLabel: {
    color: theme.colors.textDim,
    fontSize: 11, fontWeight: "700",
    marginBottom: 10, letterSpacing: 0.8, textTransform: "uppercase",
  },
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.colors.card,
    borderWidth: 1, borderColor: theme.colors.borderLight,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
  },
  suggestEmoji: { fontSize: 14 },
  suggestText: { color: theme.colors.accent, fontSize: 12, fontWeight: "600" },

  inputWrap: {
    borderTopWidth: 1, borderTopColor: "#0d2820",
    padding: 12, paddingBottom: Platform.OS === "ios" ? 28 : 14,
    backgroundColor: "#040e0b",
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: {
    flex: 1, backgroundColor: theme.colors.card,
    borderRadius: 18, borderWidth: 1, borderColor: theme.colors.borderLight,
    padding: 13, paddingTop: 13,
    color: theme.colors.text, fontSize: 14,
    maxHeight: 120, lineHeight: 20,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: theme.colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: theme.colors.border, opacity: 0.5 },
  disclaimer: {
    color: theme.colors.textDim, fontSize: 10,
    textAlign: "center", marginTop: 8, letterSpacing: 0.2,
  },
});

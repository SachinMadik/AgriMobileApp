import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000, // 60s — handles Render free tier cold start (~30-50s)
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("cropguard_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (err: any) {
      lastError = err;
      const status = err?.response?.status;
      if (status && status >= 400 && status < 500) throw err;
      if (i < retries) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastError;
}

// Call this once on app launch — wakes the Render server before screens load
export async function wakeServer(): Promise<void> {
  try { await axios.get(`${API_BASE}/health`, { timeout: 60000 }); } catch { /* silent */ }
}

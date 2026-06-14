import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

// Attach JWT token to every request
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
      // Don't retry client errors (4xx) — token missing/expired, bad request, etc.
      const status = err?.response?.status;
      if (status && status >= 400 && status < 500) throw err;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastError;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const TOKEN_KEY = "cropguard_token";
const USER_ID_KEY = "cropguard_user_id";

export async function register(phone: string, password: string, name: string) {
  const { data } = await api.post("/auth/register", { phone, password, name });
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_ID_KEY, String(data.userId));
  return data;
}

export async function login(phone: string, password: string) {
  const { data } = await api.post("/auth/login", { phone, password });
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  await AsyncStorage.setItem(USER_ID_KEY, String(data.userId));
  return data;
}

export async function resetPassword(phone: string, newPassword: string) {
  const { data } = await api.post("/auth/reset-password", { phone, newPassword });
  return data;
}

export async function logout() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_ID_KEY, "cropguard_profile_setup_done"]);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

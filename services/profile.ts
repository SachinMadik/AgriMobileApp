import { api, fetchWithRetry } from "./api";

export async function getProfile() {
  try { return await fetchWithRetry(() => api.get("/profile").then((r) => r.data)); }
  catch { console.log("[profile] API failed"); return null; }
}
export async function updateProfile(body: object) {
  try { return await fetchWithRetry(() => api.put("/profile", body).then((r) => r.data)); }
  catch { console.log("[profile] update failed"); return null; }
}
export async function getProfileStats() {
  try { return await fetchWithRetry(() => api.get("/profile/stats").then((r) => r.data)); }
  catch { return null; }
}

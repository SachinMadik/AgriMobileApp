import { api, fetchWithRetry } from "./api";

export async function getAlerts() {
  try { return await fetchWithRetry(() => api.get("/alerts").then((r) => r.data)); }
  catch { console.log("[alerts] API failed"); return []; }
}
export async function acknowledgeAlert(id: string) {
  try { return await fetchWithRetry(() => api.patch(`/alerts/${id}/acknowledge`).then((r) => r.data)); }
  catch { return null; }
}
export async function acknowledgeAll() {
  try { return await fetchWithRetry(() => api.post("/alerts/acknowledge-all").then((r) => r.data)); }
  catch { return null; }
}
export async function runRiskCheck(body: object) {
  try { return await fetchWithRetry(() => api.post("/alerts/risk-check", body).then((r) => r.data)); }
  catch { return null; }
}
export async function getReminders() {
  try { return await fetchWithRetry(() => api.get("/reminders").then((r) => r.data)); }
  catch { return []; }
}
export async function createReminder(body: object) {
  return fetchWithRetry(() => api.post("/reminders", body).then((r) => r.data));
}
export async function markReminderDone(id: string) {
  try { return await fetchWithRetry(() => api.patch(`/reminders/${id}/done`).then((r) => r.data)); }
  catch { return null; }
}
export async function deleteReminder(id: string) {
  try { return await fetchWithRetry(() => api.delete(`/reminders/${id}`).then((r) => r.data)); }
  catch { return null; }
}

import { api, fetchWithRetry } from "./api";

export async function getRisks(lat: number, lon: number) {
  try { return await fetchWithRetry(() => api.get(`/risks?lat=${lat}&lon=${lon}`).then((r) => r.data)); }
  catch { console.log("[risks] API failed"); return null; }
}

import { api, fetchWithRetry } from "./api";

export async function getDiseaseZones() {
  try { return await fetchWithRetry(() => api.get("/disease-zones").then((r) => r.data)); }
  catch { console.log("[disease-zones] API failed"); return []; }
}

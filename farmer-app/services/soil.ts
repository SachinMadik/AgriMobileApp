import { api, fetchWithRetry } from "./api";

export async function getSoilNutrients() {
  try { return await fetchWithRetry(() => api.get("/soil").then((r) => r.data)); }
  catch { console.log("[soil] API failed"); return []; }
}

export async function getSoilHealthScore() {
  try { return await fetchWithRetry(() => api.get("/soil/health-score").then((r) => r.data)); }
  catch { return { score: 0, label: "No Data" }; }
}

export async function getSoilTrend() {
  try { return await fetchWithRetry(() => api.get("/soil/trend").then((r) => r.data)); }
  catch { return []; }
}

export async function getSoilRecommendations() {
  try { return await fetchWithRetry(() => api.get("/soil/recommendations").then((r) => r.data)); }
  catch { return []; }
}

export async function updateSoilNutrient(id: string, value: number) {
  return fetchWithRetry(() => api.put(`/soil/${id}`, { value }).then((r) => r.data));
}

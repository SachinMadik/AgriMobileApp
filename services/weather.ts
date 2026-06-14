import { api, fetchWithRetry } from "./api";

export async function getWeather(lat: number, lon: number) {
  try { return await fetchWithRetry(() => api.get(`/weather?lat=${lat}&lon=${lon}`).then((r) => r.data)); }
  catch { console.log("[weather] API failed"); return null; }
}
export async function getForecast(lat: number, lon: number) {
  try { return await fetchWithRetry(() => api.get(`/weather/forecast?lat=${lat}&lon=${lon}`).then((r) => r.data)); }
  catch { console.log("[forecast] API failed"); return []; }
}

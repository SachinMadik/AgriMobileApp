import { api, fetchWithRetry } from "./api";

export interface SprayLog {
  id: string;
  date: string;
  time: string;
  chemical: string;
  chemicalType: string;
  dose: string;
  area: string;
  zone: string;
  weather: string;
  notes: string;
  done: boolean;
  createdAt: string;
}

export interface SprayStats {
  total: number;
  done: number;
  pending: number;
  lastSprayDate: string | null;
  byType: Record<string, number>;
}

const MOCK_LOGS: SprayLog[] = [
  { id: "sp1", date: "2026-04-20", time: "07:00 AM", chemical: "Mancozeb 75% WP", chemicalType: "fungicide", dose: "2.5 g/L", area: "4.2 ha", zone: "Full Farm", weather: "Clear", notes: "Preventive spray", done: true, createdAt: "2026-04-20T07:00:00Z" },
  { id: "sp2", date: "2026-04-15", time: "06:30 AM", chemical: "Chlorpyrifos 20% EC", chemicalType: "insecticide", dose: "2 mL/L", area: "2.0 ha", zone: "Zone A", weather: "Partly cloudy", notes: "Aphid control", done: true, createdAt: "2026-04-15T06:30:00Z" },
];

export async function getSprayLogs(): Promise<SprayLog[]> {
  try {
    return await fetchWithRetry(() => api.get("/spray-log").then((r) => r.data));
  } catch {
    return MOCK_LOGS;
  }
}

export async function getSprayStats(): Promise<SprayStats> {
  try {
    return await fetchWithRetry(() => api.get("/spray-log/stats").then((r) => r.data));
  } catch {
    return { total: 2, done: 2, pending: 0, lastSprayDate: "2026-04-20", byType: { fungicide: 1, insecticide: 1 } };
  }
}

export async function createSprayLog(body: Partial<SprayLog>): Promise<SprayLog | null> {
  try {
    return await fetchWithRetry(() => api.post("/spray-log", body).then((r) => r.data));
  } catch {
    return null;
  }
}

export async function markSprayDone(id: string): Promise<SprayLog | null> {
  try {
    return await fetchWithRetry(() => api.patch(`/spray-log/${id}/done`).then((r) => r.data));
  } catch {
    return null;
  }
}

export async function deleteSprayLog(id: string): Promise<boolean> {
  try {
    await fetchWithRetry(() => api.delete(`/spray-log/${id}`).then((r) => r.data));
    return true;
  } catch {
    return false;
  }
}

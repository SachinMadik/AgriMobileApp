import { api, fetchWithRetry } from "./api";

export interface StageLog {
  id: number;
  cycleId: string;
  stage: string;
  date: string;
  notes: string;
}

export interface CropCycle {
  id: string;
  crop: string;
  variety: string;
  field: string;
  area: string;
  sowingDate: string;
  expectedHarvest: string;
  currentStage: string;
  notes: string;
  createdAt: string;
  stageLogs: StageLog[];
  allStages: string[];
}

export const ALL_STAGES = ['sowing','germination','transplanting','vegetative','flowering','fruiting','maturity','harvest'];

const MOCK_CYCLE: CropCycle = {
  id: "cc1", crop: "Tomato", variety: "Hybrid F1 (Arka Rakshak)", field: "Main Field",
  area: "4.2 ha", sowingDate: "2026-03-01", expectedHarvest: "2026-06-15",
  currentStage: "flowering", notes: "Kharif 2026 season", createdAt: "2026-03-01T00:00:00Z",
  allStages: ALL_STAGES,
  stageLogs: [
    { id: 1, cycleId: "cc1", stage: "sowing", date: "2026-03-01", notes: "Seeds sown in nursery beds" },
    { id: 2, cycleId: "cc1", stage: "germination", date: "2026-03-08", notes: "80% germination observed" },
    { id: 3, cycleId: "cc1", stage: "transplanting", date: "2026-03-22", notes: "Seedlings transplanted" },
    { id: 4, cycleId: "cc1", stage: "vegetative", date: "2026-04-05", notes: "Rapid leaf growth" },
    { id: 5, cycleId: "cc1", stage: "flowering", date: "2026-04-20", notes: "First flowers visible" },
  ],
};

export async function getActiveCycle(): Promise<CropCycle | null> {
  try {
    return await fetchWithRetry(() => api.get("/crop-calendar").then((r) => r.data));
  } catch {
    return MOCK_CYCLE;
  }
}

export async function getAllCycles(): Promise<CropCycle[]> {
  try {
    return await fetchWithRetry(() => api.get("/crop-calendar/all").then((r) => r.data));
  } catch {
    return [MOCK_CYCLE];
  }
}

export async function createCycle(body: Partial<CropCycle>): Promise<CropCycle | null> {
  try {
    return await fetchWithRetry(() => api.post("/crop-calendar", body).then((r) => r.data));
  } catch {
    return null;
  }
}

export async function advanceStage(id: string, stage: string, notes?: string): Promise<CropCycle | null> {
  try {
    return await fetchWithRetry(() =>
      api.put(`/crop-calendar/${id}/stage`, { stage, notes }).then((r) => r.data)
    );
  } catch {
    return null;
  }
}

export async function deleteCycle(id: string): Promise<boolean> {
  try {
    await fetchWithRetry(() => api.delete(`/crop-calendar/${id}`).then((r) => r.data));
    return true;
  } catch {
    return false;
  }
}

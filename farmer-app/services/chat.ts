import { api, fetchWithRetry } from "./api";

export async function sendChat(messages: { role: string; content: string }[]) {
  return fetchWithRetry(() =>
    api.post("/chat", { messages }, { timeout: 30000 }).then((r) => r.data)
  );
}

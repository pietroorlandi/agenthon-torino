import type { Message, NextResult, ProbeResult, State, StepResult } from "./types";

// Demo identity: the user switcher sets X-User; the server applies every filter.
let currentUser = (() => {
  try { return localStorage.getItem("brain.user") || "sara"; } catch { return "sara"; }
})();

export const getUser = () => currentUser;
export function setUser(id: string) {
  currentUser = id;
  try { localStorage.setItem("brain.user", id); } catch { /* private mode */ }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", "X-User": currentUser },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(typeof d.detail === "string" ? d.detail : r.statusText);
  }
  return r.json() as Promise<T>;
}

export const api = {
  state: () => req<State>("GET", "/api/state"),
  observability: () => req<Record<string, any>>("GET", "/api/observability"),
  reset: () => req<State>("POST", "/api/reset"),
  next: () => req<NextResult>("POST", "/api/clock/next"),
  ask: (question: string) => req<Message>("POST", "/api/ask", { question }),
  probe: (question: string) => req<ProbeResult>("POST", "/api/probe", { question }),
  read: () => req("POST", "/api/dm/read"),
  memory: (id: string, decision: "approve" | "reject") => req<State>("POST", `/api/memory/${id}/${decision}`),
  shipOrder: (orderId: string) => req<State>("POST", `/api/orders/${orderId.replace("#", "")}/ship`),
  quarantine: (id: string, decision: "ban" | "accept" | "release" | "confirm-bad") => req<State>("POST", `/api/quarantine/${id}/${decision}`),
  gapAnswer: (id: string, fact: string, question: string, access: string[]) => req<State>("POST", `/api/gaps/${id}/answer`, { fact, question, access }),
  gapDismiss: (id: string) => req<State>("POST", `/api/gaps/${id}/dismiss`),
  action: (id: string, decision: "approve" | "reject") => req<State>("POST", `/api/actions/${id}/${decision}`),
  editDraft: (id: string, draft: string) => req<State>("PATCH", `/api/actions/${id}`, { draft }),
  agentDraft: (id: string) => req<State>("POST", `/api/actions/${id}/draft`),
  inject: (ev: { type: string; sender?: string; to?: string; channel?: string; title?: string; body: string }) => req<StepResult>("POST", "/api/events", ev),
  briefText: () => req<{ text: string }>("GET", "/api/brief/text"),
};

export async function fetchBriefAudio(): Promise<Blob | null> {
  const r = await fetch("/api/brief/audio", { headers: { "X-User": currentUser } });
  return r.ok ? r.blob() : null;
}

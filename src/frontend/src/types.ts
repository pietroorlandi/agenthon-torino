// Contract of GET /api/state (built server side in src/backend/app/views.py).
export type Role = "magazzino" | "clienti" | "shop" | "spedizioni";

export interface User { id: string; name: string; role: Role; role_label: string; avatar: string; color: string }
export interface BriefItem { text: string; sources: string[]; derived?: boolean }

export interface Message {
  id: string; sender: "brain" | "user"; user_id?: string | null; kind: string; text: string; time: string;
  sources: string[]; memory_ids: string[]; items?: BriefItem[] | null;
  action_id?: string | null; gap_id?: string | null; quarantine_id?: string | null; engine?: string | null;
}

export interface SourceView {
  id: string; type: string; locked?: boolean; access_label: string;
  title?: string; sender?: string; sender_label?: string; to?: string | null; to_label?: string | null; date?: string; body?: string;
  channel?: string | null; observed_at?: string | null; trust?: string | null; trust_reason?: string | null;
  triage?: string | null; triage_reason?: string | null; triage_engine?: string | null; outcome?: string | null;
  banned?: boolean; in_quarantine?: boolean; injected_by?: string | null;
}

export interface MemoryView {
  id: string; status: "pending" | "approved" | "rejected" | "superseded"; locked?: boolean; access_label: string; source_ids: string[];
  text?: string; question?: string | null; proposed_by?: string; approved_by?: string | null; rejected_by?: string | null;
  can_curate?: boolean; attributed_to?: string | null; source_quote?: string | null; type?: string; created_at?: string | null;
}

export interface QuarantineView {
  id: string; kind: "contradiction" | "security"; status: string; authority_label: string; decided_by?: string | null; locked?: boolean;
  can_decide?: boolean; reason?: string; source_id?: string; claim_text?: string | null; memory_id?: string | null;
  memory_text?: string | null; memory_approved_by?: string | null; order_id?: string | null;
}

export interface GapView {
  id: string; question: string; asked_by: string; asked_by_name: string; asked_by_role_label: string; asker_role: Role;
  owner: Role; owner_label: string; topic_label: string; status: "open" | "answered" | "dismissed"; time: string;
  answer?: string | null; decided_by?: string | null; mine: boolean;
}

export interface ActionView {
  id: string; status: "pending" | "executed" | "rejected"; locked?: boolean; owner_label: string;
  title?: string; why?: string; draft?: string; source_ids?: string[]; decided_by?: string | null;
  draft_by?: string; edited_by?: string | null; can_decide?: boolean; effect?: string;
}

export interface Product { sku: string; name: string; price: number; stock: number; threshold: number; sold7d: number; blocked: boolean; incoming: number }
export interface Order { id: string; date: string; customer: string; country: string; kind: string; total: number; status: string; carrier: string; flag: string }
export interface AuditEntry { id: number; real_ts: string; sim_ts: string; actor: string; op: string; text: string; trace_id?: string | null }
export interface OutboxItem { action_id: string; title: string; body: string; approved_by: string; sent_at: string; delivery?: "simulated" | "sending" | "sent" | "failed"; delivery_error?: string | null }

export interface State {
  now: string; me: User; users: User[]; roles: Record<Role, string>;
  channels: { id: string; locked: boolean }[];
  dm: Message[]; unread: number;
  brief: { text: string; time: string; items: BriefItem[] };
  memory: MemoryView[]; quarantine: QuarantineView[]; gaps: GapView[]; actions: ActionView[]; outbox: OutboxItem[];
  sources: SourceView[]; hidden_sources: number;
  products: Product[]; orders: Order[]; audit: AuditEntry[];
  timeline: { done: number; total: number; next: { at: string; label: string } | null };
  llm: { mode: string; model: string; model_lite: string; tts: boolean; trace_exporter: string };
  mail: { enabled: boolean; to: string | null };
  counters: Record<string, number>;
  suggestions: string[];
}

export interface StepResult { source_id?: string; title: string; trust?: string | null; triage?: string | null; reason?: string | null; engine?: string | null; outcome?: string | null }
export interface NextResult { moment: { id: string; at: string; label: string }; results: StepResult[] }

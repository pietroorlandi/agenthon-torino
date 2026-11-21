import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { SourceView, State, User } from "./types";

// ---------- app context: state + navigation + source panel ----------
export type Tab = "guide" | "chat" | "email" | "store" | "memory" | "actions" | "sources" | "redteam" | "audit" | "obs";
interface AppCtx { state: State; openSource: (id: string) => void; goto: (tab: Tab) => void }
export const AppContext = createContext<AppCtx | null>(null);
export const useApp = () => useContext(AppContext)!;

// ---------- toasts ----------
const ToastCtx = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 flex max-w-md flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-lg bg-stone-900 px-4 py-3 text-sm whitespace-pre-line text-white shadow-lg">🧠 {t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// Run a server call, then refresh /api/state. Errors (403, 503…) become toasts.
export function useAct() {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    setBusy(true);
    try {
      const r = await fn();
      if (ok) toast(ok);
      return r;
    } catch (e) {
      toast(`⚠️ ${(e as Error).message}`);
    } finally {
      setBusy(false);
      await qc.invalidateQueries({ queryKey: ["state"] });
    }
  }, [qc, toast]);
  return { run, busy };
}

// ---------- mini markdown: **bold**, *italic*, newlines (no raw HTML: user text is escaped by React) ----------
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <span key={i}>
          {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <b key={j}>{part.slice(2, -2)}</b>
            : part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <i key={j}>{part.slice(1, -1)}</i>
            : <span key={j}>{part}</span>)}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </div>
  );
}

const TONES = {
  blue: "bg-sky-100 text-sky-800", amber: "bg-amber-100 text-amber-800", red: "bg-rose-100 text-rose-800",
  gray: "bg-stone-200 text-stone-700", green: "bg-emerald-100 text-emerald-800", purple: "bg-violet-100 text-violet-800",
};
export type Tone = keyof typeof TONES;
export function Tag({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap uppercase ${TONES[tone]}`}>{children}</span>;
}

export function Avatar({ user, size = "md" }: { user: Pick<User, "avatar" | "color">; size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-xs";
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white ${s}`} style={{ background: user.color }}>{user.avatar}</span>;
}

export const TYPE_ICON: Record<string, string> = { email: "📧", chat: "💬", doc: "📄", task: "☑️", store: "🛒", note: "📝" };

export function sourceLabel(s?: SourceView) {
  if (!s) return "fonte";
  return s.locked ? "🔒 Fonte riservata" : `${TYPE_ICON[s.type] ?? "•"} ${s.title}`;
}

export function Cites({ ids, memoryIds = [] }: { ids?: string[]; memoryIds?: string[] }) {
  const { state, openSource } = useApp();
  if (!ids?.length && !memoryIds.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs">
      <span className="muted">Fonti:</span>
      {memoryIds.map((m) => <span key={m} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">🧠 {m}</span>)}
      {ids?.map((id) => (
        <button key={id} onClick={() => openSource(id)} className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 hover:bg-sky-100">
          {sourceLabel(state.sources.find((s) => s.id === id))}
        </button>
      ))}
    </div>
  );
}

export const TRIAGE_TONE: Record<string, Tone> = { noise: "gray", spam: "gray", suspicious: "red", relevant: "blue" };
export const OUTCOME_LABEL: Record<string, [string, Tone]> = {
  ignored: ["ignorato", "gray"], quarantined: ["in quarantena", "red"], proposed: ["proposta di memoria", "amber"],
  corroborated: ["conferma memoria", "green"], no_candidates: ["niente da ricordare", "gray"], alert: ["alert", "amber"], ok: ["ok", "green"],
};

export function TriageBadges({ s }: { s: SourceView }) {
  if (!s.observed_at) return null;
  const o = s.outcome ? OUTCOME_LABEL[s.outcome] : undefined;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {s.trust === "lookalike" && <Tag tone="red">dominio somigliante</Tag>}
      {s.triage && <Tag tone={TRIAGE_TONE[s.triage]}>{s.triage}</Tag>}
      {o && <Tag tone={o[1]}>{o[0]}</Tag>}
      {s.banned && <Tag tone="red">bandita</Tag>}
    </span>
  );
}

export function SourceModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { state } = useApp();
  const s = state.sources.find((x) => x.id === id);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card relative max-h-[85vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-3 right-3 text-stone-500 hover:text-stone-900" onClick={onClose}><X size={18} /></button>
        {!s || s.locked ? (
          <><h2 className="h2 mt-0">🔒 Fonte riservata</h2><p>Questa fonte è accessibile solo a {s?.access_label ?? "altri reparti"}.</p></>
        ) : (
          <>
            <div className="muted text-xs">{TYPE_ICON[s.type]} {s.type.toUpperCase()} · {s.sender_label}{s.to_label ? ` → ${s.to_label}` : ""} · {s.date} · visibile a: {s.access_label}</div>
            <h2 className="h2 mt-2">{s.title}</h2>
            <p className="whitespace-pre-line">{s.body}</p>
            {s.observed_at && (
              <div className="mt-4 rounded-md bg-stone-50 p-3 text-xs">
                <div className="mb-1 font-semibold">Come l'ha trattata il Brain</div>
                <div>Fiducia mittente: <b>{s.trust}</b> — {s.trust_reason}</div>
                <div>Triage: <b>{s.triage}</b> ({s.triage_engine}) — {s.triage_reason}</div>
                <div className="mt-1"><TriageBadges s={s} /></div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function EngineBadge({ engine }: { engine?: string | null }) {
  if (!engine) return null;
  const tone: Tone = engine === "gemini" ? "purple" : engine === "cache" ? "blue" : "gray";
  return <Tag tone={tone}>{engine === "gemini" ? "Gemini" : engine}</Tag>;
}

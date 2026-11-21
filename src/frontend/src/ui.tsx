import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, FileText, Lock, Mail, MessageSquare, ShoppingCart, StickyNote, X, type LucideIcon } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { SourceView, State, User } from "./types";

// ---------- app context: state + navigation + source panel ----------
export type Tab = "today" | "chat" | "mail" | "knowledge" | "store" | "sources" | "redteam" | "audit" | "obs";
interface AppCtx { state: State; openSource: (id: string) => void; goto: (tab: Tab) => void; dev: boolean }
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
          <div key={t.id} className="rounded-lg bg-stone-900 px-4 py-3 text-sm whitespace-pre-line text-white shadow-lg">{t.text}</div>
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
      toast(`Errore: ${(e as Error).message}`);
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
            part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <b key={j} className="font-semibold">{part.slice(2, -2)}</b>
            : part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <i key={j}>{part.slice(1, -1)}</i>
            : <span key={j}>{part}</span>)}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </div>
  );
}

const TONES = {
  blue: "bg-sky-50 text-sky-800 ring-sky-200", amber: "bg-amber-50 text-amber-800 ring-amber-200", red: "bg-rose-50 text-rose-800 ring-rose-200",
  gray: "bg-stone-100 text-stone-600 ring-stone-200", green: "bg-emerald-50 text-emerald-800 ring-emerald-200", purple: "bg-violet-50 text-violet-800 ring-violet-200",
};
export type Tone = keyof typeof TONES;
export function Tag({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

export function Avatar({ user, size = "md" }: { user: Pick<User, "avatar" | "color">; size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${s}`} style={{ background: user.color }}>{user.avatar}</span>;
}

const TYPE_ICON: Record<string, LucideIcon> = { email: Mail, chat: MessageSquare, doc: FileText, task: CheckSquare, store: ShoppingCart, note: StickyNote };
export function SourceIcon({ type, size = 12 }: { type?: string; size?: number }) {
  const I = TYPE_ICON[type ?? ""] ?? FileText;
  return <I size={size} className="shrink-0" />;
}

// Citation chips: every answer and proposal shows where it comes from (click → original)
export function Cites({ ids, memoryIds = [] }: { ids?: string[]; memoryIds?: string[] }) {
  const { state, openSource } = useApp();
  if (!ids?.length && !memoryIds.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
      <span className="muted">Fonti</span>
      {ids?.map((id) => {
        const s = state.sources.find((x) => x.id === id);
        return (
          <button key={id} onClick={() => openSource(id)}
            className="inline-flex max-w-[260px] items-center gap-1 rounded border border-stone-200 bg-white px-1.5 py-0.5 text-stone-700 hover:border-stone-400">
            {s?.locked ? <Lock size={12} /> : <SourceIcon type={s?.type} />}
            <span className="truncate">{s?.locked ? "Riservata" : s?.title ?? "fonte"}</span>
          </button>
        );
      })}
      {memoryIds.map((m) => <span key={m} className="font-mono text-[11px] text-stone-400">{m}</span>)}
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
  const { state, dev } = useApp();
  const s = state.sources.find((x) => x.id === id);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="card relative max-h-[85vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-3 right-3 text-stone-400 hover:text-stone-900" onClick={onClose} aria-label="Chiudi"><X size={18} /></button>
        {!s || s.locked ? (
          <><h2 className="h1">Fonte riservata</h2><p className="muted">È accessibile solo a {s?.access_label ?? "altri reparti"}.</p></>
        ) : (
          <>
            <div className="muted flex items-center gap-1.5 text-xs">
              <SourceIcon type={s.type} /> {s.sender_label}{s.to_label ? ` → ${s.to_label}` : ""} · {s.date} · visibile a {s.access_label}
            </div>
            <h2 className="mt-2 mb-3 text-base font-semibold">{s.title}</h2>
            <p className="leading-relaxed whitespace-pre-line">{s.body}</p>
            {s.observed_at && (
              <div className="mt-5 border-t border-stone-100 pt-3 text-xs">
                <div className="flex flex-wrap items-center gap-2"><span className="muted">Come l'ha trattata il Brain</span><TriageBadges s={s} /></div>
                {dev && (
                  <div className="muted mt-2 space-y-0.5">
                    <div>Fiducia mittente: {s.trust} — {s.trust_reason}</div>
                    <div>Triage: {s.triage} ({s.triage_engine}) — {s.triage_reason}</div>
                  </div>
                )}
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
  return <span className="font-mono text-[10px] text-stone-400">{engine}</span>;
}

// Section heading with a count, used by every page
export function Section({ title, count, children, hint }: { title: string; count?: number; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="h2 flex items-baseline gap-2">{title}{count !== undefined && <span className="font-normal text-stone-400">{count}</span>}</h2>
      {hint && <p className="muted -mt-1 mb-2 text-xs">{hint}</p>}
      <div className="space-y-2">{children}</div>
    </section>
  );
}

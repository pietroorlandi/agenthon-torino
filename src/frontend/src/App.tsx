import { useQuery } from "@tanstack/react-query";
import { Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { api, getUser, setUser } from "./api";
import { AppContext, OUTCOME_LABEL, SourceModal, useAct, useToast, type Tab } from "./ui";
import { ActionsView } from "./views/Actions";
import { AuditView, ObservabilityView } from "./views/Audit";
import { ChatView } from "./views/Chat";
import { EmailView, GuideView } from "./views/Guide";
import { MemoryView } from "./views/Memory";
import { RedTeamView } from "./views/RedTeam";
import { SourcesView, StoreView } from "./views/Store";

const TABS: { id: Tab; label: string }[] = [
  { id: "guide", label: "🎯 Guida" }, { id: "chat", label: "💬 Chat" }, { id: "email", label: "📧 Email del mattino" },
  { id: "store", label: "🛒 Store" }, { id: "memory", label: "🧠 Memoria" }, { id: "actions", label: "✅ Azioni" },
  { id: "sources", label: "📁 Fonti" }, { id: "redteam", label: "🧪 Mettilo alla prova" }, { id: "audit", label: "📜 Audit" },
  { id: "obs", label: "📊 Osservabilità" },
];

export default function App() {
  const [userId, setUserId] = useState(getUser());
  const [tab, setTab] = useState<Tab>("guide");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const { data: state, error } = useQuery({ queryKey: ["state", userId], queryFn: api.state });
  const { run, busy } = useAct();
  const toast = useToast();

  if (error) return <div className="p-8">⚠️ Backend non raggiungibile: {(error as Error).message}. Avvia FastAPI su :8000 (vedi docs/setup.md).</div>;
  if (!state) return <div className="p-8 muted">Caricamento…</div>;

  const role = state.me.role;
  const badge: Partial<Record<Tab, number>> = {
    chat: state.unread,
    actions: state.actions.filter((a) => !a.locked && a.status === "pending").length,
    memory: state.memory.filter((m) => m.status === "pending" && m.can_curate).length
      + state.quarantine.filter((q) => q.can_decide).length + state.gaps.filter((g) => g.mine && g.status === "open").length,
  };

  const next = async () => {
    const r = await run(api.next);
    if (r) {
      const lines = r.results.map((x) => `• ${x.title}: ${x.outcome ? OUTCOME_LABEL[x.outcome]?.[0] ?? x.outcome : ""}${x.reason ? ` — ${x.reason}` : ""}`);
      toast(`${r.moment.at} — ${r.moment.label}\n${lines.join("\n")}`);
    }
  };

  return (
    <AppContext.Provider value={{ state, openSource: setSourceId, goto: setTab }}>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2">
          <div className="text-base whitespace-nowrap">🧠 <b>Company Brain</b> <span className="muted">· Bottega Sabauda</span></div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-stone-100 px-2 py-1 font-mono text-xs">🕗 {state.now}</span>
            <button className="btn-primary btn-sm" disabled={busy || !state.timeline.next} onClick={next}
              title={state.timeline.next ? `${state.timeline.next.at} — ${state.timeline.next.label}` : "Timeline finita"}>
              <Play size={14} /> Avanti {state.timeline.next ? `(${state.timeline.done + 1}/${state.timeline.total}) ${state.timeline.next.at.split(" ")[1]}` : "— fine"}
            </button>
            <label className="muted text-xs" htmlFor="user">Stai usando come</label>
            <select id="user" className="rounded-md border border-stone-300 px-2 py-1" value={userId}
              onChange={(e) => { setUser(e.target.value); setUserId(e.target.value); }}>
              {state.users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.role_label}</option>)}
            </select>
            <button className="btn btn-sm" disabled={busy} title="Ripristina i dati della demo"
              onClick={() => run(api.reset, "Demo ripristinata")}><RotateCcw size={14} /> Reset</button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-1.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`rounded-md px-2.5 py-1.5 whitespace-nowrap ${tab === t.id ? "bg-sky-50 font-semibold text-brand" : "hover:bg-stone-100"}`}>
              {t.label}
              {!!badge[t.id] && <span className={`ml-1.5 rounded-full px-1.5 text-[11px] text-white ${t.id === "chat" ? "bg-rose-600" : "bg-amber-600"}`}>{badge[t.id]}</span>}
            </button>
          ))}
          <span className="muted ml-auto self-center pl-3 text-xs whitespace-nowrap">
            LLM: <b>{state.llm.mode}</b>{state.llm.mode !== "off" && ` · ${state.llm.model}`} · ruolo {state.roles[role]}
          </span>
        </nav>
      </header>
      <main>
        {tab === "guide" && <GuideView />}
        {tab === "chat" && <ChatView />}
        {tab === "email" && <EmailView />}
        {tab === "store" && <StoreView />}
        {tab === "memory" && <MemoryView />}
        {tab === "actions" && <ActionsView />}
        {tab === "sources" && <SourcesView />}
        {tab === "redteam" && <RedTeamView />}
        {tab === "audit" && <AuditView />}
        {tab === "obs" && <ObservabilityView />}
      </main>
      {sourceId && <SourceModal id={sourceId} onClose={() => setSourceId(null)} />}
    </AppContext.Provider>
  );
}

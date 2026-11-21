import { useQuery } from "@tanstack/react-query";
import { Play, RotateCcw, Wrench } from "lucide-react";
import { useState } from "react";
import { api, getUser, setUser } from "./api";
import { AppContext, OUTCOME_LABEL, SourceModal, useAct, useToast, type Tab } from "./ui";
import { AuditView, ObservabilityView } from "./views/Audit";
import { ChatView } from "./views/Chat";
import { MailView } from "./views/Mail";
import { KnowledgeView } from "./views/Memory";
import { RedTeamView } from "./views/RedTeam";
import { SourcesView, StoreView } from "./views/Store";
import { TodayView } from "./views/Today";

// End users: what needs me, the simulated team chat and mailbox, what we know. Everything else is a developer/demo tool.
const USER_TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Oggi" }, { id: "chat", label: "Chat" }, { id: "mail", label: "Posta" }, { id: "knowledge", label: "Cosa sappiamo" },
];
const DEV_TABS: { id: Tab; label: string }[] = [
  { id: "store", label: "Store" }, { id: "sources", label: "Fonti" }, { id: "redteam", label: "Mettilo alla prova" },
  { id: "audit", label: "Audit" }, { id: "obs", label: "Osservabilità" },
];

const readDev = () => { try { return localStorage.getItem("brain.dev") === "1"; } catch { return false; } };
// The open tab lives in the URL hash, so a refresh (or a shared link) keeps it
const hashTab = (): Tab | null => {
  const h = location.hash.slice(1);
  return [...USER_TABS, ...DEV_TABS].some((t) => t.id === h) ? (h as Tab) : null;
};

export default function App() {
  const [userId, setUserId] = useState(getUser());
  const [tab, setTabState] = useState<Tab>(() => hashTab() ?? "today");
  const [dev, setDevState] = useState(() => readDev() || DEV_TABS.some((t) => t.id === hashTab()));
  const setTab = (t: Tab) => { setTabState(t); history.replaceState(null, "", `#${t}`); };
  const [sourceId, setSourceId] = useState<string | null>(null);
  const { data: state, error } = useQuery({
    queryKey: ["state", userId], queryFn: api.state,
    refetchInterval: (q) => (q.state.data?.outbox.some((o) => o.delivery === "sending") ? 1500 : false), // real email in flight
  });
  const { run, busy } = useAct();
  const toast = useToast();

  const setDev = (on: boolean) => {
    setDevState(on);
    try { localStorage.setItem("brain.dev", on ? "1" : "0"); } catch { /* private mode */ }
    if (!on && DEV_TABS.some((t) => t.id === tab)) setTab("today");
  };

  if (error) return <div className="p-8">Backend non raggiungibile: {(error as Error).message}. Avvia FastAPI su :8000 (vedi docs/setup.md).</div>;
  if (!state) return <div className="muted p-8">Caricamento…</div>;

  const todo = state.quarantine.filter((q) => q.can_decide).length
    + state.actions.filter((a) => !a.locked && a.status === "pending").length
    + state.gaps.filter((g) => g.mine && g.status === "open").length
    + state.memory.filter((m) => m.status === "pending" && m.can_curate).length;
  const badge: Partial<Record<Tab, number>> = { today: todo, chat: state.unread };

  const next = async () => {
    const r = await run(api.next);
    if (r) {
      const lines = r.results.map((x) => `• ${x.title}: ${x.outcome ? OUTCOME_LABEL[x.outcome]?.[0] ?? x.outcome : ""}${x.reason ? ` — ${x.reason}` : ""}`);
      toast(`${r.moment.at} — ${r.moment.label}\n${lines.join("\n")}`);
    }
  };

  const tabBtn = (t: { id: Tab; label: string }) => (
    <button key={t.id} onClick={() => setTab(t.id)}
      className={`relative px-3 py-4 whitespace-nowrap ${tab === t.id ? "font-semibold text-stone-900 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brand" : "text-stone-500 hover:text-stone-900"}`}>
      {t.label}
      {!!badge[t.id] && <span className="ml-1.5 rounded-full bg-brand px-1.5 py-px text-[11px] font-medium text-white">{badge[t.id]}</span>}
    </button>
  );

  return (
    <AppContext.Provider value={{ state, openSource: setSourceId, goto: setTab, dev }}>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4">
          <div className="font-semibold whitespace-nowrap">Company Brain <span className="font-normal text-stone-400">Bottega Sabauda</span></div>
          <nav className="flex overflow-x-auto">{USER_TABS.map(tabBtn)}</nav>
          <div className="ml-auto flex items-center gap-2">
            <select className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm" value={userId} aria-label="Persona"
              onChange={(e) => { setUser(e.target.value); setUserId(e.target.value); }}>
              {state.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role_label}</option>)}
            </select>
            <button className={`btn btn-sm ${dev ? "border-stone-800 bg-stone-800 text-white hover:bg-stone-700" : ""}`} onClick={() => setDev(!dev)}
              title="Strumenti per sviluppatori e demo" aria-pressed={dev}><Wrench size={14} /> Dev</button>
          </div>
        </div>
        {dev && (
          <div className="border-t border-stone-700 bg-stone-900 text-stone-200">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs">
              <span className="font-mono">{state.now}</span>
              <button className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 font-medium text-stone-900 disabled:opacity-40" disabled={busy || !state.timeline.next} onClick={next}
                title={state.timeline.next ? `${state.timeline.next.at} — ${state.timeline.next.label}` : "Timeline finita"}>
                <Play size={12} /> {state.timeline.next ? `Avanti ${state.timeline.done + 1}/${state.timeline.total}` : "Fine timeline"}
              </button>
              <button className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-white/10" disabled={busy} onClick={() => run(api.reset, "Demo ripristinata")}><RotateCcw size={12} /> Reset</button>
              <span className="text-stone-500">|</span>
              {DEV_TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} className={`rounded px-2 py-1 ${tab === t.id ? "bg-white/15 text-white" : "hover:bg-white/10"}`}>{t.label}</button>
              ))}
              <span className="ml-auto font-mono text-stone-400">LLM {state.llm.mode}{state.llm.mode !== "off" && ` · ${state.llm.model}`}</span>
            </div>
          </div>
        )}
      </header>
      <main>
        {tab === "today" && <TodayView />}
        {tab === "chat" && <ChatView />}
        {tab === "mail" && <MailView />}
        {tab === "knowledge" && <KnowledgeView />}
        {tab === "store" && <StoreView />}
        {tab === "sources" && <SourcesView />}
        {tab === "redteam" && <RedTeamView />}
        {tab === "audit" && <AuditView />}
        {tab === "obs" && <ObservabilityView />}
      </main>
      {sourceId && <SourceModal id={sourceId} onClose={() => setSourceId(null)} />}
    </AppContext.Provider>
  );
}

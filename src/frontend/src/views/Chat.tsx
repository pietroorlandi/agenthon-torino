import { Hash, Loader2, Lock, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Lockup } from "../brand";
import type { Message } from "../types";
import { Avatar, Cites, EngineBadge, OUTCOME_LABEL, RichText, TriageBadges, useAct, useApp, useToast } from "../ui";

// Short, human label for each kind of Brain message (no badges soup)
const KIND: Record<string, [string, string]> = {
  answer: ["Dalla memoria approvata", "text-emerald-700"], unknown: ["Non lo so", "text-stone-500"],
  denied: ["Riservato", "text-rose-700"], gap: ["Ho chiesto a chi lo sa", "text-violet-700"],
  alert: ["Avviso", "text-amber-700"], security: ["Sicurezza", "text-rose-700"], done: ["Fatto", "text-emerald-700"],
  info: ["Proposta", "text-amber-700"], brief: ["Brief del mattino", "text-stone-500"],
};

// "dd/mm hh:mm" → sortable "mm/dd hh:mm"
const key = (d?: string) => (d ? `${d.slice(3, 5)}/${d.slice(0, 2)}${d.slice(5)}` : "");

function BrainMsg({ m }: { m: Message }) {
  const { state, goto, dev } = useApp();
  const k = KIND[m.kind];
  // the button only for whoever actually has to decide (the asker of a gap does not)
  const needsDecision = state.actions.some((a) => a.id === m.action_id && a.can_decide)
    || state.quarantine.some((q) => q.id === m.quarantine_id && q.can_decide)
    || state.gaps.some((g) => g.id === m.gap_id && g.mine && g.status === "open");
  return (
    <div className="flex gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-savoia text-xs font-semibold text-white">B</span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2 text-xs">
          <b className="text-sm font-semibold">Brain</b><span className="muted">{m.time}</span>
          {k && <span className={k[1]}>{k[0]}</span>}
          {dev && <EngineBadge engine={m.engine} />}
        </div>
        <RichText text={m.text} className="leading-relaxed" />
        {m.items && <ul className="mt-2 list-disc space-y-1.5 pl-5">{m.items.map((it, i) => <li key={i}><RichText text={it.text} /><Cites ids={it.sources} /></li>)}</ul>}
        <Cites ids={m.sources} memoryIds={dev ? m.memory_ids : []} />
        {needsDecision && <button className="btn btn-sm mt-2" onClick={() => goto("today")}>Decidi in Oggi</button>}
      </div>
    </div>
  );
}

const THINKING_STEPS = ["Leggo la domanda…", "Controllo i permessi del tuo ruolo…", "Cerco nella memoria approvata…", "Verifico le fonti…", "Preparo la risposta…"];

// Placeholder shown while /api/ask is still computing
function ThinkingMsg() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex gap-3" role="status" aria-live="polite">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-savoia text-xs font-semibold text-white">B</span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-xs"><b className="text-sm font-semibold">Brain</b> <span className="muted">sta pensando…</span></div>
        <div className="flex items-center gap-2 text-stone-500">
          <Loader2 size={15} className="animate-spin text-brand" />
          <span>{THINKING_STEPS[step]}</span>
          <span className="flex gap-1" aria-hidden>
            {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: `${d}ms` }} />)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ChatView() {
  const { state, dev } = useApp();
  const { run, busy } = useAct();
  const toast = useToast();
  const [channel, setChannel] = useState("brain");
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const me = state.me;
  const users = Object.fromEntries(state.users.map((u) => [u.id, u]));
  const isBrain = channel === "brain";
  const thinking = pending !== null;
  const asked = thinking || state.dm.some((m) => m.sender === "user");
  const channelMsgs = state.sources.filter((s) => !s.locked && s.type === "chat" && s.channel === channel)
    .sort((a, b) => key(a.date).localeCompare(key(b.date)));

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [channel, state.dm.length, channelMsgs.length, pending]);
  useEffect(() => { if (isBrain && state.unread) api.read(); }, [isBrain, state.unread]);

  // Show the question at once + a "thinking" placeholder until the answer (and refreshed state) arrives
  const ask = async (q: string) => {
    if (!q.trim() || thinking) return;
    setPending(q.trim());
    try {
      await run(() => api.ask(q));  // run() also refetches the state
    } finally {
      setPending(null);
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    if (isBrain) { await ask(t); return; }
    // a message in a channel goes through the real pipeline, with the session identity (not what the text claims)
    const r = await run(() => api.inject({ type: "chat", channel, body: t }));
    if (r && dev) toast(`Il Brain ha letto il messaggio: ${r.outcome ? OUTCOME_LABEL[r.outcome]?.[0] ?? r.outcome : ""}${r.reason ? ` — ${r.reason}` : ""}`);
  };

  const navBtn = (id: string, label: React.ReactNode, locked = false, badge = 0) => (
    <button key={id} disabled={locked} onClick={() => setChannel(id)}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left disabled:opacity-40 ${channel === id ? "bg-hazel-soft font-medium text-cocoa" : "text-stone-600 hover:bg-stone-100"}`}>
      {label}
      {locked && <Lock size={12} className="ml-auto" />}
      {!!badge && <span className="ml-auto rounded-full bg-brand px-1.5 text-[11px] text-white">{badge}</span>}
    </button>
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-6xl">
      <nav className="w-52 shrink-0 space-y-0.5 overflow-y-auto border-r border-stone-200 p-2">
        <div className="px-2 pt-1 pb-1 text-xs text-stone-400">Messaggi diretti</div>
        {navBtn("brain", <><span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-savoia text-[9px] font-semibold text-white">B</span> Brain</>, false, isBrain ? 0 : state.unread)}
        <div className="px-2 pt-4 pb-1 text-xs text-stone-400">Canali</div>
        {state.channels.map((c) => navBtn(c.id, <><Hash size={14} className="shrink-0" /> {c.id}</>, c.locked))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="border-b border-stone-200 px-5 py-3">
          {isBrain ? <><b className="font-semibold">Brain</b> <span className="muted">· chiedi qualcosa sull'azienda</span></>
            : <><b className="font-semibold">#{channel}</b> <span className="muted">· il Brain legge questo canale</span></>}
        </div>

        <div ref={box} className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          {isBrain ? (
            <>
              {state.dm.filter((m) => m.kind !== "brief").map((m) => m.sender === "user" ? (
                <div key={m.id} className="flex gap-3">
                  <Avatar user={me} />
                  <div><div className="mb-0.5 text-xs"><b className="text-sm font-semibold">{me.name}</b> <span className="muted">{m.time}</span></div>{m.text}</div>
                </div>
              ) : <BrainMsg key={m.id} m={m} />)}
              {thinking && (
                <>
                  <div className="flex gap-3 opacity-80">
                    <Avatar user={me} />
                    <div><div className="mb-0.5 text-xs"><b className="text-sm font-semibold">{me.name}</b> <span className="muted">ora</span></div>{pending}</div>
                  </div>
                  <ThinkingMsg />
                </>
              )}
              {!asked && (
                <div className="muted mt-auto flex flex-col items-center text-center">
                  <div className="mb-5"><Lockup size={96} /></div>
                  <p className="font-display text-lg font-semibold text-cocoa">Chiedimi qualcosa sull'azienda.</p>
                  <p className="text-xs">Rispondo solo con informazioni approvate dal team e ti dico da dove vengono. Se non lo so, lo dico.</p>
                </div>
              )}
            </>
          ) : channelMsgs.length ? channelMsgs.map((s) => {
            const a = users[s.sender ?? ""];
            return (
              <div key={s.id} className="flex gap-3">
                {a ? <Avatar user={a} /> : <span className="h-8 w-8 shrink-0" />}
                <div className="min-w-0">
                  <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <b className="text-sm font-semibold">{s.sender_label}</b><span className="muted">{s.date}</span>
                    {(dev || s.in_quarantine) && <TriageBadges s={s} />}
                  </div>
                  <p className="whitespace-pre-line">{s.body}</p>
                </div>
              </div>
            );
          }) : <p className="muted">Nessun messaggio in questo canale.</p>}
        </div>

        <div className="border-t border-stone-200 px-5 py-3">
          {isBrain && !asked && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {state.suggestions.slice(0, 4).map((q) => (
                <button key={q} disabled={busy} onClick={() => ask(q)} className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs hover:border-stone-500">{q}</button>
              ))}
            </div>
          )}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off"
              placeholder={thinking ? "Il Brain sta pensando…" : isBrain ? "Scrivi una domanda…" : `Scrivi in #${channel} come ${me.name}…`} />
            <button className="btn-primary" disabled={busy || thinking || !text.trim()} aria-label="Invia">{busy || thinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

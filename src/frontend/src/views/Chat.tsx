import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Message } from "../types";
import { Avatar, Cites, EngineBadge, RichText, Tag, TriageBadges, useAct, useApp, type Tone } from "../ui";

const KIND_TAG: Record<string, [string, Tone]> = {
  brief: ["proattivo · nessuno l'ha chiesto", "blue"], alert: ["alert proattivo", "amber"], security: ["sicurezza", "red"],
  denied: ["accesso negato", "red"], unknown: ["non lo so", "gray"], answer: ["dalla memoria approvata", "green"],
  gap: ["buco di conoscenza · richiesta aperta", "purple"], done: ["eseguito dopo approvazione", "green"], info: ["proposta", "amber"],
};
const BORDER: Record<string, string> = {
  brief: "border-l-sky-600", alert: "border-l-amber-500", security: "border-l-rose-600", denied: "border-l-rose-600",
  unknown: "border-l-stone-400", answer: "border-l-emerald-600", done: "border-l-emerald-600", gap: "border-l-violet-500", info: "border-l-amber-500",
};

function BrainMsg({ m }: { m: Message }) {
  const { state, goto } = useApp();
  const tag = KIND_TAG[m.kind];
  const gap = m.gap_id ? state.gaps.find((g) => g.id === m.gap_id) : undefined;
  return (
    <div className="flex gap-2.5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-800 text-lg">🧠</span>
      <div className={`min-w-0 flex-1 rounded-lg border border-l-4 border-stone-200 bg-stone-50 px-3 py-2.5 ${BORDER[m.kind] ?? ""}`}>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <b>Brain</b><span className="rounded bg-stone-200 px-1 text-[10px]">APP</span><span className="muted text-xs">{m.time}</span>
          {tag && <Tag tone={tag[1]}>{tag[0]}</Tag>}<EngineBadge engine={m.engine} />
        </div>
        <RichText text={m.text} />
        {m.items && <ul className="mt-2 list-disc space-y-2 pl-5">{m.items.map((it, i) => <li key={i}><RichText text={it.text} /><Cites ids={it.sources} /></li>)}</ul>}
        <Cites ids={m.sources} memoryIds={m.memory_ids} />
        <div className="mt-2 flex gap-2">
          {m.action_id && <button className="btn-primary btn-sm" onClick={() => goto("actions")}>Vedi azione in attesa →</button>}
          {m.quarantine_id && <button className="btn-primary btn-sm" onClick={() => goto("memory")}>Decidi in Memoria →</button>}
          {gap?.mine && gap.status === "open" && <button className="btn-primary btn-sm" onClick={() => goto("memory")}>Documenta ora →</button>}
        </div>
      </div>
    </div>
  );
}

export function ChatView() {
  const { state } = useApp();
  const { run, busy } = useAct();
  const [channel, setChannel] = useState("brain");
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const me = state.me;
  const users = Object.fromEntries(state.users.map((u) => [u.id, u]));

  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [channel, state.dm.length]);
  useEffect(() => { if (channel === "brain" && state.unread) api.read(); }, [channel, state.unread]);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setText("");
    await run(() => api.ask(q));
  };

  const channelMsgs = state.sources.filter((s) => !s.locked && s.type === "chat" && s.channel === channel)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  return (
    <section className="flex h-[calc(100vh-92px)]">
      <aside className="w-56 shrink-0 overflow-y-auto bg-side p-2 text-side-ink">
        <div className="px-2 pt-1 pb-3 text-[15px] font-bold text-white">Bottega Sabauda</div>
        <div className="px-2 pt-2 pb-1 text-xs uppercase opacity-70">Canali</div>
        {state.channels.map((c) => (
          <button key={c.id} disabled={c.locked} onClick={() => setChannel(c.id)}
            className={`block w-full rounded px-2 py-1 text-left disabled:opacity-40 ${channel === c.id ? "bg-brand text-white" : "hover:bg-white/10"}`}>
            # {c.id}{c.locked && " 🔒"}
          </button>
        ))}
        <div className="px-2 pt-4 pb-1 text-xs uppercase opacity-70">App</div>
        <button onClick={() => setChannel("brain")} className={`block w-full rounded px-2 py-1 text-left ${channel === "brain" ? "bg-brand text-white" : "hover:bg-white/10"}`}>
          🧠 Brain {!!state.unread && channel !== "brain" && <span className="ml-1 rounded-full bg-rose-600 px-1.5 text-[11px] text-white">{state.unread}</span>}
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="border-b border-stone-200 px-4 py-3">
          {channel === "brain" ? <><b>🧠 Brain</b> <span className="muted">· messaggi diretti con {me.name} ({me.role_label})</span></>
            : <><b># {channel}</b> <span className="muted">· il Brain osserva questo canale</span></>}
        </div>
        <div ref={box} className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
          {channel === "brain" ? state.dm.map((m) => m.sender === "user" ? (
            <div key={m.id} className="flex gap-2.5"><Avatar user={me} /><div><div className="mb-0.5"><b>{me.name}</b> <span className="muted text-xs">{m.time}</span></div>{m.text}</div></div>
          ) : <BrainMsg key={m.id} m={m} />)
            : channelMsgs.length ? channelMsgs.map((s) => {
              const a = users[s.sender ?? ""];
              return (
                <div key={s.id} className="flex gap-2.5">
                  {a ? <Avatar user={a} /> : <span className="h-9 w-9" />}
                  <div><div className="mb-0.5 flex flex-wrap items-center gap-1.5"><b>{s.sender_label}</b> <span className="muted text-xs">{s.date}</span><TriageBadges s={s} /></div>{s.body}</div>
                </div>
              );
            }) : <p className="muted p-5">Nessun messaggio recente.</p>}
        </div>
        {channel === "brain" ? (
          <>
            <div className="flex flex-wrap gap-1.5 border-t border-stone-200 px-4 pt-2">
              {state.suggestions.map((q) => <button key={q} disabled={busy} onClick={() => ask(q)} className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-xs text-brand hover:bg-sky-50">{q}</button>)}
            </div>
            <form className="flex gap-2 px-4 pt-2.5 pb-3.5" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Chiedi qualcosa al Brain…" autoComplete="off" />
              <button className="btn-primary" disabled={busy}>{busy ? "…" : "Invia"}</button>
            </form>
          </>
        ) : <div className="px-4 pb-3.5"><input className="input" disabled placeholder="Canale simulato (sola lettura): per scrivere usa 🧪 Mettilo alla prova" /></div>}
      </div>
    </section>
  );
}

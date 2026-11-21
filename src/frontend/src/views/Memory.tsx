import { Building2, Check, ChevronDown, ChevronRight, Headset, History, Package, PackageCheck, Search, ShieldAlert, Store, Truck, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import type { GapView, MemoryView as Mem, QuarantineView } from "../types";
import { Cites, useAct, useApp } from "../ui";

// A fact the Brain proposes: nobody uses it to answer until the right person approves it.
export function ProposalCard({ m }: { m: Mem }) {
  const { run, busy } = useAct();
  return (
    <article className="card">
      <p>{m.text}</p>
      {m.attributed_to && <p className="muted mt-1 text-xs">Lo dice {m.attributed_to}: non è un fatto verificato.</p>}
      {m.source_quote && <blockquote className="muted mt-2 border-l-2 border-stone-200 pl-2 text-xs">«{m.source_quote}»</blockquote>}
      <Cites ids={m.source_ids} />
      <div className="mt-3 flex gap-2">
        <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.memory(m.id, "approve"))}><Check size={14} /> È corretto, ricordalo</button>
        <button className="btn-danger btn-sm" disabled={busy} onClick={() => run(() => api.memory(m.id, "reject"))}><X size={14} /> Non è corretto</button>
      </div>
    </article>
  );
}

export function QuarantineCard({ q }: { q: QuarantineView }) {
  const { run, busy } = useAct();
  const contradiction = q.kind === "contradiction";
  return (
    <article className="card border-rose-200">
      <div className="flex items-center gap-2 font-semibold text-rose-800">
        <ShieldAlert size={16} /> {contradiction ? "Informazione in contrasto con ciò che sappiamo" : "Messaggio sospetto"}
      </div>
      {contradiction ? (
        <dl className="mt-2 grid gap-1.5 sm:grid-cols-[110px_1fr]">
          <dt className="muted">Nuova</dt><dd>«{q.claim_text}»</dd>
          <dt className="muted">Già approvata</dt><dd>{q.memory_text} <span className="muted text-xs">({q.memory_approved_by ?? "il team"})</span></dd>
          {q.order_id && <><dt className="muted">Attenzione</dt><dd>È già stata applicata all'ordine <b>{q.order_id}</b>.</dd></>}
        </dl>
      ) : (
        <p className="mt-1 text-stone-700">{q.reason}. Non ne ho estratto nulla e non propongo azioni finché non decidi.</p>
      )}
      <Cites ids={q.source_id ? [q.source_id] : []} />
      <div className="mt-3 flex flex-wrap gap-2">
        {contradiction ? (
          <>
            <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.quarantine(q.id, "ban"))}>Scarta, vale la versione approvata</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => run(() => api.quarantine(q.id, "accept"))}>Accetta e aggiorna</button>
          </>
        ) : (
          <>
            <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.quarantine(q.id, "confirm-bad"))}>Confermo, è da scartare</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => run(() => api.quarantine(q.id, "release"))}>È legittimo, rilascialo</button>
          </>
        )}
      </div>
    </article>
  );
}

// A colleague asked something nobody ever wrote down: the competent department documents it once.
export function GapCard({ g }: { g: GapView }) {
  const { state } = useApp();
  const { run, busy } = useAct();
  const [fact, setFact] = useState("");
  const [access, setAccess] = useState("all");
  const me = state.me;
  return (
    <article className="card">
      <p><span className="muted">{g.asked_by_name} ({g.asked_by_role_label}) chiede:</span> <b className="font-semibold">«{g.question}»</b></p>
      <p className="muted mt-1 text-xs">Non è scritto da nessuna parte. Rispondi una volta e il Brain lo saprà per tutti.</p>
      <textarea className="input mt-2" rows={2} value={fact} onChange={(e) => setFact(e.target.value)} placeholder="Scrivi la risposta…" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs" value={access} onChange={(e) => setAccess(e.target.value)} aria-label="Chi può vederlo">
          <option value="all">Visibile a tutti</option>
          {g.asker_role !== me.role && <option value={`${me.role},${g.asker_role}`}>Solo {state.roles[me.role]} e {state.roles[g.asker_role]}</option>}
          <option value={me.role}>Solo {state.roles[me.role]}</option>
        </select>
        <button className="btn-primary btn-sm" disabled={busy || !fact.trim()} onClick={() => run(() => api.gapAnswer(g.id, fact, g.question, access.split(",")), "Salvato: ora il Brain lo sa")}>Salva risposta</button>
        <button className="btn btn-sm" disabled={busy} onClick={() => run(() => api.gapDismiss(g.id))}>Non è di mia competenza</button>
      </div>
    </article>
  );
}

function FactRow({ m, from }: { m: Mem; from?: string }) {
  const { state } = useApp();
  const { run, busy } = useAct();
  const look = m.dept ? DEPT[m.dept] : undefined;
  const canShip = !!m.order_id && !m.completed && state.me.role === "spedizioni";
  return (
    <li className="border-b border-stone-100 py-3 last:border-0">
      {(from || m.order_id || m.status === "pending") && (
        <div className="mb-1 flex flex-wrap gap-1.5">
          {m.order_id && (
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium ${m.completed ? "bg-emerald-100 text-emerald-800" : "bg-savoia-soft text-savoia"}`}>
              Ordine {m.order_id}{m.order_status && ` · ${m.order_status}`}
            </span>
          )}
          {from && <span className={`inline-block rounded px-1.5 py-px text-[11px] font-medium ${look?.tint ?? "bg-stone-200 text-stone-700"}`}>dal comparto {from}</span>}
          {m.status === "pending" && <span className="inline-block rounded bg-amber-100 px-1.5 py-px text-[11px] font-medium text-amber-800">Da verificare · non usata per rispondere</span>}
        </div>
      )}
      {m.question && <div className="muted text-xs">{m.question}</div>}
      <p>{m.text}</p>
      <div className="muted mt-0.5 text-xs">
        {m.approved_by ? `Approvato da ${m.approved_by}` : m.rejected_by ? `Rifiutato da ${m.rejected_by}` : ""}
        {m.access_label && ` · visibile a ${m.access_label}`}
        {m.source_ids.length > 1 && ` · confermato da ${m.source_ids.length} fonti`}
      </div>
      <Cites ids={m.source_ids} />
      {canShip && (
        <button className="btn btn-sm mt-2" disabled={busy}
          onClick={() => run(() => api.shipOrder(m.order_id!), `Ordine ${m.order_id} evaso: la nozione è passata nello storico`)}>
          <PackageCheck size={14} /> Segna come evaso
        </button>
      )}
    </li>
  );
}

// Department look: icon + tint, so the four comparti are recognisable at a glance
const DEPT: Record<string, { icon: LucideIcon; tint: string }> = {
  magazzino: { icon: Package, tint: "bg-amber-100 text-amber-800" },
  clienti: { icon: Headset, tint: "bg-emerald-100 text-emerald-800" },
  shop: { icon: Store, tint: "bg-sky-100 text-sky-800" },
  spedizioni: { icon: Truck, tint: "bg-violet-100 text-violet-800" },
  general: { icon: Building2, tint: "bg-stone-200 text-stone-700" },
};
const GENERAL = "general";

function Counts({ facts }: { facts: Mem[] }) {
  const pending = facts.filter((m) => m.status === "pending").length;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs">
      {pending > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-px font-medium text-amber-800">{pending} da verificare</span>}
      <span className="muted tabular-nums">{facts.length}</span>
    </span>
  );
}

// What the company knows, browsable as comparto → argomento → fatti. Only approved facts are used to answer.
export function KnowledgeView() {
  const { state } = useApp();
  const [q, setQ] = useState("");
  // one section open per level: opening one closes the sibling
  const [openDept, setOpenDept] = useState<string | null>(state.me.role);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const searching = q.trim().length > 0;
  const match = (m: Mem) => !searching || `${m.text} ${m.question ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
  // Department policy (enforced server side, see views.memory_scope): my comparto + what other comparti shared with everyone.
  // "review" items are other comparti's proposals I must verify: they live in 'Oggi', not here.
  const visible = state.memory.filter((m) => !m.locked && m.scope !== "review");
  const live = visible.filter((m) => (m.status === "approved" || m.status === "pending") && match(m));
  // facts about orders already fulfilled: only behind "Visualizza storico"
  const current = live.filter((m) => !m.completed);
  const history = live.filter((m) => m.completed);
  const past = visible.filter((m) => (m.status === "rejected" || m.status === "superseded") && match(m));
  const hidden = state.memory.filter((m) => (m.locked || m.scope === "review") && m.status === "approved").length;

  const depts = [state.me.role, GENERAL];
  const deptOf = (m: Mem) => (m.scope === "mine" ? state.me.role : GENERAL);
  const deptLabel = (d: string) => (d === GENERAL ? "Condivise con te" : state.roles[d as keyof typeof state.roles]);
  const originOf = (m: Mem) => (m.scope === "shared" && m.dept ? state.roles[m.dept] : undefined);
  const byStatus = (a: Mem, b: Mem) => (a.status === b.status ? 0 : a.status === "approved" ? -1 : 1);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="h1">Cosa sappiamo</h1>
      <p className="muted">Il Brain risponde solo con informazioni approvate da una persona del team. Qui trovi le nozioni del tuo comparto e quelle che gli altri comparti hanno condiviso con tutti.</p>
      <label className="relative mt-4 block">
        <Search size={16} className="absolute top-2.5 left-3 text-stone-400" />
        <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca (es. corriere, sconto, allergeni)" />
      </label>
      {searching && <p className="muted mt-2 text-xs">{current.length ? `${current.length} risultati: ho aperto le sezioni che li contengono.` : "Nessun risultato."}</p>}

      <div className="mt-5 space-y-2.5">
        {depts.map((d) => {
          const facts = current.filter((m) => deptOf(m) === d);
          const done = history.filter((m) => deptOf(m) === d);
          if (!facts.length && !done.length) return null;
          const showHistory = searching || historyOpen === d;
          const look = DEPT[d] ?? DEPT[GENERAL];
          const Icon = look.icon;
          const open = searching || openDept === d;
          return (
            <section key={d} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50" aria-expanded={open}
                onClick={() => { setOpenDept(open ? null : d); setOpenTopic(null); }}>
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${look.tint}`}><Icon size={18} /></span>
                <span className="min-w-0">
                  <span className="block font-display text-[15px] font-semibold text-stone-900">{deptLabel(d)}</span>
                  <span className="muted block text-xs">{d === GENERAL ? "Nozioni di altri comparti condivise con tutti o con te" : "Il tuo comparto"}</span>
                </span>
                <Counts facts={facts} />
                <ChevronDown size={18} className={`shrink-0 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="space-y-1.5 border-t border-stone-100 bg-stone-50/60 px-3 py-3">
                  {state.knowledge_topics.map((t) => {
                    const tf = facts.filter((m) => (m.topic ?? "base") === t.id).sort(byStatus);
                    if (!tf.length) return null;
                    const key = `${d}/${t.id}`;
                    const topicOpen = searching || openTopic === key;
                    return (
                      <div key={key} className="rounded-md border border-stone-200 bg-white">
                        <button className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-hazel-soft/50" aria-expanded={topicOpen}
                          onClick={() => setOpenTopic(topicOpen ? null : key)}>
                          <ChevronRight size={16} className={`shrink-0 text-stone-400 transition-transform ${topicOpen ? "rotate-90" : ""}`} />
                          <span className="font-medium text-stone-800">{t.label}</span>
                          <Counts facts={tf} />
                        </button>
                        {topicOpen && <ul className="border-t border-stone-100 px-4 py-0">{tf.map((m) => <FactRow key={m.id} m={m} from={originOf(m)} />)}</ul>}
                      </div>
                    );
                  })}
                  {done.length > 0 && (
                    <div className="pt-1">
                      <button className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-savoia hover:bg-savoia-soft" aria-expanded={showHistory}
                        onClick={() => setHistoryOpen(showHistory ? null : d)}>
                        <History size={14} /> {showHistory ? "Nascondi storico" : `Visualizza storico (${done.length})`}
                      </button>
                      {showHistory && (
                        <div className="mt-1.5 rounded-md border border-dashed border-stone-300 bg-white">
                          <p className="muted border-b border-stone-100 px-4 py-1.5 text-xs">Ordini evasi: queste nozioni non servono più per il lavoro di oggi.</p>
                          <ul className="px-4 py-0 opacity-80">{done.map((m) => <FactRow key={m.id} m={m} from={originOf(m)} />)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {hidden > 0 && <p className="muted mt-3 text-xs">{hidden === 1 ? "Un'altra nozione è riservata" : `Altre ${hidden} nozioni sono riservate`} agli altri comparti e non sono visibili.</p>}
      {past.length > 0 && (
        <details className="mt-6">
          <summary className="muted cursor-pointer text-xs">Rifiutate o sostituite ({past.length})</summary>
          <ul className="card mt-2 py-0">{past.map((m) => <FactRow key={m.id} m={m} from={originOf(m)} />)}</ul>
        </details>
      )}
    </div>
  );
}

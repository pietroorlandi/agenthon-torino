import { Check, Search, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import type { GapView, MemoryView as Mem, QuarantineView } from "../types";
import { Cites, Section, useAct, useApp } from "../ui";

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

function FactRow({ m }: { m: Mem }) {
  return (
    <li className="border-b border-stone-100 py-3 last:border-0">
      {m.question && <div className="muted text-xs">{m.question}</div>}
      <p>{m.text}</p>
      <div className="muted mt-0.5 text-xs">
        {m.approved_by ? `Approvato da ${m.approved_by}` : m.rejected_by ? `Rifiutato da ${m.rejected_by}` : ""}
        {m.access_label && ` · visibile a ${m.access_label}`}
        {m.source_ids.length > 1 && ` · confermato da ${m.source_ids.length} fonti`}
      </div>
      <Cites ids={m.source_ids} />
    </li>
  );
}

// What the company knows: only approved facts are used to answer.
export function KnowledgeView() {
  const { state } = useApp();
  const [q, setQ] = useState("");
  const match = (m: Mem) => !q || `${m.text} ${m.question ?? ""}`.toLowerCase().includes(q.toLowerCase());
  const visible = state.memory.filter((m) => !m.locked);
  const approved = visible.filter((m) => m.status === "approved" && match(m));
  const pending = visible.filter((m) => m.status === "pending" && match(m));
  const past = visible.filter((m) => (m.status === "rejected" || m.status === "superseded") && match(m));
  const locked = state.memory.filter((m) => m.locked && m.status === "approved").length;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="h1">Cosa sappiamo</h1>
      <p className="muted">Il Brain risponde solo con queste informazioni, approvate da una persona del team.</p>
      <label className="relative mt-4 block">
        <Search size={16} className="absolute top-2.5 left-3 text-stone-400" />
        <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca (es. corriere, sconto, allergeni)" />
      </label>
      <Section title="Approvate" count={approved.length} hint={locked ? `Altre ${locked} sono riservate ad altri reparti.` : undefined}>
        {approved.length ? <ul className="card py-0">{approved.map((m) => <FactRow key={m.id} m={m} />)}</ul> : <p className="muted">Nessun risultato.</p>}
      </Section>
      {pending.length > 0 && (
        <Section title="In attesa di verifica" count={pending.length} hint="Non vengono usate per rispondere finché qualcuno non le approva.">
          <ul className="card py-0">{pending.map((m) => <FactRow key={m.id} m={m} />)}</ul>
        </Section>
      )}
      {past.length > 0 && (
        <details className="mt-6">
          <summary className="muted cursor-pointer text-xs">Rifiutate o sostituite ({past.length})</summary>
          <ul className="card mt-2 py-0">{past.map((m) => <FactRow key={m.id} m={m} />)}</ul>
        </details>
      )}
    </div>
  );
}

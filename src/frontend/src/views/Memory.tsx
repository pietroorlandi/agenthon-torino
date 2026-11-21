import { useState } from "react";
import { api } from "../api";
import type { GapView, MemoryView as Mem, QuarantineView } from "../types";
import { Cites, Tag, useAct, useApp } from "../ui";

function MemoryCard({ m }: { m: Mem }) {
  const { run, busy } = useAct();
  if (m.locked) return <div className="card muted border-dashed py-2.5">🔒 Elemento riservato a {m.access_label}</div>;
  const border = { pending: "border-l-amber-500", approved: "border-l-emerald-600", rejected: "border-l-stone-400", superseded: "border-l-stone-400" }[m.status];
  return (
    <div className={`card border-l-4 ${border}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {m.question && <div className="muted text-xs">❓ Risponde a: «{m.question}»</div>}
          <div>{m.text}</div>
        </div>
        <span className="font-mono text-xs text-stone-400">{m.id}</span>
      </div>
      {m.attributed_to && <div className="mt-1"><Tag tone="purple">fonte esterna: {m.attributed_to}</Tag></div>}
      {m.source_quote && <div className="muted mt-1 text-xs">Citazione: «{m.source_quote}»</div>}
      <div className="muted mt-1 text-xs">
        Proposto da {m.proposed_by} · visibile a: {m.access_label}{m.approved_by && ` · approvato da ${m.approved_by}`}{m.rejected_by && ` · rifiutato da ${m.rejected_by}`}
        {m.source_ids.length > 1 && ` · ${m.source_ids.length} fonti`}
      </div>
      <Cites ids={m.source_ids} />
      {m.status === "pending" && (m.can_curate ? (
        <div className="mt-2 flex gap-2">
          <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.memory(m.id, "approve"))}>✓ Approva</button>
          <button className="btn-danger btn-sm" disabled={busy} onClick={() => run(() => api.memory(m.id, "reject"))}>✕ Rifiuta</button>
        </div>
      ) : <div className="muted mt-2 text-xs">Lo decide chi ha l'autorità su questa voce.</div>)}
    </div>
  );
}

function QuarantineCard({ q }: { q: QuarantineView }) {
  const { run, busy } = useAct();
  if (q.locked) return <div className="card muted border-dashed py-2.5">🔒 Elemento in quarantena — {q.status === "pending" ? "in attesa di" : "deciso da"} {q.authority_label}</div>;
  const status: Record<string, [string, "red" | "green" | "gray"]> = {
    pending: ["in quarantena · non usata", "red"], banned: [`scartata e dimenticata da ${q.decided_by}`, "gray"],
    accepted: [`accettata da ${q.decided_by}`, "green"], released: [`rilasciata da ${q.decided_by}`, "green"], confirmed_bad: [`scarto confermato da ${q.decided_by}`, "gray"],
  };
  const [label, tone] = status[q.status];
  return (
    <div className="card border-l-4 border-l-rose-600">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{q.kind === "contradiction" ? "Informazione in contrasto con la memoria" : "🛡️ Messaggio sospetto"}</b><Tag tone={tone}>{label}</Tag>
      </div>
      {q.kind === "contradiction" ? (
        <>
          <div className="mt-1"><span className="muted">Nuova (non verificata):</span> «{q.claim_text}»</div>
          <Cites ids={q.source_id ? [q.source_id] : []} />
          <div className="mt-1"><span className="muted">In memoria ({q.memory_id}, approvata da {q.memory_approved_by ?? "il team"}):</span> {q.memory_text}</div>
          {q.order_id && <div className="muted mt-1">⚠️ Qualcuno l'ha già applicata all'ordine <b>{q.order_id}</b>.</div>}
          {q.can_decide && (
            <div className="mt-2 flex gap-2">
              <button className="btn-danger btn-sm" disabled={busy} onClick={() => run(() => api.quarantine(q.id, "ban"))}>🚫 Scarta e dimentica</button>
              <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.quarantine(q.id, "accept"))}>✓ Accetta e aggiorna la memoria</button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-1"><span className="muted">Motivo:</span> {q.reason}</div>
          <Cites ids={q.source_id ? [q.source_id] : []} />
          <div className="muted mt-1 text-xs">Nessun fatto estratto e nessuna azione proposta finché una persona non decide.</div>
          {q.can_decide && (
            <div className="mt-2 flex gap-2">
              <button className="btn-danger btn-sm" disabled={busy} onClick={() => run(() => api.quarantine(q.id, "confirm-bad"))}>🗑️ Conferma scarto</button>
              <button className="btn btn-sm" disabled={busy} onClick={() => run(() => api.quarantine(q.id, "release"))}>↩︎ Rilascia (è legittimo)</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GapCard({ g }: { g: GapView }) {
  const { state } = useApp();
  const { run, busy } = useAct();
  const [fact, setFact] = useState("");
  const [question, setQuestion] = useState(g.question);
  const [access, setAccess] = useState("all");
  const me = state.me;
  const status = { open: <Tag tone="purple">da documentare</Tag>, answered: <Tag tone="green">documentata da {g.decided_by}</Tag>, dismissed: <Tag tone="gray">chiusa da {g.decided_by}</Tag> }[g.status];
  const head = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2"><b>«{g.question}»</b>{status}</div>
      <div className="muted text-xs">Chiesto da {g.asked_by_name} ({g.asked_by_role_label}) alle {g.time} · assegnato a {g.owner_label} ({g.topic_label})</div>
    </>
  );
  if (!g.mine || g.status !== "open") return <div className="card border-l-4 border-l-violet-500">{head}{g.answer && <div className="mt-1">{g.answer}</div>}</div>;
  return (
    <div className="card space-y-2 border-l-4 border-l-violet-500">
      {head}
      <label className="muted block text-xs">Il fatto (la risposta)</label>
      <textarea className="input" rows={2} value={fact} onChange={(e) => setFact(e.target.value)}
        placeholder="es. Ordine minimo nocciole alla Cooperativa Nocciola Langhe: 100 kg, in multipli di 25 kg, consegna diretta al laboratorio." />
      <label className="muted block text-xs">La domanda a cui risponde (serve al Brain per ritrovarlo)</label>
      <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="muted text-xs">Chi può vederlo</label>
        <select className="rounded-md border border-stone-300 px-2 py-1" value={access} onChange={(e) => setAccess(e.target.value)}>
          <option value="all">Tutti i reparti</option>
          {g.asker_role !== me.role && <option value={`${me.role},${g.asker_role}`}>Solo {state.roles[me.role]} e {state.roles[g.asker_role]}</option>}
          <option value={me.role}>Solo {state.roles[me.role]}</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary btn-sm" disabled={busy || !fact.trim()} onClick={() => run(() => api.gapAnswer(g.id, fact, question, access.split(",")), "Salvato in memoria")}>✓ Salva in memoria</button>
        <button className="btn-danger btn-sm" disabled={busy} onClick={() => run(() => api.gapDismiss(g.id))}>✕ Non esiste / non è di mia competenza</button>
      </div>
    </div>
  );
}

export function MemoryView() {
  const { state } = useApp();
  const groups: [Mem["status"], string][] = [["pending", "Da revisionare"], ["approved", "Approvata — usata per rispondere"], ["rejected", "Rifiutata — mai usata"], ["superseded", "Sostituita"]];
  return (
    <section className="mx-auto max-w-4xl space-y-2.5 px-4 py-6">
      <h1 className="h1">🧠 Memoria condivisa</h1>
      <p className="muted">Il Brain estrae fatti dalle fonti e li propone. Solo gli elementi <b>approvati</b> da una persona vengono usati per rispondere.
        Le informazioni che <b>contraddicono</b> la memoria approvata o che arrivano da fonti sospette non vengono mai usate: finiscono in quarantena per chi ha l'autorità di decidere.</p>
      {state.gaps.length > 0 && (
        <><h2 className="h2">📝 Da documentare <span className="muted font-normal">({state.gaps.filter((g) => g.status === "open").length} aperte)</span></h2>
          {state.gaps.map((g) => <GapCard key={g.id} g={g} />)}</>
      )}
      {state.quarantine.length > 0 && (
        <><h2 className="h2">🛡️ Quarantena <span className="muted font-normal">({state.quarantine.filter((q) => q.status === "pending").length} da decidere)</span></h2>
          {state.quarantine.map((q) => <QuarantineCard key={q.id} q={q} />)}</>
      )}
      {groups.map(([st, label]) => {
        const list = state.memory.filter((m) => m.status === st);
        if (st === "superseded" && !list.length) return null;
        return (
          <div key={st} className="space-y-2.5">
            <h2 className="h2">{label} <span className="muted font-normal">({list.length})</span></h2>
            {list.length ? list.map((m) => <MemoryCard key={m.id} m={m} />) : <p className="muted">Nessun elemento.</p>}
          </div>
        );
      })}
    </section>
  );
}

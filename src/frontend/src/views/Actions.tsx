import { Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import type { ActionView } from "../types";
import { Cites, Tag, useAct, useApp } from "../ui";

function ActionCard({ a }: { a: ActionView }) {
  const { state } = useApp();
  const { run, busy } = useAct();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.draft ?? "");
  if (a.locked) {
    const s = { pending: "in attesa", executed: "eseguita", rejected: "rifiutata" }[a.status];
    return <div className="card muted border-dashed py-2.5">🔒 Azione di competenza {a.owner_label} — {s}</div>;
  }
  const status = {
    pending: <Tag tone="amber">in attesa di approvazione</Tag>,
    executed: <Tag tone="green">eseguita · approvata da {a.decided_by}</Tag>,
    rejected: <Tag tone="red">rifiutata da {a.decided_by}</Tag>,
  }[a.status];
  return (
    <div className={`card border-l-4 ${a.status === "pending" ? "border-l-amber-500" : a.status === "executed" ? "border-l-emerald-600" : "border-l-stone-400"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><b>{a.title}</b>{status}</div>
      <p className="mt-1"><span className="muted">Perché:</span> {a.why}</p>
      {editing ? (
        <textarea className="input mt-2 font-mono text-xs" rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <pre className="mt-2 rounded-md bg-stone-50 p-3 font-mono text-xs whitespace-pre-wrap">{a.draft}</pre>
      )}
      <div className="muted mt-1 text-xs">Bozza: {a.draft_by}{a.edited_by && ` · modificata da ${a.edited_by}`}</div>
      <Cites ids={a.source_ids} />
      {a.can_decide && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn-primary btn-sm" disabled={busy || editing} onClick={() => run(() => api.action(a.id, "approve"))}>✓ Approva ed esegui</button>
          <button className="btn-danger btn-sm" disabled={busy || editing} onClick={() => run(() => api.action(a.id, "reject"))}>✕ Rifiuta</button>
          {editing ? (
            <button className="btn btn-sm" disabled={busy} onClick={async () => { await run(() => api.editDraft(a.id, draft), "Bozza salvata"); setEditing(false); }}>💾 Salva bozza</button>
          ) : (
            <button className="btn btn-sm" disabled={busy} onClick={() => { setDraft(a.draft ?? ""); setEditing(true); }}>✏️ Modifica</button>
          )}
          <button className="btn btn-sm" disabled={busy || editing || state.llm.mode !== "live"} title={state.llm.mode !== "live" ? "Serve LLM_MODE=live" : "L'agente ADK rilegge le fonti e riscrive la bozza"}
            onClick={() => run(() => api.agentDraft(a.id), "Bozza riscritta dall'agente: controllala prima di approvare")}>
            <Sparkles size={14} /> {busy ? "L'agente sta scrivendo…" : "Riscrivi con l'agente"}
          </button>
        </div>
      )}
    </div>
  );
}

export function ActionsView() {
  const { state } = useApp();
  return (
    <section className="mx-auto max-w-4xl space-y-2.5 px-4 py-6">
      <h1 className="h1">✅ Azioni proposte</h1>
      <p className="muted">Il Brain <b>propone soltanto</b>: prepara bozze, ma nulla viene inviato o modificato finché una persona del reparto giusto non approva.</p>
      {state.actions.map((a) => <ActionCard key={`${a.id}-${a.draft?.length}`} a={a} />)}
      <h2 className="h2">📤 Outbox del tuo reparto <span className="muted font-normal">(eseguito solo dopo approvazione)</span></h2>
      {state.outbox.length ? state.outbox.map((o) => (
        <div key={o.action_id} className="card border-l-4 border-l-sky-600">
          <div className="flex flex-wrap items-center justify-between gap-2"><b>{o.title}</b><Tag tone="blue">inviata {o.sent_at} · approvata da {o.approved_by}</Tag></div>
          <pre className="mt-2 font-mono text-xs whitespace-pre-wrap">{o.body}</pre>
        </div>
      )) : <p className="muted">Vuota: nessuna azione approvata finora.</p>}
    </section>
  );
}

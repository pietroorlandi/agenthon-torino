import { Check, Pencil, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import type { ActionView } from "../types";
import { Cites, Tag, useAct, useApp } from "../ui";

// What approving really does (see backend services/actions.py). Nothing leaves the demo: it is all simulated.
const EFFECT: Record<string, string> = {
  refund: "registra il rimborso sull'ordine e invia la risposta al cliente",
  intercept: "segna il collo come intercettato e invia la richiesta al corriere",
  reorder: "registra il riordino (i pezzi risultano in arrivo) e invia l'ordine al fornitore",
  block: "sospende la vendita del prodotto nello shop e invia la comunicazione",
  payment: "invia il messaggio; il pagamento vero resta fuori dal sistema",
  quarantine: "invia la comunicazione al magazzino",
  notify: "invia l'avviso ai clienti",
};

export function ActionCard({ a }: { a: ActionView }) {
  const { state } = useApp();
  const { run, busy } = useAct();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(a.draft ?? "");
  const pending = a.status === "pending";
  return (
    <article className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold">{a.title}</h3>
        {!pending && <Tag tone={a.status === "executed" ? "green" : "gray"}>{a.status === "executed" ? `approvata da ${a.decided_by}` : `rifiutata da ${a.decided_by}`}</Tag>}
      </div>
      <p className="mt-1 text-stone-700">{a.why}</p>

      {editing ? (
        <textarea className="input mt-3 font-mono text-xs" rows={9} value={draft} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <div className="mt-3 rounded-md border border-stone-200 bg-stone-50">
          <button className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-stone-600" onClick={() => setOpen(!open)}>
            <span>Bozza preparata{a.draft_by ? ` da ${a.draft_by}` : ""}{a.edited_by ? `, modificata da ${a.edited_by}` : ""}</span>
            <span>{open ? "Nascondi" : "Leggi"}</span>
          </button>
          {open && <pre className="border-t border-stone-200 px-3 py-2 font-sans text-xs whitespace-pre-wrap">{a.draft}</pre>}
        </div>
      )}
      <Cites ids={a.source_ids} />

      {a.can_decide && (
        <>
          {a.effect && EFFECT[a.effect] && <p className="muted mt-3 text-xs">Se approvi, il sistema {EFFECT[a.effect]}.</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {editing ? (
              <>
                <button className="btn-primary btn-sm" disabled={busy} onClick={async () => { await run(() => api.editDraft(a.id, draft), "Bozza salvata"); setEditing(false); setOpen(true); }}>Salva bozza</button>
                <button className="btn btn-sm" disabled={busy} onClick={() => setEditing(false)}>Annulla</button>
              </>
            ) : (
              <>
                <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.action(a.id, "approve"))}><Check size={14} /> Approva</button>
                <button className="btn btn-sm" disabled={busy} onClick={() => { setDraft(a.draft ?? ""); setEditing(true); }}><Pencil size={14} /> Modifica</button>
                <button className="btn-danger btn-sm" disabled={busy} onClick={() => run(() => api.action(a.id, "reject"))}><X size={14} /> Rifiuta</button>
                {state.llm.mode === "live" && (
                  <button className="btn btn-sm" disabled={busy} title="L'agente rilegge le fonti e riscrive la bozza"
                    onClick={() => run(() => api.agentDraft(a.id), "Bozza riscritta: controllala prima di approvare")}>
                    <Sparkles size={14} /> {busy ? "Sto scrivendo…" : "Riscrivi"}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </article>
  );
}

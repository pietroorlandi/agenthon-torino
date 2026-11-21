import { useQuery } from "@tanstack/react-query";
import { api, getUser } from "../api";
import { Tag, useApp } from "../ui";

export function AuditView() {
  const { state } = useApp();
  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="h1">📜 Audit log</h1>
      <p className="muted">Tutto lascia traccia: chi (agente o persona), cosa, su quale input. Anche ciò che è stato ignorato, con il motivo. Vedi solo le righe del tuo reparto.</p>
      <div className="mt-3 max-h-[72vh] overflow-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full"><thead className="sticky top-0"><tr>{["Ora sim.", "Attore", "Operazione", "Dettaglio", "Trace"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{state.audit.map((e) => (
            <tr key={e.id}>
              <td className="td font-mono text-xs whitespace-nowrap">{e.sim_ts}</td>
              <td className="td"><Tag tone={e.actor.startsWith("user:") ? "green" : e.actor.startsWith("agent:") ? "purple" : "gray"}>{e.actor}</Tag></td>
              <td className="td font-mono text-xs">{e.op}</td><td className="td">{e.text}</td>
              <td className="td font-mono text-[10px] text-stone-400">{e.trace_id?.slice(0, 12) ?? "—"}</td>
            </tr>
          ))}</tbody></table>
      </div>
    </section>
  );
}

const fmt = (v: unknown, suffix = "") => (v === null || v === undefined ? "—" : `${v}${suffix}`);

export function ObservabilityView() {
  const { data } = useQuery({ queryKey: ["obs", getUser()], queryFn: api.observability, refetchInterval: 5000 });
  if (!data) return <div className="muted p-8">Caricamento…</div>;
  const llm = data.llm, q = data.quality;
  const comps = Object.entries(llm.components as Record<string, any>);
  const card = (label: string, value: string, hint?: string, warn = false) => (
    <div className={`card ${warn ? "border-amber-300 bg-amber-50" : ""}`}><div className="muted text-xs">{label}</div><div className="text-xl font-bold">{value}</div>{hint && <div className="muted text-xs">{hint}</div>}</div>
  );
  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="h1">📊 Osservabilità</h1>
      <p className="muted">Calcolata dai contatori del backend: funziona anche offline. Modalità LLM <b>{data.mode}</b> · modelli {data.models.main} / {data.models.lite} · tracce: <b>{data.trace_exporter}</b>.</p>
      <h2 className="h2">LLM</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {card("Costo stimato", `$${llm.total_cost_usd.toFixed(4)}`, `${llm.budget_pct}% del budget ($${llm.budget_usd})`, llm.budget_pct > 70)}
        {card("Chiamate", String(comps.reduce((n, [, c]) => n + c.calls, 0)), `${comps.reduce((n, [, c]) => n + c.cache_hits, 0)} dalla cache`)}
        {card("Errori", String(comps.reduce((n, [, c]) => n + c.errors, 0)), "fallback sicuro: “non lo so”, nessuna azione")}
        {card("Fallback", String(comps.reduce((n, [, c]) => n + c.fallbacks, 0)), "motore deterministico o copione")}
      </div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full"><thead><tr>{["Componente", "Chiamate", "Cache", "Errori", "Fallback", "Token in", "Token out", "Costo $", "p50 ms", "p95 ms"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{comps.length ? comps.map(([name, c]) => (
            <tr key={name}>{[name, c.calls, c.cache_hits, c.errors, c.fallbacks, c.tokens_in, c.tokens_out, c.cost_usd.toFixed(5), fmt(c.p50_ms), fmt(c.p95_ms)].map((v, i) => <td key={i} className="td font-mono text-xs">{v}</td>)}</tr>
          )) : <tr><td className="td muted" colSpan={10}>Ancora nessuna chiamata.</td></tr>}</tbody></table>
      </div>
      {llm.last_errors.length > 0 && <div className="card mt-3 text-xs">{llm.last_errors.map((e: any, i: number) => <div key={i}><b>{e.component}</b>: {e.error}</div>)}</div>}
      <h2 className="h2">Qualità dell'agente</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {card("Precisione estrazione", q.extraction_precision === null ? "—" : `${Math.round(q.extraction_precision * 100)}%`, `approvati ${q.memory.approved} · rifiutati ${q.memory.rejected} · in attesa ${q.memory.pending}`)}
        {card("Risposte “non lo so”", fmt(q.dont_know_pct, "%"), `${q.answers} risposte · ${q.denied} negate per ruolo`)}
        {card("Citazioni scartate", String(q.validator_rejections), "dal validator nel codice")}
        {card("Quarantena", String(q.contradictions + q.security_quarantine), `${q.contradictions} contraddizioni · ${q.security_quarantine} sospetti`)}
      </div>
      <h2 className="h2">Fonti e persone nel loop</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {card("Eventi osservati", String(q.sources.observed ?? 0), `${q.sources.ignored ?? 0} ignorati · ${q.sources.quarantined ?? 0} in quarantena`)}
        {card("Proposte di memoria", String(q.sources.proposed ?? 0), `${q.sources.corroborated ?? 0} conferme di fatti noti`)}
        {card("Azioni proposte", String(q.actions.proposed), `${q.actions.pending} in attesa`)}
        {card("Azioni decise", String(q.actions.executed + q.actions.rejected), `${q.actions.executed} approvate · ${q.actions.rejected} rifiutate`)}
      </div>
    </section>
  );
}

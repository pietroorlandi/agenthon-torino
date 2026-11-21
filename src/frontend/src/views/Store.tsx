import { SourceIcon, Tag, TriageBadges, useApp } from "../ui";

const PROBLEM = ["In attesa approvazione sconto", "Pagamento fallito", "In attesa pagamento", "Rimborso richiesto", "In giacenza", "Indirizzo errato"];
const eur = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export function StoreView() {
  const { state } = useApp();
  const low = state.products.filter((p) => p.stock < p.threshold).length;
  const revenue = state.products.reduce((n, p) => n + p.price * p.sold7d, 0);
  const problems = state.orders.filter((o) => PROBLEM.includes(o.status) || o.flag).length;
  const executed = state.audit.filter((e) => e.op === "action.executed" || e.op.startsWith("quarantine."));
  const kpi = (label: string, value: string | number, warn = false) => (
    <div className={`card flex flex-col ${warn ? "border-amber-300 bg-amber-50" : ""}`}><span className="muted text-xs">{label}</span><b className="text-xl">{value}</b></div>
  );
  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="h1">Store (simulato)</h1>
      <p className="muted">I dati cambiano solo quando una persona approva un'azione o quando arriva un evento (▶ Avanti).</p>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpi("Ordini oggi", state.orders.filter((o) => o.date.startsWith("21/11")).length)}
        {kpi("Ricavi 7 giorni", eur(revenue))}
        {kpi("Prodotti sotto scorta", low, low > 0)}
        {kpi("Ordini con problemi", problems, problems > 0)}
      </div>
      <h2 className="h2">Prodotti</h2>
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full"><thead><tr>{["SKU", "Prodotto", "Prezzo", "Scorta", "Venduti 7gg"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{state.products.map((p) => {
            const isLow = p.stock < p.threshold;
            return (
              <tr key={p.sku} className={isLow ? "bg-amber-50/60" : ""}>
                <td className="td font-mono text-xs">{p.sku}</td>
                <td className="td">{p.name} {p.blocked && <Tag tone="red">vendita sospesa</Tag>}</td>
                <td className="td">{p.price.toFixed(2)}€</td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded bg-stone-200"><div className={`h-1.5 rounded ${isLow ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (p.stock / (p.threshold * 3)) * 100)}%` }} /></div>
                    {p.stock} pz {p.incoming > 0 && <Tag tone="green">+{p.incoming} in arrivo</Tag>}
                  </div>
                </td>
                <td className="td">{p.sold7d}</td>
              </tr>
            );
          })}</tbody></table>
      </div>
      <h2 className="h2">Ordini <span className="muted font-normal">({state.orders.length}, dal più recente)</span></h2>
      <div className="max-h-[480px] overflow-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full"><thead className="sticky top-0"><tr>{["Ordine", "Cliente", "Tipo", "Paese", "Totale", "Stato", "Corriere", "Data", "Note"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{state.orders.map((o) => (
            <tr key={o.id}>
              <td className="td font-mono text-xs">{o.id}</td><td className="td">{o.customer}</td>
              <td className="td">{o.kind === "B2B" ? <Tag tone="blue">negozio</Tag> : "Privato"}</td><td className="td">{o.country}</td>
              <td className="td">{o.total.toFixed(2)}€</td>
              <td className="td"><Tag tone={PROBLEM.includes(o.status) ? "amber" : ["Rimborsato", "Intercettato"].includes(o.status) ? "green" : "gray"}>{o.status}</Tag></td>
              <td className="td">{o.carrier || "—"}</td><td className="td whitespace-nowrap">{o.date}</td><td className="td muted text-xs">{o.flag}</td>
            </tr>
          ))}</tbody></table>
      </div>
      {executed.length > 0 && (
        <><h2 className="h2">Registro decisioni</h2>
          <ul className="card space-y-1">{executed.map((e) => <li key={e.id}><span className="muted font-mono text-xs">{e.sim_ts}</span> {e.text}</li>)}</ul></>
      )}
    </section>
  );
}

export function SourcesView() {
  const { state, openSource } = useApp();
  const visible = state.sources.filter((s) => !s.locked && s.type !== "store")
    .sort((a, b) => (b.observed_at ? 1 : 0) - (a.observed_at ? 1 : 0) || (b.date ?? "").localeCompare(a.date ?? ""));
  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="h1">Fonti osservate</h1>
      <p className="muted">Email, chat, task e documenti che il Brain legge. Vedi solo quelle accessibili al ruolo <b>{state.me.role_label}</b>
        {state.hidden_sources > 0 && ` (${state.hidden_sources} riservate ad altri reparti)`}. Le fonti arrivate durante la demo mostrano come le ha trattate (fiducia, triage, esito).</p>
      <div className="mt-3 max-h-[70vh] overflow-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full"><thead className="sticky top-0"><tr>{["Tipo", "Titolo", "Da", "Data", "Accesso", "Brain"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{visible.map((s) => (
            <tr key={s.id} className="cursor-pointer hover:bg-sky-50" onClick={() => openSource(s.id)}>
              <td className="td whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><SourceIcon type={s.type} /> {s.type}</span></td>
              <td className="td">{s.title} {s.in_quarantine && <Tag tone="red">in quarantena</Tag>}</td>
              <td className="td">{s.sender_label}</td><td className="td whitespace-nowrap">{s.date}</td>
              <td className="td text-xs">{s.access_label}</td><td className="td"><TriageBadges s={s} /></td>
            </tr>
          ))}</tbody></table>
      </div>
    </section>
  );
}

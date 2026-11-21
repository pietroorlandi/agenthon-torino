import { Volume2 } from "lucide-react";
import { useState } from "react";
import { api, fetchBriefAudio } from "../api";
import { Avatar, Cites, RichText, useApp, useToast, type Tab } from "../ui";

const CHECKS: [string, string, Tab][] = [
  ["Parla per primo", "Apri **Chat → 🧠 Brain**: c'è il brief delle 08:00 che nessuno ha chiesto. Poi premi **▶ Avanti** in alto: gli eventi della mattina arrivano uno alla volta e il Brain avvisa chi deve sapere (alert scorte al Magazzino, quarantene allo Shop…).", "chat"],
  ["La memoria la curano le persone", "In **Memoria** approva il fatto su DHL (come Davide) e rifiutane un altro. Poi chiedi *“Quale corriere usiamo per l'estero da dicembre?”*: prima dell'approvazione risponde “non lo so”.", "memory"],
  ["Non si fida ciecamente delle fonti", "La battuta sul «50% al Black Friday» contraddice il -20% approvato: è in **quarantena**. Con ▶ Avanti (08:12) Giulia scrive che lo sconto massimo è il 30%: come Marco (Shop) scegli *Scarta e dimentica* o *Accetta*.", "memory"],
  ["Sa chi sta chiedendo", "Chiedi *“Qual è il margine di novembre?”* come Marco (Shop) e poi come Sara (Magazzino): solo lo Shop ottiene la risposta.", "chat"],
  ["Cita le fonti", "Ogni risposta e ogni punto del brief ha i chip **Fonti**: cliccali per vedere l'originale e come l'ha trattato il Brain.", "chat"],
  ["Ammette i limiti", "Chiedi *“Quanti dipendenti ha il nostro concorrente?”*: “non lo so”. Chiedi *“Qual è l'ordine minimo per le nocciole?”* come Sara: non lo sa, ma apre una richiesta a Marco (Shop) in *Memoria → Da documentare*.", "chat"],
  ["Propone soltanto", "In **Azioni** ci sono bozze in attesa (rimborso, quarantena lotto, avvisi…). Puoi modificarle o farle riscrivere all'agente ADK: nulla cambia nello Store finché la persona del reparto giusto non approva.", "actions"],
  ["Si inserisce nella giornata del team", "Chat stile Slack con 6 canali + **Email del mattino** per ogni persona (anche in audio 🔊).", "email"],
  ["Resiste agli attacchi", "In **🧪 Mettilo alla prova** scrivi un'email con prompt injection, un cambio IBAN da un dominio simile o un messaggio che finge di essere il capo: guarda dove finisce.", "redteam"],
];

export function GuideView() {
  const { state, goto } = useApp();
  return (
    <section className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="h1">Company Brain — il collega che sa, e parla per primo</h1>
      <p className="muted">Bottega Sabauda è un negozio online torinese di <b>gianduiotti</b> con quattro reparti: magazzino, servizio clienti, shop e spedizioni.
        Il Brain osserva email, chat, task, documenti e lo store, tiene una memoria condivisa curata dal team e avvisa ognuno di ciò che richiede attenzione. Cambia utente in alto a destra.</p>
      <div className="my-4 flex flex-wrap gap-3">
        {state.users.map((u) => (
          <div key={u.id} className="card flex items-center gap-2.5 py-2.5"><Avatar user={u} /><div><b>{u.name}</b><div className="muted text-xs">{u.role_label}</div></div></div>
        ))}
      </div>
      <div className="card border-amber-300 bg-amber-50">
        <b>Scenario di oggi (21/11):</b> il laboratorio segnala che il lotto L26-1108 dei Gianduiotti al caffè ha l'etichetta senza l'allergene latte.
        Tocca tutti e quattro i reparti: Magazzino (quarantena), Shop (stop vendita, promo CAFFE15 e newsletter delle 10:00), Servizio clienti (una cliente allergica ha già scritto) e Spedizioni (ordini da non evadere).
      </div>
      <h2 className="h2">I check della giuria</h2>
      <ol className="grid gap-2.5">
        {CHECKS.map(([t, d, tab], i) => (
          <li key={t} className="card flex items-center justify-between gap-4 py-3">
            <div><b>{i + 1}. {t}</b><RichText className="muted mt-1" text={d} /></div>
            <button className="btn-primary btn-sm shrink-0" onClick={() => goto(tab)}>Vai →</button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function EmailView() {
  const { state, goto } = useApp();
  const toast = useToast();
  const [audio, setAudio] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const me = state.me;
  const pending = state.actions.filter((a) => !a.locked && a.status === "pending");

  const listen = async () => {
    setLoading(true);
    const blob = await fetchBriefAudio();
    setLoading(false);
    if (blob) { setAudio(URL.createObjectURL(blob)); return; }
    // Fallback: browser voice when ElevenLabs is not configured
    const { text } = await api.briefText();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    toast("ElevenLabs non configurato: uso la voce del browser.");
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-6">
      <div className="card p-0">
        <div className="border-b border-stone-200 p-4 text-sm">
          <div><span className="muted">Da:</span> Brain &lt;brain@bottegasabauda.example&gt;</div>
          <div><span className="muted">A:</span> {me.name} ({me.role_label})</div>
          <div><span className="muted">Oggetto:</span> <b>Il tuo brief del 21 novembre</b></div>
          <div className="muted text-xs">Inviata automaticamente alle 08:00 · nessuno l'ha richiesta · aggiornata alle {state.now.split(" ")[1]}</div>
        </div>
        <div className="p-4">
          <div className="mb-3 flex items-center gap-3">
            <button className="btn btn-sm" onClick={listen} disabled={loading}><Volume2 size={14} /> {loading ? "Preparo l'audio…" : "Ascolta il brief"}</button>
            {audio && <audio src={audio} controls autoPlay className="h-8" />}
          </div>
          <p>{state.brief.text}</p>
          <ol className="mt-2 list-decimal space-y-2.5 pl-5">
            {state.brief.items.map((it, i) => <li key={i}><RichText text={it.text} /><Cites ids={it.sources} /></li>)}
          </ol>
          {pending.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
              <b>In attesa della tua approvazione ({pending.length})</b>
              <ul className="mt-1 list-disc pl-5">{pending.map((a) => <li key={a.id}>{a.title}</li>)}</ul>
              <button className="btn-primary btn-sm mt-2" onClick={() => goto("actions")}>Apri Azioni →</button>
            </div>
          )}
          <p className="muted mt-4 text-xs">Non eseguo nessuna azione senza la tua approvazione. Ogni informazione riporta la fonte da cui proviene.</p>
        </div>
      </div>
    </section>
  );
}

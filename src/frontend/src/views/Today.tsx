import { Check, ListChecks, Volume2 } from "lucide-react";
import { useState } from "react";
import { api, fetchBriefAudio } from "../api";
import type { Task } from "../types";
import { Cites, RichText, Section, Tag, useAct, useApp, useToast } from "../ui";
import { ActionCard } from "./Actions";
import { GapCard, ProposalCard, QuarantineCard } from "./Memory";

function ListenButton() {
  const toast = useToast();
  const [audio, setAudio] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const listen = async () => {
    setLoading(true);
    const blob = await fetchBriefAudio();
    setLoading(false);
    if (blob) { setAudio(URL.createObjectURL(blob)); return; }
    const { text } = await api.briefText(); // fallback: browser voice when ElevenLabs is not configured
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    toast("Voce ElevenLabs non configurata: uso quella del browser.");
  };
  return (
    <div className="flex items-center gap-2">
      <button className="btn btn-sm" onClick={listen} disabled={loading}><Volume2 size={14} /> {loading ? "Preparo…" : "Ascolta"}</button>
      {audio && <audio src={audio} controls autoPlay className="h-8" />}
    </div>
  );
}

const KIND_LABEL: Record<Task["kind"], string> = {
  gap: "Domanda di un collega", approve: "Da approvare", verify: "Da verificare", review: "Da confermare", ship: "Da spedire", task: "Task",
};

function dueTag(days?: number | null) {
  if (days === null || days === undefined) return null;
  if (days < 0) return <Tag tone="red">scaduto</Tag>;
  if (days === 0) return <Tag tone="red">scade oggi</Tag>;
  if (days === 1) return <Tag tone="amber">scade domani</Tag>;
  return <span className="muted text-xs">entro {days} giorni</span>;
}

// Everything this person has to do today, in one checklist (derived server side from gaps, actions, orders, tasks)
function TasksSection() {
  const { state, goto } = useApp();
  const { run, busy } = useAct();
  const { open, done } = state.tasks;
  return (
    <Section title="I tuoi compiti di oggi" count={open.length} hint={state.day > 0 ? "Aggiornati con quello che è successo ieri e stanotte." : undefined}>
      {open.length ? (
        <ul className="card divide-y divide-stone-100 py-1">
          {open.map((t) => (
            <li key={t.id} className="flex items-start gap-3 py-2.5">
              {t.kind === "task" ? (
                <button className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-stone-300 hover:border-savoia hover:bg-savoia-soft"
                  disabled={busy} title="Segna come fatto" aria-label={`Segna come fatto: ${t.title}`}
                  onClick={() => run(() => api.taskDone(t.id), "Fatto: lo ritroverai nel brief di domani")} />
              ) : <ListChecks size={18} className="mt-0.5 shrink-0 text-savoia" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{t.title}</span>
                  {t.is_new && <Tag tone="blue">nuovo</Tag>}
                  {dueTag(t.days_left)}
                </div>
                <div className="muted text-xs">{KIND_LABEL[t.kind]}{t.detail ? ` · ${t.detail}` : ""}</div>
              </div>
              {t.tab === "knowledge" && <button className="btn btn-sm shrink-0" onClick={() => goto("knowledge")}>Apri</button>}
            </li>
          ))}
        </ul>
      ) : <p className="muted">Niente in sospeso per oggi.</p>}
      {done.length > 0 && (
        <details className="mt-1">
          <summary className="muted cursor-pointer text-xs">Fatto oggi ({done.length})</summary>
          <ul className="mt-1 space-y-1 pl-1">
            {done.map((d, i) => <li key={i} className="flex items-center gap-2 text-stone-500"><Check size={14} className="text-emerald-600" /><span className="line-through decoration-stone-300">{d.text}</span></li>)}
          </ul>
        </details>
      )}
    </Section>
  );
}

export function TodayView() {
  const { state } = useApp();
  const quarantine = state.quarantine.filter((q) => q.can_decide);
  const actions = state.actions.filter((a) => !a.locked && a.status === "pending");
  const gaps = state.gaps.filter((g) => g.mine && g.status === "open");
  const proposals = state.memory.filter((m) => m.status === "pending" && m.can_curate);
  const decided = state.actions.filter((a) => !a.locked && a.status !== "pending");
  const todo = quarantine.length + actions.length + gaps.length + proposals.length;
  const news = state.brief.items.filter((i) => !i.derived);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Buongiorno {state.me.name.split(" ")[0]}</h1>
          <p className="muted">{todo ? `Hai ${todo} ${todo === 1 ? "cosa" : "cose"} da decidere. Nulla parte senza la tua approvazione.` : "Non c'è niente che aspetti una tua decisione."}</p>
        </div>
        <ListenButton />
      </div>

      <TasksSection />

      {news.length > 0 && (
        <Section title="Cosa devi sapere">
          <ul className="card space-y-3">
            {news.map((it, i) => <li key={i}><RichText text={it.text} /><Cites ids={it.sources} /></li>)}
          </ul>
        </Section>
      )}

      {quarantine.length > 0 && (
        <Section title="Da verificare" count={quarantine.length} hint="Non le uso finché non decidi.">
          {quarantine.map((q) => <QuarantineCard key={q.id} q={q} />)}
        </Section>
      )}
      {actions.length > 0 && (
        <Section title="Azioni da approvare" count={actions.length} hint="Ho preparato le bozze. Puoi modificarle prima di approvare.">
          {actions.map((a) => <ActionCard key={`${a.id}-${a.draft?.length}`} a={a} />)}
        </Section>
      )}
      {gaps.length > 0 && (
        <Section title="Domande dei colleghi" count={gaps.length}>
          {gaps.map((g) => <GapCard key={g.id} g={g} />)}
        </Section>
      )}
      {proposals.length > 0 && (
        <Section title="Nuove informazioni da confermare" count={proposals.length} hint="Le ho trovate in email e chat. Le userò per rispondere solo se le confermi.">
          {proposals.map((m) => <ProposalCard key={m.id} m={m} />)}
        </Section>
      )}

      {decided.length > 0 && (
        <details className="mt-8">
          <summary className="muted cursor-pointer text-xs">Già decise ({decided.length})</summary>
          <ul className="card mt-2 divide-y divide-stone-100 py-1">
            {decided.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{a.title}</span>
                <Tag tone={a.status === "executed" ? "green" : "gray"}>{a.status === "executed" ? `approvata da ${a.decided_by}` : `rifiutata da ${a.decided_by}`}</Tag>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

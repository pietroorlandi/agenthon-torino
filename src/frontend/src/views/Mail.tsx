import { Volume2 } from "lucide-react";
import { useState } from "react";
import { api, fetchBriefAudio } from "../api";
import type { OutboxItem, SourceView } from "../types";
import { Cites, RichText, Tag, TriageBadges, useApp, useToast } from "../ui";

// Simulated mailbox: the Brain's morning brief, the emails of the department and what was sent after approval.
type Folder = "inbox" | "sent" | "team";
type Sel = { kind: "brief" } | { kind: "source"; id: string } | { kind: "outbox"; id: string };

// "dd/mm hh:mm" → sortable "mm/dd hh:mm"
const key = (d?: string) => (d ? `${d.slice(3, 5)}/${d.slice(0, 2)}${d.slice(5)}` : "");

function BriefMail() {
  const { state, goto } = useApp();
  const toast = useToast();
  const [audio, setAudio] = useState<string | null>(null);
  const listen = async () => {
    const blob = await fetchBriefAudio();
    if (blob) { setAudio(URL.createObjectURL(blob)); return; }
    const { text } = await api.briefText(); // fallback: browser voice when ElevenLabs is not configured
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    toast("Voce ElevenLabs non configurata: uso quella del browser.");
  };
  return (
    <>
      <Header from="Brain <brain@bottegasabauda.example>" to={`${state.me.name} (${state.me.role_label})`} subject="Il tuo brief del 21 novembre" date="21/11 08:00" />
      <div className="mt-3 flex items-center gap-2">
        <button className="btn btn-sm" onClick={listen}><Volume2 size={14} /> Ascolta</button>
        {audio && <audio src={audio} controls autoPlay className="h-8" />}
      </div>
      <p className="mt-4">{state.brief.text}</p>
      <ol className="mt-2 list-decimal space-y-3 pl-5">
        {state.brief.items.map((it, i) => <li key={i}><RichText text={it.text} /><Cites ids={it.sources} /></li>)}
      </ol>
      <p className="mt-5">Per decidere apri <button className="font-medium text-brand underline" onClick={() => goto("today")}>Oggi</button>. Non eseguo nulla senza la tua approvazione.</p>
    </>
  );
}

export function DeliveryTag({ o }: { o: OutboxItem }) {
  if (o.delivery === "sent") return <Tag tone="blue">inviata davvero</Tag>;
  if (o.delivery === "sending") return <Tag tone="amber">invio in corso…</Tag>;
  if (o.delivery === "failed") return <Tag tone="red">invio reale non riuscito</Tag>;
  return <Tag tone="gray">invio simulato</Tag>;
}

function Header({ from, to, subject, date, extra }: { from: string; to: string; subject: string; date: string; extra?: React.ReactNode }) {
  return (
    <div className="border-b border-stone-200 pb-3">
      <h2 className="text-base font-semibold">{subject}</h2>
      <div className="muted mt-1 text-xs">Da <span className="text-stone-700">{from}</span> · a {to} · {date}</div>
      {extra && <div className="mt-2">{extra}</div>}
    </div>
  );
}

export function MailView() {
  const { state } = useApp();
  const [folder, setFolder] = useState<Folder>("inbox");
  const [sel, setSel] = useState<Sel>({ kind: "brief" });
  const me = state.me;
  const emails = state.sources.filter((s) => !s.locked && s.type === "email").sort((a, b) => key(b.date).localeCompare(key(a.date)));
  const lists: Record<Folder, SourceView[]> = {
    inbox: emails.filter((s) => s.to === me.id),
    sent: emails.filter((s) => s.sender === me.id),
    team: emails.filter((s) => s.to !== me.id && s.sender !== me.id),
  };
  const folders: [Folder, string, number][] = [
    ["inbox", "In arrivo", lists.inbox.length + 1], ["sent", "Inviate", lists.sent.length + state.outbox.length], ["team", "Del reparto", lists.team.length],
  ];
  const current = sel.kind === "source" ? state.sources.find((s) => s.id === sel.id) : undefined;
  const sentByBrain = sel.kind === "outbox" ? state.outbox.find((o) => o.action_id === sel.id) : undefined;

  const row = (active: boolean, onClick: () => void, title: string, sub: string, date: string, badge?: React.ReactNode) => (
    <button onClick={onClick} className={`block w-full border-b border-stone-100 px-3 py-2.5 text-left ${active ? "bg-stone-100" : "hover:bg-stone-50"}`}>
      <div className="flex items-baseline justify-between gap-2"><span className="truncate text-xs text-stone-500">{sub}</span><span className="shrink-0 text-[11px] text-stone-400">{date}</span></div>
      <div className="truncate font-medium">{title}</div>
      {badge && <div className="mt-1">{badge}</div>}
    </button>
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-6xl">
      <nav className="w-40 shrink-0 border-r border-stone-200 p-2">
        {folders.map(([f, label, n]) => (
          <button key={f} onClick={() => setFolder(f)} className={`flex w-full justify-between rounded px-2 py-1.5 ${folder === f ? "bg-hazel-soft font-medium text-cocoa" : "hover:bg-stone-100"}`}>
            {label}<span className="text-stone-400">{n}</span>
          </button>
        ))}
      </nav>
      <div className="w-80 shrink-0 overflow-y-auto border-r border-stone-200 bg-white">
        {folder === "inbox" && row(sel.kind === "brief", () => setSel({ kind: "brief" }), "Il tuo brief del 21 novembre", "Brain", "08:00", <Tag tone="blue">dal Brain</Tag>)}
        {folder === "sent" && state.outbox.map((o) => row(sel.kind === "outbox" && sel.id === o.action_id, () => setSel({ kind: "outbox", id: o.action_id }),
          o.title, `Approvata da ${o.approved_by}`, o.sent_at.split(" ")[1] ?? o.sent_at, <DeliveryTag o={o} />))}
        {lists[folder].map((s) => row(sel.kind === "source" && sel.id === s.id, () => setSel({ kind: "source", id: s.id }),
          s.title ?? "", folder === "sent" ? `a ${s.to_label}` : s.sender_label ?? "", s.date ?? "",
          s.observed_at ? <TriageBadges s={s} /> : undefined))}
        {!lists[folder].length && folder === "team" && <p className="muted p-4">Nessuna email.</p>}
      </div>
      <article className="min-w-0 flex-1 overflow-y-auto bg-white p-6">
        {sel.kind === "brief" && <BriefMail />}
        {current && !current.locked && (
          <>
            <Header from={current.sender_label ?? ""} to={current.to_label ?? ""} subject={current.title ?? ""} date={current.date ?? ""}
              extra={current.observed_at ? <TriageBadges s={current} /> : undefined} />
            <p className="mt-4 leading-relaxed whitespace-pre-line">{current.body}</p>
            {current.in_quarantine && <p className="mt-4 rounded-md bg-rose-50 p-3 text-rose-800">Il Brain l'ha messa da parte come sospetta: non ne usa il contenuto finché qualcuno non decide in Oggi.</p>}
          </>
        )}
        {sentByBrain && (
          <>
            <Header from={`${me.role_label} (preparata dal Brain)`} to={sentByBrain.delivery === "simulated" ? "destinatari dell'azione" : state.mail.to ?? ""}
              subject={sentByBrain.title} date={sentByBrain.sent_at}
              extra={<div className="flex flex-wrap gap-1.5"><Tag tone="green">approvata da {sentByBrain.approved_by}</Tag><DeliveryTag o={sentByBrain} /></div>} />
            <pre className="mt-4 font-sans leading-relaxed whitespace-pre-wrap">{sentByBrain.body}</pre>
            <p className="muted mt-4 text-xs">
              {sentByBrain.delivery === "simulated" ? "Invio simulato: nella demo non parte nessuna email reale."
                : `Per sicurezza le email reali arrivano solo alla casella demo (${state.mail.to}), mai ai destinatari veri.`}
            </p>
          </>
        )}
      </article>
    </div>
  );
}

import type { State } from "./types";

// Client-side snapshots of the brain, one per timeline step and user (the state is role-filtered).
// h[step] is the latest state seen at that step, so h[done - 1] is the brain right before the last ▶ Avanti.
export interface Counts { approved: number; pending: number; past: number; quarantine: number; gapsOpen: number; gapsAnswered: number; banned: number }
export interface Snap { at: string; counts: Counts; mem: Record<string, string>; srcs: Record<string, number>; txt: Record<string, string>; q: Record<string, string>; gaps: Record<string, string>; banned: string[] }

const hist: Record<string, Record<number, Snap>> = {};

export function snapOf(s: State): Snap {
  const banned = s.sources.filter((x) => x.banned).map((x) => x.id);
  return {
    at: s.now,
    counts: {
      approved: s.memory.filter((m) => m.status === "approved").length,
      pending: s.memory.filter((m) => m.status === "pending").length,
      past: s.memory.filter((m) => m.status === "rejected" || m.status === "superseded").length,
      quarantine: s.quarantine.filter((q) => q.status === "pending").length,
      gapsOpen: s.gaps.filter((g) => g.status === "open").length,
      gapsAnswered: s.gaps.filter((g) => g.status === "answered").length,
      banned: banned.length,
    },
    mem: Object.fromEntries(s.memory.map((m) => [m.id, m.status])),
    srcs: Object.fromEntries(s.memory.map((m) => [m.id, m.source_ids.length])),
    txt: Object.fromEntries(s.memory.map((m) => [m.id, m.text ?? ""])),
    q: Object.fromEntries(s.quarantine.map((q) => [q.id, q.status])),
    gaps: Object.fromEntries(s.gaps.map((g) => [g.id, g.status])),
    banned,
  };
}

export function record(s: State) {
  const d = s.timeline.done;
  const h = (hist[s.me.id] ??= {});
  for (const k of Object.keys(h)) if (+k > d) delete h[+k]; // a reset went back in time
  h[d] = snapOf(s);
}

export const history = (userId: string) => hist[userId] ?? {};

const MEM_LABEL: Record<string, string> = { approved: "approvato", pending: "in attesa", rejected: "rifiutato", superseded: "superato" };

// Human-readable list of what changed between two snapshots
export function diff(a: Snap, b: Snap, s: State): string[] {
  const out: string[] = [];
  for (const [id, st] of Object.entries(b.mem)) {
    const text = s.memory.find((m) => m.id === id)?.text;
    const t = text ? ` «${text.slice(0, 70)}${text.length > 70 ? "…" : ""}»` : " (riservato)";
    if (!a.mem[id]) out.push(`+ ${id} in memoria, ${MEM_LABEL[st]}${t}`);
    else if (a.mem[id] !== st) out.push(`${id}: ${MEM_LABEL[a.mem[id]]} → ${MEM_LABEL[st]}${t}`);
    else if (a.txt[id] !== b.txt[id] && b.txt[id]) out.push(`${id} aggiornato, prima diceva «${a.txt[id].slice(0, 60)}…» → ora${t}`);
    else if ((b.srcs[id] ?? 0) > (a.srcs[id] ?? 0)) out.push(`${id} confermato da una nuova fonte (${b.srcs[id]} fonti), nessun fatto nuovo${t}`);
  }
  for (const [id, st] of Object.entries(b.q)) {
    const q = s.quarantine.find((x) => x.id === id);
    const what = q?.locked ? "decide " + q.authority_label : q?.claim_text ? `«${q.claim_text}»` : q?.reason ?? "";
    if (!a.q[id]) out.push(`+ ${id} in quarantena (${q?.kind === "security" ? "sospetto" : "contraddizione"}): ${what}`);
    else if (a.q[id] !== st) out.push(`${id}: quarantena ${a.q[id]} → ${st}${q?.decided_by ? ` (${q.decided_by})` : ""}`);
  }
  for (const [id, st] of Object.entries(b.gaps)) {
    const g = s.gaps.find((x) => x.id === id);
    if (!a.gaps[id]) out.push(`+ ${id} buco di conoscenza → ${g?.owner_label}: «${g?.question}»`);
    else if (a.gaps[id] !== st) out.push(`${id}: buco ${a.gaps[id]} → ${st}${g?.decided_by ? ` (${g.decided_by})` : ""}`);
  }
  for (const id of b.banned) if (!a.banned.includes(id)) out.push(`Fonte ${id} bandita: le sue informazioni non vengono più usate`);
  return out;
}

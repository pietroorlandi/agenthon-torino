"""Morning brief per person.
Day 1: the news part is written by Gemini (services/writer.py) from the sources the person can see (seed items only
as fallback) + live quarantine, gaps, pending memory. From day 2 (▶ Nuovo giorno), built in code: what you closed
yesterday, what happened overnight, today's to-do list (new items marked) and deadlines."""
from __future__ import annotations

import re

from ..models import BriefItem, User

MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]


def email_subject(date: str) -> str:
    day, month = date.split("/")[:2]
    return f"Il tuo brief del {int(day)} {MONTHS[int(month) - 1]}"


def _short(text: str, n: int = 70) -> str:
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def _join(parts: list[str]) -> str:
    out = "; ".join(parts)
    return out if out.endswith(("…", ".")) else out + "."


def _due_label(days: int | None) -> str:
    return {0: " (scade **oggi**)", 1: " (scade domani)"}.get(days, "") if days is not None and days >= 0 else (" (**scaduto**)" if days is not None else "")


def build_brief(brain, user: User) -> dict:
    from ..store import can_see
    from .tasks import done_for, tasks_for

    first_day = brain.day == 0
    items, engine = [], "codice"
    if first_day:
        written = brain.llm_brief.get(user.id)
        if written:
            items, engine = [i.model_copy() for i in written[0]], written[1]
        elif f"brief:{user.id}" in brain.writing:
            engine = "writing"
        else:
            items, engine = [i.model_copy() for i in brain.brief_items.get(user.role, [])], "riserva"
    else:
        done = done_for(brain, user, brain.prev_date or "")
        if done:
            items.append(BriefItem(text=f"**Ieri hai chiuso {len(done)} attività**: "
                                        + _join([_short(d["text"].split(" ha ", 1)[-1]) for d in done[:4]])
                                        + (f" e altre {len(done) - 4}." if len(done) > 4 else "")))
        else:
            items.append(BriefItem(text="**Ieri** non hai chiuso attività: quelle aperte sono ancora qui sotto."))
        for news in brain.overnight.get(user.role, []):
            items.append(BriefItem(text=news))
    for q in brain.quarantine:
        if q.status != "pending" or user.role not in q.authority:
            continue
        if q.kind == "contradiction":
            text = f"**Informazione in quarantena**: «{q.claim.text}» contraddice la memoria approvata. Non la uso finché non decidi in *Oggi*."
        else:
            text = f"**Messaggio sospetto in quarantena**: «{brain.sources[q.source_id].title}» — {q.reason}."
        items.insert(0, BriefItem(text=text, sources=[q.source_id], derived=True))
    tasks = tasks_for(brain, user)
    if not first_day:
        if tasks:
            new = sum(1 for t in tasks if t.get("is_new"))
            lines = _join([("*nuovo* · " if t.get("is_new") else "") + _short(t["title"], 60) + _due_label(t.get("days_left")) for t in tasks[:5]])
            items.append(BriefItem(text=f"**Oggi hai {len(tasks)} compiti**{f' ({new} nuovi)' if new else ''}: {lines}"
                                        + (f" e altri {len(tasks) - 5}." if len(tasks) > 5 else ""), derived=True))
        else:
            items.append(BriefItem(text="**Oggi non hai compiti aperti.**", derived=True))
    else:
        gaps = [g for g in brain.gaps if g.status == "open" and g.owner == user.role]
        if gaps:
            items.append(BriefItem(text=f"Hai **{len(gaps)} domande da documentare** che nessuno aveva mai scritto (es. «{gaps[0].question}»).", derived=True))
        pending = [m for m in brain.memory if m.status == "pending" and can_see(m.access, user.role) and brain.can_curate(m, user.role)]
        if pending:
            items.append(BriefItem(text=f"Hai **{len(pending)} elementi di memoria** da revisionare.", derived=True))
    due = [t for t in tasks if t["kind"] == "task" and t.get("days_left") is not None and t["days_left"] <= 1]
    for t in due:
        items.append(BriefItem(text=f"**Scadenza**: «{t['title']}»{_due_label(t['days_left'])}. {t.get('detail') or ''}".strip(), sources=[t["id"]]))
    c = brain.counters
    if c["observed"]:
        items.append(BriefItem(text=f"Da stamattina ho osservato **{c['observed']} nuovi eventi**: {c['ignored']} ignorati, "
                                    f"{c['quarantined']} in quarantena, {c['proposed']} proposte di memoria, {c['corroborated']} conferme.", derived=True))
    return {"text": f"Buongiorno {user.name.split()[0]}, ecco cosa richiede la tua attenzione oggi:", "items": items, "time": "08:00", "engine": engine}


def plain(text: str) -> str:
    return re.sub(r"[*_#]", "", text)


def brief_plaintext(brain, user: User) -> str:
    b = build_brief(brain, user)
    ordinals = ["Primo", "Secondo", "Terzo", "Quarto", "Quinto", "Sesto", "Settimo", "Ottavo"]
    parts = [b["text"]] + [f"{ordinals[i] if i < len(ordinals) else 'Poi'}: {plain(it.text)}" for i, it in enumerate(b["items"])]
    return "\n".join(parts) + "\nNon eseguo nessuna azione senza la tua approvazione."

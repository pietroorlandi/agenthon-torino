"""Morning brief per person: deterministic content and order (seed items + live quarantine, gaps, pending memory)."""
from __future__ import annotations

import re

from ..models import BriefItem, User


def build_brief(brain, user: User) -> dict:
    from ..store import can_see

    items = [i.model_copy() for i in brain.brief_items.get(user.role, [])]
    for q in brain.quarantine:
        if q.status != "pending" or user.role not in q.authority:
            continue
        if q.kind == "contradiction":
            text = f"🛡️ **Informazione in quarantena**: «{q.claim.text}» contraddice la memoria approvata. Non la uso finché non decidi in *Memoria*."
        else:
            text = f"🛡️ **Messaggio sospetto in quarantena**: «{brain.sources[q.source_id].title}» — {q.reason}."
        items.insert(0, BriefItem(text=text, sources=[q.source_id]))
    gaps = [g for g in brain.gaps if g.status == "open" and g.owner == user.role]
    if gaps:
        items.append(BriefItem(text=f"📝 Hai **{len(gaps)} domande da documentare** che nessuno aveva mai scritto (es. «{gaps[0].question}»)."))
    pending = [m for m in brain.memory if m.status == "pending" and can_see(m.access, user.role) and brain.can_curate(m, user.role)]
    if pending:
        items.append(BriefItem(text=f"Hai **{len(pending)} elementi di memoria** da revisionare."))
    c = brain.counters
    if c["observed"]:
        items.append(BriefItem(text=f"Da stamattina ho osservato **{c['observed']} nuovi eventi**: {c['ignored']} ignorati, "
                                    f"{c['quarantined']} in quarantena, {c['proposed']} proposte di memoria, {c['corroborated']} conferme."))
    return {"text": f"Buongiorno {user.name.split()[0]}, ecco cosa richiede la tua attenzione oggi:", "items": items, "time": "08:00"}


def plain(text: str) -> str:
    return re.sub(r"[*_#]", "", text)


def brief_plaintext(brain, user: User) -> str:
    b = build_brief(brain, user)
    ordinals = ["Primo", "Secondo", "Terzo", "Quarto", "Quinto", "Sesto", "Settimo", "Ottavo"]
    parts = [b["text"]] + [f"{ordinals[i] if i < len(ordinals) else 'Poi'}: {plain(it.text)}" for i, it in enumerate(b["items"])]
    return "\n".join(parts) + "\nNon eseguo nessuna azione senza la tua approvazione."

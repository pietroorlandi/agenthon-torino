"""Knowledge gaps: an unanswerable company question opens a 'da documentare' request to the competent department.
The answer, signed by a person of that department, enters memory already approved."""
from __future__ import annotations

import re

from ..models import Gap, MemoryItem, Source, TopicOwner, User
from ..store import can_see, norm
from . import orders


def route_question(brain, q: str, asker_role: str | None = None):
    """Department that knows the answer. Nobody asks their own department: if another department is also
    relevant, it wins (e.g. Spedizioni asking «il pacco #10487 è pronto?» → Magazzino, who prepares it)."""
    scored = [(t, sum(1 for k in t.keywords if norm(k) in q)) for t in brain.company.topic_owners]
    scored = [x for x in scored if x[1] > 0]
    if asker_role:
        others = [x for x in scored if x[0].role != asker_role]
        scored = others or scored
    return max(scored, key=lambda x: x[1])[0] if scored else None


def open_gap(brain, asker: User, question: str, topic: TopicOwner, text: str, engine: str) -> dict:
    key = re.sub(r"[^a-z0-9 ]", "", norm(question)).strip()
    gap = next((g for g in brain.gaps if g.key == key and g.status == "open"), None)
    is_new = gap is None
    if is_new:
        gap = Gap(id=f"G{len(brain.gaps) + 1}", key=key, question=question, asked_by=asker.id, owner=topic.role,
                  topic_label=topic.label, time=brain.sim_time())
        brain.gaps.append(gap)
        brain.log(f"agent:qa", "gap.opened", f"Buco di conoscenza: «{question}» → {brain.role_label(topic.role)}", refs=[gap.id])
    owner = next(iter(brain.users_with_role(topic.role)), None)
    if is_new and owner and owner.id != asker.id:
        brain.push(owner.id, kind="alert", gap_id=gap.id,
                   text=f"**Buco di conoscenza da colmare**\n{asker.name} ({asker.role_label}) ha chiesto: «{question}». Non è nella memoria e sembra "
                        f"di tua competenza ({topic.label}). Puoi scrivere la risposta in *Oggi*?")
    if owner and owner.id == asker.id:
        tail = "Sembra di **tua** competenza: puoi documentarla tu in *Oggi*."
    elif is_new:
        tail = f"Sembra di competenza **{brain.role_label(topic.role)}** ({topic.label}): ho chiesto a **{owner.name if owner else 'il reparto'}** di documentarla, quando risponde te lo scrivo qui."
    else:
        tail = f"C'è già una richiesta aperta a **{owner.name if owner else brain.role_label(topic.role)}** su questa domanda."
    return {"kind": "gap", "text": f"{text}\nÈ un'informazione aziendale che qualcuno conosce ma che non è mai stata scritta. {tail}",
            "gap_id": gap.id, "engine": engine}


def answer_gap(brain, user: User, gap: Gap, fact: str, question: str, access: list[str]) -> None:
    from ..pipeline.observe import derive_keywords

    question = question.strip() or gap.question
    src = Source(id=f"kn-{gap.id}", type="note", title=f"Risposta di {user.name}: {question}", sender=user.id,
                 date=brain.now, access=access, body=fact, observed_at=brain.now, trust="internal")
    brain.sources[src.id] = src
    n = len([m for m in brain.memory if m.id.startswith("K")]) + 1
    asker = brain.user(gap.asked_by)
    # a fact about one order is operational: it lives in Spedizioni → 'Stato degli ordini' until the order is fulfilled
    order_id = orders.find_order_id(brain, question, fact, gap.question)
    mem = MemoryItem(id=f"K{n}", text=fact, question=question, source_ids=[src.id], access=access, status="approved",
                     proposed_by=user.name, approved_by=user.name, keywords=derive_keywords(question), min_score=2, created_at=brain.now,
                     dept=orders.SHIP_ROLE if order_id else gap.owner, topic="ordini" if order_id else None, order_id=order_id,
                     involves=list(dict.fromkeys([user.role] + ([asker.role] if asker else []))))
    brain.memory.append(mem)
    gap.status, gap.answer, gap.decided_by = "answered", fact, user.name
    brain.log(f"user:{user.id}", "gap.answered", f"{user.name} ha documentato «{question}» ({mem.id})", access=access, refs=[gap.id, mem.id])
    asker = brain.user(gap.asked_by)
    if asker and can_see(access, asker.role):
        brain.push(asker.id, kind="answer", sources=[src.id], memory_ids=[mem.id],
                   text=f"**{user.name}** ha risposto alla tua domanda «{gap.question}»:\n{fact}\nL'ho aggiunto alla memoria: da ora lo so anche io.")
    elif asker:
        brain.push(asker.id, kind="denied", text=f"{user.name} ha documentato la risposta a «{gap.question}», ma l'ha resa visibile solo a {brain.roles_label(access)}.")
    if asker and asker.id != user.id:
        brain.push(user.id, kind="done", sources=[src.id], text=f"Grazie! Ho salvato in memoria la risposta a «{question}» e ho avvisato {asker.name}.")


def dismiss_gap(brain, user: User, gap: Gap) -> None:
    gap.status, gap.decided_by = "dismissed", user.name
    brain.log(f"user:{user.id}", "gap.dismissed", f"{user.name} ha chiuso «{gap.question}» (informazione non esistente)", refs=[gap.id])
    if gap.asked_by != user.id:
        brain.push(gap.asked_by, kind="unknown",
                   text=f"{user.name} ha chiuso la tua domanda «{gap.question}»: l'informazione non esiste o non è di sua competenza. Continuo a non saperlo, e non invento.")

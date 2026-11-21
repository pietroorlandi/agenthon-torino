"""Projection of the state for one user: every per-role filter is applied here, server side (P2).
What a role cannot see is sent only as a locked stub (id + status), never with its text."""
from __future__ import annotations

from .config import settings
from .models import User
from .services.brief import build_brief
from .services.mailer import mask
from .services.taxonomy import classify
from .store import can_see

SUGGESTIONS = [
    "Quale corriere usiamo per l'estero da dicembre?", "Che sconto facciamo per il Black Friday?",
    "Posso cumulare NATALE10 e BENVENUTO5?", "I gianduiotti contengono latte?", "Come funzionano i rimborsi?",
    "Qual è lo sconto massimo applicabile a un ordine?", "Qual è l'ordine minimo per le nocciole?",
    "Qual è il margine di novembre?", "Entro quando ordinare per ricevere prima di Natale?",
    "Quanti dipendenti ha il nostro concorrente?",
]


def _source(brain, s, role: str) -> dict:
    if not can_see(s.access, role):
        return {"id": s.id, "type": s.type, "locked": True, "access_label": brain.roles_label(s.access)}
    d = s.model_dump(exclude={"fallback", "claim", "effects"})
    d.update(sender_label=brain.who(s.sender), to_label=brain.who(s.to) if s.to else None, access_label=brain.roles_label(s.access),
             in_quarantine=any(q.source_id == s.id and q.status == "pending" for q in brain.quarantine))
    return d


def memory_scope(m, dept: str | None, role: str, can_curate: bool) -> str | None:
    """Department policy for 'Cosa sappiamo' (on top of the `access` list):
    mine    → fact of my own department
    company → fact with no department, visible to me
    shared  → another department's fact that its owner made visible to everyone
    review  → another department's pending fact I am asked to verify (shown only in 'Oggi')
    None    → not sent to this user (locked stub)"""
    if not can_see(m.access, role):
        return None
    if dept == role:
        return "mine"
    if dept is None:
        return "company"
    if "all" in m.access:
        return "shared"
    if m.status == "pending" and can_curate:
        return "review"
    return None


def state_for(brain, user: User) -> dict:
    role = user.role
    sources = list(brain.sources.values()) + [brain.source(f"STORE-{sku}") for sku in brain.products]
    memory = []
    for m in brain.memory:
        dept, topic = classify(brain, m) if can_see(m.access, role) else (None, None)
        scope = memory_scope(m, dept, role, brain.can_curate(m, role))
        if scope:
            memory.append({**m.model_dump(), "dept": dept, "topic": topic, "scope": scope,
                           "access_label": brain.roles_label(m.access), "can_curate": brain.can_curate(m, role)})
        else:
            memory.append({"id": m.id, "status": m.status, "locked": True, "access_label": brain.roles_label(m.access), "source_ids": []})
    quarantine = []
    for q in brain.quarantine:
        base = {"id": q.id, "kind": q.kind, "status": q.status, "authority_label": brain.roles_label(q.authority), "decided_by": q.decided_by}
        if role not in q.authority:
            quarantine.append({**base, "locked": True})
            continue
        mem = brain.memory_by_id(q.memory_id) if q.memory_id else None
        quarantine.append({**base, "can_decide": q.status == "pending", "reason": q.reason, "source_id": q.source_id,
                           "claim_text": q.claim.text if q.claim else None, "memory_id": q.memory_id,
                           "memory_text": mem.text if mem else None, "memory_approved_by": mem.approved_by if mem else None,
                           "order_id": (q.effects or {}).get("order_id")})
    gaps = []
    for g in brain.gaps:
        asker = brain.user(g.asked_by)
        mine = g.owner == role
        gaps.append({**g.model_dump(exclude={"key", "answer"}), "mine": mine, "asked_by_name": asker.name, "asker_role": asker.role,
                     "asked_by_role_label": asker.role_label, "owner_label": brain.role_label(g.owner),
                     "answer": g.answer if (mine or g.asked_by == user.id) else None})
    actions = []
    for a in brain.actions:
        if a.owner == role:
            actions.append({**a.model_dump(), "owner_label": brain.role_label(a.owner), "can_decide": a.status == "pending"})
        else:
            actions.append({"id": a.id, "status": a.status, "locked": True, "owner_label": brain.role_label(a.owner)})
    nxt = brain.timeline[brain.cursor] if brain.cursor < len(brain.timeline) else None
    visible_sources = [_source(brain, s, role) for s in sources]
    return {
        "now": brain.now,
        "me": user.model_dump(),
        "users": [u.model_dump() for u in brain.company.users],
        "roles": brain.company.roles,
        "knowledge_topics": [{"id": t.id, "label": t.label} for t in brain.company.knowledge_topics],
        "channels": [{"id": c.id, "locked": not can_see(c.access, role)} for c in brain.company.channels],
        "dm": [m.model_dump() for m in brain.dm[user.id]],
        "unread": brain.unread.get(user.id, 0),
        "brief": {**build_brief(brain, user), "items": [i.model_dump() for i in build_brief(brain, user)["items"]]},
        "memory": memory,
        "quarantine": quarantine,
        "gaps": gaps,
        "actions": actions,
        "outbox": [o.model_dump() for o in brain.outbox if (a := brain.action_by_id(o.action_id)) and a.owner == role],
        "sources": visible_sources,
        "hidden_sources": sum(1 for s in visible_sources if s.get("locked")),
        "products": [p.model_dump() for p in brain.products.values()],
        "orders": [o.model_dump() for o in reversed(brain.orders)],
        "audit": [e.model_dump() for e in reversed(brain.audit) if can_see(e.access, role)][:300],
        "timeline": {"done": brain.cursor, "total": len(brain.timeline),
                     "next": {"at": nxt.at, "label": nxt.label} if nxt else None},
        "llm": {"mode": settings.llm_mode, "model": settings.model, "model_lite": settings.model_lite,
                "tts": settings.tts_enabled, "trace_exporter": settings.trace_exporter},
        "mail": {"enabled": settings.mail_enabled, "to": mask(settings.mail_to) if settings.mail_enabled else None},
        "counters": dict(brain.counters),
        "suggestions": SUGGESTIONS,
    }


def quality(brain) -> dict:
    """Agent quality metrics derived from the state (Observability panel)."""
    by_brain = [m for m in brain.memory if m.proposed_by == "Brain"]
    approved = sum(1 for m in by_brain if m.status == "approved")
    rejected = sum(1 for m in by_brain if m.status == "rejected")
    answers = [m for msgs in brain.dm.values() for m in msgs if m.sender == "brain" and m.kind in ("answer", "unknown", "denied", "gap")]
    acts = brain.actions
    return {
        "extraction_precision": round(approved / (approved + rejected), 3) if approved + rejected else None,
        "memory": {"approved": approved, "rejected": rejected, "pending": sum(1 for m in by_brain if m.status == "pending")},
        "answers": len(answers),
        "dont_know_pct": round(sum(1 for m in answers if m.kind in ("unknown", "gap")) / len(answers) * 100, 1) if answers else None,
        "denied": sum(1 for m in answers if m.kind == "denied"),
        "validator_rejections": sum(1 for e in brain.audit if e.op.startswith("validator.")),
        "contradictions": sum(1 for q in brain.quarantine if q.kind == "contradiction"),
        "security_quarantine": sum(1 for q in brain.quarantine if q.kind == "security"),
        "sources": dict(brain.counters),
        "actions": {"proposed": len(acts), "executed": sum(a.status == "executed" for a in acts),
                    "rejected": sum(a.status == "rejected" for a in acts), "pending": sum(a.status == "pending" for a in acts)},
    }

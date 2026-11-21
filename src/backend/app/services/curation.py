"""Human decisions on memory and quarantine. Only these functions (called by human endpoints) move items to
approved / rejected / banned / released (P4): no agent code path calls them."""
from __future__ import annotations

from ..models import MemoryItem, QuarantineItem, User
from ..store import can_see
from .actions import Forbidden


def decide_memory(brain, user: User, m: MemoryItem, approve: bool) -> None:
    if not (can_see(m.access, user.role) and brain.can_curate(m, user.role)):
        raise Forbidden("Non hai l'autorità per decidere su questo elemento")
    if m.status != "pending":
        raise Forbidden("Elemento già deciso")
    if approve:
        m.status, m.approved_by = "approved", user.name
    else:
        m.status, m.rejected_by = "rejected", user.name
    brain.log(f"user:{user.id}", "memory.approve" if approve else "memory.reject",
              f"{user.name} ha {'approvato' if approve else 'rifiutato'} {m.id}: «{m.text[:80]}»", access=m.access, refs=[m.id])


def _apply_order(brain, effects: dict | None, key: str) -> str:
    if not effects or not effects.get("order_id") or not effects.get(key):
        return ""
    order = brain.order_by_id(effects["order_id"])
    if not order:
        return ""
    for k, v in effects[key].items():
        setattr(order, k, v)
    return f" Ho aggiornato l'ordine {order.id} ({order.total:.2f}€, {order.flag})."


def decide_quarantine(brain, user: User, q: QuarantineItem, decision: str) -> None:
    if user.role not in q.authority:
        raise Forbidden("Solo chi ha l'autorità sulla voce può decidere")
    if q.status != "pending":
        raise Forbidden("Già deciso")
    src = brain.sources[q.source_id]
    q.decided_by = user.name
    actor = f"user:{user.id}"
    if q.kind == "contradiction" and decision == "ban":
        q.status, src.banned = "banned", True
        extra = _apply_order(brain, q.effects, "on_ban")
        brain.log(actor, "quarantine.banned", f"{user.name} ha scartato «{q.claim.text}» (fonte bandita).{extra}", access=q.authority, refs=[q.id, src.id])
        brain.push(user.id, kind="done", sources=[src.id], text=f"Scartata e dimenticata: **{q.claim.text}** Non la userò mai.{extra}")
    elif q.kind == "contradiction" and decision == "accept":
        mem = brain.memory_by_id(q.memory_id)
        q.status = "accepted"
        mem.text, mem.approved_by = q.claim.text, user.name
        if mem.fact:
            mem.fact.value = q.claim.value
        if src.id not in mem.source_ids:
            mem.source_ids.append(src.id)
        extra = _apply_order(brain, q.effects, "on_accept")
        brain.log(actor, "quarantine.accepted", f"{user.name} ha accettato «{q.claim.text}»: memoria {mem.id} aggiornata.{extra}", access=q.authority, refs=[q.id, mem.id])
        brain.push(user.id, kind="done", sources=[src.id], memory_ids=[mem.id], text=f"Ho aggiornato la memoria: **{q.claim.text}** Da ora risponderò così.{extra}")
    elif q.kind == "security" and decision == "confirm_bad":
        q.status, src.banned = "confirmed_bad", True
        brain.log(actor, "quarantine.confirmed_bad", f"{user.name} ha confermato lo scarto di «{src.title}»", access=q.authority, refs=[q.id, src.id])
        brain.push(user.id, kind="done", sources=[src.id], text=f"Confermato: «{src.title}» resta scartato. Non ne userò nulla.")
    elif q.kind == "security" and decision == "release":
        from ..pipeline.observe import process

        q.status = "released"
        brain.log(actor, "quarantine.released", f"{user.name} ha rilasciato «{src.title}»: riparte la pipeline", access=q.authority, refs=[q.id, src.id])
        res = process(brain, src, released=True)
        brain.push(user.id, kind="done", sources=[src.id],
                   text=f"Ho rilasciato «{src.title}» e l'ho rianalizzato: esito **{res['outcome']}**. Eventuali fatti restano proposte da approvare.")
    else:
        raise Forbidden("Decisione non valida per questo elemento")

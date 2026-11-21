"""Each person's to-do list, derived from the live state (no separate task store to keep in sync):
assigned tasks (seed), colleagues' questions to document, orders ready to ship, decisions waiting for them.
What they closed is read back from the audit log, so the morning brief can say what happened yesterday."""
from __future__ import annotations

from datetime import datetime

from ..models import User
from ..store import can_see
from . import orders

YEAR = 2026
DONE_OPS = {
    "gap.answered", "order.shipped", "task.done", "action.executed", "action.rejected", "memory.approve", "memory.reject",
    "quarantine.banned", "quarantine.accepted", "quarantine.confirmed_bad", "quarantine.released",
}


def _days_left(today: str, due: str | None) -> int | None:
    if not due:
        return None
    try:
        d = lambda s: datetime.strptime(f"{s.strip()[:5]}/{YEAR}", "%d/%m/%Y")
        return (d(due) - d(today)).days
    except ValueError:
        return None


def tasks_for(brain, user: User) -> list[dict]:
    role, out = user.role, []
    for g in brain.gaps:
        if g.status == "open" and g.owner == role:
            asker = brain.user(g.asked_by)
            out.append({"id": g.id, "kind": "gap", "title": f"Rispondi a {asker.name if asker else 'un collega'}: «{g.question}»", "tab": "today"})
    for a in brain.actions:
        if a.status == "pending" and a.owner == role:
            out.append({"id": a.id, "kind": "approve", "title": f"Decidi: {a.title}", "tab": "today"})
    n_q = sum(1 for q in brain.quarantine if q.status == "pending" and role in q.authority)
    if n_q:
        out.append({"id": "quarantine", "kind": "verify", "title": f"Verifica {n_q} {'informazione' if n_q == 1 else 'informazioni'} in quarantena", "tab": "today"})
    n_p = sum(1 for m in brain.memory if m.status == "pending" and can_see(m.access, role) and brain.can_curate(m, role))
    if n_p:
        out.append({"id": "proposals", "kind": "review", "title": f"Conferma {n_p} {'nuova informazione' if n_p == 1 else 'nuove informazioni'}", "tab": "today"})
    if role == orders.SHIP_ROLE:
        for m in brain.memory:
            if m.order_id and m.status == "approved" and can_see(m.access, role) and not orders.order_done(brain, m.order_id):
                out.append({"id": f"ship-{m.order_id}", "kind": "ship", "title": f"Spedisci l'ordine {m.order_id}", "detail": m.text, "tab": "knowledge"})
    for s in brain.sources.values():
        if s.type == "task" and s.sender == user.id and s.id not in brain.tasks_done:
            out.append({"id": s.id, "kind": "task", "title": s.title, "detail": s.body, "due": s.due,
                        "days_left": _days_left(brain.date, s.due)})
    seen = brain.prev_open.get(user.id)
    for t in out:
        t["is_new"] = seen is not None and t["id"] not in seen
    return out


def done_for(brain, user: User, date: str) -> list[dict]:
    return [{"text": e.text, "op": e.op} for e in brain.audit
            if e.actor == f"user:{user.id}" and e.op in DONE_OPS and e.sim_ts.startswith(date)]


def complete_task(brain, user: User, task_id: str) -> None:
    from .actions import Forbidden

    s = brain.sources.get(task_id)
    if not s or s.type != "task" or s.sender != user.id:
        raise Forbidden("Puoi chiudere solo i task assegnati a te")
    if task_id in brain.tasks_done:
        raise Forbidden("Task già completato")
    brain.tasks_done[task_id] = brain.date
    brain.log(f"user:{user.id}", "task.done", f"{user.name} ha completato: {s.title}", access=s.access, refs=[s.id])

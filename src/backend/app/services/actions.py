"""Proposed actions: the Brain only proposes. Executor runs only after approval by a person of the owner department (P4)."""
from __future__ import annotations

from ..models import Action, OutboxItem, User
from . import mailer


class Forbidden(Exception):
    pass


# Who decides each effect: fixed in code, the LLM cannot pick the approver
EFFECT_OWNER = {"refund": "clienti", "notify": "clienti", "intercept": "spedizioni", "reorder": "magazzino",
                "quarantine": "magazzino", "block": "shop", "payment": "shop"}


def _check(brain, user: User, a: Action) -> None:
    if f"action:{a.id}" in brain.writing:
        raise Forbidden("Gemini sta ancora scrivendo la bozza: riprova tra qualche secondo")
    if a.owner != user.role:
        raise Forbidden(f"Azione di competenza {a.owner}: il ruolo {user.role} non può deciderla")
    if a.status != "pending":
        raise Forbidden("Azione già decisa")


def approve(brain, user: User, a: Action) -> None:
    _check(brain, user, a)
    a.status, a.decided_by = "executed", user.name
    order = brain.order_by_id(a.order_id) if a.order_id else None
    product = brain.products.get(a.sku) if a.sku else None
    if a.effect == "refund" and order:
        order.status = "Rimborsato"
    elif a.effect == "intercept" and order:
        order.status = "Intercettato"
    elif a.effect == "reorder" and product:
        product.incoming += a.qty or 0
    elif a.effect == "block" and product:
        product.blocked = True
    item = OutboxItem(action_id=a.id, title=a.title, body=a.draft, approved_by=user.name, sent_at=brain.now)
    brain.outbox.insert(0, item)
    mailer.deliver(brain, item, a, user)  # real email only to MAIL_TO, only here, i.e. only after a human approval
    brain.log(f"user:{user.id}", "action.executed", f"{user.name} ha approvato: {a.title}", refs=[a.id])
    brain.push(user.id, kind="done", sources=a.source_ids, action_id=a.id,
               text=f"Fatto: **{a.title}**. L'ho eseguito solo dopo la tua approvazione.")


def reject(brain, user: User, a: Action) -> None:
    _check(brain, user, a)
    a.status, a.decided_by = "rejected", user.name
    brain.log(f"user:{user.id}", "action.rejected", f"{user.name} ha rifiutato: {a.title} (nessuna modifica)", refs=[a.id])


def edit_draft(brain, user: User, a: Action, draft: str) -> None:
    _check(brain, user, a)
    a.draft, a.edited_by = draft, user.name
    brain.log(f"user:{user.id}", "action.edited", f"{user.name} ha modificato la bozza di {a.id}", access=[a.owner], refs=[a.id])

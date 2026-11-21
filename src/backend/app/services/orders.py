"""Operational knowledge about single orders («il pacco #10487 è pronto?»).
A fact linked to an order lives in Spedizioni → 'Stato degli ordini' and moves to the history once the order is fulfilled."""
from __future__ import annotations

import re

from ..models import User
from .actions import Forbidden

ORDER_RE = re.compile(r"#\s?(\d{4,6})")
DONE_STATUSES = {"Spedito", "Consegnato", "Rimborsato"}
SHIP_ROLE = "spedizioni"


def find_order_id(brain, *texts: str) -> str | None:
    """First '#NNNNN' in the texts that is a real order of the store."""
    for t in texts:
        for n in ORDER_RE.findall(t or ""):
            if brain.order_by_id(f"#{n}"):
                return f"#{n}"
    return None


def order_done(brain, order_id: str | None) -> bool:
    o = brain.order_by_id(order_id) if order_id else None
    return bool(o and o.status in DONE_STATUSES)


def mark_shipped(brain, user: User, order_id: str) -> None:
    """A person of Spedizioni confirms the order left: the store is updated and its facts go to the history."""
    if user.role != SHIP_ROLE:
        raise Forbidden("Solo le Spedizioni possono segnare un ordine come evaso")
    o = brain.order_by_id(order_id)
    if not o:
        raise Forbidden("Ordine inesistente")
    if o.status in DONE_STATUSES:
        raise Forbidden(f"L'ordine {o.id} è già chiuso ({o.status})")
    before, o.status = o.status, "Spedito"
    brain.log(f"user:{user.id}", "order.shipped", f"{user.name} ha segnato l'ordine {o.id} come evaso ({before} → Spedito)",
              refs=[o.id] + [m.id for m in brain.memory if m.order_id == o.id])

"""Simulated clock: ▶ Next replays the next moment of the timeline (store changes + new sources + rules)."""
from __future__ import annotations

from datetime import datetime, timedelta

from ..models import Action, Order, Source
from ..pipeline.observe import observe
from ..telemetry import op_span


def next_moment(brain) -> dict | None:
    if brain.cursor >= len(brain.timeline):
        return None
    m = brain.timeline[brain.cursor]
    brain.cursor += 1
    # after ▶ Nuovo giorno the remaining moments happen on the current simulated day
    brain.now = m.at if brain.day == 0 else f"{brain.date} {m.at.split(' ')[-1]}"
    with op_span("clock.next", **{"brain.moment": m.id}):
        results = []
        store = m.store or {}
        for o in store.get("add_orders", []):
            brain.orders.append(Order.model_validate(o))
        changed = []
        for s in store.get("stock", []):
            p = brain.products[s["sku"]]
            p.stock = s.get("stock", p.stock)
            p.sold7d += s.get("sold7d_add", 0)
            changed.append(p.sku)
        for src in m.sources:
            results.append(observe(brain, Source.model_validate(src.model_dump())))
        rule = store.get("on_low_stock")
        if rule:
            results.append(low_stock_rule(brain, rule))
        brain.log("system", "clock.next", f"{m.at} — {m.label}", refs=[m.id])
        return {"moment": {"id": m.id, "at": m.at, "label": m.label}, "results": results}


def new_day(brain) -> dict:
    """▶ Nuovo giorno: the night passes (shipped orders get delivered), then everyone gets a new morning brief
    built from what they closed yesterday and what is still open today."""
    from .tasks import YEAR, tasks_for

    brain.prev_open = {u.id: {t["id"] for t in tasks_for(brain, u)} for u in brain.company.users}
    brain.prev_date = brain.date
    d = datetime.strptime(f"{brain.date}/{YEAR}", "%d/%m/%Y") + timedelta(days=1)
    brain.day += 1
    brain.now = f"{d:%d/%m} 08:00"
    brain.counters.clear()
    brain.overnight = {}
    delivered = [o for o in brain.orders if o.status == "Spedito"]
    for o in delivered:
        o.status = "Consegnato"
    if delivered:
        ids = ", ".join(o.id for o in delivered[:6]) + ("…" if len(delivered) > 6 else "")
        brain.overnight["spedizioni"] = [f"**Nella notte il corriere ha consegnato {len(delivered)} ordini** ({ids}): sono chiusi."]
        brain.log("system", "order.delivered", f"Consegnati nella notte: {ids}", refs=[o.id for o in delivered])
    _overnight_orders(brain)
    with op_span("clock.day"):
        brain.send_morning_briefs()
    brain.log("system", "clock.day", f"Nuovo giorno: {brain.date} — inviato il brief del mattino a tutti")
    return {"date": brain.date, "delivered": len(delivered)}


NIGHT_CUSTOMERS = [("L. Ferrero", "IT", [("GIA-LAT", 2)], 31.8), ("Pasticceria Mole", "IT", [("GIA-SAL", 6)], 162.5),
                   ("S. Novak", "AT", [("BOX-NAT", 1)], 34.9), ("G. Costa", "IT", [("GIA-FON", 3)], 47.7)]


def _overnight_orders(brain) -> None:
    """Two new web orders arrive every night: Magazzino finds them in the morning brief."""
    # also skip ids that future timeline moments will create (e.g. #10490 in the 30% discount story)
    planned = [o["id"] for m in brain.timeline for o in (m.store or {}).get("add_orders", [])]
    last = max(int(oid.lstrip("#")) for oid in [o.id for o in brain.orders] + planned)
    picks = [NIGHT_CUSTOMERS[(brain.day * 2 + i) % len(NIGHT_CUSTOMERS)] for i in range(2)]
    new = []
    for i, (customer, country, items, total) in enumerate(picks, start=1):
        kind = "B2B" if "Pasticceria" in customer else "B2C"
        items = [(sku, q) for sku, q in items if sku in brain.products] or [(next(iter(brain.products)), 1)]
        o = Order(id=f"#{last + i}", date=f"{brain.date} 0{i + 1}:{14 * i:02d}", customer=customer, country=country, kind=kind,
                  items=items, status="In preparazione", total=total)
        brain.orders.append(o)
        new.append(o)
    ids = ", ".join(f"{o.id} ({o.customer})" for o in new)
    brain.overnight.setdefault("magazzino", []).append(f"**Nella notte sono arrivati {len(new)} nuovi ordini da preparare**: {ids}.")
    brain.log("system", "order.received", f"Nuovi ordini nella notte: {ids}", refs=[o.id for o in new])


def low_stock_rule(brain, rule: dict) -> dict:
    """Deterministic rule (no LLM): stock below threshold → alert to the owner role + proposed reorder."""
    p = brain.products[rule["sku"]]
    if p.stock >= p.threshold:
        return {"title": f"Scorte {p.sku}", "outcome": "ok"}
    action = Action.model_validate(rule["action"])
    if not brain.action_by_id(action.id):
        brain.actions.append(action)
    brain.notify_roles([rule["target"]], kind="alert", sources=rule.get("source_ids", []), action_id=action.id,
                       text=f"**{rule['title']}**\n{rule['text']}")
    brain.log("agent:rules", "alert.low_stock", f"{p.name}: {p.stock} pz < soglia {p.threshold} → alert {brain.role_label(rule['target'])} + azione {action.id}",
              refs=[p.sku, action.id])
    return {"title": rule["title"], "outcome": "alert", "reason": "Regola scorte (codice, nessun LLM)", "engine": "regole"}

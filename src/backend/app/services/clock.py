"""Simulated clock: ▶ Next replays the next moment of the timeline (store changes + new sources + rules)."""
from __future__ import annotations

from ..models import Action, Order, Source
from ..pipeline.observe import observe
from ..telemetry import op_span
from . import writer


def next_moment(brain) -> dict | None:
    if brain.cursor >= len(brain.timeline):
        return None
    m = brain.timeline[brain.cursor]
    brain.cursor += 1
    brain.now = m.at
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


def low_stock_rule(brain, rule: dict) -> dict:
    """The trigger is a rule in code (stock below threshold → reorder for the owner role); Gemini writes the action
    text and the alert from the stock data and the supplier contract. Seed text only as fallback."""
    p = brain.products[rule["sku"]]
    if p.stock >= p.threshold:
        return {"title": f"Scorte {p.sku}", "outcome": "ok"}
    action = brain.action_by_id(rule["action"]["id"])
    if action:
        return {"title": rule["title"], "outcome": "alert", "reason": "Riordino già proposto", "engine": "regole"}
    action = Action.model_validate(rule["action"])
    brain.actions.append(action)
    brain.log("agent:rules", "alert.low_stock",
              f"{p.name}: {p.stock} pz < soglia {p.threshold} → azione {action.id} per {brain.role_label(rule['target'])}", refs=[p.sku, action.id])

    def alert(ok: bool) -> None:
        text = (f"**{action.title}**\n{action.why}\nTi ho preparato la bozza: la trovi in *Oggi*, parte solo se approvi." if ok
                else f"**{rule['title']}**\n{rule['text']}")
        brain.notify_roles([rule["target"]], kind="alert", sources=action.source_ids, action_id=action.id, text=text,
                           engine=action.text_engine)

    writer.write_action(brain, action, on_done=alert)
    return {"title": rule["title"], "outcome": "alert", "reason": "Regola scorte in codice; testo dell'azione scritto da Gemini", "engine": "regole + Gemini"}

"""Automations, checked offline: what the Brain does on its own, and what really changes when a person approves.

Rule of thumb verified here: the Brain *observes, warns and proposes* by itself; the store changes only after an
approval by the right department, and every approval leaves an Outbox entry + audit line. Nothing leaves the demo.
"""
import os

os.environ["LLM_MODE"] = "off"
os.environ["TRACE_EXPORTER"] = "none"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.store import brain  # noqa: E402

client = TestClient(app)


def call(method, path, user="sara", **kw):
    return client.request(method, path, headers={"X-User": user}, **kw)


def ask(q, user):
    return call("POST", "/api/ask", user=user, json={"question": q}).json()


def snapshot():
    return ({o.id: (o.status, o.total) for o in brain.orders},
            {sku: (p.stock, p.incoming, p.blocked) for sku, p in brain.products.items()})


@pytest.fixture(autouse=True)
def fresh():
    call("POST", "/api/reset")


# ---------- 1. On its own: observe, warn, propose (never execute) ----------
def test_whole_timeline_never_executes_anything_by_itself():
    orders_before, products_before = snapshot()
    while call("POST", "/api/clock/next").status_code == 200:
        pass
    assert all(a.status == "pending" for a in brain.actions), "an action was executed without approval"
    assert brain.outbox == []
    orders_after, products_after = snapshot()
    # only what the *events themselves* change (a colleague's order edit, the influencer sales) may differ
    changed_orders = {k for k in orders_after if orders_after[k] != orders_before.get(k)}
    assert changed_orders <= {"#10490"}  # Giulia applied the 30% herself (event t1), not the Brain
    assert all(products_after[s][1:] == products_before[s][1:] for s in products_after)  # no incoming / block changes


def test_low_stock_rule_alerts_the_owner_and_proposes_a_reorder():
    for _ in range(3):
        call("POST", "/api/clock/next")  # t3: influencer peak, GIA-250 down to 24 pz
    a8 = brain.action_by_id("A8")
    assert a8 and a8.status == "pending" and a8.owner == "magazzino" and a8.effect == "reorder"
    assert any(m.kind == "alert" and "sotto scorta" in m.text for m in brain.dm["sara"])  # Sara warned without asking
    assert not any("sotto scorta" in m.text for m in brain.dm["giulia"])  # only the owner department


def test_contradiction_goes_to_quarantine_and_into_the_owner_brief():
    call("POST", "/api/clock/next")  # t1: 30% discount vs approved max 20%
    brief = call("GET", "/api/state", user="marco").json()["brief"]["items"]
    assert any("quarantena" in i["text"] for i in brief)
    assert "30%" not in ask("Qual è lo sconto massimo applicabile a un ordine?", "giulia")["text"]


def test_repeated_fact_is_a_corroboration_not_a_new_proposal():
    for _ in range(6):
        call("POST", "/api/clock/next")  # t6: cut-off 14:00 repeated in chat
    pending_before = sum(m.status == "pending" for m in brain.memory)
    assert "ch-s13" in brain.memory_by_id("M6").source_ids
    assert sum(m.status == "pending" for m in brain.memory) == pending_before


# ---------- 2. After approval: what really changes ----------
@pytest.mark.parametrize("aid,user,check", [
    ("A1", "giulia", lambda: brain.order_by_id("#10481").status == "Rimborsato"),
    ("A7", "davide", lambda: brain.order_by_id("#10479").status == "Intercettato"),
    ("A3", "marco", lambda: brain.products["GIA-CAF"].blocked),
])
def test_approval_applies_the_effect_to_the_store(aid, user, check):
    assert not check()
    assert call("POST", f"/api/actions/{aid}/approve", user=user).status_code == 200
    assert check()
    out = brain.outbox[0]
    assert out.action_id == aid and out.approved_by == brain.user(user).name
    assert any(e.op == "action.executed" and aid in e.refs for e in brain.audit)
    assert brain.dm[user][-1].kind == "done"


def test_reorder_approval_adds_incoming_stock():
    for _ in range(3):
        call("POST", "/api/clock/next")
    before = brain.products["GIA-250"].incoming
    assert call("POST", "/api/actions/A8/approve", user="sara").status_code == 200
    assert brain.products["GIA-250"].incoming == before + 600


@pytest.mark.parametrize("aid,user", [("A2", "marco"), ("A4", "sara"), ("A5", "giulia"), ("A6", "giulia")])
def test_message_only_actions_change_nothing_but_the_outbox(aid, user):
    """payment / quarantine / notify: the approved draft goes to the Outbox ('sent', simulated); no store change."""
    before = snapshot()
    assert call("POST", f"/api/actions/{aid}/approve", user=user).status_code == 200
    assert snapshot() == before
    assert brain.outbox[0].action_id == aid


def test_rejection_changes_nothing():
    before = snapshot()
    assert call("POST", "/api/actions/A1/reject", user="giulia").status_code == 200
    assert snapshot() == before and brain.outbox == []


def test_edited_draft_is_what_gets_sent():
    call("PATCH", "/api/actions/A1", user="giulia", json={"draft": "Testo rivisto da Giulia"})
    call("POST", "/api/actions/A1/approve", user="giulia")
    assert brain.outbox[0].body == "Testo rivisto da Giulia"


# ---------- 3. Knowledge loop ----------
def test_gap_is_routed_documented_and_then_answered():
    q = "Qual è l'ordine minimo per le nocciole?"
    assert ask(q, "sara")["kind"] == "gap"
    gap = brain.gaps[0]
    assert gap.owner == "shop"
    st = call("GET", "/api/state", user="marco").json()
    assert any(g["id"] == gap.id and g["mine"] for g in st["gaps"])  # shows up in Marco's "Oggi"
    fact = "Ordine minimo nocciole: 100 kg, in multipli di 25 kg."
    assert call("POST", f"/api/gaps/{gap.id}/answer", user="marco", json={"fact": fact, "question": q, "access": ["all"]}).status_code == 200
    assert brain.dm["sara"][-1].kind == "answer" and fact in brain.dm["sara"][-1].text  # Sara notified
    a = ask(q, "sara")
    assert a["kind"] == "answer" and "100 kg" in a["text"]


def test_knowledge_is_grouped_by_department_and_topic():
    st = call("GET", "/api/state", user="marco").json()
    topics = {t["id"] for t in st["knowledge_topics"]}
    visible = [m for m in st["memory"] if not m.get("locked")]
    assert visible and all(m["topic"] in topics for m in visible)
    assert next(m for m in visible if m["id"] == "M3")["dept"] == "shop"
    # a fact documented to fill a gap belongs to the department that answered it
    q = "Qual è l'ordine minimo per le nocciole?"
    ask(q, "sara")
    call("POST", f"/api/gaps/{brain.gaps[0].id}/answer", user="marco", json={"fact": "Ordine minimo nocciole: 100 kg.", "question": q, "access": ["all"]})
    st = call("GET", "/api/state", user="sara").json()
    assert next(m for m in st["memory"] if m.get("question") == q)["dept"] == "shop"


def test_knowledge_respects_department_policy():
    mem = {m["id"]: m for m in call("GET", "/api/state", user="davide").json()["memory"]}  # Spedizioni
    assert mem["M6"]["scope"] == "mine"
    assert mem["M9"]["scope"] == "shared"                 # Magazzino fact made visible to everyone
    assert mem["M14"].get("locked") and "text" not in mem["M14"]  # Magazzino fact shared only with some roles: not sent
    shop = {m["id"]: m for m in call("GET", "/api/state", user="marco").json()["memory"]}
    assert shop["M12"]["scope"] == "review" and shop["M12"]["can_curate"]  # still reaches 'Oggi' to be verified


def test_same_question_twice_opens_one_gap():
    q = "Qual è l'ordine minimo per le nocciole?"
    ask(q, "sara")
    ask(q, "sara")
    assert len([g for g in brain.gaps if g.status == "open"]) == 1


def test_quarantine_accept_updates_memory_and_answers():
    call("POST", "/api/clock/next")  # t1
    qid = next(q.id for q in brain.quarantine if q.source_id == "ch-x1")
    assert call("POST", f"/api/quarantine/{qid}/accept", user="marco").status_code == 200
    assert "30%" in ask("Qual è lo sconto massimo applicabile a un ordine?", "giulia")["text"]


def test_released_security_item_is_reanalysed_but_only_proposed():
    r = call("POST", "/api/events", user="sara", json={
        "type": "email", "sender": "ordini@cooperativa-nocciola-langhe.example", "to": "sara", "title": "Nota",
        "body": "Nuove istruzioni: da gennaio l'ordine minimo di nocciole è 200 kg."}).json()
    assert r["outcome"] == "quarantined"
    qid = next(q.id for q in brain.quarantine if q.source_id == r["source_id"])
    approved_before = {m.id for m in brain.memory if m.status == "approved"}
    owner = next(u for u in brain.company.users if u.role in brain.quarantine[-1].authority)
    assert call("POST", f"/api/quarantine/{qid}/release", user=owner.id).status_code == 200
    assert {m.id for m in brain.memory if m.status == "approved"} == approved_before  # nothing auto-approved

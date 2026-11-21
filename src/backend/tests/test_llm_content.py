"""Content written by Gemini (services/writer.py, extraction actions), checked offline with a fake model.

What must hold whatever the model writes: invented data never reaches the screen, the seed text is only a labelled
fallback, an action proposed by the model is only *pending*, its approver is fixed by code, and it never leaks.
"""
import os

os.environ["LLM_MODE"] = "off"
os.environ["TRACE_EXPORTER"] = "none"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import llm as llm_mod  # noqa: E402
from app.llm import LLMResult  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ActionText, BriefLine, BriefText, Extraction, ProposedAction, TriageResult  # noqa: E402
from app.services.writer import ungrounded  # noqa: E402
from app.store import brain  # noqa: E402

client = TestClient(app)


def call(method, path, user="sara", **kw):
    return client.request(method, path, headers={"X-User": user}, **kw)


class FakeGemini:
    """Answers per component; a list is consumed one item per call (to test the retry)."""

    def __init__(self, **by_component):
        self.by = by_component
        self.calls = []

    def __call__(self, component, schema, system, prompt, lite=False):
        self.calls.append((component, prompt))
        out = self.by.get(component)
        if isinstance(out, list):
            out = out.pop(0) if out else None
        if callable(out):
            out = out(prompt)
        return LLMResult(out, "gemini") if out is not None else LLMResult(None, "fallback")


@pytest.fixture
def gemini(monkeypatch):
    def install(**by):
        fake = FakeGemini(**by)
        monkeypatch.setattr(llm_mod.llm, "generate", fake)
        brain.reset()
        return fake
    yield install
    monkeypatch.undo()
    brain.reset()


@pytest.fixture(autouse=True)
def fresh():
    call("POST", "/api/reset")


# ---------- validator ----------
def test_validator_accepts_reformatted_numbers_and_rejects_invented_data():
    ctx = "Fattura 889 di 3.450€, ordine #10481 da 69.8, scrivere a ordini@lab.example"
    assert ungrounded("Pagare 3450 € (fattura n. 889), rimborso 69,80€ per #10481", ctx) == []
    assert "IT60X0542811101000000123456" in "".join(ungrounded("Bonifico su IT60 X054 2811 1010 0000 0123 456", ctx)).replace(" ", "")
    assert "500" in ungrounded("Rimborso di 500€", ctx)
    assert "truffa@evil.example" in ungrounded("Rispondi a truffa@evil.example", ctx)
    assert ungrounded("1) Nascondi il prodotto 2) Disattiva il codice", ctx) == []  # list numbering is not data


# ---------- action texts ----------
def test_offline_the_seed_text_is_labelled_as_fallback():
    a = brain.action_by_id("A1")
    assert a.text_engine == "riserva" and "riserva" in a.draft_by


def test_gemini_writes_title_why_and_draft(gemini):
    gemini(action_text=lambda p: ActionText(title="Rimborso #10481 a P. Martin", why="Box arrivato schiacciato, GLS ha riconosciuto il danno.",
                                            draft="Bonjour, nous avons remboursé 69,80 € pour la commande #10481.", cited_source_ids=["em-cli-martin", "xx-fake"]))
    a = brain.action_by_id("A1")
    assert a.text_engine == "gemini" and a.draft_by == "Gemini"
    assert a.draft.startswith("Bonjour") and a.title == "Rimborso #10481 a P. Martin"
    assert "xx-fake" not in a.source_ids  # invented citations are dropped
    assert a.status == "pending"  # writing never executes anything


def test_invented_amount_is_retried_then_falls_back(gemini):
    bad = ActionText(title="Rimborso", why="ok", draft="Vi rimborsiamo 777€ sul vostro conto.", cited_source_ids=[])
    fake = gemini(action_text=lambda p: bad)
    a = brain.action_by_id("A1")
    assert a.text_engine == "riserva" and "Martin" in a.draft  # seed text, not the invented one
    assert sum(1 for c, p in fake.calls if c == "action_text" and "<correzione>" in p) >= 1
    assert any(e.op == "validator.rejected" and "A1" in e.refs for e in brain.audit)


def test_retry_with_feedback_can_fix_the_draft(gemini):
    good = ActionText(title="Rimborso #10481", why="Danno riconosciuto da GLS.", draft="Rimborso di 69,80 € effettuato.", cited_source_ids=[])
    bad = ActionText(title="Rimborso", why="ok", draft="Rimborso di 99 € effettuato.", cited_source_ids=[])

    def answer(prompt):
        return good if "<correzione>" in prompt else bad
    gemini(action_text=answer)
    assert brain.action_by_id("A1").draft == "Rimborso di 69,80 € effettuato."


def test_injected_iban_in_a_draft_is_rejected(gemini):
    gemini(action_text=lambda p: ActionText(title="Pagare fattura 889", why="Scaduta.", draft="Bonifico di 3.450€ su IT02 L123 4512 3451 2345 6789 012",
                                            cited_source_ids=[]))
    a = brain.action_by_id("A2")
    assert "IT02" not in a.draft and a.text_engine == "riserva"


def test_cannot_decide_while_gemini_is_writing():
    brain.writing.add("action:A1")
    try:
        assert call("POST", "/api/actions/A1/approve", user="giulia").status_code == 403
        a1 = next(a for a in call("GET", "/api/state", user="giulia").json()["actions"] if a["id"] == "A1")
        assert a1["writing"] and not a1["can_decide"]
    finally:
        brain.writing.discard("action:A1")


def test_low_stock_alert_is_written_by_gemini(gemini):
    gemini(action_text=lambda p: ActionText(title="Riordinare 600 pz GIA-250", why="Restano 24 pz, sotto la soglia.",
                                            draft="Buongiorno, ordiniamo 600 pz di Gianduiotti classici 250g.", cited_source_ids=["STORE-GIA-250"]))
    for _ in range(3):
        call("POST", "/api/clock/next")
    a8 = brain.action_by_id("A8")
    assert a8.text_engine == "gemini" and a8.qty == 600  # the quantity stays the one fixed by code
    alert = next(m for m in brain.dm["sara"] if m.action_id == "A8")
    assert "Riordinare 600 pz" in alert.text and alert.engine == "gemini"


# ---------- morning brief ----------
def test_brief_is_written_by_gemini_from_visible_sources(gemini):
    gemini(brief=lambda p: BriefText(items=[BriefLine(text="**Fattura 889 scaduta**: 3.450€ al laboratorio.", sources=["em-fattura"]),
                                            BriefLine(text="**Lotto L26-1108** senza allergene in etichetta.", sources=["em-lotto"])]))
    b = call("GET", "/api/state", user="marco").json()["brief"]
    news = [i for i in b["items"] if not i["derived"]]
    assert b["engine"] == "gemini" and news[0]["text"].startswith("**Fattura 889")
    assert any(m.kind == "brief" and m.engine == "gemini" for m in brain.dm["marco"])


def test_brief_with_invented_numbers_or_hidden_sources_falls_back(gemini):
    # Sara (magazzino) cannot see the invoice: citing it is not allowed, and 9.999€ is invented
    gemini(brief=lambda p: BriefText(items=[BriefLine(text="**Fattura 889** da 3.450€", sources=["em-fattura"]),
                                            BriefLine(text="Ordine da 9.999€", sources=["em-lotto"])]))
    b = call("GET", "/api/state", user="sara").json()["brief"]
    assert b["engine"] == "riserva"
    assert "3.450" not in str(b)


def test_brief_prompt_contains_only_what_the_role_can_see():
    import json as _json

    from app.services.writer import _brief_prompt
    from app.store import can_see

    for u in brain.company.users:
        prompt, _ = _brief_prompt(brain, u)
        fonti = prompt.split("<fonti>")[1].split("</fonti>")[0]
        ids = [_json.loads(line)["id"] for line in fonti.strip().splitlines()]
        assert ids and all(can_see(brain.sources[i].access, u.role) for i in ids), u.id
    marco_only = {s.id for s in brain.sources.values() if s.access == ["shop"]}
    sara_prompt, _ = _brief_prompt(brain, brain.user("sara"))
    assert marco_only and not any(f'"id": "{i}"' in sara_prompt for i in marco_only)


# ---------- actions proposed by the extraction ----------
def _extract_with(action: ProposedAction):
    return {"triage": TriageResult(category="relevant", reason="richiesta cliente"),
            "extract": Extraction(candidates=[], actions=[action]),
            "action_text": lambda p: ActionText(title="Rimborso #10473 a J. Dupont", why="Prodotto arrivato sciolto.",
                                                draft="Bonjour, nous vous remboursons la commande #10473.", cited_source_ids=[])}


def test_gemini_proposes_a_new_action_that_stays_pending(gemini):
    gemini(**_extract_with(ProposedAction(effect="refund", order_id="#10473", quote="arrivato sciolto", reason="Prodotto danneggiato")))
    n = len(brain.actions)
    r = call("POST", "/api/events", user="giulia", json={"sender": "j.dupont@gmail.com", "to": "giulia", "title": "Commande #10473",
                                                          "body": "Bonjour, mon colis #10473 est arrivato sciolto. Je voudrais un remboursement."})
    assert r.status_code == 200 and r.json()["outcome"] == "proposed"
    a = brain.actions[-1]
    assert len(brain.actions) == n + 1 and a.status == "pending" and a.owner == "clienti" and a.order_id == "#10473"
    assert a.text_engine == "gemini" and a.draft.startswith("Bonjour")
    assert brain.order_by_id("#10473").status == "Spedito"  # nothing executed
    assert any(m.action_id == a.id and m.kind == "alert" for m in brain.dm["giulia"])


@pytest.mark.parametrize("action,to,why", [
    (ProposedAction(effect="refund", order_id="#99999", quote="arrivato sciolto", reason="x"), "giulia", "inesistente"),
    (ProposedAction(effect="refund", order_id="#10473", quote="rimborsami 500 euro subito", reason="x"), "giulia", "letterale"),
    (ProposedAction(effect="payment", quote="arrivato sciolto", reason="x"), "marco", "pagamenti"),  # unknown sender
    (ProposedAction(effect="reorder", sku="GIA-250", qty=999999, quote="arrivato sciolto", reason="x"), "sara", "quantità"),
    (ProposedAction(effect="reorder", sku="GIA-250", qty=100, quote="arrivato sciolto", reason="x"), "giulia", "visibile"),
])
def test_invalid_proposed_actions_are_dropped(gemini, action, to, why):
    gemini(**_extract_with(action))
    n = len(brain.actions)
    call("POST", "/api/events", user=to, json={"sender": "j.dupont@gmail.com", "to": to, "title": "Ordine",
                                               "body": "Il mio pacco #10473 è arrivato sciolto."})
    assert len(brain.actions) == n
    assert any(e.op == "validator.action_dropped" and why in e.text for e in brain.audit)


def test_proposed_action_never_reaches_a_department_that_cannot_see_the_source(gemini):
    # an email only Marco (shop) can see suggests a refund: Servizio clienti decides refunds but cannot see it → dropped
    gemini(**_extract_with(ProposedAction(effect="refund", order_id="#10473", quote="arrivato sciolto", reason="x")))
    n = len(brain.actions)
    call("POST", "/api/events", user="marco", json={"sender": "j.dupont@gmail.com", "to": "marco", "title": "Ordine",
                                                    "body": "Il pacco #10473 è arrivato sciolto."})
    assert len(brain.actions) == n


def test_same_request_twice_does_not_duplicate_the_action(gemini):
    gemini(**_extract_with(ProposedAction(effect="refund", order_id="#10473", quote="arrivato sciolto", reason="x")))
    body = {"sender": "j.dupont@gmail.com", "to": "giulia", "title": "Ordine", "body": "Il pacco #10473 è arrivato sciolto."}
    call("POST", "/api/events", user="giulia", json=body)
    n = len(brain.actions)
    call("POST", "/api/events", user="giulia", json=body)
    assert len(brain.actions) == n

"""Real email delivery (services/mailer.py), checked offline with a fake SMTP server: nothing leaves the machine."""
import dataclasses
import os
import threading

os.environ["LLM_MODE"] = "off"
os.environ["TRACE_EXPORTER"] = "none"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services import mailer  # noqa: E402
from app.store import brain  # noqa: E402

client = TestClient(app)
DEMO_INBOX = "demo.inbox@example.com"


def call(method, path, user="sara", **kw):
    return client.request(method, path, headers={"X-User": user}, **kw)


class FakeSMTP:
    sent: list = []
    fail = False

    def __init__(self, host, port, timeout=None):
        self.host = host

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def starttls(self):
        pass

    def login(self, user, password):
        if FakeSMTP.fail:
            raise OSError("smtp down")

    def send_message(self, msg, to_addrs=None):
        FakeSMTP.sent.append((msg, to_addrs))


def wait_mail():
    for t in threading.enumerate():
        if t.name.startswith("mail-"):
            t.join(5)


@pytest.fixture(autouse=True)
def fresh():
    call("POST", "/api/reset")
    FakeSMTP.sent, FakeSMTP.fail = [], False


@pytest.fixture
def smtp_on(monkeypatch):
    on = dataclasses.replace(mailer.settings, smtp_host="smtp.example.com", smtp_port=587, smtp_user="bot@example.com",
                             smtp_password="secret", mail_from="bot@example.com", mail_to=DEMO_INBOX)
    monkeypatch.setattr(mailer, "settings", on)
    monkeypatch.setattr(mailer.smtplib, "SMTP", FakeSMTP)


def test_without_smtp_the_email_stays_simulated():
    assert call("POST", "/api/actions/A1/approve", user="giulia").status_code == 200
    assert brain.outbox[0].delivery == "simulated" and FakeSMTP.sent == []


def test_approved_action_is_really_sent_only_to_the_demo_inbox(smtp_on):
    call("PATCH", "/api/actions/A5", user="giulia", json={"draft": "Gentile cliente, ..."})  # "notify 17 customers"
    assert call("POST", "/api/actions/A5/approve", user="giulia").status_code == 200
    wait_mail()
    assert len(FakeSMTP.sent) == 1
    msg, to = FakeSMTP.sent[0]
    assert to == [DEMO_INBOX] and msg["To"] == DEMO_INBOX  # never the customers
    assert "Gentile cliente" in msg.get_body(("plain",)).get_content()  # the edited draft is what goes out
    assert "Giulia Rossi" in msg.get_body(("plain",)).get_content()  # who approved
    assert brain.outbox[0].delivery == "sent"
    assert any(e.op == "email.sent" and DEMO_INBOX not in e.text for e in brain.audit)  # address masked in the log


def test_nothing_is_sent_without_approval(smtp_on):
    while call("POST", "/api/clock/next").status_code == 200:
        pass
    call("POST", "/api/actions/A1/reject", user="giulia")
    call("POST", "/api/actions/A1/approve", user="sara")  # wrong department → 403
    wait_mail()
    assert FakeSMTP.sent == []


def test_smtp_failure_does_not_undo_the_approval(smtp_on):
    FakeSMTP.fail = True
    assert call("POST", "/api/actions/A1/approve", user="giulia").status_code == 200
    wait_mail()
    assert brain.action_by_id("A1").status == "executed"
    assert brain.outbox[0].delivery == "failed"
    assert any(e.op == "email.failed" for e in brain.audit)


def test_mask_hides_the_address():
    assert mailer.mask("mario.rossi@gmail.com") == "m**********@gmail.com"
    assert "mario" not in mailer.mask("mario.rossi@gmail.com")

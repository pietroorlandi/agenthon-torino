"""Shared test setup. Tests must never touch the network, whatever the developer's .env contains."""
import dataclasses
import os

# Before importing the app: settings are read once at import time, so this must win over .env (no Vertex, no traces)
os.environ["LLM_MODE"] = "off"
os.environ["TRACE_EXPORTER"] = "none"

import pytest  # noqa: E402

from app.services import mailer  # noqa: E402


@pytest.fixture(autouse=True)
def no_real_email(monkeypatch):
    """A developer with SMTP configured in .env would otherwise send real emails on every approval in the tests."""
    off = dataclasses.replace(mailer.settings, smtp_host="", smtp_user="", smtp_password="", mail_to="")
    monkeypatch.setattr(mailer, "settings", off)

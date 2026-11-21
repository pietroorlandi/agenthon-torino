"""Real email delivery for approved actions (demo wow effect), via plain SMTP from the standard library.

Trust rules, enforced here in code:
- it runs only from actions.approve(), i.e. after a human of the right department approved (P4);
- the ONLY recipient is MAIL_TO from .env: whatever the action says ("notify 17 customers", "write to the
  supplier"), no email can reach a third party. The intended recipients are only mentioned in the body;
- delivery runs in a background thread: a slow or failing SMTP never blocks or undoes the approval, and the
  outcome (sent / failed) is visible in the Outbox and in the audit log.
"""
from __future__ import annotations

import html
import logging
import smtplib
import threading
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

from ..config import settings
from ..models import Action, OutboxItem, User

log = logging.getLogger("brain.mailer")


def mask(addr: str) -> str:
    """c*****@gmail.com: the address never shows up in full in the UI or in the audit log."""
    name, _, domain = addr.partition("@")
    return f"{name[:1]}{'*' * max(len(name) - 1, 3)}@{domain}" if domain else "***"


def build_message(brain, item: OutboxItem, action: Action, approver: User) -> EmailMessage:
    sources = [s.title for sid in action.source_ids if (s := brain.sources.get(sid))]
    footer = (f"Approvata da {approver.name} ({approver.role_label}) alle {item.sent_at}.\n"
              "Preparata dal Company Brain di Bottega Sabauda e inviata solo dopo l'approvazione di una persona.")
    msg = EmailMessage()
    msg["Subject"] = f"[Company Brain] {action.title}"
    msg["From"] = formataddr(("Company Brain · Bottega Sabauda", settings.mail_from))
    msg["To"] = settings.mail_to
    msg["Message-ID"] = make_msgid(domain="company-brain.demo")
    text = f"{item.body}\n\n--\n{footer}"
    if sources:
        text += "\nFonti: " + "; ".join(sources)
    msg.set_content(text)
    src_html = "".join(f"<li>{html.escape(s)}</li>" for s in sources)
    msg.add_alternative(f"""<div style="font-family:system-ui,Segoe UI,sans-serif;max-width:620px;color:#1c1917">
<div style="white-space:pre-wrap;line-height:1.5">{html.escape(item.body)}</div>
<hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0 12px">
<div style="font-size:12px;color:#78716c;line-height:1.5">
<b style="color:#7a4528">Company Brain</b> · {html.escape(footer).replace(chr(10), '<br>')}
{f'<div style="margin-top:8px">Fonti:</div><ul style="margin:4px 0;padding-left:18px">{src_html}</ul>' if sources else ''}
</div></div>""", subtype="html")
    return msg


def _send(msg: EmailMessage) -> None:
    if settings.smtp_port == 465:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20) as s:
            s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg, to_addrs=[settings.mail_to])
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as s:
            s.starttls()
            s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg, to_addrs=[settings.mail_to])  # explicit: never the headers, never anyone else


def deliver(brain, item: OutboxItem, action: Action, approver: User) -> None:
    """Called after an approval. Without SMTP configured the email stays simulated (the demo still works)."""
    if not settings.mail_enabled:
        item.delivery = "simulated"
        return
    item.delivery = "sending"
    msg = build_message(brain, item, action, approver)

    def worker() -> None:
        try:
            _send(msg)
            with brain.lock:
                item.delivery = "sent"
                brain.log("system:mailer", "email.sent", f"Email «{action.title}» inviata davvero a {mask(settings.mail_to)} (casella demo)",
                          access=[action.owner], refs=[action.id])
        except Exception as e:  # noqa: BLE001 — any SMTP/network error: report it, never crash the app
            log.warning("email delivery failed: %s", e)
            with brain.lock:
                item.delivery, item.delivery_error = "failed", type(e).__name__
                brain.log("system:mailer", "email.failed", f"Invio reale di «{action.title}» non riuscito ({type(e).__name__}): resta nell'Outbox",
                          access=[action.owner], refs=[action.id])

    threading.Thread(target=worker, daemon=True, name=f"mail-{action.id}").start()

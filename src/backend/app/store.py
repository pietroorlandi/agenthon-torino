"""In-memory state of the demo (single Cloud Run instance) + seed loading + reset.

Every guarantee that depends on "who is asking" uses the helpers here (can_see, can_curate):
the frontend never decides what a user may see.
"""
from __future__ import annotations

import itertools
import json
import re
import threading
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from typing import Optional

from .config import settings
from .models import (
    Action, AuditEntry, BriefItem, Company, Gap, MemoryItem, Message, Order, OutboxItem, Product,
    QuarantineItem, Source, TimelineMoment, User,
)
from .telemetry import current_trace_id


def norm(text: str) -> str:
    t = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def can_see(access: list[str], role: str) -> bool:
    return "all" in access or role in access


def _load(name: str):
    return json.loads((settings.seed_dir / name).read_text(encoding="utf-8"))


class Brain:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.reset()

    # ---------- lifecycle ----------
    def reset(self) -> None:
        with self.lock:
            self.company = Company.model_validate(_load("company.json"))
            store = _load("store.json")
            self.products: dict[str, Product] = {p["sku"]: Product.model_validate(p) for p in store["products"]}
            self.orders: list[Order] = [Order.model_validate(o) for o in store["orders"]]
            self.sources: dict[str, Source] = {s["id"]: Source.model_validate(s) for s in _load("sources.json")}
            self.memory: list[MemoryItem] = [MemoryItem.model_validate(m) for m in _load("memory.json")]
            self.actions: list[Action] = [Action.model_validate(a) for a in _load("actions.json")]
            self.brief_items: dict[str, list[BriefItem]] = {
                r: [BriefItem.model_validate(i) for i in items] for r, items in _load("brief.json").items()
            }
            self.timeline: list[TimelineMoment] = [TimelineMoment.model_validate(t) for t in _load("timeline.json")]
            self.cursor = 0
            self.now = self.company.today
            self.quarantine: list[QuarantineItem] = []
            self.gaps: list[Gap] = []
            self.outbox: list[OutboxItem] = []
            self.dm: dict[str, list[Message]] = {u.id: [] for u in self.company.users}
            self.unread: dict[str, int] = {u.id: 0 for u in self.company.users}
            self.audit: list[AuditEntry] = []
            self.counters: Counter = Counter()
            self._seq = itertools.count(1)
            self._audit_seq = itertools.count(1)
            self.users: dict[str, User] = {u.id: u for u in self.company.users}
            self._seed_conflicts()
            # background LLM writing (services/writer.py): a reset invalidates jobs still running for the old state
            self.epoch = getattr(self, "epoch", 0) + 1
            self.writing: set[str] = set()
            self.llm_brief: dict[str, tuple[list[BriefItem], str]] = {}
            self.log("system", "demo.reset", "Demo riportata allo stato iniziale (21/11 08:10)")
            from .services import writer  # local import: avoids a cycle

            writer.start(self)  # Gemini writes the action texts and the morning briefs (the brief is pushed when ready)

    def _seed_conflicts(self) -> None:
        """Seed claims (pre-annotated extraction) that contradict approved memory go to quarantine, never to memory."""
        for src in self.sources.values():
            if not src.claim:
                continue
            mem = self.approved_by_fact(src.claim.key)
            if mem and norm_value(mem.fact.value) != norm_value(src.claim.value):
                self.add_quarantine_contradiction(src, mem, src.claim.text, src.claim.value, notify=False)

    # ---------- ids, time ----------
    def next_id(self, prefix: str) -> str:
        return f"{prefix}{next(self._seq)}"

    def sim_time(self) -> str:
        return self.now.split(" ")[-1]

    # ---------- lookups ----------
    def user(self, uid: str) -> Optional[User]:
        return self.users.get(uid)

    def users_with_role(self, role: str) -> list[User]:
        return [u for u in self.company.users if u.role == role]

    def roles_of(self, access: list[str]) -> list[str]:
        return list(self.company.roles) if "all" in access else [r for r in access if r in self.company.roles]

    def role_label(self, role: str) -> str:
        return "Tutti" if role == "all" else self.company.roles.get(role, role)

    def roles_label(self, access: list[str]) -> str:
        return ", ".join(self.role_label(r) for r in access)

    def who(self, sender: str) -> str:
        u = self.users.get(sender)
        return u.name if u else sender

    def memory_by_id(self, mid: str) -> Optional[MemoryItem]:
        return next((m for m in self.memory if m.id == mid), None)

    def action_by_id(self, aid: str) -> Optional[Action]:
        return next((a for a in self.actions if a.id == aid), None)

    def order_by_id(self, oid: str) -> Optional[Order]:
        return next((o for o in self.orders if o.id == oid), None)

    def approved_by_fact(self, key: str) -> Optional[MemoryItem]:
        return next((m for m in self.memory if m.status == "approved" and m.fact and m.fact.key == key), None)

    def source(self, sid: str) -> Optional[Source]:
        if sid.startswith("STORE-"):
            p = self.products.get(sid[6:])
            if not p:
                return None
            body = f"{p.name}: {p.stock} pz in magazzino (soglia {p.threshold}), {p.sold7d} venduti negli ultimi 7 giorni."
            if p.blocked:
                body += " Vendita sospesa."
            if p.incoming:
                body += f" In arrivo: {p.incoming} pz."
            return Source(id=sid, type="store", title=f"Store admin — scorte {p.sku}", sender="sistema", date="live", access=["all"], body=body)
        return self.sources.get(sid)

    def can_curate(self, m: MemoryItem, role: str) -> bool:
        return role in m.authority if m.authority else can_see(m.access, role)

    def usable_memory(self, role: str) -> list[MemoryItem]:
        """P1 + P2: approved, visible to the role, not backed only by banned sources."""
        return [
            m for m in self.memory
            if m.status == "approved" and can_see(m.access, role)
            and not all((self.sources.get(s) and self.sources[s].banned) for s in m.source_ids)
        ]

    # ---------- messages & audit ----------
    def push(self, to_user: str, **msg) -> Message:
        m = Message(id=self.next_id("msg"), sender=msg.pop("sender", "brain"), time=msg.pop("time", self.sim_time()), **msg)
        self.dm[to_user].append(m)
        if m.sender == "brain":
            self.unread[to_user] = self.unread.get(to_user, 0) + 1
        return m

    def notify_roles(self, roles: list[str], **msg) -> None:
        for r in roles:
            for u in self.users_with_role(r):
                self.push(u.id, **msg)

    def log(self, actor: str, op: str, text: str, access: Optional[list[str]] = None, refs: Optional[list[str]] = None) -> None:
        self.audit.append(AuditEntry(
            id=next(self._audit_seq), real_ts=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            sim_ts=self.now, actor=actor, op=op, text=text, access=access or ["all"], trace_id=current_trace_id(), refs=refs or [],
        ))

    # ---------- quarantine ----------
    def add_quarantine_contradiction(self, src: Source, mem: MemoryItem, claim_text: str, value: Optional[str], notify: bool = True) -> QuarantineItem:
        from .models import Claim

        q = QuarantineItem(
            id=f"Q{len(self.quarantine) + 1}", kind="contradiction", source_id=src.id, memory_id=mem.id,
            claim=Claim(key=mem.fact.key if mem.fact else mem.id, value=value or "?", text=claim_text),
            reason=f"Contraddice la memoria approvata {mem.id}", authority=mem.authority or self.roles_of(mem.access),
            effects=src.effects,
        )
        self.quarantine.append(q)
        self.counters["quarantined"] += 1
        self.log("agent:reconcile", "event.quarantined", f"«{claim_text}» contraddice {mem.id}: in quarantena, non usata", access=q.authority, refs=[src.id, mem.id])
        if notify:
            where = f"#{src.channel}" if src.channel else src.title
            order = f" e l'ha applicata all'ordine {src.effects['order_id']}" if src.effects and src.effects.get("order_id") else ""
            self.notify_roles(
                q.authority, kind="alert", sources=[src.id], memory_ids=[mem.id], quarantine_id=q.id,
                text=f"**Informazione in contrasto con la memoria**\nIn {where} {self.who(src.sender)} scrive che «{claim_text}»{order}. "
                     f"In memoria ({mem.id}) risulta **{mem.fact.value if mem.fact else mem.text}**. Non l'ho usata: è in quarantena, decidi in *Oggi* se scartarla o accettarla.",
            )
        return q

    def add_quarantine_security(self, src: Source, reason: str) -> QuarantineItem:
        roles = self.roles_of(src.access)
        q = QuarantineItem(id=f"Q{len(self.quarantine) + 1}", kind="security", source_id=src.id, reason=reason, authority=roles)
        self.quarantine.append(q)
        self.counters["quarantined"] += 1
        self.log("agent:triage", "event.quarantined", f"Fonte sospetta in quarantena: {src.title} — {reason}", access=roles, refs=[src.id])
        self.notify_roles(
            roles, kind="security", sources=[src.id], quarantine_id=q.id,
            text=f"**Messaggio sospetto messo in quarantena**\n«{src.title}» da {src.sender}: {reason}. "
                 "Non ne ho estratto nulla e non ho proposto azioni. Puoi confermare lo scarto o rilasciarlo in *Oggi*.",
        )
        return q


NUM_RE = re.compile(r"\d+(?:[.,]\d+)?")


def norm_value(v: str) -> str:
    return norm(v).replace(" ", "").replace(",", ".").rstrip("%").strip()


brain_lock = threading.RLock()
brain = Brain()

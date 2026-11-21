"""Dry-run Q&A for the Dev "Brain" view: runs the exact chat code path on a throwaway copy of the brain, so a probe
never pushes messages, opens gaps or writes audit rows. Same per-role filter as /api/ask (the asker's role)."""
from __future__ import annotations

import copy
import itertools
import threading
from collections import Counter

from ..models import User
from ..store import Brain, can_see
from .qa import ask as qa_ask

# State that ask() may mutate; everything else is shared read-only with the live brain
_MUTABLE = ("memory", "gaps", "dm", "unread", "audit", "quarantine", "sources")


def _clone(brain: Brain) -> Brain:
    c = object.__new__(Brain)
    c.__dict__.update(brain.__dict__)
    for k in _MUTABLE:
        setattr(c, k, copy.deepcopy(getattr(brain, k)))
    c.lock = threading.RLock()
    c.counters = Counter(brain.counters)
    c._seq = itertools.count(10_000)
    c._audit_seq = itertools.count(10_000)
    return c


def probe(brain: Brain, user: User, question: str) -> dict:
    with brain.lock:
        sandbox = _clone(brain)
    res = qa_ask(sandbox, user, question)
    cited = [m for m in sandbox.memory if m.id in res.get("memory_ids", [])]
    # Pending contradictions about the facts it used: shown so the demo proves the quarantined claim was ignored
    notes = []
    for q in sandbox.quarantine:
        if q.status != "pending" or q.memory_id not in {m.id for m in cited}:
            continue
        if user.role in q.authority and q.claim:
            notes.append(f"Ignorata la fonte in quarantena {q.source_id}: «{q.claim.text}» contraddice {q.memory_id}.")
        else:
            notes.append(f"Una fonte in quarantena contraddice {q.memory_id}: ignorata finché decide {sandbox.roles_label(q.authority)}.")
    gap = next((g for g in sandbox.gaps if g.id == res.get("gap_id")), None)
    return {
        "question": question, "path": res.get("path", res["kind"]), "kind": res["kind"], "text": res["text"],
        "engine": res.get("engine"),
        "memory": [{"id": m.id, "text": m.text} for m in cited if can_see(m.access, user.role)],
        "gap_owner": sandbox.role_label(gap.owner) if gap else None,
        "gap_existing": bool(gap and any(g.id == gap.id for g in brain.gaps)),
        "notes": notes,
    }

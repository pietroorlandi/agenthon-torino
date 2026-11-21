"""Department + topic of a memory item, to browse 'Cosa sappiamo' as comparto → argomento → fatti.
Seed items carry them explicitly; items created at runtime (extraction, gap answers) are classified here
with the same keyword routing the Brain uses for knowledge gaps. Deterministic, no LLM call."""
from __future__ import annotations

from ..models import MemoryItem
from ..store import norm

DEFAULT_TOPIC = "base"


def classify(brain, m: MemoryItem) -> tuple[str | None, str]:
    from .gaps import route_question

    text = norm(f"{m.question or ''} {m.text}")
    dept = m.dept
    if not dept:
        owner = route_question(brain, text)
        # fall back to the only department that can see it, if there is one
        roles = [r for r in m.access if r in brain.company.roles]
        dept = owner.role if owner else (roles[0] if len(roles) == 1 else None)
    topic = m.topic
    if not topic:
        scored = [(t.id, sum(1 for k in t.keywords if norm(k) in text)) for t in brain.company.knowledge_topics]
        scored = [s for s in scored if s[1] > 0]
        topic = max(scored, key=lambda s: s[1])[0] if scored else DEFAULT_TOPIC
    return dept, topic

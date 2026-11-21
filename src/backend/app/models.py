"""Domain entities (runtime state) and the JSON schemas the LLM must fill."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class User(BaseModel):
    id: str
    name: str
    role: str
    role_label: str
    avatar: str
    color: str


class Channel(BaseModel):
    id: str
    access: list[str]


class TopicOwner(BaseModel):
    role: str
    label: str
    keywords: list[str]


class Contact(BaseModel):
    domain: str
    org: str
    kind: str


class Company(BaseModel):
    name: str
    internal_domain: str
    today: str
    users: list[User]
    roles: dict[str, str]
    channels: list[Channel]
    topic_owners: list[TopicOwner]
    contacts: list[Contact] = []
    consumer_domains: list[str] = []


class Claim(BaseModel):
    key: str
    value: str
    text: str


class Fact(BaseModel):
    key: str
    value: str


class Product(BaseModel):
    sku: str
    name: str
    price: float
    stock: int
    threshold: int
    sold7d: int
    blocked: bool = False
    incoming: int = 0


class Order(BaseModel):
    id: str
    date: str
    customer: str
    country: str
    kind: str
    items: list[tuple[str, int]]
    promo: list[str] = []
    status: str
    carrier: str = ""
    flag: str = ""
    total: float


# ---------- LLM output schemas (also used for offline fallback annotations) ----------
class TriageResult(BaseModel):
    category: Literal["noise", "spam", "suspicious", "relevant"]
    reason: str = Field(description="Motivo breve, in italiano")


class Candidate(BaseModel):
    text: str = Field(description="Il fatto da ricordare, autosufficiente, in italiano")
    type: Literal["fact", "decision", "deadline", "commitment", "price", "policy"]
    quote: str = Field(description="Citazione LETTERALE (copiata identica) dalla fonte")
    relation: Literal["new", "confirms", "contradicts"] = "new"
    memory_id: Optional[str] = Field(default=None, description="Id dell'elemento di memoria correlato, se esiste")
    value: Optional[str] = Field(default=None, description="Valore confrontabile (es. '30%'), se c'è")


class Extraction(BaseModel):
    candidates: list[Candidate] = []


class QAAnswer(BaseModel):
    answerable: bool
    answer: str = Field(description="Risposta breve in italiano, solo dai fatti forniti")
    citations: list[str] = Field(description="Id degli elementi di memoria usati, es. ['M3']")


class QAMiss(BaseModel):
    restricted_memory_id: Optional[str] = None
    pending_memory_id: Optional[str] = None
    topic_owner: Literal["magazzino", "clienti", "shop", "spedizioni", "none"] = "none"


class Fallback(BaseModel):
    triage: Optional[TriageResult] = None
    candidates: list[Candidate] = []


# ---------- runtime state ----------
class Source(BaseModel):
    id: str
    type: str  # email | chat | doc | task | note | store
    title: str
    sender: str
    date: str
    access: list[str]
    body: str
    to: Optional[str] = None
    channel: Optional[str] = None
    due: Optional[str] = None
    claim: Optional[Claim] = None  # pre-annotated claim (seed)
    effects: Optional[dict] = None
    fallback: Optional[Fallback] = None
    # filled by the observation pipeline (None = already in the seed)
    observed_at: Optional[str] = None
    trust: Optional[str] = None
    trust_reason: Optional[str] = None
    triage: Optional[str] = None
    triage_reason: Optional[str] = None
    triage_engine: Optional[str] = None
    outcome: Optional[str] = None  # ignored | quarantined | proposed | corroborated | no_candidates
    banned: bool = False
    injected_by: Optional[str] = None


class MemoryItem(BaseModel):
    id: str
    text: str
    source_ids: list[str]
    access: list[str]
    status: Literal["pending", "approved", "rejected", "superseded"]
    proposed_by: str = "Brain"
    approved_by: Optional[str] = None
    rejected_by: Optional[str] = None
    authority: Optional[list[str]] = None
    fact: Optional[Fact] = None
    keywords: list[str] = []
    min_score: int = 1
    question: Optional[str] = None
    type: str = "fact"
    source_quote: Optional[str] = None
    attributed_to: Optional[str] = None
    created_at: Optional[str] = None


class QuarantineItem(BaseModel):
    id: str
    kind: Literal["contradiction", "security"]
    source_id: str
    reason: str
    authority: list[str]
    memory_id: Optional[str] = None
    claim: Optional[Claim] = None
    status: Literal["pending", "banned", "accepted", "released", "confirmed_bad"] = "pending"
    effects: Optional[dict] = None
    decided_by: Optional[str] = None


class Gap(BaseModel):
    id: str
    key: str
    question: str
    asked_by: str
    owner: str
    topic_label: str
    status: Literal["open", "answered", "dismissed"] = "open"
    time: str
    answer: Optional[str] = None
    decided_by: Optional[str] = None


class Action(BaseModel):
    id: str
    title: str
    owner: str
    effect: str
    why: str
    draft: str
    source_ids: list[str]
    status: Literal["pending", "executed", "rejected"] = "pending"
    order_id: Optional[str] = None
    sku: Optional[str] = None
    qty: Optional[int] = None
    decided_by: Optional[str] = None
    draft_by: str = "Brain"
    edited_by: Optional[str] = None


class BriefItem(BaseModel):
    text: str
    sources: list[str] = []


class Message(BaseModel):
    id: str
    sender: Literal["brain", "user"]
    user_id: Optional[str] = None
    kind: str = "info"  # brief | alert | answer | unknown | denied | gap | done | security
    text: str
    time: str
    sources: list[str] = []
    memory_ids: list[str] = []
    items: Optional[list[BriefItem]] = None
    action_id: Optional[str] = None
    gap_id: Optional[str] = None
    quarantine_id: Optional[str] = None
    engine: Optional[str] = None


class AuditEntry(BaseModel):
    id: int
    real_ts: str
    sim_ts: str
    actor: str
    op: str
    text: str
    access: list[str] = ["all"]
    trace_id: Optional[str] = None
    refs: list[str] = []


class OutboxItem(BaseModel):
    action_id: str
    title: str
    body: str
    approved_by: str
    sent_at: str


class TimelineMoment(BaseModel):
    id: str
    at: str
    label: str
    sources: list[Source] = []
    store: Optional[dict] = None

"""Stage 1 — sender trust, deterministic (no LLM). Stage 0 rules: injection / payment-change patterns."""
from __future__ import annotations

import re
from typing import Optional

from ..models import Source


def levenshtein(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def compute_trust(brain, src: Source) -> tuple[str, str]:
    """internal | known_external | unknown | lookalike (a lookalike goes straight to quarantine)."""
    if src.sender in brain.users or src.type in ("store", "note"):
        return "internal", "Collega del team"
    if "@" not in src.sender:
        return "unknown", "Mittente non identificabile"
    domain = src.sender.rsplit("@", 1)[1].lower().strip()
    company = brain.company
    if domain == company.internal_domain:
        return "internal", "Dominio aziendale"
    known = {c.domain: c for c in company.contacts}
    if domain in known:
        return "known_external", f"Contatto noto: {known[domain].org}"
    if domain in company.consumer_domains:
        return "unknown", "Privato (cliente o sconosciuto)"
    base = _base(domain)
    for dom, org in [(c.domain, c.org) for c in company.contacts] + [(company.internal_domain, company.name)]:
        known_base = _base(dom)
        # same name on another TLD (santanna.com vs santanna.example) or a near-identical name
        near = levenshtein(base, known_base) <= 2 if min(len(base), len(known_base)) >= 5 else base == known_base
        if levenshtein(domain, dom) <= 2 or near:
            return "lookalike", f"Il dominio {domain} somiglia a {dom} ({org}) ma non è lo stesso"
    return "unknown", "Dominio sconosciuto"


def _base(domain: str) -> str:
    """Registrable name without the TLD: 'mail.laboratorio-santanna.com' → 'laboratorio-santanna'."""
    parts = domain.split(".")
    return parts[-2] if len(parts) >= 2 else domain


def attribution(brain, src: Source) -> Optional[str]:
    """Who 'says' a fact coming from outside: facts from externals are attributed claims, not company facts."""
    trust, _ = compute_trust(brain, src)
    if trust == "internal":
        return None
    if trust == "known_external":
        domain = src.sender.rsplit("@", 1)[1].lower()
        return next(c.org for c in brain.company.contacts if c.domain == domain)
    return f"mittente non verificato ({src.sender})"


INJECTION = [
    r"ignor\w* (tutte |tutto |le |ogni )*(le )?(istruzion|regol)", r"ignore (all |any )?(previous|prior|above) (instructions|rules)",
    r"(^|\W)system\s*:", r"\bprompt di sistema\b", r"\bsystem prompt\b", r"sei autorizzat[oa] a", r"you are now",
    r"\bagisci come\b", r"developer mode", r"jailbreak", r"</?\s*(system|instructions?)\s*>", r"nuove istruzioni",
    r"dimentica (le|tutte le) (regole|istruzioni)",
]
PAYMENT_CHANGE = [
    r"\biban\b", r"coordinate bancarie", r"cambi\w* (di |dell')?(banca|istituto bancario|conto)", r"bank (details|account)", r"nuovo conto",
]


def rule_flags(text: str) -> Optional[str]:
    t = text.lower()
    for p in INJECTION:
        m = re.search(p, t)
        if m:
            return f"Contiene istruzioni rivolte all'assistente («{m.group(0).strip()}»)"
    for p in PAYMENT_CHANGE:
        if re.search(p, t):
            return "Chiede pagamenti verso coordinate bancarie nuove o diverse da quelle in anagrafica"
    return None

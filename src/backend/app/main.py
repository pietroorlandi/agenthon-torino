"""FastAPI app: API contract (docs/architecture.md §12) + static frontend.

The current user arrives in the X-User header (demo user switcher): every filter is applied server side.
"""
from __future__ import annotations

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import settings
from .telemetry import metrics, op_span, setup_telemetry

setup_telemetry()

from .agents.draft_agent import draft_with_agent  # noqa: E402
from .models import Source, User  # noqa: E402
from .pipeline.observe import observe  # noqa: E402
from .services import actions as act_svc  # noqa: E402
from .services import gaps as gap_svc  # noqa: E402
from .services.actions import Forbidden  # noqa: E402
from .services.brief import brief_plaintext  # noqa: E402
from .services.clock import next_moment  # noqa: E402
from .services.curation import decide_memory, decide_quarantine  # noqa: E402
from .services.probe import probe as qa_probe  # noqa: E402
from .services.qa import ask as qa_ask  # noqa: E402
from .services.tts import synthesize  # noqa: E402
from .store import brain, can_see  # noqa: E402
from .views import quality, state_for  # noqa: E402

app = FastAPI(title="Company Brain — Bottega Sabauda")


def current_user(x_user: str = Header(default="sara")) -> User:
    u = brain.user(x_user)
    if not u:
        raise HTTPException(400, f"Utente sconosciuto: {x_user}")
    return u


def guard(fn):
    try:
        return fn()
    except Forbidden as e:
        raise HTTPException(403, str(e))


def _ok(user: User) -> dict:
    return state_for(brain, user)


# ---------- read ----------
@app.get("/api/health")
def health():
    return {"ok": True, "llm_mode": settings.llm_mode, "model": settings.model, "tts": settings.tts_enabled}


@app.get("/api/state")
def get_state(user: User = Depends(current_user)):
    with brain.lock:
        return state_for(brain, user)


@app.get("/api/observability")
def observability(user: User = Depends(current_user)):
    with brain.lock:
        return {"llm": metrics.snapshot(), "quality": quality(brain), "mode": settings.llm_mode,
                "trace_exporter": settings.trace_exporter, "models": {"main": settings.model, "lite": settings.model_lite}}


@app.get("/api/brief/audio")
def brief_audio(user: User = Depends(current_user)):
    with brain.lock:
        text = brief_plaintext(brain, user)
    mp3 = synthesize(text)
    if mp3 is None:
        raise HTTPException(503, "ElevenLabs non configurato o non raggiungibile")
    return Response(mp3, media_type="audio/mpeg")


@app.get("/api/brief/text")
def brief_text(user: User = Depends(current_user)):
    with brain.lock:
        return {"text": brief_plaintext(brain, user)}


# ---------- clock & events ----------
@app.post("/api/reset")
def reset(user: User = Depends(current_user)):
    with brain.lock, op_span("demo.reset"):
        brain.reset()
        return _ok(user)


@app.post("/api/clock/next")
def clock_next(user: User = Depends(current_user)):
    with brain.lock:
        res = next_moment(brain)
        if res is None:
            raise HTTPException(409, "La timeline della demo è finita: usa Reset")
        return res


class InjectIn(BaseModel):
    type: str = "email"  # email | chat
    sender: str = ""  # email only: the attacker controls From
    to: str = ""  # email recipient (user id)
    channel: str = ""  # chat only
    title: str = ""
    body: str


@app.post("/api/events")
def inject_event(body: InjectIn, user: User = Depends(current_user)):
    """Red team: anyone can push a new email/chat into the pipeline and see how the Brain reacts."""
    with brain.lock, op_span("event.inject", **{"brain.injected_by": user.id}):
        n = sum(1 for s in brain.sources.values() if s.injected_by) + 1
        if body.type == "chat":
            ch = next((c for c in brain.company.channels if c.id == body.channel), None)
            if not ch or not can_see(ch.access, user.role):
                raise HTTPException(403, "Canale non accessibile al tuo ruolo")
            # identity of a chat message = the logged-in user (session), never what the text claims
            src = Source(id=f"rt-{n}", type="chat", channel=ch.id, title="#" + ch.id, sender=user.id, date=brain.now,
                         access=ch.access, body=body.body, injected_by=user.id)
        else:
            to = brain.user(body.to) or user
            src = Source(id=f"rt-{n}", type="email", title=body.title or "(senza oggetto)", sender=body.sender or "sconosciuto@example.com",
                         to=to.id, date=brain.now, access=[to.role], body=body.body, injected_by=user.id)
        brain.log(f"user:{user.id}", "event.injected", f"{user.name} ha inviato un evento di prova ({src.type})", access=src.access, refs=[src.id])
        return observe(brain, src)


# ---------- Q&A ----------
class AskIn(BaseModel):
    question: str


@app.post("/api/ask")
def ask(body: AskIn, user: User = Depends(current_user)):
    q = body.question.strip()[:500]
    if not q:
        raise HTTPException(400, "Domanda vuota")
    with brain.lock, op_span("qa.ask", **{"brain.role": user.role}) as span:
        brain.push(user.id, sender="user", user_id=user.id, kind="question", text=q)
        brain.unread[user.id] = 0
        res = qa_ask(brain, user, q)
        span.set_attribute("brain.qa.kind", res["kind"])
        msg = brain.push(user.id, **res)
        brain.unread[user.id] = 0
        brain.log(f"user:{user.id}", "qa.answer", f"{user.name} ha chiesto «{q[:80]}» → {res['kind']} ({res.get('engine')})",
                  access=[user.role], refs=msg.memory_ids)
        return msg.model_dump()


@app.post("/api/probe")
def probe(body: AskIn, user: User = Depends(current_user)):
    """Dev "Brain" view: what the Brain would answer to this user, with no side effects."""
    q = body.question.strip()[:500]
    if not q:
        raise HTTPException(400, "Domanda vuota")
    with op_span("qa.probe", **{"brain.role": user.role}):
        return qa_probe(brain, user, q)


@app.post("/api/dm/read")
def dm_read(user: User = Depends(current_user)):
    brain.unread[user.id] = 0
    return {"ok": True}


# ---------- curation ----------
def _mem(mid: str):
    m = brain.memory_by_id(mid)
    if not m:
        raise HTTPException(404, "Elemento non trovato")
    return m


@app.post("/api/memory/{mid}/{decision}")
def memory_decide(mid: str, decision: str, user: User = Depends(current_user)):
    if decision not in ("approve", "reject"):
        raise HTTPException(404)
    with brain.lock, op_span(f"memory.{decision}"):
        guard(lambda: decide_memory(brain, user, _mem(mid), decision == "approve"))
        return _ok(user)


@app.post("/api/quarantine/{qid}/{decision}")
def quarantine_decide(qid: str, decision: str, user: User = Depends(current_user)):
    q = next((x for x in brain.quarantine if x.id == qid), None)
    if not q or decision not in ("ban", "accept", "release", "confirm-bad"):
        raise HTTPException(404)
    with brain.lock, op_span(f"quarantine.{decision}"):
        guard(lambda: decide_quarantine(brain, user, q, decision.replace("-", "_")))
        return _ok(user)


class GapAnswerIn(BaseModel):
    fact: str
    question: str = ""
    access: list[str] = ["all"]


def _gap(gid: str, user: User):
    g = next((x for x in brain.gaps if x.id == gid), None)
    if not g:
        raise HTTPException(404)
    if g.owner != user.role or g.status != "open":
        raise HTTPException(403, "Richiesta non assegnata al tuo reparto o già chiusa")
    return g


@app.post("/api/gaps/{gid}/answer")
def gap_answer(gid: str, body: GapAnswerIn, user: User = Depends(current_user)):
    if not body.fact.strip():
        raise HTTPException(400, "Scrivi il fatto")
    access = [a for a in body.access if a == "all" or a in brain.company.roles] or ["all"]
    with brain.lock, op_span("gap.answer"):
        gap_svc.answer_gap(brain, user, _gap(gid, user), body.fact.strip(), body.question, access)
        return _ok(user)


@app.post("/api/gaps/{gid}/dismiss")
def gap_dismiss(gid: str, user: User = Depends(current_user)):
    with brain.lock:
        gap_svc.dismiss_gap(brain, user, _gap(gid, user))
        return _ok(user)


# ---------- actions ----------
def _act(aid: str):
    a = brain.action_by_id(aid)
    if not a:
        raise HTTPException(404)
    return a


@app.post("/api/actions/{aid}/approve")
def action_approve(aid: str, user: User = Depends(current_user)):
    with brain.lock, op_span("action.approve"):
        guard(lambda: act_svc.approve(brain, user, _act(aid)))
        return _ok(user)


@app.post("/api/actions/{aid}/reject")
def action_reject(aid: str, user: User = Depends(current_user)):
    with brain.lock, op_span("action.reject"):
        guard(lambda: act_svc.reject(brain, user, _act(aid)))
        return _ok(user)


class DraftIn(BaseModel):
    draft: str


@app.patch("/api/actions/{aid}")
def action_edit(aid: str, body: DraftIn, user: User = Depends(current_user)):
    with brain.lock:
        guard(lambda: act_svc.edit_draft(brain, user, _act(aid), body.draft))
        return _ok(user)


@app.post("/api/actions/{aid}/draft")
async def action_agent_draft(aid: str, user: User = Depends(current_user)):
    a = _act(aid)
    if a.owner != user.role or a.status != "pending":
        raise HTTPException(403, "Puoi rigenerare solo le bozze in attesa del tuo reparto")
    with op_span("action.draft", **{"brain.action_id": aid}):
        res = await draft_with_agent(brain, user, a)
    if res is None:
        raise HTTPException(503, "Agente bozze non disponibile (serve LLM_MODE=live): la bozza attuale resta invariata")
    with brain.lock:
        valid = [s for s in res["cited"] if (src := brain.source(s)) and can_see(src.access, user.role)]
        a.draft, a.draft_by = res["draft"], "agente ADK"
        a.source_ids = list(dict.fromkeys(a.source_ids + valid))
        brain.log("agent:draft", "action.drafted", f"Bozza di {a.id} riscritta dall'agente (fonti: {', '.join(valid) or 'nessuna'})", access=[a.owner], refs=[a.id])
        return _ok(user)


# ---------- static frontend (production build) ----------
if settings.static_dir.exists():
    app.mount("/assets", StaticFiles(directory=settings.static_dir / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        root = settings.static_dir.resolve()
        f = (root / path).resolve()
        if path and f.is_file() and f.is_relative_to(root):  # no path traversal
            return FileResponse(f)
        return FileResponse(settings.static_dir / "index.html")

"""Runtime settings, read once from the environment (and from the repo-root .env file)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent  # src/backend
REPO_ROOT = BACKEND_DIR.parent.parent
load_dotenv(REPO_ROOT / ".env")  # real environment variables win over .env

# USD per 1M tokens (input, output). Thinking tokens are billed as output.
# 3.8 Flash comes from docs/resources.md; the other two are estimates: check the Vertex price list.
PRICES_USD_PER_M = {
    "gemini-3.8-flash": (0.75, 3.75),
    "gemini-3.5-flash": (0.50, 3.00),
    "gemini-3.1-flash-lite": (0.25, 1.50),
}


def _env(name: str, default: str = "") -> str:
    # strip inline comments copied from .env.example ("value   # comment")
    return os.environ.get(name, default).split(" #")[0].strip()


def _bool(name: str, default: bool = False) -> bool:
    v = _env(name)
    return default if not v else v.lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    project: str
    location: str
    model: str
    model_lite: str
    llm_mode: str  # live | replay | off
    thinking_level: str  # "" (model default) | minimal | low | medium | high
    elevenlabs_api_key: str
    elevenlabs_voice_id: str
    elevenlabs_model: str
    trace_exporter: str  # none | console | gcp | otlp
    service_name: str
    log_prompts: bool
    budget_usd: float
    seed_dir: Path
    cache_dir: Path
    static_dir: Path

    @property
    def tts_enabled(self) -> bool:
        return bool(self.elevenlabs_api_key and self.elevenlabs_voice_id)


def load_settings() -> Settings:
    project = _env("GOOGLE_CLOUD_PROJECT")
    mode = _env("LLM_MODE").lower() or ("live" if project else "off")
    if mode not in ("live", "replay", "off"):
        mode = "off"
    if mode == "live" and not project:
        mode = "off"  # cannot call Vertex without a project: fail safe (P8)
    location = _env("GOOGLE_CLOUD_LOCATION", "global")
    # ADK and google-genai read these from the environment.
    if project:
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "TRUE"  # always Vertex (credits); also cleans inline comments
        os.environ["GOOGLE_CLOUD_PROJECT"] = project
        os.environ["GOOGLE_CLOUD_LOCATION"] = location
    data_dir = REPO_ROOT / "src" / "data"
    return Settings(
        project=project,
        location=location,
        model=_env("GEMINI_MODEL", "gemini-3.8-flash"),
        model_lite=_env("GEMINI_MODEL_LITE", "gemini-3.1-flash-lite"),
        llm_mode=mode,
        thinking_level=_env("GEMINI_THINKING_LEVEL", "low").lower(),
        elevenlabs_api_key=_env("ELEVENLABS_API_KEY"),
        elevenlabs_voice_id=_env("ELEVENLABS_VOICE_ID"),
        elevenlabs_model=_env("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"),
        trace_exporter=_env("TRACE_EXPORTER", "none").lower(),
        service_name=_env("OTEL_SERVICE_NAME", "company-brain"),
        log_prompts=_bool("LOG_PROMPTS"),
        budget_usd=float(_env("LLM_BUDGET_USD", "90") or 90),
        seed_dir=Path(_env("SEED_DIR") or data_dir / "seed"),
        cache_dir=Path(_env("LLM_CACHE_DIR") or data_dir / "llm_cache"),
        static_dir=Path(_env("STATIC_DIR") or REPO_ROOT / "src" / "frontend" / "dist"),
    )


settings = load_settings()

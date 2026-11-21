"""ElevenLabs text-to-speech for the morning brief (mp3 cached per text). None = not configured or failed."""
from __future__ import annotations

import hashlib
import logging

import httpx

from ..config import settings
from ..telemetry import op_span

log = logging.getLogger("brain.tts")
_cache: dict[str, bytes] = {}


def synthesize(text: str) -> bytes | None:
    if not settings.tts_enabled:
        return None
    key = hashlib.sha256(f"{settings.elevenlabs_voice_id}|{settings.elevenlabs_model}|{text}".encode()).hexdigest()
    if key in _cache:
        return _cache[key]
    with op_span("tts.elevenlabs", **{"tts.chars": len(text), "tts.model": settings.elevenlabs_model}):
        try:
            r = httpx.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{settings.elevenlabs_voice_id}",
                params={"output_format": "mp3_44100_128"},
                headers={"xi-api-key": settings.elevenlabs_api_key, "Content-Type": "application/json"},
                json={"text": text, "model_id": settings.elevenlabs_model},
                timeout=60,
            )
            r.raise_for_status()
        except Exception as e:
            log.warning("ElevenLabs failed: %s", e)
            return None
    _cache[key] = r.content
    return r.content

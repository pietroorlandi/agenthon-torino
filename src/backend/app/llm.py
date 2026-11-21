"""Single entry point for Gemini (Vertex AI): structured JSON output, disk cache, replay/off fallback, metrics + GenAI spans.

Modes (LLM_MODE): live = call Vertex and cache · replay = cache only · off = never call (callers use their fallback).
A None result always means "use your deterministic fallback" (P8: fail safe, never invent).
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from typing import Optional, TypeVar

from pydantic import BaseModel, ValidationError

from .config import settings
from .telemetry import metrics, tracer

log = logging.getLogger("brain.llm")
T = TypeVar("T", bound=BaseModel)


@dataclass
class LLMResult:
    data: Optional[BaseModel]
    engine: str  # gemini | cache | fallback
    error: Optional[str] = None


class LLM:
    def __init__(self) -> None:
        self._client = None
        self._init_error: Optional[str] = None
        settings.cache_dir.mkdir(parents=True, exist_ok=True)

    @property
    def mode(self) -> str:
        return settings.llm_mode

    def client(self):
        if self._client is None and self._init_error is None:
            try:
                from google import genai

                self._client = genai.Client(vertexai=True, project=settings.project, location=settings.location)
            except Exception as e:  # missing ADC, bad project...
                self._init_error = str(e)
                log.warning("Vertex client init failed: %s", e)
        return self._client

    def _cache_path(self, key: str):
        return settings.cache_dir / f"{key}.json"

    def _config(self, system: str, schema: type[BaseModel], thinking: bool):
        from google.genai import types

        cfg = dict(system_instruction=system, response_mime_type="application/json", response_schema=schema, max_output_tokens=4096)
        if thinking and settings.thinking_level:
            cfg["thinking_config"] = types.ThinkingConfig(thinking_level=settings.thinking_level.upper())
        return types.GenerateContentConfig(**cfg)

    def generate(self, component: str, schema: type[T], system: str, prompt: str, lite: bool = False) -> LLMResult:
        model = settings.model_lite if lite else settings.model
        if self.mode == "off":
            metrics.fallback(component)
            return LLMResult(None, "fallback", "LLM_MODE=off")
        key = hashlib.sha256(
            json.dumps([model, system, prompt, schema.__name__, schema.model_json_schema()], sort_keys=True).encode()
        ).hexdigest()[:32]
        with tracer.start_as_current_span(f"llm.{component}") as span:
            span.set_attribute("gen_ai.system", "gcp.vertex_ai")
            span.set_attribute("gen_ai.operation.name", "generate_content")
            span.set_attribute("gen_ai.request.model", model)
            span.set_attribute("openinference.span.kind", "LLM")
            span.set_attribute("llm.model_name", model)
            span.set_attribute("brain.component", component)
            if settings.log_prompts:
                span.set_attribute("input.value", f"{system}\n\n{prompt}")
            path = self._cache_path(key)
            if path.exists():
                try:
                    data = schema.model_validate(json.loads(path.read_text(encoding="utf-8")))
                    metrics.record(component, model, 0, 0, 0, cache_hit=True)
                    span.set_attribute("brain.cache_hit", True)
                    return LLMResult(data, "cache")
                except (ValidationError, json.JSONDecodeError):
                    pass
            span.set_attribute("brain.cache_hit", False)
            if self.mode == "replay":
                metrics.fallback(component)
                span.set_attribute("brain.fallback", True)
                return LLMResult(None, "fallback", "cache miss (replay)")
            client = self.client()
            if client is None:
                metrics.error(component, self._init_error or "no client")
                metrics.fallback(component)
                return LLMResult(None, "fallback", self._init_error)
            t0 = time.perf_counter()
            resp = None
            for thinking in (True, False):  # retry once without thinking_config if the model rejects it
                try:
                    resp = client.models.generate_content(model=model, contents=prompt, config=self._config(system, schema, thinking))
                    break
                except Exception as e:
                    err = str(e)
                    if thinking and settings.thinking_level and ("thinking" in err.lower() or "INVALID_ARGUMENT" in err):
                        continue
                    metrics.error(component, err)
                    metrics.fallback(component)
                    span.record_exception(e)
                    span.set_attribute("brain.fallback", True)
                    log.warning("LLM %s failed: %s", component, err)
                    return LLMResult(None, "fallback", err)
            latency = (time.perf_counter() - t0) * 1000
            u = getattr(resp, "usage_metadata", None)
            tin = (getattr(u, "prompt_token_count", 0) or 0) if u else 0
            tout = ((getattr(u, "candidates_token_count", 0) or 0) + (getattr(u, "thoughts_token_count", 0) or 0)) if u else 0
            try:
                parsed = resp.parsed if isinstance(resp.parsed, schema) else schema.model_validate_json(resp.text or "")
            except Exception as e:
                metrics.error(component, f"invalid JSON: {e}")
                metrics.fallback(component)
                return LLMResult(None, "fallback", str(e))
            cost = metrics.record(component, model, tin, tout, latency)
            span.set_attribute("gen_ai.usage.input_tokens", tin)
            span.set_attribute("gen_ai.usage.output_tokens", tout)
            span.set_attribute("llm.token_count.prompt", tin)
            span.set_attribute("llm.token_count.completion", tout)
            span.set_attribute("brain.latency_ms", round(latency))
            span.set_attribute("brain.cost_usd", cost)
            out = parsed.model_dump()
            if settings.log_prompts:
                span.set_attribute("output.value", json.dumps(out, ensure_ascii=False))
                log.info("llm call", extra={"extra": {"component": component, "prompt": prompt, "response": out}})
            path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
            return LLMResult(parsed, "gemini")


llm = LLM()

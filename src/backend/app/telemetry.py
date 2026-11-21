"""Observability: OpenTelemetry tracing (console / Cloud Trace / OTLP), JSON logs, in-memory LLM metrics."""
from __future__ import annotations

import json
import logging
import statistics
import threading
from collections import defaultdict
from contextlib import contextmanager

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

from .config import PRICES_USD_PER_M, settings

tracer = trace.get_tracer("company_brain")
log = logging.getLogger("brain")


def setup_telemetry() -> None:
    provider = TracerProvider(resource=Resource.create({"service.name": settings.service_name}))
    exp = settings.trace_exporter
    try:
        if exp == "console":
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
        elif exp == "gcp":
            from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter

            provider.add_span_processor(BatchSpanProcessor(CloudTraceSpanExporter(project_id=settings.project or None)))
        elif exp == "otlp":  # Langfuse / Phoenix: endpoint + headers from OTEL_EXPORTER_OTLP_* env vars
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

            provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    except Exception as e:  # observability must never break the demo
        logging.getLogger("brain").warning("trace exporter %s disabled: %s", exp, e)
    trace.set_tracer_provider(provider)
    _setup_logging()


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        d = {"severity": record.levelname, "message": record.getMessage(), "logger": record.name}
        ctx = trace.get_current_span().get_span_context()
        if ctx.is_valid:
            d["logging.googleapis.com/trace"] = f"projects/{settings.project}/traces/{ctx.trace_id:032x}"
            d["logging.googleapis.com/spanId"] = f"{ctx.span_id:016x}"
        extra = getattr(record, "extra", None)
        if extra:
            d.update(extra)
        if record.exc_info:
            d["exception"] = self.formatException(record.exc_info)
        return json.dumps(d, ensure_ascii=False, default=str)


def _setup_logging() -> None:
    h = logging.StreamHandler()
    h.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [h]
    root.setLevel(logging.INFO)


def current_trace_id() -> str | None:
    ctx = trace.get_current_span().get_span_context()
    return f"{ctx.trace_id:032x}" if ctx.is_valid else None


@contextmanager
def op_span(name: str, **attrs):
    with tracer.start_as_current_span(name) as span:
        for k, v in attrs.items():
            if v is not None:
                span.set_attribute(k, v)
        yield span


def cost_usd(model: str, tokens_in: int, tokens_out: int) -> float:
    p_in, p_out = PRICES_USD_PER_M.get(model, (0.75, 3.75))
    return tokens_in / 1e6 * p_in + tokens_out / 1e6 * p_out


class Metrics:
    """LLM counters for the in-app Observability panel. Process lifetime: a demo reset does not erase real costs."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.by_component: dict[str, dict] = defaultdict(
            lambda: {"calls": 0, "cache_hits": 0, "errors": 0, "fallbacks": 0, "tokens_in": 0, "tokens_out": 0, "cost_usd": 0.0}
        )
        self.latencies: dict[str, list[float]] = defaultdict(list)
        self.last_errors: list[dict] = []

    def record(self, component: str, model: str, tokens_in: int, tokens_out: int, latency_ms: float, cache_hit: bool = False) -> float:
        cost = 0.0 if cache_hit else cost_usd(model, tokens_in, tokens_out)
        with self.lock:
            c = self.by_component[component]
            c["calls"] += 1
            if cache_hit:
                c["cache_hits"] += 1
            else:
                c["tokens_in"] += tokens_in
                c["tokens_out"] += tokens_out
                c["cost_usd"] += cost
                self.latencies[component].append(latency_ms)
        return cost

    def error(self, component: str, msg: str) -> None:
        with self.lock:
            self.by_component[component]["errors"] += 1
            self.last_errors = (self.last_errors + [{"component": component, "error": msg[:300]}])[-5:]

    def fallback(self, component: str) -> None:
        with self.lock:
            self.by_component[component]["fallbacks"] += 1

    def snapshot(self) -> dict:
        with self.lock:
            comps = {}
            for name, c in self.by_component.items():
                lat = sorted(self.latencies.get(name, []))
                comps[name] = {
                    **c,
                    "cost_usd": round(c["cost_usd"], 5),
                    "p50_ms": round(statistics.median(lat)) if lat else None,
                    "p95_ms": round(lat[min(len(lat) - 1, int(len(lat) * 0.95))]) if lat else None,
                }
            total = sum(c["cost_usd"] for c in self.by_component.values())
            return {
                "components": comps,
                "total_cost_usd": round(total, 5),
                "budget_usd": settings.budget_usd,
                "budget_pct": round(total / settings.budget_usd * 100, 3) if settings.budget_usd else 0,
                "last_errors": list(self.last_errors),
            }


metrics = Metrics()

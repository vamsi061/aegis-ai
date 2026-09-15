"""Lightweight OpenTelemetry-compatible telemetry adapter (FR-12, NFR-05)."""

import logging
import time
from typing import Any

logger = logging.getLogger("aegis.telemetry")

try:  # Optional OTel SDK; degrade to structured logs when absent.
    from opentelemetry import trace as _otel_trace

    _tracer = _otel_trace.get_tracer("aegis")
except Exception:  # pragma: no cover
    _otel_trace = None
    _tracer = None


class TracedSpan:
    def __init__(self, name: str, attrs: dict[str, Any] | None):
        self.name = name
        self.attrs = attrs or {}
        self._t0 = time.perf_counter()
        self._span = _tracer.start_as_current_span(name) if _tracer else None

    def __enter__(self):
        if self._span:
            self._span.__enter__()
            for k, v in self.attrs.items():
                try:
                    self._span.set_attribute(k, v)
                except Exception:
                    pass
        return self

    def __exit__(self, exc_type, exc, tb):
        if self._span:
            return self._span.__exit__(exc_type, exc, tb)
        if exc_type:
            logger.error("span=%s error=%s", self.name, exc)
        else:
            logger.info("span=%s duration_ms=%.1f", self.name, (time.perf_counter() - self._t0) * 1000)
        return False


class Telemetry:
    """TelemetryProvider implementation: OTel spans when available, logs always."""

    def span(self, name: str, **attrs: Any) -> TracedSpan:
        return TracedSpan(name, attrs)

    def record(self, name: str, value: float = 0.0, attrs: dict[str, Any] | None = None) -> None:
        logger.info("metric=%s value=%.2f attrs=%s", name, value, attrs or {})


telemetry = Telemetry()

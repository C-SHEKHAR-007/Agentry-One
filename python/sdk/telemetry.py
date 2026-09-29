"""Per-job usage accounting: which model(s) a step called and how many tokens
they reported. The runner opens one JobTelemetry per job and returns its
summary as result.metrics.usage (or sends it over the progress channel when
the job fails), where the API records it on the attempt.

Handlers call providers from executor threads, which don't inherit
contextvars, so a CapabilityClient captures the job's telemetry when it is
constructed (in the handler's own context) and records into that object."""

from __future__ import annotations

import threading
from contextvars import ContextVar, Token


class JobTelemetry:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.models: list[str] = []
        self.input_tokens = 0
        self.output_tokens = 0
        self.calls = 0
        self._counted = False

    def record(self, model: str | None, input_tokens: int | None = None, output_tokens: int | None = None) -> None:
        with self._lock:
            self.calls += 1
            if model and model not in self.models:
                self.models.append(str(model))
            if isinstance(input_tokens, (int, float)) and input_tokens >= 0:
                self.input_tokens += int(input_tokens)
                self._counted = True
            if isinstance(output_tokens, (int, float)) and output_tokens >= 0:
                self.output_tokens += int(output_tokens)
                self._counted = True

    def summary(self) -> dict | None:
        with self._lock:
            if not self.calls:
                return None
            return {
                "model": ", ".join(self.models) or None,
                "inputTokens": self.input_tokens if self._counted else None,
                "outputTokens": self.output_tokens if self._counted else None,
                "calls": self.calls,
            }


_current: ContextVar[JobTelemetry | None] = ContextVar("agentry_job_telemetry", default=None)


def current() -> JobTelemetry | None:
    return _current.get()


def begin() -> tuple[JobTelemetry, Token]:
    telemetry = JobTelemetry()
    return telemetry, _current.set(telemetry)


def end(token: Token) -> None:
    _current.reset(token)

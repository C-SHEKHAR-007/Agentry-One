"""BullMQ worker loop: dispatches each job to a step handler by stepKey and
returns whatever it returns as the job's result (the result envelope from
docs/03-agent-sdk-contract.md)."""

from __future__ import annotations

import asyncio
import json
import os
import signal
import sys
import time
from pathlib import Path
from typing import Awaitable, Callable

from bullmq import Worker

from .agent_job import AgentJob
from .log import get_logger

StepHandler = Callable[[AgentJob], Awaitable[dict]]

DEFAULT_TIMEOUT_SEC = 600


def _own_manifest() -> dict:
    """The manifest.json next to the running worker script, if any."""
    main = sys.modules.get("__main__")
    main_file = getattr(main, "__file__", None)
    if not main_file:
        return {}
    path = Path(main_file).resolve().parent / "manifest.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def run_agent(step_handlers: dict[str, StepHandler], queue_name: str) -> None:
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
    manifest = _own_manifest()
    agent_id = manifest.get("id") or queue_name
    # Manifest limits are enforced here, not just declared: a runaway job must
    # not hold the queue forever, and concurrency must match what the agent
    # says it can handle.
    concurrency = int(os.environ.get("WORKER_CONCURRENCY") or manifest.get("concurrency") or 1)
    default_timeout = float(manifest.get("timeoutSec") or DEFAULT_TIMEOUT_SEC)
    log = get_logger(f"agentry.worker.{agent_id}")

    async def processor(raw_job, _token: str) -> dict:
        job = AgentJob(raw_job)
        ctx = {"agent": agent_id, "job_id": job.job_id, "workflow_id": job.workflow_id, "step": job.step_key}
        handler = step_handlers.get(job.step_key)
        if handler is None:
            # Raise (not return a failed envelope) so BullMQ records a failure.
            raise RuntimeError(f"no handler for step '{job.step_key}'")
        timeout = float((job.agent_manifest or {}).get("timeoutSec") or default_timeout)
        started = time.monotonic()
        log.info("job started", extra=ctx)
        try:
            await job.load_secrets()
            result = await asyncio.wait_for(handler(job), timeout=timeout)
        except asyncio.TimeoutError:
            log.error("job timed out", extra={**ctx, "duration_ms": int((time.monotonic() - started) * 1000)})
            raise RuntimeError(f"step '{job.step_key}' exceeded its {int(timeout)}s timeout") from None
        except Exception:
            log.exception("job failed", extra={**ctx, "duration_ms": int((time.monotonic() - started) * 1000)})
            raise
        log.info("job completed", extra={**ctx, "duration_ms": int((time.monotonic() - started) * 1000)})
        return result

    async def main():
        # bullmq's Worker schedules its run loop via asyncio.ensure_future in
        # __init__, so it must be constructed inside a running event loop
        # (Python 3.14 removed the implicit "create one if missing" fallback).
        worker = Worker(queue_name, processor, {"connection": redis_url, "concurrency": concurrency})
        log.info("worker listening", extra={"agent": agent_id, "queue": queue_name})

        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, stop.set)

        await stop.wait()
        log.info("worker stopping; waiting for in-flight jobs", extra={"agent": agent_id})
        await worker.close()

    asyncio.run(main())

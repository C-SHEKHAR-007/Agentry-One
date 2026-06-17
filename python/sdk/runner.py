"""BullMQ worker loop: dispatches each job to a step handler by stepKey and
returns whatever it returns as the job's result (the result envelope from
docs/03-agent-sdk-contract.md)."""

from __future__ import annotations

import asyncio
import os
import signal
from typing import Callable

from bullmq import Worker

from .agent_job import AgentJob

StepHandler = Callable[[AgentJob], dict]


def run_agent(step_handlers: dict[str, StepHandler], queue_name: str) -> None:
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")

    async def processor(raw_job, _token: str) -> dict:
        job = AgentJob(raw_job)
        handler = step_handlers.get(job.step_key)
        if handler is None:
            return {"status": "failed", "artifacts": [], "error": {"message": f"no handler for step '{job.step_key}'"}}
        return await handler(job)

    async def main():
        # bullmq's Worker schedules its run loop via asyncio.ensure_future in
        # __init__, so it must be constructed inside a running event loop
        # (Python 3.14 removed the implicit "create one if missing" fallback).
        worker = Worker(queue_name, processor, {"connection": redis_url})
        print(f"[agentry] worker listening on queue '{queue_name}'", flush=True)

        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, stop.set)

        await stop.wait()
        await worker.close()

    asyncio.run(main())

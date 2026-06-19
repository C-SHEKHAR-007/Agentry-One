"""Sketch Agent worker. Resolves image generation through the capability
client (python/sdk/providers.py) instead of a hardcoded model import, so
swapping the configured provider (local SD-Turbo vs. a premium API) never
requires a code change here -- see the plan's provider/capability design."""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root, for python.sdk imports

from python.sdk.agent_job import AgentJob
from python.sdk.providers import CapabilityClient
from python.sdk.runner import run_agent

ARTIFACTS_DIR = Path(os.environ.get("ARTIFACTS_DIR", str(Path(__file__).resolve().parents[2] / "artifacts")))


async def generate(job: AgentJob) -> dict:
    await job.report_progress(0, "Generating...")

    client = CapabilityClient(job.provider_context)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: client.generate_image(
            prompt=job.params["prompt"],
            negative_prompt=job.params.get("negativePrompt"),
            steps=job.params.get("steps", 2),
            seed=job.params.get("seed"),
        ),
    )

    job_dir = ARTIFACTS_DIR / job.workflow_id
    job_dir.mkdir(parents=True, exist_ok=True)
    out_path = job_dir / f"{uuid.uuid4()}.png"
    out_path.write_bytes(result.image_bytes)

    await job.report_progress(100, "Done.")
    return {
        "status": "completed",
        "artifacts": [
            {
                "kind": "image",
                "path": str(out_path),
                "mimeType": "image/png",
                "metadata": {"width": result.width, "height": result.height},
            }
        ],
        "error": None,
    }


if __name__ == "__main__":
    run_agent({"generate": generate}, queue_name="agent.sketch")

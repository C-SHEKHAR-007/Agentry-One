"""Echo Agent worker (scaffolded by Agent Studio).

This stub echoes its input params into a text artifact so the end-to-end
pipeline (queue -> worker -> artifact -> UI) works immediately. Replace the
body of run() with your real logic.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root, for python.sdk imports

from python.sdk.agent_job import AgentJob
from python.sdk.runner import run_agent

ARTIFACTS_DIR = Path(os.environ.get("ARTIFACTS_DIR", str(Path(__file__).resolve().parents[2] / "artifacts")))


async def run(job: AgentJob) -> dict:
    await job.report_progress(10, "Working...")

    # TODO: replace with real logic. job.params holds the validated input;
    # job.provider_context is set when the step declares requiresCapability.
    output_text = json.dumps(job.params, indent=2)

    job_dir = ARTIFACTS_DIR / job.workflow_id
    job_dir.mkdir(parents=True, exist_ok=True)
    out_path = job_dir / f"{uuid.uuid4()}.txt"
    out_path.write_text(output_text)

    await job.report_progress(100, "Done.")
    return {
        "status": "completed",
        "artifacts": [
            {"kind": "text", "path": str(out_path), "mimeType": "text/plain", "metadata": {}}
        ],
        "error": None,
    }


if __name__ == "__main__":
    run_agent({"run": run}, queue_name="agent.echo-agent")

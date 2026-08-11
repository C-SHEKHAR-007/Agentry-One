"""Voice Agent worker. Resolves text-to-speech through the capability client
(python/sdk/providers.py) so swapping the configured provider never requires
a code change here -- same pattern as the Sketch Agent for image-generation."""

from __future__ import annotations

import asyncio
import sys
import tempfile
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root, for python.sdk imports

from python.sdk.agent_job import AgentJob
from python.sdk.artifact_io import read_text_artifact, write_artifact_file
from python.sdk.providers import CapabilityClient
from python.sdk.runner import run_agent


async def generate(job: AgentJob) -> dict:
    await job.report_progress(0, "Synthesizing voiceover...")

    # params.text is either a literal caption or a Template `fromStep`
    # reference (the upstream text artifact's storage_key) -- either way,
    # read_text_artifact resolves it to the actual words to speak.
    text = read_text_artifact(job.params.get("text", ""))

    if not text.strip():
        raise ValueError("Voice Agent requires non-empty text (params.text).")

    client = CapabilityClient(job.provider_context)

    scratch_path = str(Path(tempfile.gettempdir()) / f"{uuid.uuid4()}.wav")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        lambda: client.generate_audio(text=text, out_path=scratch_path, voice=job.params.get("voice")),
    )
    out_path = write_artifact_file(scratch_path, job.workflow_id, ".wav", "audio/wav")

    await job.report_progress(100, "Done.")
    # ~150 words/minute is a reasonable estimate for spoken narration pacing.
    duration_estimate = max(1.0, len(text.split()) / 150 * 60)

    return {
        "status": "completed",
        "artifacts": [
            {
                "kind": "audio",
                "path": out_path,
                "mimeType": "audio/wav",
                "metadata": {"durationEstimateSec": round(duration_estimate, 1)},
            }
        ],
        "error": None,
    }


if __name__ == "__main__":
    run_agent({"generate": generate}, queue_name="agent.voice")

import asyncio
import sys
import tempfile
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root

from python.sdk.agent_job import AgentJob
from python.sdk.artifact_io import read_text_artifact, write_artifact_file
from python.sdk.runner import run_agent
from python.sdk.social_connectors import load_publisher


async def run(job: AgentJob) -> dict:
    await job.report_progress(0, "Initializing Publisher...")

    if not job.social_auth:
        raise ValueError("Social Publisher requires a connected social account (socialAuth on the job payload).")

    platform = job.social_auth["platform"]
    access_token = job.social_auth["accessToken"]
    is_mock = job.social_auth.get("isMock", False)

    # params.text is either a literal caption or a Template `fromStep`
    # reference (an upstream text artifact's storage_key) -- resolve either.
    caption = read_text_artifact(job.params.get("text") or "") or "Default caption"
    # A public URL the platform can fetch the media from -- required by
    # platforms (Instagram) that can't post a caption alone; optional for
    # ones that can (X, LinkedIn -- not wired up to actually attach it yet).
    media_url = job.params.get("mediaUrl") or None
    media_note = "" if media_url else " (no media attached)"

    await job.report_progress(30, f"Connecting to {platform}...")

    if is_mock:
        await asyncio.sleep(1)
        await job.report_progress(70, f"[local mock] Simulating post to {platform}...")
        await asyncio.sleep(1)
        post_url = f"https://{platform}.com/post/{uuid.uuid4().hex[:8]}"
        receipt = f"[MOCK -- no app credentials configured] Would have posted to {platform}: {caption}{media_note}"
    else:
        await job.report_progress(60, f"Publishing to {platform}...")
        post_url = load_publisher(platform)(access_token, caption, media_url)
        receipt = f"Posted to {platform}: {caption}{media_note}"

    await job.report_progress(100, "Successfully published!")

    scratch_path = str(Path(tempfile.gettempdir()) / f"{uuid.uuid4()}.txt")
    Path(scratch_path).write_text(receipt, encoding="utf-8")
    out_path = write_artifact_file(scratch_path, job.workflow_id, ".txt", "text/plain")

    return {
        "status": "completed",
        "artifacts": [
            {
                "kind": "text",
                "path": out_path,
                "mimeType": "text/plain",
                "metadata": {"url": post_url, "platform": platform, "mock": is_mock},
            }
        ],
        "error": None,
    }


if __name__ == "__main__":
    run_agent({"run": run}, queue_name="agent.social-publisher")

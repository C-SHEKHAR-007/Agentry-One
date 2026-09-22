import asyncio
import mimetypes
import os
import re
import sys
import tempfile
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root

from python.sdk.agent_job import AgentJob
from python.sdk.artifact_io import local_artifact_path, read_text_artifact, resolve_to_local_path, resolve_to_public_url, write_artifact_file
from python.sdk.runner import run_agent
from python.sdk.social_connectors import load_publisher

API_DOWNLOAD_PATH = re.compile(r"^(?:/api)?/artifacts/([0-9a-fA-F-]{36})/download$")


def _download_api_artifact(artifact_id: str, job_id: str) -> str:
    """Fetches an artifact through the API into scratch space and returns the
    local path. Uses the X-API-Key header so the key never lands in URLs/logs."""
    import requests

    api_url = os.environ.get("AGENTRY_API_URL", "http://localhost:4000").rstrip("/")
    api_key = os.environ.get("AGENTRY_API_KEY")
    if not api_key:
        raise RuntimeError("AGENTRY_API_KEY must be set for the worker to download artifacts from the API")
    r = requests.get(f"{api_url}/artifacts/{artifact_id}/download", headers={"X-API-Key": api_key}, timeout=30)
    r.raise_for_status()
    ext = mimetypes.guess_extension((r.headers.get("Content-Type") or "").split(";")[0].strip()) or ".bin"
    scratch_dir = Path(tempfile.gettempdir()) / f"social-publisher-{job_id}"
    scratch_dir.mkdir(parents=True, exist_ok=True)
    local_f = scratch_dir / f"{uuid.uuid4()}{ext}"
    local_f.write_bytes(r.content)
    return str(local_f)


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

    # Resolve media URL / artifact if provided
    raw_media = job.params.get("mediaUrl") or None
    media_url = None
    if raw_media:
        if raw_media.startswith("http://") or raw_media.startswith("https://"):
            media_url = raw_media
        elif raw_media.startswith("azure://"):
            scratch_dir = Path(tempfile.gettempdir()) / f"social-publisher-{job.job_id}"
            local_path = resolve_to_local_path(raw_media, scratch_dir)
            sas_url = resolve_to_public_url(raw_media)
            if platform in ("facebook", "telegram", "discord", "instagram") and Path(local_path).exists():
                media_url = local_path
            elif sas_url and sas_url.startswith("http"):
                media_url = sas_url
            else:
                media_url = local_path
        elif (artifact_path := local_artifact_path(raw_media)) is not None:
            media_url = str(artifact_path)
        elif (match := API_DOWNLOAD_PATH.match(raw_media)) is not None:
            # An API artifact-download path (as the web UI's downloadUrl builds
            # it, with or without the browser-proxy "/api" prefix).
            media_url = _download_api_artifact(match.group(1), job.job_id)
        else:
            raise ValueError(f"mediaUrl must be an http(s) URL or an artifact reference, got {raw_media!r}")

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

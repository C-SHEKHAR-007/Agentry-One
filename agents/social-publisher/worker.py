import asyncio
import sys
import tempfile
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root

from python.sdk.agent_job import AgentJob
from python.sdk.artifact_io import read_text_artifact, resolve_to_local_path, resolve_to_public_url, write_artifact_file
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
        elif raw_media.startswith("/"):
            if Path(raw_media).exists() and not Path(raw_media).is_dir():
                media_url = raw_media
            else:
                api_url = os.environ.get("AGENTRY_API_URL", "http://localhost:4000")
                api_key = os.environ.get("AGENTRY_API_KEY", "dev-local-api-key")
                sep = "&" if "?" in raw_media else "?"
                download_url = f"{api_url}{raw_media}{sep}key={api_key}"
                scratch_dir = Path(tempfile.gettempdir()) / f"social-publisher-{job.job_id}"
                scratch_dir.mkdir(parents=True, exist_ok=True)
                local_f = str(scratch_dir / f"{uuid.uuid4()}.jpg")
                try:
                    import requests
                    r = requests.get(download_url, timeout=30)
                    if r.ok:
                        Path(local_f).write_bytes(r.content)
                        media_url = local_f
                    else:
                        media_url = raw_media
                except Exception:
                    media_url = raw_media
        elif Path(raw_media).exists():
            media_url = raw_media
        else:
            media_url = raw_media

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

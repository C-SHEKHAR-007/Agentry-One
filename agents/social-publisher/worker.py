import asyncio
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root

from python.sdk.agent_job import AgentJob
from python.sdk.runner import run_agent

async def run(job: AgentJob) -> dict:
    await job.report_progress(0, "Initializing Publisher...")

    # The platform should be mapped via the UI or job params
    platform = job.params.get("platform", "instagram")
    
    # We expect text artifact (caption) and an optional image/video artifact
    caption = "Default caption"
    media_path = None
    
    for ref in job.input_artifacts:
        if ref["kind"] == "text":
            caption = Path(ref["path"]).read_text(encoding="utf-8")
        elif ref["kind"] in ["image", "video"]:
            media_path = ref["path"]

    await job.report_progress(30, f"Connecting to {platform} via saved OAuth keys...")
    
    # In a real scenario, this worker would query the Node API (or Postgres) 
    # to get the decrypted SocialAccount access_token for job.workflow_id's Project.
    # For now, we simulate the post.
    await asyncio.sleep(2)
    
    await job.report_progress(70, f"Uploading media and posting to {platform}...")
    await asyncio.sleep(2)
    
    # Simulate a successful post url
    post_url = f"https://{platform}.com/post/{uuid.uuid4().hex[:8]}"

    await job.report_progress(100, "Successfully published!")
    
    return {
        "status": "completed",
        "artifacts": [
            {
                "kind": "text",
                "path": "social_post_receipt.txt", # fake path
                "mimeType": "text/plain",
                "metadata": {"url": post_url},
            }
        ],
        "error": None,
    }

if __name__ == "__main__":
    run_agent({"run": run}, queue_name="agent.social-publisher")

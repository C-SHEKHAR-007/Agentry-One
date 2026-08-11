import asyncio
import os
import re
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root

from python.sdk.agent_job import AgentJob
from python.sdk.providers import CapabilityClient
from python.sdk.runner import run_agent

ARTIFACTS_DIR = Path(os.environ.get("ARTIFACTS_DIR", str(Path(__file__).resolve().parents[2] / "artifacts")))

async def run(job: AgentJob) -> dict:
    await job.report_progress(0, "Initializing Dynamic Skill...")

    if not job.step_manifest:
        raise ValueError("Dynamic Skill requires step_manifest in the job payload.")

    ui_config = job.step_manifest.get("ui_config", {})
    system_prompt_template = ui_config.get("system_prompt", "You are a helpful AI.")
    
    # Render the system prompt template using basic {{key}} replacement
    system_prompt = system_prompt_template
    for key, value in job.params.items():
        system_prompt = re.sub(r'\{\{\s*' + re.escape(key) + r'\s*\}\}', str(value), system_prompt)

    # For dynamic skills, we typically expect a text-generation capability.
    requires_capability = job.step_manifest.get("requiresCapability", "text-generation")
    
    if requires_capability == "text-generation":
        client = CapabilityClient(job.provider_context)
        await job.report_progress(20, "Generating text...")
        
        loop = asyncio.get_event_loop()
        # Passing an empty string for user prompt since everything might be in system_prompt for now
        # Or we can allow mapping an explicit "prompt" input.
        user_prompt = job.params.get("prompt", "")
        
        # If user_prompt is provided, append it, otherwise just use the rendered system_prompt
        final_prompt = system_prompt
        if user_prompt:
            final_prompt += f"\n\n{user_prompt}"

        result_text = await loop.run_in_executor(
            None,
            lambda: client.generate_text(prompt=final_prompt),
        )
        
        await job.report_progress(80, "Saving artifact...")
        
        if os.environ.get("STORAGE_PROVIDER") == "local" or not os.environ.get("STORAGE_PROVIDER"):
            job_dir = ARTIFACTS_DIR / job.workflow_id
            job_dir.mkdir(parents=True, exist_ok=True)
            out_path = str(job_dir / f"{uuid.uuid4()}.txt")
            Path(out_path).write_text(result_text, encoding="utf-8")
        else:
            from python.sdk.azure_storage import upload_artifact_bytes
            out_path, _ = upload_artifact_bytes(result_text.encode("utf-8"), job.workflow_id, ".txt", "text/plain")
            
        await job.report_progress(100, "Done.")
        return {
            "status": "completed",
            "artifacts": [
                {
                    "kind": "text",
                    "path": out_path,
                    "mimeType": "text/plain",
                    "metadata": {"token_count": len(result_text.split())},
                }
            ],
            "error": None,
        }
    else:
        raise NotImplementedError(f"Dynamic Skill capability {requires_capability} not implemented yet.")

if __name__ == "__main__":
    run_agent({"run": run}, queue_name="agent.dynamic")

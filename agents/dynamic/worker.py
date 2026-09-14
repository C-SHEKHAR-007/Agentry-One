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
    
    # Check if any parameter references an upstream artifact file and load its content
    enriched_params = dict(job.params)
    for key, value in job.params.items():
        if isinstance(value, str) and (value.endswith(".txt") or value.endswith(".md") or "/" in value or "\\" in value):
            try:
                candidate_path = Path(value)
                if not candidate_path.is_absolute():
                    candidate_path = ARTIFACTS_DIR / value
                if candidate_path.exists() and candidate_path.is_file():
                    content = candidate_path.read_text(encoding="utf-8", errors="ignore")
                    enriched_params[key] = content
                    enriched_params[f"{key}_content"] = content
            except Exception:
                pass

    # Render the system prompt template using {{key}} replacement
    system_prompt = system_prompt_template
    for key, value in enriched_params.items():
        system_prompt = re.sub(r'\{\{\s*' + re.escape(key) + r'\s*\}\}', str(value), system_prompt)

    # For dynamic skills, we typically expect a text-generation capability.
    requires_capability = job.step_manifest.get("requiresCapability", "text-generation")
    
    loop = asyncio.get_event_loop()

    if requires_capability == "text-generation":
        client = CapabilityClient(job.provider_context)
        await job.report_progress(20, "Generating text...")
        
        user_prompt = enriched_params.get("prompt", "")
        final_prompt = system_prompt
        if user_prompt and user_prompt not in system_prompt:
            final_prompt += f"\n\n{user_prompt}"

        context_keys = [k for k in enriched_params if "context" in k or "brief" in k or "artifact" in k]
        for ck in context_keys:
            if ck in enriched_params and str(enriched_params[ck]) not in final_prompt:
                final_prompt += f"\n\n--- Input Reference ({ck}) ---\n{enriched_params[ck]}"

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
                    "metadata": {"token_count": len(result_text.split()), "preview": result_text[:200]},
                }
            ],
            "error": None,
        }

    elif requires_capability == "image-generation":
        client = CapabilityClient(job.provider_context)
        await job.report_progress(20, "Generating image...")

        user_prompt = enriched_params.get("prompt") or enriched_params.get("post_idea") or system_prompt
        img_res = await loop.run_in_executor(
            None,
            lambda: client.generate_image(prompt=user_prompt),
        )

        await job.report_progress(80, "Saving image artifact...")
        if os.environ.get("STORAGE_PROVIDER") == "local" or not os.environ.get("STORAGE_PROVIDER"):
            job_dir = ARTIFACTS_DIR / job.workflow_id
            job_dir.mkdir(parents=True, exist_ok=True)
            out_path = str(job_dir / f"{uuid.uuid4()}.png")
            Path(out_path).write_bytes(img_res.image_bytes)
        else:
            from python.sdk.azure_storage import upload_artifact_bytes
            out_path, _ = upload_artifact_bytes(img_res.image_bytes, job.workflow_id, ".png", "image/png")

        await job.report_progress(100, "Done.")
        return {
            "status": "completed",
            "artifacts": [
                {
                    "kind": "image",
                    "path": out_path,
                    "mimeType": "image/png",
                    "metadata": {"width": img_res.width, "height": img_res.height},
                }
            ],
            "error": None,
        }

    elif requires_capability == "audio-generation":
        client = CapabilityClient(job.provider_context)
        await job.report_progress(20, "Synthesizing audio narration...")

        text_to_speak = enriched_params.get("text") or enriched_params.get("prompt") or system_prompt
        import tempfile
        tmp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp_path = tmp_file.name
        tmp_file.close()

        await loop.run_in_executor(
            None,
            lambda: client.generate_audio(text=text_to_speak, out_path=tmp_path),
        )

        await job.report_progress(80, "Saving audio artifact...")
        wav_bytes = Path(tmp_path).read_bytes()
        try:
            os.remove(tmp_path)
        except Exception:
            pass

        if os.environ.get("STORAGE_PROVIDER") == "local" or not os.environ.get("STORAGE_PROVIDER"):
            job_dir = ARTIFACTS_DIR / job.workflow_id
            job_dir.mkdir(parents=True, exist_ok=True)
            out_path = str(job_dir / f"{uuid.uuid4()}.wav")
            Path(out_path).write_bytes(wav_bytes)
        else:
            from python.sdk.azure_storage import upload_artifact_bytes
            out_path, _ = upload_artifact_bytes(wav_bytes, job.workflow_id, ".wav", "audio/wav")

        await job.report_progress(100, "Done.")
        return {
            "status": "completed",
            "artifacts": [
                {
                    "kind": "audio",
                    "path": out_path,
                    "mimeType": "audio/wav",
                    "metadata": {"size_bytes": len(wav_bytes)},
                }
            ],
            "error": None,
        }

    elif requires_capability == "web-search":
        await job.report_progress(20, "Executing live web search...")
        query = enriched_params.get("query") or enriched_params.get("topic") or enriched_params.get("prompt") or "latest trends"
        
        import importlib.util
        ws_path = Path(__file__).resolve().parents[1] / "web-search" / "worker.py"
        spec = importlib.util.spec_from_file_location("web_search_worker", str(ws_path))
        ws_mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ws_mod)
        search_web_live = ws_mod.search_web_live
        format_research_brief = ws_mod.format_research_brief

        results = await loop.run_in_executor(None, lambda: search_web_live(query))
        brief_md = format_research_brief(query, results)

        await job.report_progress(80, "Saving research brief artifact...")
        if os.environ.get("STORAGE_PROVIDER") == "local" or not os.environ.get("STORAGE_PROVIDER"):
            job_dir = ARTIFACTS_DIR / job.workflow_id
            job_dir.mkdir(parents=True, exist_ok=True)
            out_path = str(job_dir / f"{uuid.uuid4()}.md")
            Path(out_path).write_text(brief_md, encoding="utf-8")
        else:
            from python.sdk.azure_storage import upload_artifact_bytes
            out_path, _ = upload_artifact_bytes(brief_md.encode("utf-8"), job.workflow_id, ".md", "text/markdown")

        await job.report_progress(100, "Done.")
        return {
            "status": "completed",
            "artifacts": [
                {
                    "kind": "search_brief",
                    "path": out_path,
                    "mimeType": "text/markdown",
                    "metadata": {"query": query, "results_count": len(results)},
                }
            ],
            "error": None,
        }

    else:
        raise NotImplementedError(f"Dynamic Skill capability {requires_capability} not implemented yet.")

if __name__ == "__main__":
    run_agent({"run": run}, queue_name="agent.dynamic")

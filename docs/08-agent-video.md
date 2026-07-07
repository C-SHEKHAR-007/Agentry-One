# 08 — Video Agent

Video Agent's internals are **out of scope for this document** — they're VSplitter's existing, working, tested pipeline (`src/pipeline.py` and everything it calls), unmodified. This document is the wrapper spec only: how that pipeline gets fitted to the Agent SDK contract from [03-agent-sdk-contract.md](03-agent-sdk-contract.md). For the pipeline's own internals, see VSplitter's `docs/ARCHITECTURE.md`.

## Manifest

```jsonc
{
  "id": "video-agent",
  "name": "Video Agent",
  "version": "1.0.0",
  "description": "Cuts vertical, captioned clips from a video for Shorts/Reels.",
  "entrypoint": {
    "type": "python-worker",
    "module": "agents.video.worker",
    "queueName": "agent.video"
  },
  "steps": [
    {
      "key": "analyze",
      "inputSchema": { "$ref": "./schemas/analyze.input.json" },
      "outputSchema": { "$ref": "./schemas/analyze.output.json" },
      "humanGate": true,
      "producesArtifactKinds": ["candidate_list", "transcript"]
    },
    {
      "key": "render",
      "inputSchema": { "$ref": "./schemas/render.input.json" },
      "outputSchema": { "$ref": "./schemas/render.output.json" },
      "humanGate": false,
      "producesArtifactKinds": ["video_clip", "manifest"]
    }
  ],
  "resources": { "cpu": 2, "memoryMb": 4096, "gpu": false },
  "concurrency": 1,
  "timeoutSec": 1800,
  "attempts": 2,
  "backoff": { "type": "exponential", "delayMs": 10000 }
}
```

`attempts: 2` applies to jobs on *either* step's queue (the manifest's retry config is agent-wide, not per-step — see [03-agent-sdk-contract.md](03-agent-sdk-contract.md)). This is a deliberate, conservative choice: `analyze` failures are often transient (a flaky download, Ollama momentarily unreachable) and safe to retry outright, but `render` writes clip files to the output directory before it can fail partway through a multi-clip batch. The wrapper's `render` handler must therefore be **idempotent** — always overwrite `clip_NN.mp4` at a deterministic path rather than appending — so a retried `render` attempt is safe rather than producing duplicate or inconsistent output.

`analyze.input.json` maps directly onto `pipeline.analyze(source, progress_cb, weights)`'s real parameters: `source` (string — file path or YouTube URL) and `weights` (object with `transcript`/`audio`/`visual` floats, matching `config.SIGNAL_WEIGHTS`'s shape). `render.input.json` maps onto `pipeline.render_selected(ctx, selected_indices)`'s `selected_indices` (array of integers).

## Worker implementation shape

```python
# agents/video/worker.py
from python.sdk.runner import run_agent
from python.sdk.agent_job import AgentJob
from src import pipeline  # VSplitter's existing, unmodified package

ANALYZE_STAGE_PERCENT = {
    "Resolving input...": 5,
    "Extracting audio...": 10,
    "Transcribing (faster-whisper)...": 40,
    "Analyzing audio energy...": 55,
    "Analyzing scene cuts and motion...": 65,
    "Building candidate windows...": 75,
    "Heuristic scoring...": 82,
    "LLM re-ranking shortlist (Ollama)...": 90,
    "Combining signals and ranking...": 97,
}

def analyze(job: AgentJob) -> dict:
    def report(msg: str):
        percent = ANALYZE_STAGE_PERCENT.get(msg, 50)  # unmatched/dynamic messages (e.g. "Done: N candidates ranked.") fall back to a mid-point rather than erroring
        job.report_progress(percent, msg)

    ctx = pipeline.analyze(job.params["source"], progress_cb=report, weights=job.params.get("weights"))
    candidate_list_path = _write_candidate_list_artifact(ctx)
    transcript_path = _write_transcript_artifact(ctx)
    job.report_progress(100, f"Done: {len(ctx.candidates)} candidates ranked.")
    return {
        "status": "completed",
        "artifacts": [
            {"kind": "candidate_list", "path": candidate_list_path, "mimeType": "application/json", "metadata": {"count": len(ctx.candidates)}},
            {"kind": "transcript", "path": transcript_path, "mimeType": "application/json", "metadata": {}},
        ],
        "error": None,
    }

def render(job: AgentJob) -> dict:
    ctx = _load_job_context(job.input_artifacts)  # reconstructed from the analyze step's persisted state
    job.report_progress(0, "Rendering selected clips...")
    out_paths = pipeline.render_selected(ctx, job.params["selected_indices"])
    job.report_progress(100, "Done.")  # coarse only -- see limitation below
    return {
        "status": "completed",
        "artifacts": (
            [{"kind": "video_clip", "path": p, "mimeType": "video/mp4"} for p in out_paths]
            + [{"kind": "manifest", "path": _manifest_path(ctx), "mimeType": "application/json"}]
        ),
        "error": None,
    }

if __name__ == "__main__":
    run_agent({"analyze": analyze, "render": render}, queue_name="agent.video")
```

## Progress-stage mapping

VSplitter's `pipeline.analyze()` reports progress via a **plain string callback**, not a percentage (see VSplitter's `src/pipeline.py`, the `report(msg)` closure). The table above is the concrete translation layer: each known stage string maps to a fixed percentage; anything unrecognized (including the final dynamic `"Done: N candidates ranked."` message, which includes a variable candidate count) falls back to a reasonable mid-point rather than crashing the mapping. This lookup table is the entire "adapter" needed to satisfy the SDK contract's progress-reporting expectation from an unmodified pipeline function.

## Known limitation: `render` step has coarse progress only

**This is documented plainly, not glossed over.** VSplitter's `pipeline.render_selected()` has no `progress_cb` parameter at all today — it renders every selected clip in a loop with no intermediate reporting. The wrapper above can therefore only report `0%` at the start and `100%` at completion of the entire `render` step, regardless of how many clips are selected. A user rendering 8 clips sees no incremental feedback until all 8 finish.

This is called out as a **small, additive, non-breaking enhancement candidate** for a future VSplitter change (adding an optional `progress_cb` parameter to `render_selected` that fires once per completed clip) — but that change is explicitly out of scope for this Phase-1 documentation pass, since it would mean modifying VSplitter's tested code rather than just wrapping it.

## Artifact mapping

| Step | Artifact `kind` | Content |
|---|---|---|
| `analyze` | `candidate_list` | The ranked `Candidate` list from VSplitter's `ranker.py` (start/end/final_score/text per candidate) — rendered by the frontend as the same checklist VSplitter's own Gradio UI shows today. |
| `analyze` | `transcript` | VSplitter's cached `transcript.json` (segments + word-level timestamps). |
| `render` | `video_clip` (× N) | One per selected candidate — the final vertical mp4 with burned-in captions. |
| `render` | `manifest` | VSplitter's own `manifest.json` output (path/start/end/score/text per rendered clip), unchanged. |

## Config mapping

VSplitter's `config.py` today is a flat module of Python constants (`WHISPER_MODEL_SIZE`, `SIGNAL_WEIGHTS`, `NMS_OVERLAP_THRESHOLD`, `OUTPUT_WIDTH`/`OUTPUT_HEIGHT`, caption styling, reframe thresholds, etc.). Under Agentry, these become **defaults** the worker falls back to when a job's `params` doesn't override them, with per-project or global overrides available through the `settings` table (see [05-database-schema.md](05-database-schema.md)) instead of requiring a code change and redeploy to adjust, e.g., the transcript/audio/visual weight balance.

## Ollama networking

VSplitter's own `docker-compose.yml` today uses `network_mode: host` for its single service specifically so it can reach a host-installed Ollama at `localhost:11434` with zero extra configuration — a reasonable shortcut for a single-service app, but not appropriate once there are multiple services (API, worker-sketch, Postgres, Redis) that don't need or want the host's full network namespace. Under Agentry, **only `worker-video` needs Ollama reachability** — [10-deployment.md](10-deployment.md) specifies a targeted approach (host-gateway reachability scoped to that one service) rather than blanket host networking across the whole compose stack.

## Resource/concurrency notes

`concurrency: 1` is the conservative Phase-1 default, matching VSplitter's own documented caution about running faster-whisper and Ollama concurrently on a single machine's limited VRAM/CPU (see VSplitter's `docs/ARCHITECTURE.md` §8). This can be revisited once real usage patterns and hardware (particularly whether GPU becomes available) are better understood.

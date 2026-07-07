# 09 — Sketch Agent

Unlike Video Agent, Sketch Agent doesn't wrap an existing implementation — it's new. This document is a real design, not just a wrapper spec, and it exists specifically to prove the platform's abstraction holds for an agent with a **structurally different execution shape**: one step, no human gate, and a completely different resource profile (a resident in-memory model instead of a multi-stage CPU/audio/LLM pipeline).

## The hardware constraint driving this design

This machine has no GPU (confirmed: 0 CUDA devices, no `/dev/nvidia*` — same constraint documented in VSplitter's own `docs/ARCHITECTURE.md`). Two paths were available: a paid hosted image-gen API (fast, but breaks the "free/local" principle Video Agent already established), or a local CPU model (slow, but consistent). The decision made for this platform is **local CPU, accept slower generation** — consistency with Video Agent's design principle mattered more than raw speed for a portfolio/personal-use platform.

## Model recommendation: SD-Turbo

**Primary pick: `stabilityai/sd-turbo`** — a distilled variant of Stable Diffusion 2.1 that produces usable images in **1-4 inference steps** instead of the 20-50 steps a standard diffusion model needs, at 512×512 resolution. This is the single most important design decision in this document: a full, non-distilled SDXL pipeline on CPU would take **minutes to tens of minutes per image** (50 steps × a much larger model, with no GPU parallelism), which would make the platform practically unusable for iterative image generation. SD-Turbo's few-step distillation is what makes "CPU-only and free" survive contact with reality.

**Fallback/alternative: LCM-LoRA on an SD 1.5 checkpoint** (e.g. the community "Dreamshaper" checkpoint) — also few-step, also CPU-viable, and licensed under the more permissive OpenRAIL-family terms. This matters because **SD-Turbo's own license is non-commercial/research-use only** — fine for a personal/portfolio deployment, but a real constraint to flag explicitly now rather than discover later if this project is ever framed commercially. If that framing ever changes, swap the primary model to the LCM-LoRA path; the manifest/worker contract below doesn't change either way.

## Realistic latency — an estimate, not a guarantee

Order-of-magnitude estimate: **roughly 15-60 seconds per 512×512 image** with SD-Turbo on a modern multi-core CPU, after the model is warm-loaded. This number is **explicitly not validated yet** — the first concrete implementation task for this agent should be a small benchmarking spike on the actual target machine, since CPU diffusion performance varies a lot with core count, instruction set support (AVX-512 etc.), and the specific inference backend used. Treat every latency number in this document as a planning estimate to be confirmed, the same honest framing VSplitter's own docs use for Whisper-on-CPU timing.

## Design implication: keep the pipeline warm

The single biggest lesson carried over from Video Agent's own experience: **loading a model is expensive, and must not happen per-job.** VSplitter's Whisper model load took roughly 100 seconds on first run in this same environment (see VSplitter's `docs/ARCHITECTURE.md`) — a diffusion pipeline's load is in a similar ballpark. `worker-sketch` must load the SD-Turbo pipeline **once at process start** and keep it resident in memory across every job it processes, exactly as VSplitter's Whisper model is loaded once and reused. This is why Sketch Agent's manifest sets `concurrency: 1` — one long-lived process holding one pipeline instance, processing jobs from its queue serially, not spinning up a fresh process (and a fresh model load) per job.

## Future optimization (explicitly not Phase 1)

`optimum-intel` with OpenVINO INT8 quantization is a realistic 2-4x CPU speedup path for this exact model family, worth revisiting once the platform is running and real latency numbers are in hand — not attempted in the initial implementation, to avoid adding an optimization dependency before confirming the simple path even needs it.

## Manifest

```jsonc
{
  "id": "sketch-agent",
  "name": "Sketch Agent",
  "version": "1.0.0",
  "description": "Generates an image from a text prompt using a local, CPU-only diffusion model.",
  "entrypoint": {
    "type": "python-worker",
    "module": "agents.sketch.worker",
    "queueName": "agent.sketch"
  },
  "steps": [
    {
      "key": "generate",
      "inputSchema": { "$ref": "./schemas/generate.input.json" },
      "outputSchema": { "$ref": "./schemas/generate.output.json" },
      "humanGate": false,
      "producesArtifactKinds": ["image"]
    }
  ],
  "resources": { "cpu": 4, "memoryMb": 6144, "gpu": false },
  "concurrency": 1,
  "timeoutSec": 300,
  "attempts": 2,
  "backoff": { "type": "exponential", "delayMs": 5000 }
}
```

`generate` is a pure function of its inputs (prompt/seed/steps) with no partial side effects to clean up on failure, so retrying it is always safe — a more generous `attempts` than this would be reasonable too, but `2` is a sane starting default.

`generate.input.json` covers: `prompt` (string, required), `negativePrompt` (string, optional), `steps` (integer, default 2-4, since this is a few-step distilled model — a "50" here would defeat the entire point of the model choice), `seed` (integer, optional, for reproducibility), `width`/`height` (default 512×512, since going higher costs meaningfully more CPU time for a model distilled/tuned around that resolution).

## Worker implementation shape

```python
# agents/sketch/worker.py
from python.sdk.runner import run_agent
from python.sdk.agent_job import AgentJob

_pipeline = None  # loaded once, kept warm across jobs -- see "Design implication" above

def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        from diffusers import AutoPipelineForText2Image
        _pipeline = AutoPipelineForText2Image.from_pretrained("stabilityai/sd-turbo")
    return _pipeline

def generate(job: AgentJob) -> dict:
    job.report_progress(0, "Generating...")
    pipe = _get_pipeline()
    image = pipe(
        prompt=job.params["prompt"],
        negative_prompt=job.params.get("negativePrompt"),
        num_inference_steps=job.params.get("steps", 2),
        guidance_scale=0.0,  # SD-Turbo is trained for guidance-free sampling
    ).images[0]
    out_path = _write_image_artifact(image, job)
    job.report_progress(100, "Done.")
    return {
        "status": "completed",
        "artifacts": [{"kind": "image", "path": out_path, "mimeType": "image/png", "metadata": {"width": image.width, "height": image.height}}],
        "error": None,
    }

if __name__ == "__main__":
    run_agent({"generate": generate}, queue_name="agent.sketch")
```

`guidance_scale=0.0` is intentional, not an oversight — SD-Turbo is specifically trained for guidance-free (classifier-free-guidance-disabled) sampling; using a standard SD guidance scale would work against the distillation and produce worse results in fewer steps than the model is capable of.

## Progress reporting

Like Video Agent's `render` step, Sketch Agent's single `generate` step reports **coarse progress only** (0% at start, 100% at completion) in this initial design. Per-diffusion-step progress (e.g. reporting after each of the 2-4 denoising steps) is a plausible future enhancement, but with generation this fast (tens of seconds), the UX value of fine-grained progress is much lower than it is for Video Agent's multi-minute `analyze` step — not worth the added complexity for Phase 1.

## Prompt versioning

Default negative prompts and any prompt-engineering templates (e.g. a style-prefix template) live in the `prompts` table (see [05-database-schema.md](05-database-schema.md)), scoped to `agent_id: "sketch-agent"` — so refining the default negative prompt is a data change, not a code deploy.

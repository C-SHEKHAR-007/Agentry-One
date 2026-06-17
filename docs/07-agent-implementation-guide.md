# 07 — Agent Implementation Guide

This is the platform's core value proposition, written for the "agent author" persona from [`01-product-vision.md`](01-product-vision.md): someone adding a new capability who should never need to read the orchestrator's internals. If this guide is followed correctly, adding an agent touches nothing outside `agents/<new-agent>/` and one line in `docker-compose.yml`.

## Step 1: create the manifest

```text
agents/
  <your-agent-id>/
    manifest.json
    worker.py
    schemas/
      <step>.input.json
      <step>.output.json
    Dockerfile
```

Write `manifest.json` following the contract in [`03-agent-sdk-contract.md`](03-agent-sdk-contract.md). At minimum:

```jsonc
{
  "id": "your-agent-id",
  "name": "Your Agent",
  "version": "1.0.0",
  "description": "One sentence describing what it does.",
  "entrypoint": {
    "type": "python-worker",
    "module": "agents.your_agent_id.worker",
    "queueName": "agent.your-agent-id"
  },
  "steps": [
    {
      "key": "run",
      "inputSchema": { "$ref": "./schemas/run.input.json" },
      "outputSchema": { "$ref": "./schemas/run.output.json" },
      "humanGate": false,
      "producesArtifactKinds": ["your_output_kind"]
    }
  ],
  "resources": { "cpu": 1, "memoryMb": 2048, "gpu": false },
  "concurrency": 1,
  "timeoutSec": 300
}
```

Most new agents will have either **one step with no human gate** (like Sketch Agent — submit, run, done) or, if there's a genuine reason for the platform to pause for human review mid-way, **multiple steps with `humanGate: true`** on the ones that need it (like Video Agent). Don't add a human gate unless there's a real reason a human needs to look at intermediate output before the next step should run — it adds real UI and workflow-state complexity.

## Step 2: define the JSON Schemas

Each step's `inputSchema`/`outputSchema` are plain JSON Schema files. These are not a formality — they're what the Node API validates incoming requests against, and what the frontend uses to render a generic submission form (see Step 6) with zero custom UI code. Keep them accurate; a vague `{"type": "object"}` schema means a worse auto-generated form.

## Step 3: implement the worker

Using the thin Python SDK from [`03-agent-sdk-contract.md`](03-agent-sdk-contract.md):

```python
# agents/your_agent_id/worker.py
from python.sdk.runner import run_agent
from python.sdk.agent_job import AgentJob

def run(job: AgentJob) -> dict:
    job.report_progress(0, "Starting...")
    # ... your actual logic here ...
    job.report_progress(100, "Done.")
    return {
        "status": "completed",
        "artifacts": [
            {"kind": "your_output_kind", "path": "/artifacts/.../output.bin", "mimeType": "application/octet-stream"}
        ],
        "error": None,
    }

if __name__ == "__main__":
    run_agent({"run": run}, queue_name="agent.your-agent-id")
```

This is the entire integration surface. Nothing here imports anything from `apps/api` or references BullMQ's Node client — the worker only ever talks to Redis via the Python port of BullMQ, using the wire contract from [`03-agent-sdk-contract.md`](03-agent-sdk-contract.md).

## Step 4: containerize and register the worker service

Add a `Dockerfile` (a shared base Python image with common deps is reasonable to factor out once a third agent exists, but isn't required for the second one). Then add exactly one service entry to `docker-compose.yml`:

```yaml
worker-your-agent-id:
  build: ./agents/your-agent-id
  depends_on: [redis, postgres]
  environment:
    - REDIS_URL=redis://redis:6379
```

This is the "one line in `docker-compose.yml`" referenced above — no changes to any other service.

## Step 5: registry auto-discovery

At API boot, the registry module scans `agents/*/manifest.json`, validates each against the manifest schema, and upserts a row into the `agents` table (see [`05-database-schema.md`](05-database-schema.md)). **This happens once at startup — Phase 1 has no live hot-reload.** Adding or changing an agent requires restarting the API process before it's picked up. This is a deliberate, honest scoping decision (see ADR-0006 in [`decisions/`](decisions/)): a file-watcher-driven hot-reload of a running registry is materially harder to get right (partial-write races, in-flight workflows against a manifest version that just changed underneath them) and isn't needed until agent authors are someone other than the platform operator restarting their own server.

## Step 6: the frontend needs zero custom code (usually)

Because the platform's frontend is driven entirely by each agent's manifest and JSON Schemas:

- The **job-submission form** is generated generically from the step's `inputSchema` — a schema with `type: "string"`, `type: "number"`, `enum`, etc. renders as the corresponding form control automatically.
- The **artifact viewer** is generic, dispatching on `mimeType`/`kind`: `video/mp4` renders a `<video>` player, `image/png` renders an `<img>`, `application/json` with `kind: "candidate_list"` renders as a checklist (this one specific renderer is the one piece of Video-Agent-shaped UI code that exists, since a ranked-candidate-selection view isn't a generic JSON viewer — everything else about Video Agent's UI is generic).

A new agent only needs custom frontend code if its input or output shape doesn't fit an existing generic renderer (e.g., a hypothetical future agent whose output needs a specialized viewer). Most agents — anything that takes simple typed inputs and produces a single downloadable file — need none.

## Step 7: testing checklist

Following the pattern in [`11-testing-strategy.md`](11-testing-strategy.md):

- [ ] Manifest validates against the manifest JSON Schema (a fast, dependency-free unit test).
- [ ] Each step's `inputSchema`/`outputSchema` are valid JSON Schema themselves.
- [ ] Worker handler unit tests using a stubbed `AgentJob` (no real Redis needed) — verify the result envelope shape and that `report_progress` is called sensibly.
- [ ] One slow, environment-flag-gated integration test that actually runs the worker end-to-end against a real (small) input, auto-skipping if its prerequisites (a model file, a GPU, an external service) aren't available — mirroring VSplitter's existing `test_pipeline_smoke.py` pattern.

## Worked example: Video Agent as the model instance

[`08-agent-video.md`](08-agent-video.md) is the fully worked-out application of every step above, for a real agent. If anything in this guide is ambiguous, that document resolves it concretely — including a case (`render` step's progress reporting) where the honest answer was "the current implementation doesn't support that yet," documented rather than glossed over.

# 02 — Architecture Overview

## System diagram

```text
                              ┌─────────────────────┐
                              │   React (Vite) UI    │
                              │  agent list, job      │
                              │  submit, progress,    │
                              │  artifact viewer       │
                              └──────────┬───────────┘
                                         │ HTTP + SSE
                                         ▼
                              ┌─────────────────────┐
                              │   Fastify API (Node)  │
                              │  ─────────────────    │
                              │  agent registry module │
                              │  workflow module        │
                              │  job/queue module         │
                              │  artifact module            │
                              └──────┬───────────┬─────┘
                                     │           │
                         ┌───────────┘           └───────────┐
                         ▼                                   ▼
                 ┌───────────────┐                   ┌───────────────┐
                 │   PostgreSQL   │                   │  Redis (BullMQ)│
                 │  (see doc 05)  │                   │  job queues    │
                 └───────────────┘                   └───────┬───────┘
                                                               │
                                     ┌─────────────────────────┴─────────────────────────┐
                                     ▼                                                     ▼
                          ┌─────────────────────┐                              ┌─────────────────────┐
                          │  worker-video (Py)    │                              │  worker-sketch (Py)   │
                          │  bullmq (python port)  │                              │  bullmq (python port)  │
                          │  runs VSplitter          │                              │  runs SD-Turbo diffusers│
                          │  pipeline.analyze() /     │                              │  pipeline                │
                          │  render_selected()          │                              │                            │
                          └──────────┬───────────────┘                              └──────────┬───────────────┘
                                     │                                                          │
                                     ▼                                                          ▼
                          ┌─────────────────────────────────────────────────────────────────────────┐
                          │                    Local filesystem artifact storage                       │
                          │           (shared volume: transcripts, clips, images, manifests)             │
                          └─────────────────────────────────────────────────────────────────────────┘

worker-video also reaches a host-installed Ollama server (targeted network
path — see doc 08 and doc 10) for LLM-based highlight re-ranking, exactly as
VSplitter does today.
```

**The load-bearing correction this diagram makes versus the original brainstorm:** agents are **separate Python worker processes** (one per agent type, each its own container), not functions executing inside the Node API process. Node never imports agent code or runs agent logic directly — it only ever enqueues a job and later reads back whatever the worker wrote to Postgres/the filesystem. This matters because every agent so far (and every agent likely to be added next — OCR, PDF summarization, voice cloning) is fundamentally a Python AI workload; forcing that into Node would mean either shelling out unsafely or reimplementing every agent's logic twice.

## Component responsibilities

| Component | Responsibility | Does NOT do |
|---|---|---|
| **React (Vite) frontend** | Render the agent registry, a generic job-submission form driven by each agent's `inputSchema`, a live progress view (via SSE), and a generic artifact viewer driven by `kind`/`mimeType`. | Contains no agent-specific UI code in the common case — see [`07-agent-implementation-guide.md`](07-agent-implementation-guide.md) for how a new agent gets a working UI for free. |
| **Fastify API — agent registry module** | Scans `agents/*/manifest.json` at boot, validates each manifest, upserts into the `agents` table. Serves `GET /agents`. | Does not execute agents. Does not hot-reload — a new/changed agent requires an API restart in Phase 1 (see ADR-0006 in [`decisions/`](decisions/)). |
| **Fastify API — workflow module** | Given an agent + input, instantiates a `workflow` and its `workflow_steps` from that agent's manifest `steps[]`. Handles the human-gate `advance` endpoint. | Does not support user-composed, cross-agent DAGs — each workflow follows one agent's own fixed step sequence (see [`04-workflow-and-job-execution.md`](04-workflow-and-job-execution.md) and ADR-0005). |
| **Fastify API — job/queue module** | Enqueues BullMQ jobs per workflow step, subscribes to BullMQ `QueueEvents` for progress/completion, relays progress to the frontend over SSE, writes `jobs`/`job_runs`/`events` rows. | Does not run any AI logic itself. |
| **Fastify API — artifact module** | Registers artifacts written by workers (path, kind, mime type, checksum) into the `artifacts`/`artifact_versions` tables, serves download endpoints. | Does not interpret artifact contents — a `video_clip` and an `image` are handled identically at this layer. |
| **PostgreSQL** | System of record for projects, workflows, jobs, artifacts, logs, events, settings. See [`05-database-schema.md`](05-database-schema.md). | Not used as the job queue itself — that's Redis/BullMQ's job. |
| **Redis / BullMQ** | Durable job queue with retries/backoff, and the source of truth for live job status while a job is in flight. | Not used as long-term storage — completed job history lives in Postgres. |
| **Python workers (`worker-video`, `worker-sketch`)** | One process per agent type. Consume jobs from their queue via the official Python port of BullMQ, run the actual agent logic, write artifacts to the shared filesystem volume, report progress via `job.updateProgress()`. | Never talk to the frontend directly, never write to Postgres directly — all state changes flow back through the API via BullMQ's job result/events (see [`03-agent-sdk-contract.md`](03-agent-sdk-contract.md)). |
| **Shared filesystem artifact volume** | Holds actual artifact bytes (transcripts, clips, generated images, manifests) that both the API (for serving downloads) and the workers (for writing output) can reach. | Phase 1 only — no S3/object storage yet (see [`10-deployment.md`](10-deployment.md) and roadmap). |

## Why one Fastify app, not three microservices

The original brainstorm described three separate services under the API: a Workflow Orchestrator, an Agent Registry, and (implicitly) a queue/job manager. For one developer running two agents on one machine, splitting these into three independently-deployed services buys nothing — it only adds three sets of infrastructure (three deploy targets, three sets of health checks, cross-service network calls where a function call would do) with no corresponding benefit, since there's no scaling or team-ownership boundary that requires the split yet.

Agentry Phase 1 collapses these into **one Fastify application with three internal modules** that mirror those same names and responsibilities (registry, workflow, job/queue — plus an artifact module the original brainstorm didn't separate out explicitly). Each module has a clean interface and doesn't reach into another's internals. This is a deliberate, reversible choice: if a real scaling or ownership boundary appears later (e.g., the registry needs to scale independently of the workflow engine), the module boundaries already drawn here make splitting it out later a refactor, not a rewrite. See ADR-0004 in [`decisions/`](decisions/) for the full reasoning.

## Per-agent data flow

### Video Agent (two-phase, human-in-the-loop)

1. User submits a source (file upload or YouTube URL) plus optional signal weights.
2. API creates a `workflow` with two `workflow_steps` (`analyze`, `render` — from Video Agent's manifest) and enqueues the `analyze` job.
3. `worker-video` picks up the job, runs VSplitter's `pipeline.analyze()` unmodified, translates its stage-string progress callback into percentages via a static lookup table, and reports progress.
4. On completion, the worker writes a `candidate_list` artifact (the ranked candidates with scores and transcript excerpts) and a `transcript` artifact, and the `analyze` step moves to `awaiting_review` — the workflow pauses here.
5. The user reviews ranked candidates in the UI and selects which to render, then calls the `advance` endpoint with their selection.
6. API enqueues the `render` job with the selected indices as input.
7. `worker-video` runs `pipeline.render_selected()` unmodified, writes `video_clip` artifacts (one per selected clip) and a `manifest` artifact, reports coarse progress (this step has no fine-grained progress hook today — see [`08-agent-video.md`](08-agent-video.md)).
8. Workflow completes; all artifacts are downloadable from the UI.

### Sketch Agent (one-phase, no human gate)

1. User submits a prompt (plus optional negative prompt, steps, seed, resolution).
2. API creates a `workflow` with one `workflow_step` (`generate`) and enqueues the job immediately — no human gate, since there's nothing to review before generation happens.
3. `worker-sketch` (with the diffusion pipeline already warm-loaded in memory, not reloaded per job — see [`09-agent-sketch.md`](09-agent-sketch.md)) generates the image, reporting coarse progress.
4. Worker writes a single `image` artifact.
5. Workflow completes.

The two flows differ structurally (two steps with a pause vs. one step with none), and the platform supports both through the same manifest-driven mechanism — no special-casing "Video" vs. "Sketch" anywhere in the orchestrator. That's the concrete test of the abstraction described in [`01-product-vision.md`](01-product-vision.md)'s success criteria.

# 04 — Workflow and Job Execution

## Entity model, in plain language

Four entities, each one level more granular than the last:

- A **workflow** is one run of one agent — "clip this video," "generate this image." It's created the moment a user submits a job and exists until that agent's full step sequence finishes, fails, or is cancelled.
- A **workflow_step** is one step in that agent's manifest-declared sequence, instantiated for this specific workflow. Video Agent's manifest declares two steps (`analyze`, `render`); every Video Agent workflow gets exactly those two `workflow_step` rows, in order. Sketch Agent's manifest declares one (`generate`); every Sketch Agent workflow gets exactly one.
- A **job** is the unit of work enqueued to BullMQ for one `workflow_step`. There's a 1:1 relationship between a `workflow_step` and its `job` in Phase 1 (no step is ever split across multiple jobs, and no job spans multiple steps).
- A **job_run** is one *attempt* at executing a job. Most jobs succeed on the first attempt and have exactly one `job_run` row. A job that fails and is retried (per BullMQ's `attempts`/backoff configuration) gets a new `job_run` row per attempt, so the full retry history is visible without losing earlier failure details.

This chain — workflow → workflow_step → job → job_run — is what [05-database-schema.md](05-database-schema.md) actually stores; this document exists to make the relationships and the reasoning behind them legible before looking at raw table definitions.

**Important scope note:** in Phase 1, a "workflow" is always *one agent's own* fixed step sequence — never a user-composed chain across multiple different agents. See ADR-0005 in [decisions/](decisions/) for why a general DAG/BPM-style workflow engine is explicitly not being built yet.

## Walkthrough 1: Video Agent (two-phase, human-in-the-loop)

This is the more complex of the two flows because it has a **human approval gate** between its two steps — the platform pauses and waits for the user, rather than running straight through.

1. **Submit.** User POSTs a source (file upload or YouTube URL) and optional signal weights to `POST /projects/:id/workflows` with `agentId: "video-agent"`.
2. **Instantiate.** API reads `video-agent`'s manifest, creates a `workflows` row (status `running`) and two `workflow_steps` rows (`analyze` status `pending`, `render` status `pending`), and enqueues a BullMQ job onto the `agent.video` queue for the `analyze` step only.
3. **Analyze runs.** `worker-video` picks up the job and calls VSplitter's existing `pipeline.analyze(source, progress_cb, weights)` completely unmodified. `pipeline.analyze`'s plain-string `progress_cb` callbacks (`"Transcribing (faster-whisper)..."`, `"LLM re-ranking shortlist (Ollama)..."`, etc.) are mapped through a static lookup table into percentages and forwarded via `job.report_progress(percent, message)` (see [08-agent-video.md](08-agent-video.md) for the actual table). The API relays these to the browser over SSE as they arrive.
4. **Analyze completes.** The worker's result envelope includes a `candidate_list` artifact (the ranked `Candidate`s — start/end/score/text — from VSplitter's `ranker.py`) and a `transcript` artifact. The API writes both to the `artifacts` table, marks the `analyze` `workflow_step` as `awaiting_review` (its manifest declares `humanGate: true`), and the **workflow itself pauses here** — no job is enqueued for `render` yet.
5. **Human review.** The frontend renders the `candidate_list` artifact as the same ranked checklist VSplitter's Gradio UI shows today (start/end/score/transcript excerpt). The user checks the clips they want.
6. **Advance.** User calls `POST /workflows/:id/steps/render/advance` with the selected candidate indices. The API validates this against `render`'s `inputSchema`, creates the `render` `job`, and enqueues it — with the `candidate_list` artifact and the selected indices as its `inputArtifactRefs`/`params`.
7. **Render runs.** `worker-video` calls VSplitter's existing `pipeline.render_selected(ctx, indices)`, again unmodified. **This step currently has no fine-grained progress callback in VSplitter's own code** — the wrapper can only report coarse progress (0% → 100% on completion), which is documented plainly rather than implying granularity that doesn't exist (see [08-agent-video.md](08-agent-video.md)).
8. **Render completes.** Result envelope includes one `video_clip` artifact per selected candidate plus a `manifest` artifact (mirroring VSplitter's own `manifest.json` output today). Both `workflow_steps` are now `completed`; the `workflow` itself moves to `completed`.
9. **Download.** All artifacts are available via `GET /artifacts/:id/download`.

## Walkthrough 2: Sketch Agent (one-phase, no human gate)

Structurally much simpler — there's nothing to review before generation happens, so there's no pause.

1. **Submit.** User POSTs a prompt (plus optional negative prompt, step count, seed, resolution) to `POST /projects/:id/workflows` with `agentId: "sketch-agent"`.
2. **Instantiate.** API creates a `workflows` row and a single `workflow_steps` row (`generate`, `humanGate: false`), and immediately enqueues the job — no waiting, since there's only one step and it's not gated.
3. **Generate runs.** `worker-sketch` (with its diffusion pipeline already resident in memory from a previous job — see [09-agent-sketch.md](09-agent-sketch.md) for why reloading per-job would be unacceptably slow) runs inference, reporting coarse progress (e.g., 0% at start, 100% on completion — diffusion step-level progress is a nice-to-have, not required for Phase 1).
4. **Generate completes.** Result envelope includes one `image` artifact.
5. **Workflow completes.** Image is downloadable immediately.

## Retry and failure semantics

Retries are handled by BullMQ's native `attempts`/backoff configuration, declared explicitly per-agent in its manifest (`attempts` and `backoff` fields — see [03-agent-sdk-contract.md](03-agent-sdk-contract.md)). This defaults to `attempts: 1` (no retry) if an agent's manifest omits it, since not every failure is safely retryable — an agent author has to opt in deliberately, not rely on a silent platform-wide default. Each attempt gets its own `job_runs` row, so:

- A job's **first** attempt failing due to a transient issue (e.g. Ollama momentarily unreachable) produces one `job_runs` row with `status: failed` and an `error`, followed by a **second** `job_runs` row for the retry — both remain visible in the job's history, rather than the failure being silently overwritten.
- If all configured attempts are exhausted, the `job` itself is marked `failed`, its parent `workflow_step` is marked `failed`, and the `workflow` moves to `failed` — it does not silently continue to the next step. (There is no meaningful "partial success" state for a fixed two-step sequence where `render` depends entirely on `analyze`'s output.)
- Every state transition — `job.active`, `job.progress`, `job.completed`, `job.failed` — is also written to the `events` table as an audit trail, independent of BullMQ's own in-flight state (which is transient/Redis-only). This is what a future UI "activity feed" would read from, and what satisfies the event-visibility need from the original brainstorm's "event bus" idea without standing up a separate message broker (see ADR-0007 in [decisions/](decisions/)).

## What this explicitly is not

A **workflow**, in Agentry Phase 1, is always one agent's own manifest-declared step sequence. It is not:
- A user-composable chain of *different* agents (e.g., "run OCR, then feed its output to Translation, then to PDF-summarization") — that's real future value, deferred until a second concrete use case actually demands it (see [14-roadmap.md](14-roadmap.md)).
- A general BPM/DAG engine with branching, conditionals, or parallel fan-out/fan-in — Video Agent's two steps are strictly sequential with one gate; Sketch Agent's one step has none. Nothing in Phase 1 needs more expressiveness than that, so nothing more is built.

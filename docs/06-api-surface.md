# 06 — API Surface

Roughly 20 endpoints — scoped to "enough to actually run both agents end to end through the UI," not the 100+ endpoint surface from the original brainstorm. Every endpoint here exists because a step in one of the two walkthroughs in [`04-workflow-and-job-execution.md`](04-workflow-and-job-execution.md) needs it; nothing speculative was added.

## Agents

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/agents` | List all registered agents (id, name, version, description) — drives the frontend's agent picker. |
| `GET` | `/agents/:id` | Full manifest for one agent, including per-step JSON Schemas — drives the frontend's generic job-submission form. |

## Projects

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/projects` | List the operator's projects. |
| `POST` | `/projects` | Create a project. |
| `GET` | `/projects/:id` | Project detail. |
| `PATCH` | `/projects/:id` | Rename/update a project. |
| `DELETE` | `/projects/:id` | Delete a project (and, per FK cascade, its workflows). |

## Workflows

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/projects/:id/workflows` | Start a new workflow: `{agentId, input}` — instantiates `workflow_steps` from that agent's manifest and enqueues the first step's job. |
| `GET` | `/workflows/:id` | Workflow status, its steps, and their current state. |
| `GET` | `/workflows/:id/steps` | Just the step list with per-step status (used for polling fallback if SSE drops). |
| `POST` | `/workflows/:id/steps/:stepKey/advance` | The human-gate action: submit the input needed to unblock a `awaiting_review` step (e.g. Video Agent's selected candidate indices) and enqueue its job. Returns `400` if the named step isn't currently `awaiting_review`. |
| `POST` | `/workflows/:id/cancel` | Best-effort cancellation — removes any not-yet-started queued job and marks the workflow `cancelled`; does not interrupt a job already mid-execution in Phase 1 (see note below). |

**On mid-execution cancellation:** this is a real, felt limitation given both agents are slow on CPU (a multi-minute Video Agent `analyze`, or even a 15-60s Sketch `generate`) — a user who cancels 10 seconds into a 3-minute job will still wait for it to finish. Phase 1 doesn't attempt to kill an in-progress Python worker process, since doing so safely (mid-write artifact cleanup, partial-state handling) is nontrivial and not worth building before real usage shows how often it's actually needed. The honest UX mitigation for now: the frontend should show cancellation as **"cancellation requested — will stop after the current step finishes"** rather than implying an immediate stop, and the workflow's status should reflect `cancelling` (queued-but-not-yet-started work removed) distinctly from `cancelled` (fully stopped) so the user isn't left wondering if their cancel click did anything.

## Jobs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/jobs/:id` | Job detail, including its `job_runs` history. |
| `GET` | `/jobs/:id/logs` | Structured log lines for the job's most recent run. |
| `GET` | `/jobs/:id/events` | **SSE stream** of progress/status events for this job — the frontend's live progress bar subscribes here. |

## Artifacts

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/workflows/:id/artifacts` | All artifacts produced so far by any step of this workflow. |
| `GET` | `/artifacts/:id` | Metadata for one artifact (kind, mime type, size, checksum). |
| `GET` | `/artifacts/:id/download` | Stream the actual bytes. |

## Settings

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/settings` | Effective settings (global, optionally merged with a project override via `?projectId=`). |
| `PUT` | `/settings` | Upsert a setting: `{scope, projectId?, agentId?, key, value}`. |

## Meta

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness/readiness — checks Postgres and Redis connectivity. |
| `GET` | `/version` | API + agent-registry version info, for debugging deployed state. |

## Worked examples

### Starting a Video Agent workflow

```http
POST /projects/2f1a.../workflows
Content-Type: application/json

{
  "agentId": "video-agent",
  "input": {
    "source": "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "weights": { "transcript": 0.5, "audio": 0.25, "visual": 0.25 }
  }
}
```

```http
201 Created
Content-Type: application/json

{
  "id": "wf_9c3e...",
  "agentId": "video-agent",
  "agentVersion": "1.0.0",
  "status": "running",
  "steps": [
    { "stepKey": "analyze", "sequence": 0, "status": "queued", "humanGate": true },
    { "stepKey": "render",  "sequence": 1, "status": "pending", "humanGate": false }
  ]
}
```

The client then opens `GET /jobs/:analyzeJobId/events` (SSE) to watch progress, and polls or waits for `GET /workflows/:id` to show `analyze` as `awaiting_review`.

### The human-gate advance call

Once `analyze` is `awaiting_review` and the frontend has rendered the ranked `candidate_list` artifact for the user to pick from:

```http
POST /workflows/wf_9c3e.../steps/render/advance
Content-Type: application/json

{
  "selectedIndices": [0, 2, 3]
}
```

```http
202 Accepted
Content-Type: application/json

{
  "stepKey": "render",
  "status": "queued",
  "jobId": "job_7b1d..."
}
```

This validates `{selectedIndices: [0, 2, 3]}` against `render`'s `inputSchema` (defined in Video Agent's manifest — see [`08-agent-video.md`](08-agent-video.md)), attaches the `analyze` step's `candidate_list` artifact as an `inputArtifactRef`, and enqueues the `render` job exactly as described in [`04-workflow-and-job-execution.md`](04-workflow-and-job-execution.md).

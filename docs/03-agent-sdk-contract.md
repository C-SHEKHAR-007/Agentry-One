# 03 — Agent SDK Contract

This is the single most important document in this repository. It defines the contract every agent implements — the thing that makes "drop in a new agent, don't touch the orchestrator" actually true.

## Correcting the original brainstorm's interface

The original brainstorm proposed a single TypeScript interface every agent implements:

```typescript
interface Agent {
    id: string;
    name: string;
    version: string;
    description: string;
    inputSchema: object;
    outputSchema: object;
    execute(input): Promise<Result>;
}
```

This is clean, but it assumes agents run as in-process TypeScript functions. They don't — every agent so far, and every plausible future agent (OCR, PDF summarization, voice cloning, translation), is fundamentally a Python AI workload, running in its own worker process. `execute(input): Promise<Result>` can't describe a function call across a process and language boundary; it needs to describe a **message passed over a queue** instead.

Agentry's contract splits this one interface into two things that together do the same job, correctly:

1. A **manifest contract** — a static, declarative description of the agent (what the TS interface's fields were trying to capture).
2. A **wire/runtime contract** — the actual message shape sent to and returned from the worker process over BullMQ.

The TypeScript `Agent` type still exists, but only as a **Zod validation/registry type at the API boundary** — it validates that a manifest is well-formed and lets the API type-check requests against an agent's schema. It is never the executor. That distinction is recorded as ADR-0001 in [`decisions/`](decisions/).

## Part 1: the manifest contract

Every agent is a directory under `agents/` containing a `manifest.json`. This is the single source of truth the registry reads at boot.

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
  "attempts": 3,
  "backoff": { "type": "exponential", "delayMs": 5000 }
}
```

Field reference:

| Field | Meaning |
|---|---|
| `id` | Stable identifier, used as the BullMQ queue name prefix and the primary key in the `agents` table. Never changes across versions. |
| `name` / `description` | Human-readable, shown in the UI's agent list. |
| `version` | Semver. A breaking change to any step's input/output schema requires a version bump (see Versioning below). |
| `entrypoint` | How the registry/worker bootstrap finds the code to run. `type: "python-worker"` today; the shape leaves room for a future `"container-image"` type without a breaking change. |
| `steps[]` | The agent's fixed sequence of steps (see [`04-workflow-and-job-execution.md`](04-workflow-and-job-execution.md) for why this is fixed-per-agent, not a user-composable DAG). Each step has its own input/output JSON Schema, a `humanGate` flag (does the workflow pause here for user review before the next step runs?), and the artifact `kind`s it's expected to produce. |
| `resources` | Declarative resource hints used to size the worker's container/process in [`10-deployment.md`](10-deployment.md). Not enforced by a scheduler in Phase 1 — informational, forward-compatible with real resource limits later. |
| `concurrency` | How many jobs this agent's worker processes at once. `1` for Sketch Agent (one diffusion pipeline instance, one job at a time); Video Agent may run higher once VRAM/CPU contention with Whisper+Ollama is characterized (see [`08-agent-video.md`](08-agent-video.md)). |
| `timeoutSec` | Hard ceiling before BullMQ marks the job failed and (depending on `attempts`) retries it. |
| `attempts` | Max BullMQ retry attempts for any job on this agent's queue, per manifest-declared step. Defaults to `1` (no retry) if omitted — an agent author must opt into retries explicitly, since not every failure mode is safely retryable (e.g. a `render` step that partially wrote files before failing). Each attempt gets its own `job_runs` row (see [`05-database-schema.md`](05-database-schema.md)). |
| `backoff` | BullMQ backoff strategy between retry attempts. `"exponential"` with a base `delayMs` is the sane default; only meaningful when `attempts` > 1. |

### Why JSON Schema, not TypeScript types, for input/output

JSON Schema is the only artifact in this contract that both sides — the Node API (validating requests, generating a form in the frontend) and the Python worker (validating what it receives) — can consume natively without a code-generation step or a hand-maintained parallel type definition. TypeScript types are a fine *view* onto a JSON Schema (Zod can both validate against and be derived from one), but the schema itself, not a `.ts` file, is the real contract.

## Part 2: the wire/runtime contract

This is what actually crosses the Node ↔ Redis ↔ Python boundary — the concrete replacement for `execute(input): Promise<Result>`.

**Job payload (Node enqueues, Python receives):**

```jsonc
{
  "jobId": "job_01hz...",
  "workflowId": "wf_01hz...",
  "stepKey": "analyze",
  "agentId": "video-agent",
  "agentVersion": "1.0.0",
  "params": { "source": "https://youtube.com/watch?v=...", "weights": { "transcript": 0.5, "audio": 0.25, "visual": 0.25 } },
  "inputArtifactRefs": []
}
```

`inputArtifactRefs` is how one step consumes another step's output — e.g. Video Agent's `render` step receives the `candidate_list` artifact produced by `analyze` (plus the user's selected indices, in `params`) as an input reference rather than the raw data being re-sent.

**Result envelope (Python returns, Node persists):**

```jsonc
{
  "status": "completed",
  "artifacts": [
    {
      "kind": "candidate_list",
      "path": "/artifacts/wf_01hz.../candidates.json",
      "mimeType": "application/json",
      "metadata": { "count": 8 }
    },
    {
      "kind": "transcript",
      "path": "/artifacts/wf_01hz.../transcript.json",
      "mimeType": "application/json",
      "metadata": {}
    }
  ],
  "metrics": { "durationSec": 143.2 },
  "error": null
}
```

On failure, `status` is `"failed"`, `artifacts` is empty, and `error` carries a machine-readable code plus a human-readable message — this is what populates the `job_runs.error` column described in [`05-database-schema.md`](05-database-schema.md).

**Progress**, reported continuously during execution (not just at the end): the Python worker calls `job.updateProgress(percent, message)` using the official Python port of BullMQ (`pip install bullmq` — see ADR-0003 for why this specific package, not a hand-rolled bridge). The Node API subscribes to BullMQ's `QueueEvents` for that queue and relays `progress` events to the browser over Server-Sent Events. This is also how VSplitter's existing plain-string `progress_cb` gets adapted — see [`08-agent-video.md`](08-agent-video.md) for the concrete stage-to-percentage mapping table.

## Minimal Python-side SDK

`python/sdk` is intentionally thin — a standardizing wrapper, not a framework an agent author has to learn deeply:

```python
# python/sdk/agent_job.py
class AgentJob:
    def __init__(self, raw_job):
        self.params = raw_job.data["params"]
        self.input_artifacts = raw_job.data["inputArtifactRefs"]
        self._raw = raw_job

    def report_progress(self, percent: int, message: str) -> None:
        self._raw.updateProgress({"percent": percent, "message": message})

# python/sdk/runner.py
def run_agent(step_handlers: dict[str, Callable[[AgentJob], AgentResult]], queue_name: str) -> None:
    """Starts a BullMQ worker loop on queue_name, dispatching each job to
    step_handlers[job.data["stepKey"]], and returning whatever that handler
    returns as the job's result (matching the result envelope above)."""
```

An agent author writes one handler function per step (`def analyze(job: AgentJob) -> AgentResult`, `def render(job: AgentJob) -> AgentResult`), each responsible for calling `report_progress` at meaningful points and returning the result envelope's `artifacts` list. Everything about queue connection, retries, and the job-loop itself is handled by `run_agent`. See [`07-agent-implementation-guide.md`](07-agent-implementation-guide.md) for the full worked steps.

## Versioning

`agents.version` is semver, stored per-row in the `agents` table (see [`05-database-schema.md`](05-database-schema.md)) alongside the agent's current manifest snapshot. A **breaking** change to any step's input or output JSON Schema requires a minor-or-major version bump; the registry keeps the previous version's manifest available so in-flight workflows started against it can still be read back correctly, even after the worker itself is upgraded. Phase 1 does not enforce this with tooling — it's a documented convention an agent author follows, not a CI gate (see [`14-roadmap.md`](14-roadmap.md) for when that might change).

## Explicit non-goals of this contract

- **No live plugin hot-reload.** A new or changed manifest is picked up at API boot only (see [`07-agent-implementation-guide.md`](07-agent-implementation-guide.md) and ADR-0006).
- **No cross-agent composition DSL.** An agent's `steps[]` describes *that agent's own* fixed sequence; there is no mechanism in this contract for one agent's output to automatically feed a *different* agent as input. That's real future value, deferred to [`14-roadmap.md`](14-roadmap.md) once a concrete use case needs it.
- **No schema-breaking-change enforcement.** Versioning discipline above is documented, not machine-enforced, in Phase 1.

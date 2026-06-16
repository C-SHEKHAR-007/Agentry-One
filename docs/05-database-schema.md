# 05 — Database Schema

Thirteen tables — right-sized for two real agents and a single-operator deployment, not the 30-50 table schema from the original brainstorm. Every table here is either used directly by the walkthroughs in [`04-workflow-and-job-execution.md`](04-workflow-and-job-execution.md), or exists to keep the schema forward-compatible with the roadmap without requiring a rewrite (e.g. `users` is minimal today but shaped to grow into multi-tenancy later).

## Table list

### `users`
Minimal in Phase 1 — effectively one row for the solo operator — but shaped so a future auth system (see [`14-roadmap.md`](14-roadmap.md)) can add rows without restructuring anything downstream that references `user_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `email` | text | |
| `created_at` | timestamptz | |

### `projects`
A workspace grouping for workflows — lets the same operator keep, say, "Weekly Shorts" and "Sketch experiments" visually separate without needing multi-tenancy to do it.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `users.id` | |
| `name` | text | |
| `created_at` | timestamptz | |

### `agents`
The registry's cache of every agent the API discovered by scanning `agents/*/manifest.json` at boot (see [`03-agent-sdk-contract.md`](03-agent-sdk-contract.md) and [`07-agent-implementation-guide.md`](07-agent-implementation-guide.md)).

| Column | Type | Notes |
|---|---|---|
| `id` | text, PK | matches manifest `id`, e.g. `"video-agent"` |
| `version` | text | current semver from manifest |
| `name` | text | |
| `description` | text | |
| `manifest` | jsonb | full manifest snapshot, so past workflows remain interpretable even after an upgrade |
| `status` | text | `active` / `disabled` |
| `discovered_at` | timestamptz | last boot-time scan that (re)found this agent |

### `workflows`
One row per submitted job run (one agent invocation).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `project_id` | uuid, FK → `projects.id` | |
| `agent_id` | text, FK → `agents.id` | |
| `agent_version` | text | pinned at creation time, even if the agent is later upgraded |
| `status` | text | `running` / `awaiting_review` / `cancelling` / `completed` / `failed` / `cancelled` — see [`06-api-surface.md`](06-api-surface.md) for why `cancelling` (requested, current step still finishing) is distinct from `cancelled` (fully stopped) |
| `input_params` | jsonb | the original submission payload |
| `created_at` / `updated_at` | timestamptz | |

### `workflow_steps`
Instantiated per-workflow from the agent's manifest `steps[]` at creation time.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `workflow_id` | uuid, FK → `workflows.id` | |
| `step_key` | text | e.g. `"analyze"`, `"render"`, `"generate"` |
| `sequence` | int | order within the workflow |
| `human_gate` | bool | copied from the manifest step at creation time |
| `status` | text | `pending` / `queued` / `running` / `awaiting_review` / `completed` / `failed` |
| `created_at` / `updated_at` | timestamptz | |

### `jobs`
One per `workflow_step` — the unit actually enqueued to BullMQ.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `workflow_step_id` | uuid, FK → `workflow_steps.id` | |
| `queue_job_id` | text | BullMQ's own job id, for cross-referencing Redis state while in flight |
| `params` | jsonb | the exact payload sent to the worker |
| `status` | text | mirrors `workflow_steps.status` for this job specifically |
| `created_at` | timestamptz | |

### `job_runs`
One row per **attempt** — matches BullMQ's native `attempts`/backoff model directly, so retry history is never overwritten (see [`04-workflow-and-job-execution.md`](04-workflow-and-job-execution.md)).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `job_id` | uuid, FK → `jobs.id` | |
| `attempt_number` | int | 1, 2, 3... |
| `status` | text | `running` / `completed` / `failed` |
| `progress_percent` | int | last reported value |
| `progress_message` | text | last reported message |
| `error` | jsonb | `{code, message}` — null unless `status = failed` |
| `started_at` / `finished_at` | timestamptz | |

### `artifacts`
Generic output row — deliberately not typed per-agent (no `video_clips` / `sketch_images` tables). This is the concrete shape the original brainstorm's "generic artifact" idea needed to actually be buildable (see ADR-0002).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `workflow_step_id` | uuid, FK → `workflow_steps.id` | which step produced it |
| `kind` | text | e.g. `"candidate_list"`, `"transcript"`, `"video_clip"`, `"manifest"`, `"image"` — see per-agent `producesArtifactKinds` in each manifest |
| `mime_type` | text | e.g. `"video/mp4"`, `"application/json"`, `"image/png"` |
| `storage_backend` | text | `"local_fs"` in Phase 1 (see [`10-deployment.md`](10-deployment.md); `"s3"` is roadmap) |
| `storage_key` | text | path/key within that backend |
| `size_bytes` | bigint | |
| `checksum` | text | sha256, for integrity/dedup checks |
| `is_primary_output` | bool | true for the artifact(s) a user actually downloads as "the result" (e.g. `video_clip`), false for intermediate ones consumed only by a later step (e.g. `candidate_list`) |
| `metadata` | jsonb | free-form, kind-specific (e.g. `{count: 8}` for a candidate list, `{width, height}` for an image) |
| `created_at` | timestamptz | |

### `artifact_versions`
Needed because regeneration is a real Phase-1 case: a user might re-run `render` with a different candidate selection, or re-run Sketch with a different seed on the same prompt. Rather than overwriting or creating an ambiguous second `artifacts` row, each logical artifact can have multiple versions.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `artifact_id` | uuid, FK → `artifacts.id` | the logical artifact this is a version of |
| `version_number` | int | |
| `storage_key` | text | this version's own storage location |
| `created_at` | timestamptz | |

### `prompts`
Versioned templates — both the Ollama highlight-re-rank prompt VSplitter already uses (see VSplitter's `src/highlight_scorer.py`) and Sketch Agent's prompt templates live here, so changing prompt wording is a data change, not a code deploy.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `agent_id` | text, FK → `agents.id` | |
| `key` | text | e.g. `"highlight_rerank"`, `"sketch_default_negative"` |
| `version` | int | |
| `template` | text | |
| `created_at` | timestamptz | |

### `logs`
Structured per-`job_run` log lines — the operator's primary debugging surface in Phase 1 (see [`13-observability-and-ops.md`](13-observability-and-ops.md)).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `job_run_id` | uuid, FK → `job_runs.id` | |
| `level` | text | `info` / `warn` / `error` |
| `message` | text | |
| `created_at` | timestamptz | |

### `events`
Audit trail mirroring BullMQ's lifecycle events (`job.created`, `job.active`, `job.progress`, `job.completed`, `job.failed`) — the durable, queryable counterpart to BullMQ's own transient in-Redis event stream, and what a future "activity feed" UI reads from. This is deliberately what satisfies the original brainstorm's "event bus" need in Phase 1, without standing up Kafka/NATS (see ADR-0007).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `workflow_id` | uuid, FK → `workflows.id`, nullable | |
| `job_id` | uuid, FK → `jobs.id`, nullable | |
| `type` | text | e.g. `"job.progress"`, `"workflow.completed"` |
| `payload` | jsonb | |
| `created_at` | timestamptz | |

### `settings`
Overridable tunables — e.g. Video Agent's signal weights (`transcript`/`audio`/`visual`), Whisper model size, Sketch's default step count — scoped globally or per-project, so operators change behavior through the UI/API instead of editing `config.py`-style constants in code (VSplitter's current approach).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `scope` | text | `"global"` or `"project"` |
| `project_id` | uuid, FK → `projects.id`, nullable | null when `scope = "global"` |
| `agent_id` | text, FK → `agents.id`, nullable | null for platform-wide settings |
| `key` | text | |
| `value` | jsonb | |

**Precedence rule:** for a given `(agent_id, key)`, a `scope: "project"` row overrides a `scope: "global"` row with the same `agent_id`/`key` when resolving effective settings for a workflow running in that project. If no project-scoped row exists, the global row applies; if neither exists, the agent's own manifest/code default applies (e.g. VSplitter's current `config.py` constants become the hardcoded fallback baked into the Video Agent worker, not a row that must always exist in this table). There is a natural uniqueness constraint implied here: at most one row per `(scope, project_id, agent_id, key)` combination — enforced at the application layer in Phase 1, not yet a DB-level constraint.

## ER relationship summary

```text
users 1──* projects 1──* workflows *──1 agents
                              │
                              1
                              │
                              *
                       workflow_steps
                              │
                    ┌─────────┴─────────┐
                    1                   1
                    │                   │
                    *                   *
                  jobs              artifacts ──* artifact_versions
                    │
                    1
                    │
                    *
                job_runs ──* logs

events references workflows/jobs loosely (nullable FKs, audit-only)
prompts references agents (template ownership)
settings references projects/agents optionally (scoping)
```

## What's deliberately not here

- **No `sessions` or `api_keys` table** — Phase 1's auth is a stub (see [`12-security-and-auth.md`](12-security-and-auth.md)); these arrive with real auth in the roadmap.
- **No per-agent-type tables** (`video_jobs`, `sketch_jobs`, etc.) — the entire point of the `agents`/`workflows`/`artifacts` generic model is that adding a third agent never means a schema migration for a new table, only new rows.
- **No workflow-graph/edge table** — since Phase-1 workflows are a fixed, manifest-declared sequence (`workflow_steps.sequence` is just an integer), there's no need for a graph structure. A DAG-capable schema is explicit future roadmap work, not a Phase-1 concern (see ADR-0005).

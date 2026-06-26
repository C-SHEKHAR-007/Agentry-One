# ADR-0008: Saved multi-step templates — supersedes ADR-0005's deferral

**Status: implemented** (`apps/api/src/modules/templates/`, tables `templates`/`template_steps`/`template_runs`/`template_run_steps`).

## Context

ADR-0005 deferred user-composable, cross-agent workflow composition until a real use case existed. The product direction then changed by explicit decision: the platform's target flow became "select a model, compose a multi-step workflow, run it — fully customizable from the UI," making saved, reusable templates a launch requirement rather than roadmap. ADR-0005 is kept as historical record; this ADR supersedes its deferral while preserving its structural insight.

## Decision

A **template** is a saved, ordered list of steps, each pinning one agent + agent **version** + one of its manifest steps, with a per-field `input_mapping` (literal / `fromRunInput` / `fromStep` artifact reference). Running a template creates one real, unmodified `workflows` execution per step, advanced sequentially by an orchestration module that listens for each workflow's completion. `workflows`/`workflow_steps` were not changed at all — exactly the "slots in above the existing model rather than replacing it" evolution ADR-0005's own consequences section predicted.

Key properties:

- **Ordered list, not a graph**: `fromStep` references are forward-only (any earlier step), so definitions are cycle-free by construction — no DAG engine, no cycle detection. Branching/conditionals/parallel fan-out remain deferred (roadmap).
- **One validator, three invocation points**: live in the builder UI, a **hard gate at save** (a mapping referencing an artifact `kind` the upstream step doesn't produce cannot persist), and a narrower **version-drift check at run** (`409` if a pinned agent version no longer matches the registry, since manifests only reload at boot per ADR-0006).
- **Snapshotting**: each template step stores the pinned version's `producesArtifactKinds` and `inputSchema`, so validation never depends on a live manifest that may have moved.

## Consequences

- With one registered agent, templates are multi-*step* (proven end-to-end: two independent Sketch generations per run); genuinely multi-*agent* chaining needs no engine changes once a second agent registers.
- A cancel on a template run stops progression after the in-flight step settles; an `awaiting_review` in an underlying workflow surfaces to the run level.
- Editing a template is a whole-document `PUT`, fully re-validated — no partial-mutation endpoints in Phase 1.

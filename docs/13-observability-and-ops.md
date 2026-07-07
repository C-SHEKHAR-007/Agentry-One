# 13 — Observability and Ops (Phase 1 stub)

## Phase-1 reality

There is no Prometheus/Grafana stack, no distributed tracing, and no alerting in Phase 1. Observability consists entirely of:

- **Structured logs** written to the `logs` table per `job_run` (see [05-database-schema.md](05-database-schema.md)) — the operator's primary debugging surface when a job fails.
- **The `events` table**, which durably records every BullMQ lifecycle transition (`job.active`, `job.progress`, `job.completed`, `job.failed`) as an audit trail independent of Redis's own transient in-flight state (see [04-workflow-and-job-execution.md](04-workflow-and-job-execution.md)) — this is what a future "activity feed" UI would read from, and it's already sufficient to answer "what happened to this workflow and when" without a separate observability stack.
- **`GET /health`**, a basic liveness/readiness check (Postgres + Redis connectivity), for the operator to confirm the stack is up.

## Why this is acceptable for now

A real monitoring/alerting stack pays off once there's unattended, always-on operation with more than one operator depending on uptime — neither is true in Phase 1, where the operator is running the platform themselves and would notice a failure by simply trying to use it. Standing up Prometheus/Grafana (or equivalent) before that point is infrastructure the project doesn't yet need, at the cost of time that could go toward proving the agent abstraction with a real second agent.

## What's deferred

See [14-roadmap.md](14-roadmap.md) — a real metrics/monitoring stack is ordered well after auth and after a few more agents exist, since its main value (catching problems across many concurrent jobs/users before anyone notices manually) doesn't materialize until the platform has meaningfully more load than one operator generates by hand.

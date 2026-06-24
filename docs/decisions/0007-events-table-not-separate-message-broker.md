# ADR-0007: BullMQ's own `QueueEvents` + an `events` table, not a separate message broker

## Context

The original brainstorm described an "Event Bus" as a distinct architectural component — every workflow step emitting events (`Generation Started`, `Prompt Enhanced`, `Image Generated`, etc.) to enable notifications, analytics, retries, and audit logs "without coupling everything together," implicitly suggesting infrastructure like Kafka or NATS.

## Decision

Phase 1 satisfies this need with two things that already exist for other reasons: BullMQ's native `QueueEvents` (for live progress relay from a worker to the Node API to the browser over SSE — see [`03-agent-sdk-contract.md`](../03-agent-sdk-contract.md)), and a durable `events` table (see [`05-database-schema.md`](../05-database-schema.md)) that records every job lifecycle transition as an audit trail independent of Redis's transient in-flight state. No separate message broker is introduced.

## Why

A real message broker earns its operational cost (another piece of infrastructure to run, monitor, and keep available) once there are **multiple independent consumers** of these events beyond "relay progress to the one browser tab that's watching." Phase 1 has exactly one consumer: the same API process that already has a live queue connection. Standing up Kafka/NATS now would be infrastructure built for a fan-out requirement that doesn't exist yet.

## Consequences

- The `events` table is what a future "activity feed" UI reads from, and what would need to be joined against by a future notifications service.
- If genuinely decoupled services with no shared Postgres access, or multiple independent consumers, become real (e.g. a separate analytics pipeline), a real broker becomes worth it — tracked as roadmap item 6 in [`14-roadmap.md`](../14-roadmap.md). Until then, this is a "postpone the infrastructure until a second consumer exists" decision, not a rejection of the original idea.

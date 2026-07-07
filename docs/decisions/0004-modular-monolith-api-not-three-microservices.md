# ADR-0004: One Fastify app with internal modules, not three microservices

## Context

The original brainstorm described the API layer as three separate services: a Workflow Orchestrator, an Agent Registry, and (implicitly) a job/queue manager, each presumably independently deployed.

## Decision

Phase 1 implements these as **three internal modules within one Fastify application** (plus a fourth, artifact handling, that the original brainstorm didn't separate out) — not three independently deployed services.

## Why

Splitting into separate services buys isolation and independent scalability at the cost of three deploy targets, three sets of health checks, and network calls where a function call would otherwise do — none of which has a payoff for one developer running two agents on one machine. There is no team-ownership boundary or differential scaling need that would justify the operational overhead today.

## Consequences

- Module boundaries (registry / workflow / job-queue / artifact) are still drawn cleanly in code, specifically so that splitting any one of them into its own deployable service later is a refactor along an existing seam, not a rewrite.
- All four modules share one Postgres connection pool and one process lifecycle in Phase 1.
- If a real scaling or ownership boundary appears later (e.g., the registry needing to scale independently), this decision should be revisited — but not before that need is concrete.

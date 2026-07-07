# 14 — Roadmap

Everything deliberately deferred from Phase 1, in the order it should actually be tackled, with the reasoning for that order. Nothing here is forgotten — it's sequenced.

## 1. Authentication and RBAC

**Why first:** almost every other deferred item (a plugin marketplace, shared projects, per-agent access control, real multi-tenant usage) implicitly assumes more than one user exists. Phase 1's single-operator assumption (see [12-security-and-auth.md](12-security-and-auth.md)) is the one thing that has to change before most of the rest of this list becomes relevant at all.

## 2. Cross-agent workflow composition (DAGs)

**Why here:** Phase 1's "workflow" is deliberately just one agent's own fixed step sequence (see [04-workflow-and-job-execution.md](04-workflow-and-job-execution.md) and ADR-0005) — there's no evidence yet that users want to chain, say, OCR's output into Translation's input. Building a general DAG/BPM engine before a second real chaining use case exists would be speculative complexity. Once a third or fourth agent exists and a genuine cross-agent use case shows up, this is the natural next structural addition — it slots in above the existing `workflow_steps` model rather than replacing it.

## 3. Plugin hot-reload

**Why here:** the manifest-scan-at-boot approach (see [07-agent-implementation-guide.md](07-agent-implementation-guide.md) and ADR-0006) is honest and sufficient as long as the platform operator and the agent author are the same person restarting their own server. It stops being sufficient once someone other than the operator is expected to add agents without operational access to restart the API process — at that point, live discovery (file-watcher-driven or an explicit "reload registry" endpoint) becomes worth the added complexity of handling in-flight workflows against a manifest that changes underneath them.

## 4. Additional agents

**Candidates, in no particular priority order:** OCR (document/image text extraction), PDF summarization, resume generation, voice cloning, translation. Each one is exactly the exercise [07-agent-implementation-guide.md](07-agent-implementation-guide.md) is written for — the roadmap value here isn't the specific agents listed, it's using each new one as a fresh test of whether the guide is still accurate and the abstraction still holds without orchestrator changes.

## 5. Schema expansion beyond 13 tables

**Why here, and why conditional:** the 13-table schema in [05-database-schema.md](05-database-schema.md) was sized for two agents and one operator. It should only grow when a real, encountered limitation demands it (e.g., a genuine need for fine-grained per-resource permissions once RBAC exists, or a workflow-graph/edge table once DAG composition is built) — not preemptively. Expanding it before that point risks recreating the original brainstorm's 30-50 table sprawl without the requirements to justify it.

## 6. Event bus beyond BullMQ's own `QueueEvents`

**Why here:** the `events` table plus BullMQ's native `QueueEvents` already covers Phase 1's actual need (an audit trail, and progress relay to the frontend — see ADR-0007). A real message broker (Kafka, NATS, etc.) becomes worth its operational cost once there are multiple independent consumers of job lifecycle events beyond "the API relays them to one browser tab" — e.g., a notifications service, an analytics pipeline, or genuinely decoupled services that don't share Postgres.

## 7. Object storage (S3/MinIO)

**Why here:** local-disk artifact storage (see [10-deployment.md](10-deployment.md)) is fine for a single machine. This becomes necessary once the artifact volume outgrows a single disk, or once the platform needs to run its API/workers across more than one machine and a shared local filesystem is no longer available to all of them. The storage interface is already designed to make this a new driver, not a rewrite.

## 8. Kubernetes / multi-machine deployment

**Why last among infra items:** Docker Compose on a single machine (see [10-deployment.md](10-deployment.md)) is sufficient until the platform's load genuinely exceeds what one machine can serve — which, for a personal/portfolio platform with two agents, is a distant concern. Standing up Kubernetes before that point adds operational overhead (manifests, ingress, secrets management, cluster maintenance) with no corresponding benefit yet.

## 9. CI/CD maturity

**Why here:** Phase 1's CI scope (lint + unit tests + typecheck — see [11-testing-strategy.md](11-testing-strategy.md)) is enough for a solo developer iterating locally. Deeper CI/CD (automated deployment pipelines, staged environments, canary releases) becomes worth building once there's a deployment target beyond "the operator's own machine" to actually roll out to.

## 10. Monitoring/observability stack

**Why last:** as covered in [13-observability-and-ops.md](13-observability-and-ops.md), the `logs`/`events` tables plus a health check endpoint are sufficient when the operator would notice a failure simply by using the platform. A real metrics/alerting stack (Prometheus/Grafana or equivalent) pays for itself once there's unattended operation and/or other people depending on uptime — ordered last because that condition is the furthest away from Phase 1's actual situation.

## 11. Schema/contract enforcement tooling

**Why here:** [03-agent-sdk-contract.md](03-agent-sdk-contract.md)'s versioning discipline (bump semver on a breaking schema change) is documented convention, not a CI-enforced gate, in Phase 1. Once there are multiple agent authors (see item 1 and item 3 above), automated compatibility checking between an agent's declared version and its actual schema becomes worth building — before that, it would be tooling built for a problem (multiple careless agent authors) that doesn't exist yet.

## 12. Automated artifact retention

**Why last:** Phase 1's policy is manual cleanup only (see [10-deployment.md](10-deployment.md)) — deliberately, since an automated deletion policy that's wrong is worse than no automation at all (silently losing an artifact the operator wanted), and there isn't yet real usage data on how much storage pressure actually builds up. This becomes worth building once either real disk-usage patterns are observed, or once there's more than one operator and manual cleanup no longer scales as a shared responsibility. A likely shape when it is built: a TTL/expiry field on `artifacts`, a scheduled cleanup job, and a storage-quota warning surfaced in the UI — but that shape should be informed by real usage, not designed speculatively now.

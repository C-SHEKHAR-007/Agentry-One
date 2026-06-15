# Agentry

An AI Agent Platform: a single system for running self-contained AI "Agents" behind one shared contract — an agent registry, BYOK provider/credential management, saved multi-step workflow templates, job queuing with live progress, and generic artifact storage — instead of building a new standalone app for every AI capability.

**Status: the platform is built and running**, with one real agent registered (Sketch Agent — local SD-Turbo image generation, swappable to a premium provider like Stability AI through the UI with zero code changes). Video Agent is designed (`docs/08-agent-video.md`) but intentionally not implemented — the existing [VSplitter](../VSplitter) project stays a separate, untouched standalone app for now.

> **Taking ownership of this project? Start with [`HANDOVER.md`](HANDOVER.md)** — the single as-built reference: architecture, full API reference, configuration, runbook, data model, known limitations, and verification status. The `docs/` tree is the design blueprint the build followed; [`docs/15-as-built-deltas.md`](docs/15-as-built-deltas.md) lists exactly where the implementation differs from it. Where they disagree, `HANDOVER.md` and the code win.

## Running it

Local development (what the repo is set up for on this machine):

```bash
# infra: postgres container (host port 5433; 5432 is taken by a native instance)
docker compose up -d postgres
# a native redis on localhost:6379 is assumed (or uncomment/adapt compose)

# api (port 4000; 3000 is taken on this machine)
cd apps/api && npm install && npx prisma migrate deploy && npx tsx src/server.ts

# sketch worker
cd agents/sketch && python3 -m venv .venv && source .venv/bin/activate \
  && pip install -r requirements.txt && cd ../.. \
  && REDIS_URL=redis://localhost:6379 ARTIFACTS_DIR=$PWD/artifacts python agents/sketch/worker.py

# web (port 5173)
cd apps/web && npm install && npx vite
```

Fully containerized alternative: `docker compose up -d --build` (stop the local tsx/vite/worker processes first — same ports). Set `AGENTRY_CREDENTIALS_KEY` (`openssl rand -base64 32`) and `AGENTRY_API_KEY` in a root `.env` (see `.env.example`) either way. Every API request needs the `X-API-Key` header.

Tests: `cd apps/api && npx vitest run` (pure logic, no infra needed) and `python -m pytest agents/sketch/tests/` (auto-skips unless the SD-Turbo model is cached).

## Adding a new agent

Drop a directory under `agents/<id>/` with a `manifest.json`, JSON Schemas, and a worker built on `python/sdk` — then restart the API. The registry, submission forms, template builder, and artifact viewers pick it up with no platform code changes. Full guide: [`docs/07-agent-implementation-guide.md`](docs/07-agent-implementation-guide.md).

## Reading order

If you're picking this up cold: read [`HANDOVER.md`](HANDOVER.md) first (the as-built system), then the design blueprint in this order:

1. [`01-product-vision.md`](docs/01-product-vision.md) — what Agentry is and isn't, why a platform instead of an app
2. [`02-architecture-overview.md`](docs/02-architecture-overview.md) — the system end to end
3. [`03-agent-sdk-contract.md`](docs/03-agent-sdk-contract.md) — the core abstraction every agent implements
4. [`04-workflow-and-job-execution.md`](docs/04-workflow-and-job-execution.md) — how a job actually runs, start to finish
5. [`05-database-schema.md`](docs/05-database-schema.md) — the data model
6. [`06-api-surface.md`](docs/06-api-surface.md) — the HTTP contract
7. [`07-agent-implementation-guide.md`](docs/07-agent-implementation-guide.md) — how to add a new agent (the core value proposition of the platform)
8. [`08-agent-video.md`](docs/08-agent-video.md) / [`09-agent-sketch.md`](docs/09-agent-sketch.md) — the two concrete agents designed in depth
9. [`10-deployment.md`](docs/10-deployment.md), [`11-testing-strategy.md`](docs/11-testing-strategy.md) — how it runs and how it's tested
10. [`12-security-and-auth.md`](docs/12-security-and-auth.md), [`13-observability-and-ops.md`](docs/13-observability-and-ops.md) — short stubs describing Phase-1 reality, pointing to the roadmap
11. [`14-roadmap.md`](docs/14-roadmap.md) — everything deferred, in order, with rationale
12. [`decisions/`](docs/decisions/) — a short ADR log recording where and why this design deviates from the original brainstorm

## Full document index

| Doc | Covers |
|---|---|
| [HANDOVER.md](HANDOVER.md) | **As-built reference: architecture, API, config, runbook, limitations** |
| [01-product-vision.md](docs/01-product-vision.md) | Vision, scope, non-goals, success criteria |
| [02-architecture-overview.md](docs/02-architecture-overview.md) | System diagram, component responsibilities, data flow |
| [03-agent-sdk-contract.md](docs/03-agent-sdk-contract.md) | Manifest contract, wire protocol, Python SDK, versioning |
| [04-workflow-and-job-execution.md](docs/04-workflow-and-job-execution.md) | Entity model, Video Agent + Sketch Agent walkthroughs, retries |
| [05-database-schema.md](docs/05-database-schema.md) | 13-table Postgres schema, ER relationships |
| [06-api-surface.md](docs/06-api-surface.md) | ~20 REST endpoints, request/response examples |
| [07-agent-implementation-guide.md](docs/07-agent-implementation-guide.md) | Step-by-step guide to adding a new agent |
| [08-agent-video.md](docs/08-agent-video.md) | Video Agent wrapper spec around VSplitter |
| [09-agent-sketch.md](docs/09-agent-sketch.md) | Sketch Agent design (local CPU image generation) |
| [10-deployment.md](docs/10-deployment.md) | Docker Compose topology, volumes, networking |
| [11-testing-strategy.md](docs/11-testing-strategy.md) | Test approach per layer |
| [12-security-and-auth.md](docs/12-security-and-auth.md) | Phase-1 auth reality (stub) |
| [13-observability-and-ops.md](docs/13-observability-and-ops.md) | Phase-1 observability reality (stub) |
| [14-roadmap.md](docs/14-roadmap.md) | Deferred work, ordered, with rationale |
| [15-as-built-deltas.md](docs/15-as-built-deltas.md) | Where the implementation differs from the blueprint |
| [decisions/](docs/decisions/) | ADR log (0001-0009; 0008/0009 cover templates + BYOK providers) |

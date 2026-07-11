# Agentry One

An AI Agent Platform: a single system for running self-contained AI "Agents" behind one shared contract — an agent registry, BYOK provider/credential management, saved multi-step workflow templates, job queuing with live progress, and generic artifact storage — instead of building a new standalone app for every AI capability.

**Status: the platform is built and running**, with one real agent registered (Sketch Agent — local SD-Turbo image generation, swappable to a premium provider like Stability AI through the UI with zero code changes). Video Agent is designed (`docs/08-agent-video.md`) but intentionally not implemented — the existing [VSplitter](../VSplitter) project stays a separate, untouched standalone app for now.

> **Taking ownership of this project? Start with [docs/00-handover.md](docs/00-handover.md)** — the single as-built reference: architecture, full API reference, configuration, runbook, data model, known limitations, and verification status. The `docs/` tree is the design blueprint the build followed; [docs/15-as-built-deltas.md](docs/15-as-built-deltas.md) lists exactly where the implementation differs from it. Where they disagree, `00-handover.md` and the code win.

## Running it

### Start Application & Workers in Background (without Docker)

If you have external Postgres and Redis running and want to run Agentry One in the background without blocking your terminal:

```bash
# 1. Start API & Web UI dev servers in the background
nohup npm run dev > /tmp/agentry-dev.log 2>&1 &

# 2. Start Agent Workers in the background
nohup python agents/sketch/worker.py > /tmp/sketch-worker.log 2>&1 &
nohup python agents/echo-agent/worker.py > /tmp/echo-worker.log 2>&1 &
```

* **Web UI:** http://localhost:5173
* **API Server:** http://localhost:4000
* **Logs:** Check `/tmp/agentry-dev.log`, `/tmp/sketch-worker.log`, `/tmp/echo-worker.log`

To cleanly stop all background servers and workers:

```bash
pkill -f "apps/api/src/server.ts" && pkill -f "vite" && pkill -f "worker.py"
```

### Foreground Local Development

```bash
# api (port 4000)
cd apps/api && npm install && npx prisma migrate deploy && npx tsx src/server.ts

# sketch worker
cd agents/sketch && python3 -m venv .venv && source .venv/bin/activate \
  && pip install -r requirements.txt && cd ../.. \
  && REDIS_URL=redis://localhost:6379 ARTIFACTS_DIR=$PWD/artifacts python agents/sketch/worker.py

# web (port 5173)
cd apps/web && npm install && npx vite
```

### Docker Compose

You can run the API, Web UI, and Sketch Worker via Docker Compose:

```bash
docker compose up -d --build
```

`docker-compose.yml` connects to your external Postgres and Redis instances. You can configure the connection URLs in your `.env` file or shell environment:
* `DATABASE_URL` (default: `postgresql://agentry:agentry_dev@host.docker.internal:5432/agentry`)
* `REDIS_URL` (default: `redis://host.docker.internal:6379`)
* `OLLAMA_HOST` (default: `http://ollama-host:11434`)

Tests: `cd apps/api && npx vitest run` (pure logic, no infra needed) and `python -m pytest agents/sketch/tests/`.

## Adding a new agent

Drop a directory under `agents/<id>/` with a `manifest.json`, JSON Schemas, and a worker built on `python/sdk` — then restart the API. The registry, submission forms, template builder, and artifact viewers pick it up with no platform code changes. Full guide: [docs/07-agent-implementation-guide.md](docs/07-agent-implementation-guide.md).

## Reading order

If you're picking this up cold: read [00-handover.md](docs/00-handover.md) first (the as-built system), then the design blueprint in this order:

1. [01-product-vision.md](docs/01-product-vision.md) — what Agentry is and isn't, why a platform instead of an app
2. [02-architecture-overview.md](docs/02-architecture-overview.md) — the system end to end
3. [03-agent-sdk-contract.md](docs/03-agent-sdk-contract.md) — the core abstraction every agent implements
4. [04-workflow-and-job-execution.md](docs/04-workflow-and-job-execution.md) — how a job actually runs, start to finish
5. [05-database-schema.md](docs/05-database-schema.md) — the data model
6. [06-api-surface.md](docs/06-api-surface.md) — the HTTP contract
7. [07-agent-implementation-guide.md](docs/07-agent-implementation-guide.md) — how to add a new agent (the core value proposition of the platform)
8. [08-agent-video.md](docs/08-agent-video.md) / [09-agent-sketch.md](docs/09-agent-sketch.md) — the two concrete agents designed in depth
9. [10-deployment.md](docs/10-deployment.md), [11-testing-strategy.md](docs/11-testing-strategy.md) — how it runs and how it's tested
10. [12-security-and-auth.md](docs/12-security-and-auth.md), [13-observability-and-ops.md](docs/13-observability-and-ops.md) — short stubs describing Phase-1 reality, pointing to the roadmap
11. [14-roadmap.md](docs/14-roadmap.md) — everything deferred, in order, with rationale
12. [decisions/](docs/decisions/) — a short ADR log recording where and why this design deviates from the original brainstorm

## Full document index

| Doc | Covers |
|---|---|
| [00-handover.md](docs/00-handover.md) | **As-built reference: architecture, API, config, runbook, limitations** |
| [16-step-by-step-user-guide.md](docs/16-step-by-step-user-guide.md) | **End-User Step-by-Step Guide: complete usage walkthrough** |
| [README.md](docs/README.md) | **Documentation Index & Table of Contents** |
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

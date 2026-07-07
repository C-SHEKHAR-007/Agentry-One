# 10 — Deployment

Phase 1 deployment target is **a single machine, via Docker Compose** — the same tool VSplitter already uses successfully. No Kubernetes, no multi-machine orchestration (see [14-roadmap.md](14-roadmap.md) for when that might become relevant).

## Service list

```yaml
services:
  postgres:
    image: postgres:16
    volumes: [postgres_data:/var/lib/postgresql/data]
    environment: [POSTGRES_DB=agentry, POSTGRES_USER=agentry, POSTGRES_PASSWORD=...]

  redis:
    image: redis:7

  api:
    build: ./apps/api
    depends_on: [postgres, redis]
    ports: ["3000:3000"]
    volumes: [artifact_storage:/artifacts]
    environment:
      - DATABASE_URL=postgres://agentry:...@postgres:5432/agentry
      - REDIS_URL=redis://redis:6379

  web:
    build: ./apps/web
    depends_on: [api]
    ports: ["5173:80"]   # built static assets served behind a lightweight web server

  worker-video:
    build: ./agents/video
    depends_on: [redis, postgres]
    volumes:
      - artifact_storage:/artifacts
      - huggingface_cache:/root/.cache/huggingface
      - vsplitter_cache:/root/.cache/vsplitter   # MediaPipe face model, same cache pattern as VSplitter itself
    environment:
      - REDIS_URL=redis://redis:6379
      - OLLAMA_HOST=http://ollama-host:11434   # see networking note below

  worker-sketch:
    build: ./agents/sketch
    depends_on: [redis, postgres]
    volumes:
      - artifact_storage:/artifacts
      - sketch_model_cache:/root/.cache/huggingface   # SD-Turbo weights, loaded once and reused across restarts
    environment:
      - REDIS_URL=redis://redis:6379

volumes:
  postgres_data:
  artifact_storage:
  huggingface_cache:
  vsplitter_cache:
  sketch_model_cache:
```

## Networking: a targeted correction to VSplitter's own shortcut

VSplitter's existing `docker-compose.yml` uses `network_mode: host` for its one and only service, specifically so it can reach a host-installed Ollama at `localhost:11434` with zero extra configuration. That was a reasonable shortcut for a single-service app, but it's the wrong default for a multi-service stack — `network_mode: host` would put every Agentry service (Postgres, Redis, the API, both workers) directly on the host's network namespace, discarding the isolation and service-name DNS that normal Docker Compose bridge networking provides for no benefit to most of those services.

**Only `worker-video` actually needs to reach Ollama.** The targeted fix: add `extra_hosts: ["ollama-host:host-gateway"]` to just that one service (Docker Compose's standard mechanism for letting one container reach the host without full host networking) and point `OLLAMA_HOST` at that hostname. Every other service uses normal bridge networking and reaches its peers by service name (`postgres`, `redis`, `api`) exactly as Compose intends.

## Volumes

- `postgres_data` — database files.
- `artifact_storage` — shared between `api` (serves downloads) and both workers (write outputs). Local disk only in Phase 1; see below.
- `huggingface_cache` / `vsplitter_cache` — reused verbatim from VSplitter's own proven pattern, avoiding re-downloading the Whisper model and MediaPipe face-detector model on every container rebuild.
- `sketch_model_cache` — the equivalent pattern for Sketch Agent's SD-Turbo weights.

## Storage backend

Phase 1 uses **local filesystem storage only** for artifacts (`storage_backend: "local_fs"` in the `artifacts` table, see [05-database-schema.md](05-database-schema.md)). The storage layer is accessed through one internal interface (conceptually, `packages/storage` in the eventual application code) specifically so that adding an S3/MinIO-backed driver later is a new implementation of that interface, not a rewrite of every place that reads or writes an artifact. Object storage itself is explicit roadmap work (see [14-roadmap.md](14-roadmap.md)) — not needed until either the artifact volume outgrows a single disk or the platform needs to run across more than one machine.

## Artifact retention

Nothing in Phase 1 ever deletes an artifact automatically. Video clips and generated images accumulate in `artifact_storage` indefinitely — for a solo operator running both agents personally, this is a real, foreseeable disk-usage problem, not a hypothetical one, so it's worth a plain policy statement rather than silence:

- **Phase 1 policy: manual cleanup only.** The operator is responsible for periodically deleting old workflows/artifacts they no longer need (a `DELETE /workflows/:id` cascading to its artifacts, or a manual `docker exec` cleanup of the volume, is enough for one person).
- **What's deliberately not built yet:** no TTL/expiry field on `artifacts`, no scheduled cleanup job, no storage-quota enforcement or warning. Automated retention is real future work (see [14-roadmap.md](14-roadmap.md)) — it's excluded from Phase 1 specifically because it's easy to get wrong in a way that's much worse than doing nothing (silently deleting an artifact the operator actually wanted), and there's no evidence yet of how much cleanup pressure real usage actually creates.
- If disk usage becomes a problem before automated retention is built, the immediate manual mitigation is deleting old `output/<job>/` -equivalent directories directly, the same way VSplitter's own `output/` folder is managed today.

## What's not here

No Kubernetes manifests, no autoscaling, no multi-machine service discovery, no managed-database migration path (RDS/Cloud SQL) — all explicit roadmap items, deferred until there's an actual scaling need past a single operator on a single machine.

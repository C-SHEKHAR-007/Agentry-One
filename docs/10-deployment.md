# 10 — Deployment

Target: **a single machine, via Docker Compose** (`docker-compose.yml`). Kubernetes and multi-machine setups are roadmap items ([14-roadmap.md](14-roadmap.md)).

## Services

| Service | Image | Role | Published |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | Database (volume `pgdata`) | no |
| `redis` | `redis:7-alpine` | Queues; `requirepass` auth + AOF persistence (volume `redisdata`) | no |
| `migrate` | `apps/api` target `migrate` | One-shot `prisma migrate deploy`; the API starts only after it succeeds | no |
| `api` | `apps/api` target `runtime` | Compiled Fastify API, non-root, `tini` as PID 1, Docker `HEALTHCHECK` on `/health` | no (internal `api:4000`) |
| `worker` | `agents/Dockerfile` | Worker supervisor running every agent under `agents/`, non-root, `tini` | no |
| `web` | `apps/web` | Unprivileged nginx serving the SPA and proxying `/api/` to the API, with CSP and security headers | `${WEB_PORT:-8080}` |

All services share a private bridge network; only the web port is published. Startup is ordered by health: postgres → migrate → api → worker/web. Every long-running service has `restart: unless-stopped`.

## First run

```bash
cp .env.example .env
# required: POSTGRES_PASSWORD, REDIS_PASSWORD, AGENTRY_API_KEY (16+ chars),
#           AGENTRY_CREDENTIALS_KEY (openssl rand -base64 32)
docker compose up -d --build --wait
open http://localhost:8080        # first visit runs the owner setup
```

Compose refuses to start if a required secret is missing, and the API refuses to boot with invalid configuration (`apps/api/src/config.ts`).

## Storage

- `STORAGE_PROVIDER=local` (default): artifacts live in the shared `artifacts` volume, mounted at `/artifacts` in both `api` and `worker` (both run as uid 1000).
- `STORAGE_PROVIDER=azure`: set `AZURE_STORAGE_CONNECTION_STRING` and a **dedicated** `AZURE_STORAGE_CONTAINER` (default `agentry-artifacts`). Don't share a container with other applications.
- `./agents` is bind-mounted read-write into the API (Agent Studio scaffolds new agents there) and read-only into the worker (the supervisor starts new agents within ~5s).

## Local image generation

The worker image ships without PyTorch. Either configure a hosted image provider (e.g. Stability AI), or build with the local SD-Turbo stack (~2 GB):

```bash
INSTALL_LOCAL_SD=true docker compose build worker
```

Model weights download on first use into the `hf-cache` volume. Without either, the sketch agent fails with a clear error, unless `SKETCH_ALLOW_PLACEHOLDER=true` (development only), which produces placeholder images.

## Behind a TLS proxy

Terminate TLS in front of `web`. Keep `NODE_ENV=production`, so session cookies are `Secure`, and set `FRONTEND_URL` / `GOOGLE_REDIRECT_URI` to the public HTTPS origin. The API trusts `X-Forwarded-For` from loopback and private networks (`TRUST_PROXY`), so per-IP rate limits see real client addresses. `COOKIE_SECURE=false` exists only to test a production build over plain HTTP.

## Shutdown and upgrades

`docker compose up -d --build` rebuilds and replaces containers.
- **API:** SIGTERM drains HTTP, the scheduler and queue connections within 25s.
- **Worker:** the supervisor gives in-flight jobs `SUPERVISOR_STOP_TIMEOUT_SEC` (120s) to finish. `stop_grace_period: 150s` covers that window, so jobs aren't killed and re-run as stalled.
- **Migrations:** these run in the `migrate` service before the new API starts.

## Backups

- Back up Postgres with `docker compose exec postgres pg_dump -U agentry agentry`.
- Back up the `artifacts` volume, or your blob container.
- Keep `AGENTRY_CREDENTIALS_KEY` separately. Without it, stored provider keys and social tokens can't be decrypted.
- Redis holds queue state only; its AOF file lets queued jobs survive a restart.

## Retention

Artifacts are never deleted automatically. Delete projects to cascade their rows, and prune the volume or container by hand. Retention automation is a roadmap item.

## Moving from the old host-networked compose

The previous `docker-compose.yml` used host networking against an external Postgres and Redis. The new stack has its own database. To keep existing data, dump it and restore it into the new `postgres` service:

```bash
pg_dump "$OLD_DATABASE_URL" > agentry.sql
docker compose up -d postgres
docker compose exec -T postgres psql -U agentry agentry < agentry.sql
docker compose up -d --build
```

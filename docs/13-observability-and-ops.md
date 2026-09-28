# 13 — Observability and Ops

## Health

- `GET /health` (no auth) reports DB and Redis connectivity, and returns 503 when either is down. It fails fast: the Redis probe doesn't queue commands while disconnected. The Docker `HEALTHCHECK` uses it.
- `web` serves `GET /healthz`.
- Compose orders startup on these checks.

## Metrics — `GET /metrics` (Prometheus text format, admin only; send `X-API-Key`)

| Metric | Meaning |
|---|---|
| `agentry_http_request_duration_seconds{method,route,status}` | Request latency histogram, labelled by route pattern (bounded cardinality) |
| `agentry_queue_jobs{queue,state}` | BullMQ jobs per queue and state (waiting/active/delayed/failed/prioritized), sampled on scrape |
| `agentry_jobs_finished_total{queue,outcome}` | Jobs reaching completed/failed |
| `agentry_process_*`, `agentry_nodejs_*` | Default process metrics (CPU, memory, event-loop lag, GC) |

Suggested alerts:
- `agentry_queue_jobs{state="waiting"}` stays above 0 while `active` is 0: that queue's worker is down.
- A rising `failed` rate.
- The `/health` probe failing.

## Logs

- **API:** pino JSON on stdout. `LOG_LEVEL` controls verbosity. The `key`, `code`, `state` and token query parameters are redacted from request URLs, and 500 responses never include internal error details (they are logged instead).
- **Workers:** JSON lines on stdout (`python/sdk/log.py`) with `agent`, `job_id`, `workflow_id`, `step` and `duration_ms`. Set `LOG_FORMAT=text` for plain text. The supervisor logs worker starts, exits and backoff.
- **Job history:** the `job_runs`, `events` and `notifications` tables, plus `GET /workflows/:id/events`.

## Reliability mechanisms

- **Stale workflows:** a timer (`REAPER_INTERVAL_MS`, default 2 min) marks workflows with no activity and no live queue job as failed.
- **Job limits:** `timeoutSec` and `concurrency` from each manifest are enforced by the worker runner, and ffmpeg has its own timeout.
- **Crashing workers:** the supervisor restarts them with exponential backoff (5s up to 5 min).
- **At-most-once publishing:** social posts are guarded by a Redis marker (`python/sdk/idempotency.py`), so a stalled-job re-run can't post twice.
- **Schedules:** BullMQ job schedulers. A deleted or inactive schedule never runs.

## Not yet in place

- Distributed tracing and an error tracker (e.g. OpenTelemetry, Sentry).
- Log shipping and a dashboard.
- Artifact retention automation.

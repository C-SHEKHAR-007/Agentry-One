# 12 — Security and Auth

This describes the security model as built. Code references are to `apps/api/src` unless noted.

## Principals

| Principal | How it authenticates | Access |
|---|---|---|
| **Owner** (user, role `owner`) | Session cookie (`agentry_session`, httpOnly, SameSite=Lax, `Secure` in production) from email+password or Google login | Everything (admin) |
| **Member** (user, role `member`) | Same | Their own projects and everything under them; read-only on global configuration |
| **API key** (`AGENTRY_API_KEY`, `X-API-Key` header) | Constant-time compared (`auth/apiKey.ts`) | Admin. Used by workers, scripts and CI — treat it as a root credential |

First-run setup (`POST /auth/setup`) creates the first owner and is serialized with a Postgres advisory lock.

## Tenant isolation (`auth/access.ts`)

Every tenant-owned row hangs off a **Project**, and a project belongs to one user. Every route that reads or changes a project, workflow, job, artifact, template, template run, schedule or social account calls `authorize(req, reply, kind, id)`, which resolves the owning project and checks it. List endpoints filter with `projectWhere` / `viaProject`. A resource that exists but belongs to someone else returns **404**, the same as a missing one, so ids can't be probed.

Global configuration — AI providers, agents (including Agent Studio scaffolding, which generates code), global settings, cost/system stats — is readable by any signed-in user but writable only by admins (`adminForWrites`, `requireAdmin`).

## Secrets

- Provider keys and social tokens are stored AES-256-GCM encrypted (`AGENTRY_CREDENTIALS_KEY`). No endpoint ever returns them; the UI treats saved keys as write-only.
- **Secrets never enter Redis.** Queue payloads carry `hasApiKey` / `hasAccessToken` flags only. At run time the worker SDK (`python/sdk/agent_job.py`) fetches them from `GET /internal/jobs/:id/secrets`, which requires the API key and only answers while the job is live (410 afterwards). Workers therefore need `AGENTRY_API_KEY` and `AGENTRY_API_URL`.
- Request logs redact `key`, `code`, `state` and token query parameters.

## OAuth

Google login and social-account connect flows use a signed (HMAC), expiring `state`; Google login is additionally bound to the browser with a nonce cookie and requires a verified email. Redirect targets are computed server-side, never taken from the request. Simulated ("dev mock") logins exist only with `AGENTRY_DEV_MOCKS=true` outside production, and the API refuses to boot with that flag in production.

## Untrusted input from jobs

Job parameters are user-controlled, so workers treat them as data:

- Files are only read when they resolve inside `ARTIFACTS_DIR` (`python/sdk/artifact_io.py:local_artifact_path`); the API applies the same rule before serving a download (`modules/artifacts/storage.ts`).
- Outbound requests to user-supplied URLs are SSRF-guarded: provider `baseUrl` (`http/ssrf.ts` — link-local/metadata always blocked, private ranges only for `PROVIDER_PRIVATE_HOSTS`, no redirects) and connector media URLs (`python/sdk/net_safety.py`).
- Workflow input is validated against the agent step's JSON Schema before anything is queued (422 otherwise).
- Artifact downloads send `X-Content-Type-Options: nosniff`, a sandboxing CSP, and force `attachment` for types that could run script (HTML, SVG).

## Hardening in place

Per-IP rate limiting on login, setup, profile and Google callback routes; constant-work login (no email-existence timing oracle); changing a password requires the current one and signs out other sessions; owner password resets and role changes end the target's sessions; CORS is closed unless `CORS_ORIGINS` is set; startup fails fast on missing or invalid configuration (`config.ts`); a central error handler never leaks internal (Prisma/SQL) messages.

## Known gaps

- Rate limiting and the SSE relay are in-memory, so both assume a single API instance.
- The SSRF check resolves DNS before the request is made, so a DNS-rebinding attacker could still race it; pinning the resolved address in the HTTP agent would close this.
- Stats counts on the dashboard (`/stats/overview`, `/stats/agents`, `/stats/series`) are platform-wide aggregates, not per-member.
- There is no audit log of admin actions.

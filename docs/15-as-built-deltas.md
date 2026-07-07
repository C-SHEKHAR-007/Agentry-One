# 15 — As-Built Deltas

Docs `01`–`14` are the design blueprint, written **before** the build. The build followed them closely, but a handover reader must know exactly where reality differs. This document is that list — where it conflicts with an earlier doc, **this document and the code win**. For the full as-built description, see [00-handover.md](00-handover.md).

## Scope deltas

1. **Only Sketch Agent is implemented.** The blueprint designs two agents in depth; Video Agent (`08-agent-video.md`) was deliberately deferred by an explicit product decision — VSplitter stays a separate standalone app. Everything Video-specific in docs 02/04/08 (two-phase flows, human-gate walkthroughs, Ollama networking) describes designed-but-unbuilt behavior. The `humanGate` machinery (schema, `advance` endpoint, status propagation) **is** implemented and route-tested, but no registered agent exercises it.
2. **Two subsystems were added beyond the original Phase-0 blueprint** (designed in a later planning pass, then built): the **provider/capability (BYOK) system** and the **workflow template system**. Docs 01–14 predate them; their as-designed spec lives in the final approved build plan, and their as-built behavior in `00-handover.md` §2/§6.
3. **`text-generation`** exists as a seeded capability for forward-compatibility but has **no adapter and no consuming agent** (`CapabilityClient.generate_text()` raises `NotImplementedError`).

## Behavioral deltas vs. doc 06 (API surface)

- As-built surface is **38 endpoints** (doc 06 planned ~20 before providers/templates existed). The authoritative list is `00-handover.md` §6; route definitions live in `apps/api/src/modules/*/routes.ts`.
- **Cancellation is stronger than doc 06's "best-effort" wording:** queued BullMQ jobs are actually removed; a cancel during execution lets the in-flight job settle, then forces the workflow (and any parent template run) to `cancelled` instead of resuming.
- **Auth accepts `?key=` as a query-param fallback** for SSE streams and artifact downloads (browsers can't set headers on `EventSource`/`<img>`); everything else uses the `X-API-Key` header.

## Infrastructure deltas vs. doc 10 (deployment)

- **Ports:** API on **4000** (not 3000) and Postgres published on **5433** — both because the original dev machine already ran unrelated services on the documented ports. Container-internal ports are unchanged.
- **Redis:** the compose stack runs its own `redis` service with **no published host port** (the dev machine's native Redis owns 6379 and is bound to localhost — containers can't reach it, so sharing was impossible, not just undesirable). Local dev uses the native Redis; containers use the service.
- **No Ollama anywhere** — doc 10's Ollama networking notes apply only to the unbuilt Video Agent.
- **ORM is Prisma** (left open in the blueprint); migrations under `apps/api/prisma/migrations/`, applied automatically by the api container at start.

## Frontend deltas

- Stack as recommended (TanStack Query, React Router, `@rjsf/core`) **except**: plain **Tailwind** utility classes, not shadcn/ui — at this page count a component library added setup cost without payoff.
- The web image bakes the API key in at **build time** (`VITE_AGENTRY_API_KEY` build arg) since Vite inlines env vars — rotating the key requires rebuilding the web image.
- The nginx config in the web container reproduces the dev-time `/api` proxy (with buffering off for SSE), so the SPA is same-origin in both modes.

## Known gaps carried forward (not regressions — never built)

- Workers don't write `logs`-table rows; `GET /jobs/:id/logs` returns empty. Stdout and `job_runs.error` are the real debugging surfaces.
- `prompts` and `artifact_versions` tables are schema-ready but unused (nothing regenerates artifacts or needs versioned prompts yet).
- Provider adapters: `sd_turbo_local` + `stability_ai` only. `openai_compatible`/`anthropic`/`replicate` are accepted `provider_type` strings with no adapter (Replicate additionally needs async polling — flagged in the build plan as explicitly out of scope).
- The SSE relay is an in-process `EventEmitter` — correct at one API replica, needs shared pub/sub before horizontal scaling.

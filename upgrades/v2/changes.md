# Agentry v2 — Orchestration experience

**Branch:** `feature/orchestration-experience` (18 commits on top of `feature/platform-improvements`)
**Size:** 78 files changed, +4,749 / −989 · includes 1 database migration (additive only)

## Summary

v2 turns Agentry from a generic admin dashboard into an **AI orchestration control plane**. Runs, workflows and their live execution are now the centre of the product:

- **Real telemetry.** Workers report the model and tokens used for every call. Every attempt now records model, tokens, cost and a log.
- **Live workflow runs.** A run opens as a live graph, with animated edges into running steps. An inspector shows each step's model, latency, tokens, cost and a streaming log.
- **AI control center dashboard.**
  - A 3D orchestration core and a live system-health strip.
  - An Active runs panel showing each run's steps.
  - An activity event stream.
  - Usage by runs, tokens, cost and latency.
- **Push, not poll.** The server pushes a signal when runs change. An idle dashboard went from **43 API calls/min to 1**.
- **A new visual system:**
  - A navy/violet control-plane theme with an ambient background.
  - One status language for every run and step state.
  - Monospace ids and numbers.
  - Regrouped navigation (Executions → **Runs**).
  - A ⌘K command palette with actions.
- **Content Studio redesign.**
  - A compact composer and a live pipeline preview.
  - A post preview (caption and visual together) and one-click Run again.
  - Recent creations in a searchable dialog.
- **Fixes:**
  - Agent run forms failed to submit under the Content-Security-Policy.
  - Modals opened off-centre and then jumped into place.
  - The Studio page scrolled with nothing to show.

---

## 1. Run telemetry: model, tokens, cost and logs

### Backend (`apps/api`)

- **Schema** (migration `20260929120000_run_telemetry`; adds columns and an index only, no data changes):
  - `jobs.provider_model`: the model the provider config pointed at when the job was queued.
  - `job_runs.model`, `input_tokens`, `output_tokens`, `cost_usd`: set for each attempt.
  - Index `logs(job_run_id, created_at)`.
- **Queue listener** (`src/queue/listener.ts`, `src/queue/telemetry.ts`):
  - **On completion:** stores the usage the worker reported (`result.metrics.usage`, falling back to the job's model). It prices the attempt at the configured per-job price and records a `job.completed` event with duration, model, tokens, cost and artifact count.
  - **Attempt start:** records `job.started` and writes "Attempt N started on <model>" to the log.
  - **Progress channel:** the worker's progress updates can now carry three kinds of message:
    - progress ticks (`{percent, message}`)
    - log lines (`{log: {level, message}}`)
    - usage from a failing attempt (`{usage}`)
  - **Logs:** every progress message becomes a log line. Completion and failure add a summary line, e.g. `Completed in 3.8s · on gemma3:270m · 47 tokens · 1 artifact`.
  - **Events:** `job.failed` now also records its `workflowId` and attempt number.
  - **Live stream:** log lines are also sent over the existing per-job live stream (server-sent events), as `{type: "log"}`.
- **New and changed endpoints:**

| Endpoint | Change |
|---|---|
| `GET /workflows/:id/logs` | **New.** Every attempt's log lines, oldest first. |
| `GET /template-runs?status=active\|all\|<status>&limit=` | **New.** Workflow runs with each run's step chain (`dependsOn` per step) for the dashboard and Runs list. |
| `GET /template-runs/:id` | **Changed shape.** Each step now has a `usage` summary: attempts, model, provider, tokens, cost, timings, progress, error. The run has `totals` (tokens, cost, duration) and `template {id, name}`. `workflow` is now a slim `{id, status, agentId, agentName, createdAt}`. |
| `GET /stats/agents` | Adds `tokens` and `costUsd` per agent (last 30 days). |
| `GET /events` | Adds `agentName` and a display-only `payload` (failure reason, duration, model, tokens, cost). |
| `GET /events/stream` | **New.** Server-sent "activity" signals (see §3). |

### Worker SDK (`python/sdk`)

- **New `telemetry.py`:**
  - The runner opens a usage record for each job.
  - `CapabilityClient` records every model call into it: the model name, plus token counts from Ollama, OpenAI-compatible providers, Anthropic and Gemini. Image and audio calls record just the model.
  - The client captures the record when it's created. Handlers call it from executor threads, where Python context variables aren't visible.
- **Runner:**
  - On success it returns the totals as `metrics.usage`, and never overwrites a handler's own `metrics.usage`.
  - On failure it sends the totals over the progress channel before the failure is recorded.
- **New `AgentJob.log(message, level)`** adds lines to the run's log. `docs/03-agent-sdk-contract.md` documents both changes.
- **Small fix:** `generate_audio` now always returns the output path.

## 2. Workflow run page (`/template-runs/:id`)

- **Graph view:**
  - Each step is a node showing its live status, a progress bar and message, model, duration and tokens.
  - Edges are green for completed data flow, animated and glowing into running steps, and dashed while waiting.
  - A Run inputs node is included.
- **Step inspector:**
  - Model, latency (live elapsed time while running), attempts, input/output tokens, cost and provider.
  - The failure explanation with a suggested fix.
  - Approve-and-continue for review gates.
  - A **streaming, terminal-style log** and the step's outputs.
- **Header and views:**
  - The header shows totals (steps, elapsed/duration, tokens, cost) and the actions Cancel, Edit workflow and Run again.
  - Views are **Graph / Steps / Inputs**, and the chosen view is kept in the URL.
- **Agent run page (`/workflows/:id`):**
  - A live **Logs** panel, updated from the live stream.
  - Model, tokens and cost in Details, and tokens on each attempt.

## 3. Push-based live updates

- **New `GET /events/stream`:** a Prisma `event.create` hook emits `{type}` whenever a run starts, an agent starts or finishes, something fails, needs review or is cancelled.
  - It uses the same pattern as the existing notifications stream.
  - Per-tick `job.progress` events are left out.
  - Non-admin users only receive signals about their own projects.
- **New `workflow.started` event**, so a run appears the moment it is queued rather than when a worker picks it up.
- **Web (`useLiveActivity`):** one stream for the whole app.
  - A signal refreshes only the data currently on screen.
  - Bursts are coalesced into one refresh (750 ms).
  - Per-agent stats refresh when a run settles.
- **Polling:**
  - Timed refreshes are now a 5-minute safety net. Worker health stays at 1 minute, since a worker going offline isn't an event.
  - The Studio run view polls every 3 s only while generating, for in-step progress messages.
- **Measured on the idle dashboard: 43 → 1 request/min.** Starting a run elsewhere triggers one combined refresh about 1 s later.

## 4. Visual system

- **Theme tokens:**
  - A deeper navy/charcoal dark theme (`#0B0D12`-style background, `#11141B` surfaces) with violet primary.
  - A new cyan **`info`** colour for integrations and providers.
  - **`chart-4`** is now the same teal in both themes; in dark mode it used to be amber.
  - A slightly tighter corner radius.
- **Ambient background:** two slowly drifting colour fields and a faint grid behind every page (CSS only). There's also a `glow-border` utility for featured surfaces and a live `status-dot`.
- **One status language** (`lib/status.ts`): a single map from status to label, colour, icon and whether it's live, used by `StatusBadge`, `StatusDot`, graph nodes, the activity feed and the command palette. Running states pulse or glow.
- **Typography:** Geist Mono (self-hosted) for run ids (`RUN_8F92A1`), durations, token counts and logs; tabular numbers throughout.
- **3D orchestration core** (`components/three/*`, three.js):
  - Agent nodes orbit a wireframe core, with pulses travelling along the links. It gets busier as more runs are active.
  - It follows the light/dark theme and responds to the pointer.
  - It pauses when off-screen or when the tab is hidden, and draws a single still frame when the user's system asks for reduced motion.
  - It is lazy-loaded as a separate chunk, with a CSS fallback when WebGL isn't available.
- **Sign-in and setup** pages use a split layout: the orchestration core and product story on one side, the form on the other.
- **Navigation:**
  - Grouped as **Workspace / Build / Observe / Connect**, with Team, Profile and Settings in the footer.
  - **Executions is renamed Runs** (`/runs`). Old `/executions` links redirect with their query string kept.
  - A live **System healthy** pill in the top bar.
- **Sidebar toggle:**
  - When expanded, a collapse button sits right of the app name.
  - When collapsed, the logo becomes the expand button while the pointer is over the sidebar (or it has keyboard focus).
  - The old floating chevron button is removed.
- **Editor nodes** glow on hover.

## 5. Dashboard ("AI control center")

- **Hero:**
  - The 3D core, the greeting and a one-line system verdict.
  - Service chips for API, Postgres, Redis and workers, with an "updated Ns ago" time.
  - Actions: New workflow and Open Content Studio.
- **KPIs:**
  - Active runs.
  - Completed today, compared with yesterday.
  - Success rate with average duration.
  - Tokens over 30 days, with spend and savings.
- **Active runs panel:** each workflow run's step chain, with parallel branches stacked, elapsed time and a progress rail. Standalone agent runs are listed separately.
- **Live activity** as an event stream: clock time, event, agent/project, and details (tokens · duration · model, or the failure reason).
- **Agent usage** as ranked bars with **Runs / Tokens / Cost / Latency** tabs.
- Execution trends, recent agent runs, system health and projects are kept.

## 6. Runs page (`/runs`)

- **Workflow runs** tab: each run's step chain, status and start time.
- **Agent runs** tab: the existing table.
- A status filter from an old link opens the Agent runs tab.

## 7. Command palette (⌘K)

- **With no query:** actions (Run a workflow, Create workflow, Create agent, Generate content, Search runs, Connect an account, Add an AI provider) and the six most recent runs with live status.
- **When typing:** searches workflows, agents, projects, pages and runs by short code (`RUN_…`).
- **Footer:** keyboard hints. The top-bar search placeholder is now "Search agents, workflows, runs…".
- `/builder?new=1` jumps straight to creating a workflow.

## 8. Content Studio

- **Composer:**
  - Outputs are a compact 2-column tile grid.
  - Example and tone chips scroll in one row.
  - The plan preview (a pipeline strip) and **Generate** sit in a pinned footer, and **⌘/Ctrl+Enter** generates.
- **Layout:** the composer and results pane are sized to the space left under the header (measured, not guessed), so the page never scrolls when there's nothing to scroll.
- **Empty canvas:**
  - The text and the pipeline your brief will run (you picked vs. added because another output needs it) are at the top.
  - The orchestration core fills the space below.
- **Open creation:**
  - A live pipeline strip, plus elapsed time, tokens and cost.
  - **Run details** (graph and logs), **Run again** (same brief), Open workflow and New.
  - **Post preview:** caption and visual together as the post will look, with highlighted hashtags, copy and per-part download.
  - Every output shows its model · time · tokens.
  - Running outputs show a placeholder shaped like the output (image frame, text lines, waveform, video) with the live progress message and a timer.
  - Failed outputs explain the error and link to the details.
  - Cards size to their own content, so a failed step no longer leaves gaps.
- **Recent** button next to the page title: opens a searchable dialog of up to 50 creations (status, outputs, project). Picking one opens it on the page.

## 9. Fixes

- **Agent run forms failed on Submit** with `Evaluating a string as JavaScript violates … 'unsafe-eval'`.
  - **Cause:** `@rjsf/validator-ajv8` compiles schemas with `new Function`, which the production CSP (`script-src 'self'`) blocks.
  - **Fix:** it's replaced with `@cfworker/json-schema`, which interprets schemas without generating code, through an adapter (`lib/schemaValidator.ts`). The adapter keeps the old validator's error paths and messages, custom validation and `$ref` handling. The security policy was not loosened.
- **Modals opened off-centre and then jumped into place.**
  - **Cause:** they were centred with `translate(-50%,-50%)` while their open animation also set `transform`, so for the animation's duration the modal was drawn half its size down and right of the centre.
  - **Fix:** modals are now centred with `inset-0` and auto margins.
  - **Animations:** rise, scale and fade in (260 ms ease-out-expo), and sink and fade out (160 ms ease-in); the overlay fades with them. The mobile navigation drawer slides in and out. Reduced motion is honoured.
  - **Hand-built modals:** the four on Providers and Integrations now use the shared dialog, so they get the animations plus Escape-to-close, focus trapping and a proper dialog role.
- **Studio page scrolled with nothing to show.** It is now measured and fits exactly: 0 px overflow at 1100×800 through 1920×1080.
- **Dashboard "Active runs"** showed `00` while a run was in progress; it now counts running and in-review workflows.
- **Durations** over an hour now read `1h 55m` instead of `115m 55s`.

## 10. Testing

- **The browser suite now runs under the production CSP.** `vite preview` sends the same Content-Security-Policy, read directly from `nginx.conf.template`, so eval or inline-script regressions fail in tests instead of only in production.

| Suite | Before | After |
|---|---|---|
| API unit (vitest) | 88 | **97** (+9: telemetry parsing, completion lines, run usage aggregation) |
| API integration | 3 | 3 |
| Web unit (vitest) | 41 | **54** (+13: format helpers, status map, step-chain columns, CSP-safe validator) |
| Python SDK (pytest) | 35 | **41** (+6: usage capture across executor threads, `attach_usage`) · ruff clean |
| Browser e2e (Playwright) | 14 | **22** |

**New browser specs:**
- The control-center dashboard and its usage tabs.
- The Runs rename, legacy redirect and tabs.
- A two-step workflow run: graph, inspector, logs, inputs, header actions.
- Palette search by run code.
- The dashboard updating live from a pushed signal, and staying quiet when idle.
- Submitting an agent form under the CSP. This spec fails against the old validator.
- Dialogs staying centred on every frame of the animation, and the Provider dialogs.
- The Studio post preview, Run details link, Ctrl+Enter and the Recent dialog.

The browser suite passes both with and without a live worker.

**Checked end to end with real workers:**
- Ollama `gemma3:270m` recorded model + 26/21 tokens.
- A branching 3-step workflow ran its independent steps in parallel.
- SD-Turbo recorded `stabilityai/sd-turbo` and its duration.
- A 300 s timeout appeared correctly in the log and the event feed.

### Run locally

```bash
# API
cd apps/api && npm test && npm run test:integration   # integration needs a disposable DB
# Web
cd apps/web && npx tsc --noEmit -p . && npm test && npm run build
# Python SDK
python -m pytest python/sdk/tests -q -c python/sdk/pytest.ini --rootdir python/sdk && ruff check .
# Browser (against a running API + built web)
cd apps/e2e && E2E_API_URL=http://127.0.0.1:4100 E2E_EMAIL=… E2E_PASSWORD=… npx playwright test
```

## 11. Upgrade notes

- **Migration:** run `prisma migrate deploy`. It's additive only: new columns are empty (nullable) and there's one new index. The compose `migrate` service applies it automatically.
- **Workers:** rebuild worker images to get usage reporting and `job.log()`. Workers on the old SDK keep working; their runs just have no tokens.
- **Existing runs:** runs from before this change show no model, tokens or logs.
- **API consumers of `GET /template-runs/:id`:** the response shape changed (see §1). The web app's Studio and run pages are updated.
- **Routes:** `/executions` → `/runs` (redirect kept).
- **Dependencies:**
  - Added `three` (lazy chunk), `@fontsource-variable/geist-mono` and `@cfworker/json-schema`.
  - Removed `@rjsf/validator-ajv8`.
- **Live updates** use one server-sent-events connection per tab (`/api/events/stream`). It sends data only when something happens, plus a 15 s keep-alive. It works through the bundled nginx config.
- **Cost** is still the per-job price from Cost Monitor settings (local providers are $0). Per-token pricing is planned.

## 12. Known limitations and follow-ups

- **Live updates are single-process:** the event stream and notification hooks live inside one API process. Move them to Redis pub/sub before running more than one API replica.
- **No traces:** there are no spans or tool calls inside agents yet, so the run graph shows steps and attempts, not traces.
- **Default Ollama model:** a provider config without a model falls back to the worker default (`qwen3:8b`), which can exceed the 300 s step timeout on small machines. Set a model on the provider.
- **List limits:** lists are still capped (50–100 rows) with no paging.

## Commits

```
0e9bc5b feat(api): record model, tokens, cost and logs for every attempt
7f3623f feat(sdk): report model usage and log lines from workers
e1146fd feat(web): control-plane visual system and 3D orchestration core
3d7ea43 feat(web): turn the dashboard into an AI control center
256ddd4 feat(web): live graph and inspector for workflow runs
f47d21a feat(web): command palette with actions, workflows and recent runs
68d2707 test(e2e): cover the control center, runs, run graph and palette
fef127d fix(web): validate agent forms without eval so submit works under the CSP
d47b51a test(e2e): run the browser suite under the production CSP
b04caea feat(api): push an activity signal when runs change
0a7795b perf(web): refresh live pages on pushed activity instead of polling
1bef0bb feat(web): redesign Content Studio around the pipeline and the post
b56ff2b test(e2e): cover the Studio post preview and keep live-update checks stable
a43128d feat(web): Studio recent creations in a header dialog; full-height composer
7f20932 fix(web): Studio fits the window exactly; canvas text above the 3D core
82e0320 fix(web): dialogs open centred and ease in and out
02588f4 test(e2e): dialogs stay centred while animating and close with Escape
85b9837 feat(web): sidebar toggle in the logo row
```

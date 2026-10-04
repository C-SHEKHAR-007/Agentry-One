# Agentry v3 — Product and UI plan

> **Status: in progress.** v3.0 (quick wins) on `feature/v3.0-quick-wins`, 4 of 7 items done, each with its own commit:
>
> | Item | Commit | Date |
> |---|---|---|
> | A1 Retry from the failed step | `533b9f2` | 2 Oct |
> | I1 Paging on runs, events, notifications, artifacts | `79474df` | 3 Oct |
> | F1 Per-token pricing | `9f4645f` | 4 Oct |
> | U3 Artifacts: text previews, viewer, search, every kind | `b8ef9b7` | 5 Oct |
>
> Still to do in v3.0: U1 Submit agent, U2 run inputs and cron builder, U4 Projects, A2 regenerate one output and E1 variants in Studio. Then deploy to the local stack (two new migrations). v3.1 onwards waits on the decisions in §11.
>
> Found while building: editing a workflow deletes its past runs' step records, so a run from before an edit can't be retried (C1 workflow versions fixes this). Artifact search covers project, agent and kind; content search comes with knowledge bases (D2). A provider's default model needs a model entry before it can have token prices.

**Branch:** a new `feature/v3-*` branch per phase, from `feature/v2.2-architecture` once that is merged.
**Delivery:** one commit per workstream as it passes the gate; nothing is pushed.

v2 gave Agentry multi-step workflows, live run graphs, Content Studio and a new look. v2.2 rebuilt the web app's foundations: Redux Toolkit + RTK Query, one axios client, all routes and models in one place, and a feature-folder structure with lint rules. v3 builds on that to make Agentry **recover from failures, run without the UI, remember your brand, and work for a team**. It also brings the remaining pages up to the v2 look.

---

## 1. Where things stand (checked in the code, 30 Sep 2026)

**Solid and in place**
- Workflows (templates) with parallel steps, review gates, schedules and a live run graph.
- Every step run records its model, input/output tokens and cost (`JobRun.inputTokens`, `outputTokens`, `costUsd`).
- Live updates are pushed over server-sent events: an idle dashboard makes about 2 requests a minute.
- Content Studio, provider keys, discovered models, custom agents, prompt versions, social publishing and the Instagram helper, proxied through the API.
- Web app: RTK Query with cache tags, feature folders, ESLint architecture rules, 94 unit tests and 40 end-to-end tests under the production CSP.

**Gaps**

| Area | Today | Evidence |
|---|---|---|
| Recovery | A failed workflow can only be run again from scratch. | No retry route; `TemplateRunStep` links each step to its run, so a retry can reuse the ones that completed. |
| Triggers | UI or cron schedule only. No webhooks, personal API keys or chaining. | One shared `AGENTRY_API_KEY`; no trigger model. |
| Memory | "Prompts & Memory" has prompts but no memory. | No brand or knowledge tables. |
| Teams | Every project belongs to one user. Roles are `owner`/`member`. | `Project.userId`; `User.role`. |
| Cost | Flat price per job from settings (`pricing.stability_ai = $0.04`). Token counts are recorded but not priced. | `settings/bootstrap.ts`. |
| Agents | Agents don't call tools, so a step is a black box. | No tool-call events. |
| Lists | Hard caps (events 100, notifications 100, workflows 100, stats 500–1,000), no paging. | `take:` in the routes. |
| Scale | Live updates use an in-process `EventEmitter`, so only one API server works. | `db/client.ts`. |
| Storage | Artifacts are never deleted. | `docs/10-deployment.md`, "Retention". |

**Pages still in the pre-v2 style** (from the screenshot tour)
- **Submit agent:** a plain generated form.
- **Workflow run inputs:** a raw cron text box.
- **Artifacts:** text outputs show "Click to view full text output & copy…" instead of the text.
- **Projects:** grey folder placeholders when a project has no image.
- **Create agent, Team, Settings, Profile:** long single forms.

---

## 2. Principles

1. **Every feature must be useful on its own.** Each workstream ships behind no flag and makes sense without the next one.
2. **Reuse what's recorded.** Tokens, step outputs, events and artifacts already exist. Price them, retry from them and show them before adding new capture.
3. **Keep the v2.2 rules.** New endpoints go in `routes.ts`, new types in `models/`, new hooks in `features/<area>/<area>.api.ts`. No page over about 300 lines.
4. **Additive database changes.** New tables and nullable columns only. Existing rows keep working without a backfill, or with a backfill that runs in the migration.
5. **Same gate as v2.2**, plus a new end-to-end spec for every user-facing feature (see §6).

---

## 3. Workstreams

Each workstream lists what changes, the data model, the API, the UI and how it's tested.

### A. Recovery

**A1 · Retry from the failed step** *(the first thing to build)*
- **What:** on a failed or cancelled workflow run, "Retry from failed step" starts a new run. It reuses the outputs of every step that completed and runs only the failed step and the steps after it.
- **Data:** `TemplateRun.retryOfId` (nullable) and `TemplateRunStep.reusedFromStepId` (nullable). A reused step is created as `completed` and points at the original step's workflow, so its artifacts are found by the same lookup that later steps already use.
- **API:** `POST /template-runs/:id/retry` with body `{ fromStepOrder?: number }` (default: the first failed step). It returns the new run. It refuses runs that are still active (409).
- **UI:** a primary button on the failed-run banner in the run view, plus "Retry from here" on any step in the step inspector. Reused steps show a "Reused" badge that links to the original run.
- **Tests:** API unit tests (which steps are reused; the inputs of the steps that run again resolve from the reused artifacts; active runs are refused). An end-to-end run with a deliberately failing step, then retry, then the run completes with the first step reused.

**A2 · Regenerate one output in Studio**
- **What:** on a finished Studio run, "Regenerate" on one card (e.g. the Visual) runs that step again with the same inputs, plus an optional note ("warmer colours").
- **How:** a single-step retry (A1) with `fromStepOrder` equal to that step and `onlyStep: true`, which skips the later steps. The note is appended to the step's prompt input.
- **UI:** a regenerate icon on each output card, and a version switcher (v1 / v2) on the card.

**A3 · Retry policy per step**
- **What:** in the editor, each step gets "Retries: 0–3" and "Back off: 10s / 1m / 5m".
- **Data:** `TemplateStep.retryPolicy Json?`, passed as BullMQ `attempts` and `backoff` (the job queue already takes `attempts`).
- **UI:** a small section in the step editor panel. The run view shows "Attempt 2 of 3".

### B. Triggers and automation

**B1 · Personal API keys**
- **What:** each user creates named keys ("Zapier", "CI") with a scope (`runs:start`, `read`), sees each key once, and can revoke it.
- **Data:** a new `ApiKey` table: `id`, `userId`, `name`, `prefix`, `hash` (sha-256), `scopes[]`, `lastUsedAt`, `expiresAt?`, `revokedAt?`.
- **API:** `GET/POST/DELETE /me/api-keys`. The auth hook accepts `Authorization: Bearer agk_…` and resolves it to the user, so project access is checked exactly as for a signed-in user. The shared `AGENTRY_API_KEY` keeps working for workers.
- **UI:** a "Developer" section in Settings: a key list, a "Create key" dialog that shows the key once, and revoke.

**B2 · Webhook trigger per workflow**
- **What:** "Trigger URL" on a workflow: `POST /hooks/:token` with a JSON body starts a run. The body maps to the workflow's run inputs.
- **Data:** a new `WorkflowTrigger` table: `id`, `templateId`, `kind` (`webhook` | `chain`), `token` (random, 32 bytes), `inputMapping Json`, `enabled`, `lastFiredAt`.
- **API:** `POST /hooks/:token`, which is public but rate-limited and checks a signing secret if one is set (HMAC-SHA256 header). Triggers are managed through `GET/POST/PATCH/DELETE /templates/:id/triggers`.
- **UI:** a "Triggers" tab on the workflow run page, next to Schedules. It shows the URL with a copy button, a sample `curl`, and "Send test".

**B3 · Chaining**
- **What:** "When workflow X completes (or fails), start workflow Y", passing X's final text output as one of Y's inputs.
- **How:** a trigger of kind `chain`, with `sourceTemplateId` and `on: completed | failed`. The run-finished handler (which already sends the live event) looks up chain triggers and starts the next run. A chain depth limit of 5 stops loops.
- **UI:** in the Triggers tab, "Run after…" with a workflow picker. The workflow library card shows "→ starts Publish weekly".

**B4 · Documented "start a run" API**
- A page in `docs/06-api-surface.md` and a "Use from code" panel on the run page, with `curl`, JavaScript and Python snippets filled in with the workflow's id and inputs.

**B5 · Friendly cron builder on the run page**
- Reuse the builder from the schedules dialog on the workflow run-inputs page (see U2), so nobody types `0 9 * * 2`.

### C. Workflow editor

**C1 · Versions, history and rollback**
- **Data:** a new `TemplateVersion` table (`templateId`, `version`, `snapshot Json` of the steps and inputs, `createdBy`, `createdAt`, `note?`). Saving creates a version, and each run records `templateVersion`.
- **API:** `GET /templates/:id/versions`, `GET /templates/:id/versions/:v`, `POST /templates/:id/versions/:v/restore`.
- **UI:** a "History" drawer in the editor: a list of versions, a side-by-side step diff (reusing the prompt diff view), and "Restore". The run view shows "ran on v4".

**C2 · Test one step**
- "Test step" in the step panel runs just that agent with sample inputs in a sandbox project and shows the output inline, without creating a workflow run.
- **API:** `POST /templates/:id/steps/:order/test` with `{ input }`. It starts one agent run tagged `test: true`, which is hidden from Runs and the stats.

**C3 · Live run on the canvas**
- The editor canvas gets a "Watch latest run" toggle that colours nodes by status and animates the edges, using the same live updates as the run view. There is no new API.

**C4 · Conditional branches** *(later in the phase)*
- A step can have `runIf`: a simple condition on an earlier output (`contains`, `equals`, `length >`, `json path`). If the condition fails, the step is marked `skipped`.
- **Data:** `TemplateStep.runIf Json?`. The resolver skips the step and its dependants.

**C5 · Starter library**
- Five ready-made workflows (Weekly LinkedIn post, Product launch kit, Blog → social, Research digest, Reel from topic), installed from JSON under `templates/starters/`. The new-workflow picker gets a "Start from a template" tab.

### D. Memory and knowledge (makes "Prompts & Memory" real)

**D1 · Brand kit**
- **What:** a brand kit per project: voice, tone words, audience, banned words, hashtags, logo, colours and example posts.
- **Data:** a new `BrandKit` table (one per project) with `fields Json` and a `logoArtifactId?`.
- **How it's used:** Studio briefs and any text step with `useBrandKit: true` get the kit added to the system prompt. Banned words are checked on the output, and a warning is shown on the card.
- **UI:** a "Brand" tab on the project page, and a "Brand kit on/off" chip in the Studio composer.

**D2 · Knowledge bases**
- **What:** upload PDFs, docs or markdown, or add URLs. They're split into chunks, embedded and searched as a step ("Knowledge search") or automatically for a text step.
- **Data:** the `pgvector` extension in the existing Postgres, plus `KnowledgeBase` (project, name) and `KnowledgeChunk` (`kbId`, `sourceArtifactId`, `text`, `embedding vector(768)`, `meta`).
- **How:** a new `knowledge.ingest` worker queue (split into chunks, then embed with the configured embedding provider; Ollama `nomic-embed-text` by default), and a `knowledge-search` agent with a `query` input and a `sources` text output.
- **UI:** the "Prompts & Memory" page gets a "Knowledge" tab: bases, documents with their ingest status, and a search box that shows the matched passages.
- **Risk:** a Postgres extension. The migration checks for it and prints clear setup steps if it's missing.

### E. Content Studio

**E1 · Variants:** "3 variants" generates three captions and three visuals. You pick one of each before publishing, and the others stay as versions.
**E2 · Platform formats:** Instagram post 1:1, Reel 9:16, LinkedIn 1.91:1, X. The visual step gets the aspect ratio, and the preview shows the post in that platform's frame.
**E3 · Content calendar:** a month and week view of scheduled and published posts. Drag a post to reschedule it. It uses `WorkflowSchedule` plus a new `ScheduledPost` table (`artifactIds`, `accountId`, `publishAt`, `status`).

### F. Observability and cost

**F1 · Per-token pricing**
- **Data:** `Model.inputPricePerMTok` and `Model.outputPricePerMTok` (nullable). If they're empty, the price is taken from `metadata.pricing` (OpenRouter already fills it on discovery), then from the flat per-job setting. That keeps local and image models working.
- **How:** the step's `costUsd` is computed when it finishes, from its recorded tokens. The stats sum `costUsd` instead of counting jobs times a price.
- **UI:** price fields on each model in Providers, and a "priced by tokens / by job" note in Cost Monitor.

**F2 · Budgets and alerts:** a monthly budget per workspace and per project, with alerts at 50%, 80% and 100% (a notification plus an optional email webhook), and an optional "pause scheduled runs at 100%". Stored in `Setting` rows; checked when each step finishes.

**F3 · Better charts:** p50 and p95 duration per agent, cost over time by model, and an hour-by-weekday activity heatmap. The data comes from `JobRun`, through a new `/stats/latency` endpoint and a `groupBy` option on `/stats/series`.

**F4 · Run comparison:** pick two runs of the same workflow to see step-by-step duration, tokens, cost and outputs side by side (a text diff for text outputs).

**F5 · Evaluations** *(later)*: a rubric per workflow ("mentions the product name", "under 150 words", "tone: friendly"), scored by a model after each run. The score shows on the run and trends in Analytics.

### G. Agents

**G1 · Tool-calling agents:** the dynamic text agent can call tools (web search, HTTP GET on an allowlist, knowledge search from D2). Each call is recorded as a `tool.called` / `tool.result` event with its duration and a truncated payload.
**G2 · Step traces:** the step inspector gets a "Trace" tab: a timeline of the model calls, tool calls and their timing, built from those events.
**G3 · Agent versions:** a custom agent's manifest and prompt are versioned (the prompts table already works this way), and a template step can pin a version.
**G4 · Agent test console:** on the agent detail page, a chat-style panel that runs the agent on sample input without a project run.
**G5 · Import from git:** "Add agent from repository" (URL + ref). The worker clones it into `agents/`, and the scanner picks it up. Admins only; it goes through the existing manifest scan.

### H. Collaboration

**H1 · Shared workspaces:** a new `Workspace` table and a `Membership` table (`userId`, `workspaceId`, `role`), with `Project.workspaceId`. The migration creates one workspace per existing owner and moves their projects into it. Access checks go through membership instead of `Project.userId`.
**H2 · Roles and invites:** `admin`, `editor` and `viewer`, and invite by email (a link with a token; mail through an SMTP setting, or a copyable link if none is set). Viewers can see runs but not start or edit them.
**H3 · Assigned reviews:** a review gate can be assigned to a person. They get a notification, and the Runs page has a "Waiting for me" filter.
**H4 · Comments:** threads on runs and artifacts with @mentions (a new `Comment` table), shown in the run view and the artifact viewer.
**H5 · Audit log:** a new `AuditEvent` table (who, what, target, when, IP) for sign-ins, key changes, provider changes, role changes, deletes and publishing. It has its own page in Settings, filterable and exportable as CSV.

### I. Platform and operations

**I1 · Paging everywhere:** cursor paging (`?cursor=&limit=`) on runs, workflow runs, events, notifications, artifacts and prompts. The web app uses RTK Query "infinite" queries with a "Load more" button or infinite scroll. This removes every hard cap in §1.
**I2 · Live updates on Redis:** replace the two in-process `EventEmitter`s with Redis pub/sub (Redis is already in the stack), so two or more API servers see the same live stream. Add a test with two API instances.
**I3 · Artifact retention and quotas:** per-project rules ("delete intermediate artifacts after 30 days, keep published ones"), a nightly job, and a storage-used meter per project with a soft quota.
**I4 · Single sign-on (OIDC):** generic OIDC (Okta, Azure AD, Google Workspace) next to the existing Google sign-in, with optional "SSO only" per workspace.
**I5 · Per-user rate limits** on run starts and webhooks, using the existing rate-limit plugin keyed by user or key.

---

## 4. UI plan

The v2 design system stays: the tokens, fonts, glass cards, the 3D hero and the motion. v3 applies it to the pages that missed it and adds app-wide polish.

### U1 · Submit agent (run one agent)
- The Studio-style layout: the composer on the left and a live "what will run" preview on the right (the agent, its provider and model, and the expected outputs).
- Custom fields replace the plain rjsf look: sliders for numbers with min/max, chips for enums, a large textarea with the saved-prompt picker built in, and a seed field with a 🎲 button.
- Validation stays CSP-safe (the existing validator).

### U2 · Workflow run inputs
- The same composer style, with inputs grouped by the step that uses them.
- A **cron builder** ("Every [Tuesday] at [09:00]", with a preview of the next 3 runs) instead of the raw text box.
- A Triggers tab (B2/B3) next to Schedules.

### U3 · Artifacts
- Real previews: text and markdown rendered, JSON pretty-printed and collapsible, images as they are, audio with a waveform, video with a poster frame.
- A full-screen viewer with ← → to step through the filtered list, plus copy, download and "open run".
- Search across text artifacts. The kind filter lists every kind, not just the kinds among the loaded artifacts, which fixes the issue noted during v2.2.
- Paging (I1).

### U4 · Projects
- Cards show stats (runs in 30 days, success rate, artifacts, last activity), a mini activity sparkline, and the latest image if there is one, instead of a grey placeholder.
- The project page gets tabs: Overview · Workflows · Artifacts · Brand (D1) · Knowledge (D2) · Members (H1).

### U5 · Create agent
- A 4-step wizard: **Basics** (name, capability, model) → **Prompt** (editor with a live preview filled with sample inputs) → **Inputs** (field builder) → **Test** (run once on sample input, see the output, then create).

### U6 · Settings, Profile, Team
- Settings gets a side navigation: General · Appearance · Pricing · Budgets (F2) · Developer / API keys (B1) · Audit log (H5) · System.
- Profile: the avatar, name and password sections as cards, plus active sessions with "sign out other devices".
- Team: members with role chips, pending invites and invite by email (H2).

### U7 · Workflow editor
- Drag steps from a side palette of agents, grouped by capability.
- Undo and redo (Ctrl+Z / Ctrl+Shift+Z) over the draft history.
- Keyboard shortcuts: `N` new step, `Del` remove, `Ctrl+S` save, `Ctrl+Enter` test step.
- A "Watch latest run" overlay (C3) and a History drawer (C1).

### U8 · App-wide
- **First-run checklist** on the dashboard: add a provider → run an agent → create a workflow → connect an account. It hides itself once all four are done.
- A **"?" shortcuts panel** listing every shortcut.
- A **notifications page** (`/notifications`) with filters, bulk mark-as-read and paging.
- **Tables become card lists** on phones (Runs, Artifacts, Team).
- **Page transitions:** a short fade and rise between routes, respecting `prefers-reduced-motion`.
- **Accessibility pass:** visible focus rings everywhere, contrast checked on every token pair (automated with axe in the end-to-end tests), and dialogs and menus fully usable from the keyboard.

### U9 · Charts
- Tokens and cost over time (stacked by model), latency percentiles per agent, and an hour-by-weekday activity heatmap (F3).
- One chart theme across Analytics, Cost Monitor and the dashboard (`components/common/charts/chartTheme.tsx` already exists).

---

## 5. Phases

| Phase | Scope | Why this order |
|---|---|---|
| **v3.0 · Quick wins** | A1 retry from failed step · A2 regenerate one output · E1 variants · U1 Submit agent · U2 run inputs + cron builder · U3 Artifacts · U4 Projects · I1 paging · F1 per-token pricing | High value, self-contained, and fixes the most visible rough edges. No new concepts for users. |
| **v3.1 · Automation** | B1 API keys · B2 webhooks · B3 chaining · B4 API docs · C1 versions · C2 test step · C3 live canvas · U7 editor palette/undo · F2 budgets · U8 checklist, shortcuts, notifications page | Makes Agentry usable from outside the UI, and safe to edit workflows that other things depend on. |
| **v3.2 · Intelligence** | D1 brand kit · D2 knowledge bases · G1 tool calls · G2 traces · G4 test console · U5 agent wizard · E2 platform formats · F3 charts · F4 run comparison | The biggest differentiators; they need new data (pgvector, tool events). |
| **v3.3 · Teams** | H1 workspaces · H2 roles + invites · H3 assigned reviews · H4 comments · H5 audit log · U6 settings/team · E3 content calendar · I5 rate limits | Real multi-user use. The largest data-model change (workspace ownership), so it comes after the rest is stable. |
| **Before scaling** | I2 Redis live updates · I3 retention and quotas · I4 SSO · C4 branches · C5 starters · A3 retry policy · F5 evaluations · G3 versions · G5 git import | Needed before a second API server or a larger customer; can run alongside v3.2–v3.3. |

### v3.0 in detail (first to build)

1. **A1 retry from failed step**
   - API route, reuse logic, unit tests.
   - Run-view banner button, "Retry from here", "Reused" badges.
   - An end-to-end spec with a deliberately failing step.
2. **I1 paging:** API cursors on the six lists, and "Load more" in Runs, Artifacts, the notifications dropdown and Prompts. The request audit must show no extra calls on first load.
3. **F1 per-token pricing:** migration, cost when a step finishes, stats, price fields in Providers, and a Cost Monitor note. Unit tests for the fallback order.
4. **U3 Artifacts:** previews, the full-screen viewer and search, plus the kind filter fix.
5. **U1 Submit agent** and **U2 run inputs** (cron builder shared with the schedules dialog).
6. **U4 Projects** cards and tabs (the Brand and Knowledge tabs come later).
7. **A2 regenerate** and **E1 variants** in Studio.

*Commits:* one per numbered item, e.g. `feat(runs): retry a workflow run from its failed step`.

---

## 6. Gate (every commit)

The v2.2 gate, plus what's new in v3:

1. `tsc`, `npm run lint`, web and API unit tests (and integration or Python tests when the SDK or worker changes).
2. The full end-to-end suite, twice: with no worker and with a live worker, under the production CSP.
3. **A new spec for each user-facing feature**, e.g. retry (fail → retry → complete), webhook (curl → run starts), API key (create → call → revoke → 401), paging (load more), budgets (crossing 80% → notification).
4. **Request audit:** no new duplicate or polling calls. The idle dashboard stays at about 2 requests a minute.
5. **Screenshot check:** pages that aren't being redesigned must not change. Redesigned pages get a new baseline, reviewed by eye in light and dark themes, desktop and mobile.
6. **Accessibility:** axe runs on every page in the end-to-end tests. There must be no new serious or critical issues (from v3.0 onwards).
7. **Migrations:** every migration is applied to a copy of the local database, checked, and must be additive. Any backfill step is idempotent.

---

## 7. Data model changes (summary)

| Change | Workstream | Kind |
|---|---|---|
| `TemplateRun.retryOfId`, `TemplateRunStep.reusedFromStepId` | A1 | nullable columns |
| `TemplateStep.retryPolicy`, `TemplateStep.runIf` | A3, C4 | nullable JSON |
| `Model.inputPricePerMTok`, `Model.outputPricePerMTok` | F1 | nullable columns |
| `ApiKey` | B1 | new table |
| `WorkflowTrigger` | B2, B3 | new table |
| `TemplateVersion`, `TemplateRun.templateVersion` | C1 | new table + nullable column |
| `BrandKit` | D1 | new table |
| `KnowledgeBase`, `KnowledgeChunk` (pgvector) | D2 | new tables + extension |
| `ScheduledPost` | E3 | new table |
| `Workspace`, `Membership`, `Project.workspaceId` | H1 | new tables + column with backfill |
| `Invite`, `Comment`, `AuditEvent` | H2, H4, H5 | new tables |
| `RetentionRule` | I3 | new table |

## 8. New API surface (summary)

- `POST /template-runs/:id/retry`
- `GET|POST|DELETE /me/api-keys`
- `POST /hooks/:token` · `GET|POST|PATCH|DELETE /templates/:id/triggers`
- `GET /templates/:id/versions[/:v]` · `POST /templates/:id/versions/:v/restore`
- `POST /templates/:id/steps/:order/test`
- `GET|PUT /projects/:id/brand-kit`
- `GET|POST /projects/:id/knowledge-bases` · `POST /knowledge-bases/:id/documents` · `GET /knowledge-bases/:id/search`
- `GET /stats/latency` · `GET /stats/series?groupBy=model`
- `GET|POST /workspaces` · `/workspaces/:id/members` · `/invites/:token`
- `GET|POST /runs/:id/comments` · `GET /audit-events`
- Cursor paging (`cursor`, `limit`, response `{ items, nextCursor }`) on the six list endpoints. The old array responses stay as they are when `cursor` isn't sent, so existing clients keep working.

---

## 9. Risks and how they're handled

| Risk | Mitigation |
|---|---|
| Retry reuses outputs that a later step no longer matches (the workflow was edited since). | A retry uses the run's own template version (C1). Until C1 ships, retry is refused if the template changed after the run, with a clear message. |
| Public webhooks get abused. | A 32-byte random token, an optional HMAC signature, per-token rate limits, "disable" in one click, and every call in the audit log. |
| API keys leak. | Only hashes are stored, keys are shown once, have a prefix for identification, can have an expiry and be revoked; the last-used time is visible. |
| pgvector isn't installed on an existing Postgres. | The migration checks for it; knowledge bases stay disabled with a setup message instead of failing to boot. |
| Workspace migration breaks access. | The backfill runs per owner inside the migration; old `userId` checks stay as a fallback for one release; end-to-end specs cover owner, editor and viewer. |
| Paging changes list responses. | The paged shape is opt-in through `cursor`; the web app switches over one list at a time. |
| Redesigns change pages people know. | The same routes and main actions; the old baseline stays until a page is signed off by eye. |
| The bundle grows with new charts and editors. | Heavy pieces (chart libraries, the diff view, the 3D scene) load lazily. The build reports the entry-chunk size and flags growth over 10%. |

## 10. Estimate

| Phase | Effort |
|---|---|
| v3.0 Quick wins | ~2 weeks |
| v3.1 Automation | ~3 weeks |
| v3.2 Intelligence | ~4 weeks |
| v3.3 Teams | ~3–4 weeks |
| Before scaling (in parallel) | ~2 weeks |
| **Total** | **~14–15 weeks** |

## 11. Decisions needed before starting

1. **Order:** start with v3.0 as listed (retry first), or pull a later item forward (e.g. webhooks or the brand kit)?
2. **Embeddings (D2):** local Ollama `nomic-embed-text` by default, or use the configured provider (OpenAI or Gemini) when there is one?
3. **Email (H2 invites, F2 alerts):** add SMTP settings, or use copyable invite links and in-app notifications only?
4. **Workspaces (H1):** one workspace per user, as today, plus shared ones; or move everyone in an installation into one shared workspace?
5. **Evaluations (F5):** which model scores runs by default: the workspace default text model, or a dedicated setting?

## 12. Out of scope for v3

- A hosted or multi-tenant SaaS version (billing, tenant isolation).
- Kubernetes deployment (the compose stack stays the supported path; I2 makes more than one API server possible).
- A visual redesign of pages already in the v2 style (Dashboard, Studio, Runs, run view, Workflows, Agents, Providers, Integrations, Prompts).
- Mobile apps.

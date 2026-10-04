# Agentry v2.2 — Frontend architecture plan

> **Status: done (30 Sep 2026)** on `feature/v2.2-architecture`, commits `5ce5399` to `4131102`, plus `27e8646` (docs).
> - Every phase passed its gate. Final state: 94 web and 106 API unit tests, 40 end-to-end tests, lint clean.
> - Idle dashboard: about 2 requests a minute (one health check a minute, plus a 5-minute fallback refresh).
> - Bundle: +25 kB gzip overall, +38 kB on first load. The Phase 7 estimate of +15 kB under-counted RTK Query and axios.
> - Deployed to the local stack; the Instagram helper is proxied through the API.
> - Next: [v3 plan](../v3/plan.md).

**Goal:** restructure the web app, with **zero change in behaviour**.
- One global Redux store.
- Every API route and its model defined in one place.
- One HTTP client (axios) that sets headers, auth handling and errors once.
- A clean, feature-based folder structure.

Along the way, fix the problems found in the code review. Every phase ends fully tested end to end against the current features.

**Decisions (agreed):**

| Topic | Decision |
|---|---|
| State and data | **Redux Toolkit + RTK Query.** One store; RTK Query replaces TanStack Query for all server data. |
| HTTP | **axios**, one configured instance used as RTK Query's base query. |
| Models | Hand-written, typed models in `apps/web/src/models`, one file per domain. |
| Instagram browser-login helper | **Proxied through the API** (`/api/integrations/instagram/browser-login/*`); the browser never calls `localhost:4005`. |
| Delivery | New branch **`feature/v2.2-architecture`**. Each phase is committed as soon as all tests pass; nothing is pushed. |

---

## 1. Where things stand (audit, 29 Sep 2026)

| Area | Today | Problem |
|---|---|---|
| API calls | `api/client.ts` (a small `fetch` wrapper). **114 call sites over ~80 endpoints**, written inline across 25 files. | Paths are string-built at every call site; there's no single list of routes. |
| Server state | TanStack Query: 9 shared hooks in `api/queries.ts` plus ~70 inline `useQuery`/`useMutation` calls with ad-hoc keys. | **`/workflows/:id` is cached twice**: `["workflow", id]` on the run page and `["workflow-detail", id]` in the inspector and steps view. It's fetched twice, and the live stream only refreshes one of them. |
| Models | `api/types.ts` exists, but 9 files re-declare their own versions (`AgentDetail`, `WorkflowDetail`, `TemplateRun`, …). | Copies drift silently when the API changes. |
| App state | `AuthContext`, `NotificationContext` (manual fetch into `useState`), `ThemeProvider` in `lib/theme.tsx`, and sidebar state in `Layout.tsx` via localStorage. | Four patterns for global state. Notifications have their own caching and error handling. |
| Live updates | 3 `EventSource` connections: activity, per-job progress, notifications. | Each wired differently. |
| Bug | `IntegrationsPage` calls `http://localhost:4005` from the browser. | **Blocked by the production CSP** (`connect-src 'self' https:`), and only works on the helper's own machine. |
| Large files | `ProvidersPage` 1,390 lines, `IntegrationsPage` 887, `RunView` 649, `WorkflowPage` 604, `BuilderPage` 599, `PromptsPage` 598. | Data, forms, modals and layout mixed in one file. |
| Folders | `pages/` + `components/<feature>` + `components/ui` + `lib` (good), but also `auth/`, `contexts/`, a one-file `data/`, and feature code inside pages. | No consistent rule for where things go. |
| Tests | 54 web unit, 97 API unit + 3 integration, 41 Python, 22 browser. | No browser coverage for Providers, Integrations, Agents list/detail/create, Artifacts, Analytics, Costs, Team, Settings, Profile, Project detail or the workflow run form/schedules. That's the safety net this refactor needs first. |

---

## 2. Target architecture

### 2.1 Layers

```
 page / component
      │  useGetRunQuery(id), useCancelRunMutation(), useAppSelector(selectSidebar)
      ▼
 features/<area>/<area>.api.ts   ← RTK Query endpoints (injectEndpoints), cache tags
      │  query: () => ({ url: routes.runs.detail(id) })
      ▼
 services/api/baseApi.ts          ← createApi({ baseQuery: axiosBaseQuery, tagTypes })
      │
 services/http/client.ts          ← ONE axios instance: baseURL, headers, interceptors
      │
      ▼  /api/...   (nginx / vite proxy → Fastify)
```

- **`services/http/client.ts`** is the only place that knows about HTTP. It is one axios instance with:
  - `baseURL: "/api"`, `withCredentials: true` (the session cookie) and a timeout.
  - Default headers set once: `Accept: application/json`, `X-Requested-With: XMLHttpRequest`, and a hook for a future `Authorization` header (API keys, v3).
  - **Request interceptor:** a correlation id (`X-Request-Id`), ready to be logged by the API.
  - **Response interceptor:** normalises every failure into an `ApiError { status, code, message, details }`. The API's `message`/`error` body shapes, network errors, timeouts and cancellations are all handled. On a **401**, it dispatches `auth/sessionExpired` and redirects to `/login`, except for `/auth/*` routes.
  - Cancellation: RTK Query's `AbortSignal` is passed to axios, so unmounted pages cancel their requests.
- **`services/api/routes.ts`** is **every API path in one typed object**, and nothing else builds URLs:
  ```ts
  export const routes = {
    runs: {
      list: (q: { status?: RunStatusFilter; limit?: number }) => ({ url: "/template-runs", params: q }),
      detail: (id: string) => `/template-runs/${id}`,
      cancel: (id: string) => `/template-runs/${id}/cancel`,
    },
    workflows: { detail: (id) => `/workflows/${id}`, logs: (id) => `/workflows/${id}/logs`, … },
    streams: { activity: "/api/events/stream", job: (id) => `/api/jobs/${id}/events`, notifications: "/api/notifications/stream" },
    files: { download: (artifactId) => `/api/artifacts/${artifactId}/download` },   // for <img>/<video> src
    …
  } as const;
  ```
- **`services/api/baseApi.ts`:** `createApi` with `axiosBaseQuery`, the full `tagTypes` list and a default `keepUnusedDataFor`. Features add their endpoints with `injectEndpoints`, so each feature owns its API file while everything shares one cache.
- **`services/api/axiosBaseQuery.ts`** adapts the axios instance to RTK Query, returning `{ data }` or `{ error: ApiError }`.
- **`services/realtime/*`** holds the server-sent-event clients: `activity`, `jobProgress` and `notifications`. Browsers can't stream SSE with axios; `EventSource` is the standard, so it stays, but wrapped in one place with reconnect and cleanup. Stream signals update the Redux cache (`api.util.invalidateTags` / `updateQueryData`) instead of each page managing its own.

### 2.2 Redux store

```
store
├── api        (RTK Query cache: every server response, request status, subscriptions)
├── auth       { user, status: "unknown" | "authed" | "anon" }       ← from /auth/me, login/logout
├── ui         { theme, sidebar: { collapsed, width, lastWidth }, commandPaletteOpen, mobileNavOpen }
├── studio     { draft: { topic, tone, roles } }                       ← was localStorage in StudioPage
└── realtime   { activityConnected, lastSignalAt }                    ← stream health (for the UI and tests)
```

- **Persistence:** a small `listenerMiddleware` saves `ui.theme`, `ui.sidebar` and `studio.draft` to localStorage and restores them at startup. It keeps **the same keys used today** (`agentry-theme`, `agentry-sidebar-*`, `agentry.studio.draft`), so users keep their settings. No extra dependency.
- **Typed hooks:** `useAppDispatch` and `useAppSelector` in `app/hooks.ts`, plus memoised selectors per slice.
- **Redux DevTools** in development; the whole cache and every action are visible.

### 2.3 Cache tags (replacing the ad-hoc query keys)

| Tag | Endpoints that provide it | Invalidated by |
|---|---|---|
| `Run` (id / `LIST`) | `GET /template-runs`, `GET /template-runs/:id` | run start, cancel, activity signal |
| `Workflow` (id / `LIST`) | `GET /workflows/:id`, `/workflows/recent` | cancel, advance, activity signal |
| `WorkflowLogs`, `WorkflowEvents`, `WorkflowArtifacts` (id) | the matching `/workflows/:id/*` | activity / job stream |
| `Template` (id / `LIST`), `Schedule` | `/templates*`, `/templates/:id/schedules` | save, delete, schedule add/remove |
| `Agent`, `Capability`, `Model`, `Provider` | `/agents*`, `/capabilities`, `/models`, `/providers*` | rescan, custom create, provider edits |
| `Project`, `Artifact`, `Prompt`, `SocialAccount`, `User`, `Setting`, `Notification` | their lists and details | their mutations |
| `Stats` (overview / agents / series / costs / system) | `/stats/*` | activity signal (throttled), pricing save |
| `Event` | `/events` | activity signal |

This removes the duplicate `/workflows/:id` cache: there is one `getWorkflow` endpoint. The live-activity handler invalidates **tags**, not hand-listed keys, so no page can be missed.

### 2.4 Folder structure

```
apps/web/src/
├── app/                     # composition only
│   ├── store.ts  hooks.ts  persistence.ts
│   ├── providers.tsx        # <Provider store>, <ThemeSync>, <Toaster>, router
│   └── routes.tsx           # all routes (lazy feature pages); RequireAuth; redirects
├── services/
│   ├── http/client.ts  http/errors.ts        # axios instance + ApiError
│   ├── api/baseApi.ts  api/axiosBaseQuery.ts  api/routes.ts  api/tags.ts
│   └── realtime/activity.ts  jobProgress.ts  notifications.ts
├── models/                  # one typed file per domain; the ONLY API type definitions
│   ├── common.ts  runs.ts  workflows.ts  templates.ts  agents.ts  providers.ts
│   ├── artifacts.ts  projects.ts  prompts.ts  stats.ts  users.ts
│   └── notifications.ts  socialAccounts.ts  studio.ts  settings.ts  events.ts
├── features/                # one folder per product area
│   └── <area>/
│       ├── <area>.api.ts    # RTK Query endpoints for this area
│       ├── <area>.slice.ts  # only if it has client state (auth, ui, studio)
│       ├── pages/           # route screens (thin: layout + composition)
│       ├── components/      # area-specific components
│       ├── hooks/           # area-specific hooks
│       └── __tests__/
│   areas: auth · shell (layout, sidebar, topbar, palette) · dashboard · runs
│          workflows (library, editor, run form, schedules) · studio · agents
│          projects · artifacts · prompts · providers · integrations
│          analytics · costs · team · settings · profile · notifications
├── components/
│   ├── ui/                  # primitives (button, card, dialog, select, …) — unchanged API
│   └── common/              # shared app components: PageHeader, StatusBadge/StatusDot, StatCard,
│                            #   EmptyState, ArtifactPreview, charts, three/ (3D scene)
├── hooks/                   # generic hooks only (useNow, useSticky, useFitHeight)
├── lib/                     # pure utilities + tests (format, status, cron, workflowGraph, …)
└── styles/index.css
```

**Rules** (in `apps/web/README.md`, enforced by lint where possible):
1. Pages and components **never** import axios or `services/http`, and never build URLs. They use feature API hooks. ESLint `no-restricted-imports` enforces it.
2. Every API type lives in `models/`. Components import types, never re-declare them.
3. A feature may import from `components/*`, `lib/*`, `hooks/*`, `models/*` and another feature's **public API hooks**, but not another feature's internal components.
4. Pages stay under about 300 lines; anything bigger is split into `components/`.
5. Tests sit next to their code in `__tests__/`.

---

## 3. Phases

Every phase passes **the same gate** before it's committed:

1. `tsc --noEmit`, web unit tests, API unit tests (plus integration and Python when the API or SDK is touched).
2. **The full browser suite, run twice:** once with no worker and once with a live worker. It runs under the production CSP.
3. **Request audit:** a script records every `/api` call per page, while idle and during an action. It's compared to the saved baseline and must show no new duplicates, no extra polling and no missing refreshes.
4. **Screenshot check** of every page, dark and light, desktop and mobile, compared against the baseline tour.
5. A commit with a descriptive message; nothing is pushed.

### Phase 0 — Safety net *(before any refactor)*
- **New browser specs** for the features that have none. Each spec creates its own data through the API and cleans up after itself:
  - Providers: register → edit → set default → discover models → add model → delete.
  - Integrations: connected list, connect dialog opens and validates, test connection.
  - Agents: list/filter/tabs, agent detail, create custom agent, scaffold dialog.
  - Submit agent: run with the provider picker and a saved prompt.
  - Artifacts: filters, preview dialog, download link.
  - Projects: create, open, rename/delete; project detail templates and artifacts.
  - Workflow run form: required inputs, run now, **add/remove a schedule**.
  - Analytics and Cost Monitor: range switch, pricing save.
  - Team: add member, change role, remove.
  - Settings: theme switch (persisted); Profile: update name.
  - Notifications: a failed run produces a notification; mark read; delete.
  - Studio: publish panel visibility.
- **Baselines** of the request audit and the screenshot tour, taken on the current code.
- *Commit:* `test(e2e): cover every page before the architecture refactor`

### Phase 1 — Foundation *(no page changes yet)*
- Add dependencies: `@reduxjs/toolkit`, `react-redux`, `axios`.
- **HTTP client:** `services/http/client.ts` + `errors.ts`.
- **API core:** `services/api/*` (`baseApi`, `axiosBaseQuery`, `routes.ts` with all ~80 endpoints, `tags.ts`).
- **`models/*`:** built from `api/types.ts` and the 9 local re-declarations, checked against the API responses.
- **App wiring:** `app/store.ts`, `hooks.ts`, `persistence.ts`, `providers.tsx`. The store is mounted **next to** TanStack Query, so both work during the migration.
- **Unit tests:**
  - `ApiError` normalisation (API error body shapes, network errors, timeouts, 401 redirect).
  - `axiosBaseQuery`.
  - Every `routes.*` path builder, including query params and encoding.
  - Persistence round-trip using the existing localStorage keys.
- *Commit:* `feat(web): add redux store, axios client, central routes and models`

### Phase 2 — App shell, auth, notifications, live updates
- **`auth.slice` + `auth.api`:** me, login, logout, setup, setup-status and profile replace `AuthContext`. `RequireAuth` reads from the store.
- **`ui.slice`:**
  - Theme, replacing `ThemeProvider`; the `?theme=` override still works.
  - Sidebar collapsed/width/lastWidth, command palette and mobile nav, replacing `Layout.tsx`'s own state.
- **Notifications:** `notifications.api` (list, read, read-all, delete) with the stream applied to the cache through `onCacheEntryAdded`. Replaces `NotificationContext`; toasts and de-duplication behave the same.
- **`services/realtime/activity`:** the push stream dispatches tag invalidation, replacing `useLiveActivity`, with the same 750 ms coalescing.
- **Shell:** Sidebar, Topbar (health pill), CommandPalette and Layout move to `features/shell`.
- *Commit:* `refactor(web): app shell, auth, theme, notifications and live updates on redux`

### Phase 3 — Runs, dashboard, observability pages
- `runs.api`, `workflows.api` (agent runs: detail, logs, events, artifacts, cancel, advance, reap) and `stats.api`.
- Migrate the Dashboard, Runs list, workflow run page (graph and inspector), agent run page, Analytics and Cost Monitor (with its pricing editor).
- The per-job live stream moves to `realtime/jobProgress`, updating the `Workflow` cache entry.
- **Fixes the duplicate `/workflows/:id` cache.** The request audit must show one fetch where there were two.
- *Commit:* `refactor(web): runs, dashboard, analytics and costs on RTK Query`

### Phase 4 — Workflows and Content Studio
- `templates.api` (library, detail, create/update/delete, validate, run, schedules) and `studio.api` (briefs, social accounts).
- Migrate the workflow library, editor (`useTemplateDraft` reads from RTK Query), run form and schedules, and Studio.
- Studio's draft moves into `studio.slice` (same localStorage key); `useFitHeight` moves to `hooks/`.
- **Split** `RunView` (649) into header, post preview, output card, working and failed states, and the publish panel.
- *Commit:* `refactor(web): workflows, editor and Content Studio on RTK Query`

### Phase 5 — Agents, prompts, artifacts, projects
- `agents.api` (list, detail, rescan, custom, scaffold, capabilities, models), `prompts.api`, `artifacts.api` (list, SAS preview/download, text content via axios) and `projects.api`.
- Migrate Agents, Agent detail, Submit agent, Create agent, Prompts, Artifacts and Projects/Project detail.
- **Split** `PromptsPage` (598) and `BuilderPage` (599).
- *Commit:* `refactor(web): agents, prompts, artifacts and projects on RTK Query`

### Phase 6 — Providers, integrations, Instagram helper proxy *(API + web)*
- **API:** new `integrations/instagram/browserLogin` routes: `GET status`, `POST start`, `GET session status`, `POST cancel`.
  - They forward to the helper at `INSTAGRAM_HELPER_URL` (default `http://localhost:4005`), with a timeout and a clear `helper_offline` error.
  - Access checks: signed-in user, project scope.
  - Documented in `.env.example` and `docs/10-deployment.md`.
  - API unit tests with a mocked helper, including the helper-offline case.
- **Web:** `providers.api` and `integrations.api`. Split `ProvidersPage` (1,390) and `IntegrationsPage` (887) into `features/providers/components/*` and `features/integrations/components/*` (list, cards, forms, dialogs), with each page under 300 lines. The browser-login flow uses the proxy, so there are no more direct `localhost:4005` calls and the CSP is untouched.
- *Commit:* `feat(api,web): proxy the Instagram login helper; providers and integrations on RTK Query`

### Phase 7 — Team, settings, profile; remove the old layer; finish the structure
- Migrate Team, Settings and Profile.
- **Delete** `api/client.ts`, `api/queries.ts`, `api/types.ts`, `@tanstack/react-query`, `contexts/`, `auth/`, `data/` and `lib/theme.tsx`.
- Move the remaining files into the target folders, with import paths updated.
- **Lint rules:** no axios or `services/http` outside `services/`, no `fetch(` outside `services/`, no URL building in features.
- `apps/web/README.md`: architecture, folder rules and "how to add an endpoint / a page".
- **Final check:**
  - Full gate, and a 5-minute idle request audit (the dashboard must stay at about 1 request a minute).
  - Bundle size compared with the baseline (expected: react-query out ~13 kB gz; RTK + react-redux + axios in ~28 kB gz).
  - Deploy to the local stack and smoke-test it.
- *Commit:* `refactor(web): remove the legacy data layer; final folder structure and lint rules`

---

## 4. Behaviour that must not change (tested in every phase)

- **Live updates:**
  - Push-driven refresh.
  - The idle dashboard at about 1 request a minute.
  - Run pages polling only while live (the run page every 2 s, Studio every 3 s).
  - Logs streaming on the run pages.
- **Stored settings survive the upgrade:** theme, sidebar and Studio draft keep their localStorage keys.
- **Sessions:** a 401 anywhere redirects to `/login` (except the auth routes), and deep links survive the login redirect.
- **Errors:** the error text shown in toasts and forms is the same, via `ApiError.message`.
- **Security:** CSP compliance (the browser suite runs under the production policy); no inline scripts, no eval.
- **Routing:** `/executions` → `/runs`, `?theme=`, `?view=`, `?run=`, `?type=`, `?status=` and `?new=1` all keep working.
- **Dialogs:** centred, animated, closable with Escape.

## 5. Risks and how they're handled

| Risk | Mitigation |
|---|---|
| A page silently loses a refresh after a mutation | Tag invalidation is covered per mutation in the Phase 0 specs; the request audit diffs every page. |
| The editor's draft logic (`useTemplateDraft`) regresses | It's migrated alone in Phase 4 with the existing editor spec plus a new save/validate/branch spec. |
| RTK Query caches differently (e.g. keeps data after navigation) | `keepUnusedDataFor` is set to match today's behaviour; specs cover returning to a page. |
| SSE and cache race (a signal arrives mid-fetch) | Invalidation queues a refetch after the in-flight request; covered by the live-update spec with a worker running. |
| A large diff is hard to review | Seven phases, each small enough to review and green on its own. |

## 6. Estimate

| Phase | Effort |
|---|---|
| 0 Safety net | 1–1.5 days |
| 1 Foundation | 1 day |
| 2 Shell / auth / notifications / live | 1 day |
| 3 Runs / dashboard / analytics / costs | 1–1.5 days |
| 4 Workflows / editor / Studio | 1.5 days |
| 5 Agents / prompts / artifacts / projects | 1 day |
| 6 Providers / integrations / IG proxy | 1.5 days |
| 7 Cleanup / lint / docs / final check | 0.5–1 day |
| **Total** | **~8–10 working days** |

## 7. Out of scope for v2.2

- Any visible UI change or new feature (v3 plan).
- The API's own structure, apart from the Instagram helper proxy.
- Moving live updates to Redis pub/sub (needed before multiple API replicas; planned separately).

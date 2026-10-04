# Agentry web app

React 18 + Vite + Tailwind. Server state lives in **RTK Query**, client state in **Redux Toolkit**, and every HTTP call goes through one **axios** instance.

```bash
npm run dev      # http://localhost:5173 (proxies /api to the API)
npm test         # unit tests (vitest)
npm run lint     # architecture rules + hooks + unused code
npm run build    # type-check and bundle
```

End-to-end tests live in `apps/e2e` (Playwright, run against the production build under the production CSP).

## Structure

```
src/
├── main.tsx            entry: Redux provider, theme, session bootstrap, router
├── app/                composition only: store, typed hooks, persistence, routes.tsx
├── services/
│   ├── http/           the axios instance (auth cookie, X-Request-Id, 401 → login) and ApiError
│   ├── api/            baseApi (RTK Query), routes.ts (every API path), tags, polling
│   └── realtime/       server-sent event streams (activity, notifications)
├── models/             every API data shape, one file per domain
├── features/<area>/    one folder per product area
│   ├── <area>.api.ts   RTK Query endpoints (injectEndpoints on baseApi)
│   ├── <area>.slice.ts client state, only where there is some (auth, shell/ui, studio)
│   ├── pages/          route screens
│   ├── components/     components used only by this area
│   ├── hooks/          hooks used only by this area
│   └── __tests__/
├── components/
│   ├── ui/             primitives (button, card, dialog, select, …)
│   └── common/         shared app components (PageHeader, StatCard, StatusBadge, ArtifactPreview, …)
├── hooks/              generic hooks (useNow, useSticky)
├── lib/                pure utilities, with tests
└── styles/index.css    design tokens and global styles
```

## Rules

1. **Only `services/` talks HTTP.** Pages and components never import axios or `services/http/client`, never call `fetch`, and never write an `/api/...` URL. They use a feature's API hooks. *Lint enforces this.*
2. **Every API path is in `services/api/routes.ts`**, and every API type is in `models/`. Components import types; they don't redeclare them.
3. **Features stay separate.** A feature may import `components/*`, `lib/*`, `hooks/*`, `models/*` and another feature's API hooks (`<area>.api.ts`), but not another feature's `components/`, `pages/` or `hooks/`. If two features need a component, it moves to `components/common`. The one exception is `features/shell`, which composes the app frame (it renders the notifications dropdown).
4. **Pages stay small** (about 300 lines). Split anything bigger into the feature's `components/`.
5. **Cached data is read-only.** RTK Query freezes what it caches: copy before mutating (for example, `structuredClone` a schema before handing it to rjsf).
6. Tests sit next to their code in `__tests__/`.

## How to add an endpoint

1. Add the path to `services/api/routes.ts`.
2. Add or extend the response type in `models/<domain>.ts`.
3. Add the endpoint to `features/<area>/<area>.api.ts`:

   ```ts
   export const widgetsApi = baseApi.injectEndpoints({
     endpoints: (build) => ({
       widgets: build.query<Widget[], string>({
         query: (projectId) => routes.widgets.list(projectId),
         providesTags: (res) => listTags("Widget", res),
       }),
       createWidget: build.mutation<Widget, CreateWidgetBody>({
         query: (body) => ({ url: routes.widgets.create, method: "POST", body }),
         invalidatesTags: [{ type: "Widget", id: LIST }],
       }),
     }),
   });
   export const { useWidgetsQuery, useCreateWidgetMutation } = widgetsApi;
   ```

   New tag types go in `services/api/tags.ts`. Mutations invalidate tags; no page refreshes data by hand.
4. Use the hooks in a page. For a mutation, `trigger(args).unwrap()` gives a promise; show failures with `toast.error(errorMessage(err))`.

Things to know:

- **Skipped queries keep their last data.** When the argument can change (another run, another project), read `currentData`, which is only ever the current argument's result.
- **Live data.** The activity stream (`services/realtime/activity.ts`) invalidates the run, workflow, stats and event tags when something happens, so lists stay fresh without polling. Poll only while something is running (`pollingInterval`), and use `poll()` from `services/api/polling.ts` for the slow fallback.
- **Auth.** The session is a cookie; the axios instance sends it. A 401 from any endpoint ends the session and redirects to the login page. Logout resets the whole API cache.

## How to add a page

1. Create `features/<area>/pages/<Name>Page.tsx`.
2. Register it in `app/routes.tsx` as a lazy route, so it loads on first visit.
3. Add it to the sidebar in `features/shell/nav.ts` if it needs a menu entry.

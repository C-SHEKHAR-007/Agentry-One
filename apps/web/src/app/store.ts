import { combineReducers, configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { baseApi } from "../services/api/baseApi";
import { setUnauthorizedHandler } from "../services/http/client";
import { authReducer, sessionExpired } from "../features/auth/auth.slice";
import { persistUi, uiReducer } from "../features/shell/ui.slice";
import { persistDraft, studioReducer } from "../features/studio/studio.slice";

/** Side effects that react to actions (persistence, session handling);
 * slices register theirs with `listener.startListening`. */
export const listener = createListenerMiddleware();

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  auth: authReducer,
  ui: uiReducer,
  studio: studioReducer,
});

// Persist UI preferences (theme, sidebar) whenever they change.
listener.startListening({
  predicate: (_action, current, previous) => (current as RootState).ui !== (previous as RootState).ui,
  effect: (_action, api) => persistUi((api.getState() as RootState).ui),
});
// Persist the Studio draft (topic, tone, outputs) as it's edited.
listener.startListening({
  predicate: (_action, current, previous) => (current as RootState).studio.draft !== (previous as RootState).studio.draft,
  effect: (_action, api) => persistDraft((api.getState() as RootState).studio.draft),
});

export function makeStore(preloadedState?: Partial<ReturnType<typeof rootReducer>>) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) => getDefault().prepend(listener.middleware).concat(baseApi.middleware),
    devTools: import.meta.env.DEV,
  });
  setupListeners(store.dispatch); // refetchOnFocus / refetchOnReconnect
  // A 401 on any request ends the session in the store.
  setUnauthorizedHandler(() => store.dispatch(sessionExpired()));
  return store;
}

export const store = makeStore();

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];

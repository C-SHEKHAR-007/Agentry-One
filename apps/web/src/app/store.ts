import { combineReducers, configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { baseApi } from "../services/api/baseApi";

/** Side effects that react to actions (persistence, session handling);
 * slices register theirs with `listener.startListening`. */
export const listener = createListenerMiddleware();

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
});

export function makeStore(preloadedState?: Partial<ReturnType<typeof rootReducer>>) {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) => getDefault().prepend(listener.middleware).concat(baseApi.middleware),
    devTools: import.meta.env.DEV,
  });
  setupListeners(store.dispatch); // refetchOnFocus / refetchOnReconnect
  return store;
}

export const store = makeStore();

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];

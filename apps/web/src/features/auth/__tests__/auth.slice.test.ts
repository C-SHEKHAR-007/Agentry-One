import { afterEach, describe, expect, it } from "vitest";
import type { AxiosAdapter } from "axios";
import { makeStore } from "../../../app/store";
import { http } from "../../../services/http/client";
import { logout, refreshSession, sessionExpired } from "../auth.slice";

const original = http.defaults.adapter;
afterEach(() => {
  http.defaults.adapter = original;
});

/** Fake API: path -> [status, body]. */
function fakeApi(routes: Record<string, [number, unknown]>) {
  const calls: string[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push(`${config.method?.toUpperCase()} ${config.url}`);
    const [status, data] = routes[config.url ?? ""] ?? [404, { error: "not_found" }];
    const res = { data, status, statusText: "", headers: {}, config, request: {} };
    if (status >= 400) throw Object.assign(new Error(String(status)), { isAxiosError: true, response: res, config, toJSON: () => ({}) });
    return res;
  };
  http.defaults.adapter = adapter;
  return calls;
}

describe("auth slice", () => {
  it("signed in: loads the user", async () => {
    fakeApi({ "/auth/setup-status": [200, { needsSetup: false }], "/auth/me": [200, { user: { id: "u1", email: "a@b.c", role: "owner" } }] });
    const store = makeStore();
    await store.dispatch(refreshSession());
    expect(store.getState().auth).toEqual({ status: "authed", user: { id: "u1", email: "a@b.c", role: "owner" } });
  });

  it("first run: needs setup", async () => {
    fakeApi({ "/auth/setup-status": [200, { needsSetup: true }] });
    const store = makeStore();
    await store.dispatch(refreshSession());
    expect(store.getState().auth.status).toBe("needsSetup");
  });

  it("no session: signed out", async () => {
    fakeApi({ "/auth/setup-status": [200, { needsSetup: false }], "/auth/me": [401, { error: "unauthorized" }] });
    const store = makeStore();
    await store.dispatch(refreshSession());
    expect(store.getState().auth).toEqual({ status: "unauthed", user: null });
  });

  it("logout ends the session and drops every cached response", async () => {
    const calls = fakeApi({
      "/auth/setup-status": [200, { needsSetup: false }],
      "/auth/me": [200, { user: { id: "u1", email: "a@b.c", role: "owner" } }],
      "/auth/logout": [204, ""],
    });
    const store = makeStore();
    await store.dispatch(refreshSession());
    expect(Object.keys(store.getState().api.queries).length).toBeGreaterThan(0);
    await store.dispatch(logout());
    expect(calls).toContain("POST /auth/logout");
    expect(store.getState().auth.status).toBe("unauthed");
    expect(Object.keys(store.getState().api.queries)).toHaveLength(0);
  });

  it("a 401 elsewhere expires the session", () => {
    const store = makeStore();
    store.dispatch(sessionExpired());
    expect(store.getState().auth).toEqual({ status: "unauthed", user: null });
  });
});

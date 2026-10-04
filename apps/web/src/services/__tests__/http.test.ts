import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { http, setUnauthorizedHandler } from "../http/client";
import { ApiError, toApiError } from "../http/errors";
import { axiosBaseQuery } from "../api/axiosBaseQuery";

/** Replies from a fake adapter instead of the network. */
function respond(status: number, data: unknown, statusText = "") {
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const res = { data, status, statusText, headers: {}, config, request: {} };
    if (status >= 400) {
      const err = Object.assign(new Error(`status ${status}`), { isAxiosError: true, response: res, config, toJSON: () => ({}) });
      throw err;
    }
    return res;
  };
  http.defaults.adapter = adapter;
}

const originalAdapter = http.defaults.adapter;
let lastConfig: InternalAxiosRequestConfig | null = null;
beforeEach(() => {
  lastConfig = null;
  http.interceptors.request.use((c) => ((lastConfig = c), c));
});
afterEach(() => {
  http.defaults.adapter = originalAdapter;
  setUnauthorizedHandler(null);
});

describe("toApiError", () => {
  it("prefers the API's message, then error, then the status text", async () => {
    respond(422, { error: "bad_input", message: "name is required" });
    const e1 = await http.get("/x").catch((e) => e);
    expect(e1).toBeInstanceOf(ApiError);
    expect(e1).toMatchObject({ message: "name is required", status: 422, code: "bad_input" });

    respond(404, { error: "workflow_not_found" });
    expect(await http.get("/x").catch((e) => e)).toMatchObject({ message: "workflow_not_found", status: 404, code: "http_404" });

    respond(502, "<html>bad gateway</html>", "Bad Gateway");
    expect(await http.get("/x").catch((e) => e)).toMatchObject({ message: "Bad Gateway", status: 502 });
  });

  it("classifies network errors, timeouts and plain errors", () => {
    expect(toApiError({ isAxiosError: true, code: "ECONNABORTED", config: {} })).toMatchObject({ code: "timeout", status: 0 });
    expect(toApiError({ isAxiosError: true, config: {} })).toMatchObject({ code: "network", status: 0 });
    expect(toApiError(new Error("boom"))).toMatchObject({ message: "boom", code: "unknown" });
  });
});

describe("http client", () => {
  it("sends the shared headers and credentials on every request", async () => {
    respond(200, { ok: true });
    await http.get("/agents");
    expect(lastConfig?.baseURL).toBe("/api");
    expect(lastConfig?.withCredentials).toBe(true);
    expect(lastConfig?.headers.get("Accept")).toBe("application/json");
    expect(lastConfig?.headers.get("X-Requested-With")).toBe("XMLHttpRequest");
    expect(String(lastConfig?.headers.get("X-Request-Id"))).toMatch(/^web-/);
  });

  it("ends the session on a 401, except for auth routes", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, pathname: "/runs", assign });
    respond(401, { error: "unauthorized" });
    await http.get("/workflows/recent").catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/login");

    await http.get("/auth/me").catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe("axiosBaseQuery", () => {
  const api = { signal: new AbortController().signal } as Parameters<ReturnType<typeof axiosBaseQuery>>[1];

  it("returns data, maps 204 to undefined and sends {} for bodiless POSTs", async () => {
    const q = axiosBaseQuery();
    respond(200, [1, 2]);
    expect(await q("/runs", api, {})).toEqual({ data: [1, 2] });
    respond(204, "");
    expect(await q({ url: "/runs/1/cancel", method: "POST" }, api, {})).toEqual({ data: undefined });
    expect(lastConfig?.data).toBe("{}");
  });

  it("returns a plain, serialisable error on failure", async () => {
    respond(409, { message: "already running" });
    const res = await axiosBaseQuery()({ url: "/x", method: "POST", body: { a: 1 } }, api, {});
    expect(res.error).toEqual({ status: 409, code: "http_409", message: "already running", details: undefined });
  });
});

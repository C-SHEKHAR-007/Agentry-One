import type { AxiosAdapter } from "axios";
import { http } from "../services/http/client";

/** Replaces the network for a test: `routes` maps "METHOD /path" (or just
 * "/path" for GET) to [status, body]. Returns the list of calls made. */
export function fakeApi(routes: Record<string, [number, unknown] | (() => [number, unknown])>) {
  const calls: string[] = [];
  const adapter: AxiosAdapter = async (config) => {
    const method = (config.method ?? "get").toUpperCase();
    const url = config.url ?? "";
    const key = `${method} ${url}`;
    calls.push(key);
    const hit = routes[key] ?? (method === "GET" ? routes[url] : undefined);
    const [status, data] = typeof hit === "function" ? hit() : hit ?? [404, { error: "not_found" }];
    const res = { data, status, statusText: "", headers: {}, config, request: {} };
    if (status >= 400) throw Object.assign(new Error(String(status)), { isAxiosError: true, response: res, config, toJSON: () => ({}) });
    return res;
  };
  const previous = http.defaults.adapter;
  http.defaults.adapter = adapter;
  return { calls, restore: () => (http.defaults.adapter = previous) };
}

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

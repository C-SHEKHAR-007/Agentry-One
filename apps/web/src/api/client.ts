/**
 * Legacy call-style wrapper (v2.2 migration). It now sends every request
 * through the shared axios client (services/http/client.ts), so headers,
 * credentials, the 401 redirect and error normalisation are already
 * centralised for code not yet moved to RTK Query endpoints. Removed once
 * every page uses features/*.api.ts.
 */
import { http } from "../services/http/client";
import { routes } from "../services/api/routes";

import type { AxiosResponse } from "axios";

const body = (b: unknown) => (b !== undefined && b !== null ? b : {});
// 204 No Content -> undefined (axios would give "").
const data = <T,>(res: AxiosResponse<T>) => (res.status === 204 ? (undefined as T) : res.data);

export const api = {
  get: async <T>(path: string) => data(await http.get<T>(path)),
  post: async <T>(path: string, b?: unknown) => data(await http.post<T>(path, body(b))),
  put: async <T>(path: string, b?: unknown) => data(await http.put<T>(path, body(b))),
  patch: async <T>(path: string, b?: unknown) => data(await http.patch<T>(path, b ?? undefined)),
  delete: async <T>(path: string) => data(await http.delete<T>(path)),
};

// Same-origin <img>/EventSource requests send the session cookie by themselves.
export const downloadUrl = routes.files.download;
export const sseUrl = routes.streams.job;

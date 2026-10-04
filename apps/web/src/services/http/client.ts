import axios, { type AxiosInstance } from "axios";
import { toApiError } from "./errors";

/** Base path of the API (same origin; nginx / the vite proxy forward it). */
export const API_BASE = "/api";

let onUnauthorized: (() => void) | null = null;
/** Registered by the app (auth slice) so a 401 anywhere ends the session. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

let counter = 0;
const requestId = () => `web-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * The one HTTP client. Every API call goes through this instance, so the
 * base URL, credentials, headers, timeouts and error handling are defined
 * exactly once.
 */
export const http: AxiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // the session cookie
  timeout: 60_000,
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

http.interceptors.request.use((config) => {
  config.headers.set("X-Request-Id", requestId());
  // Future: an API key / bearer token for programmatic access goes here.
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const apiError = toApiError(err);
    const url: string = err?.config?.url ?? "";
    if (apiError.status === 401 && !url.startsWith("/auth/")) {
      // Session expired or revoked: tell the app, then bounce to login
      // (unless already there).
      onUnauthorized?.();
      if (!["/login", "/setup"].includes(window.location.pathname)) window.location.assign("/login");
    }
    return Promise.reject(apiError);
  },
);

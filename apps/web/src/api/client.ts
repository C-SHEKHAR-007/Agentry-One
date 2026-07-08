const BASE_URL = "/api";
// When set, requests carry the static API key (programmatic/baked builds).
// Unset (normal dev), the browser session cookie is the credential -- it
// flows automatically because the vite proxy keeps everything same-origin.
const API_KEY: string | undefined = import.meta.env.VITE_AGENTRY_API_KEY;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401 && !path.startsWith("/auth/")) {
    // Session expired or revoked -- bounce to login (unless already there).
    if (!["/login", "/setup"].includes(window.location.pathname)) {
      window.location.assign("/login");
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body !== undefined && body !== null ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body !== undefined && body !== null ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body !== undefined && body !== null ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Same-origin <img>/EventSource requests send the session cookie by
// themselves; the ?key= param is only appended when an explicit API key is
// configured (the server accepts either).
export function downloadUrl(artifactId: string): string {
  const suffix = API_KEY ? `?key=${encodeURIComponent(API_KEY)}` : "";
  return `${BASE_URL}/artifacts/${artifactId}/download${suffix}`;
}

export function sseUrl(jobId: string): string {
  const suffix = API_KEY ? `?key=${encodeURIComponent(API_KEY)}` : "";
  return `${BASE_URL}/jobs/${jobId}/events${suffix}`;
}

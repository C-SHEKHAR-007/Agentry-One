const BASE_URL = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
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
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body !== undefined && body !== null ? body : {}) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body !== undefined && body !== null ? body : {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body !== undefined && body !== null ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Same-origin <img>/EventSource requests send the session cookie by
// themselves; the ?key= param is only appended when an explicit API key is
// configured (the server accepts either).
export function downloadUrl(artifactId: string): string {
  return `${BASE_URL}/artifacts/${artifactId}/download`;
}

export function sseUrl(jobId: string): string {
  return `${BASE_URL}/jobs/${jobId}/events`;
}

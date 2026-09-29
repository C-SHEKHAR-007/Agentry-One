/**
 * Client for the local Instagram browser-login helper
 * (scripts/instagram_browser_login.py). The helper opens Chrome on the
 * user's desktop, waits for them to sign in to Instagram and links the
 * session to Agentry itself. The web app never calls it directly: the API
 * proxies it, so the browser only talks to its own origin (and the CSP
 * stays `connect-src 'self'`).
 */

export const DEFAULT_HELPER_URL = "http://localhost:4005";
const TIMEOUT_MS = 4_000;

/** The helper isn't running (or didn't answer in time). */
export class HelperOfflineError extends Error {
  constructor() {
    super("The Instagram login helper isn't running. Start it with: python scripts/instagram_browser_login.py");
  }
}

/** The helper answered, but with an error. */
export class HelperError extends Error {
  constructor(readonly status: number) {
    super(`The Instagram login helper failed (HTTP ${status})`);
  }
}

export type LoginStatus = "idle" | "in_progress" | "success" | "failed" | "closed";

export interface LoginProgress {
  status: LoginStatus;
  handle: string | null;
  error: string | null;
  /** Seconds since the login started. */
  elapsed: number;
}

export interface InstagramHelper {
  /** Whether the helper is running, and its current session state. */
  status(): Promise<{ ready: boolean; session: LoginStatus }>;
  /** Opens Chrome for a new login; the account is linked to `projectId`. */
  start(projectId: string): Promise<void>;
  progress(): Promise<LoginProgress>;
  cancel(): Promise<void>;
}

const STATUSES: LoginStatus[] = ["idle", "in_progress", "success", "failed", "closed"];
const asStatus = (v: unknown): LoginStatus => (STATUSES.includes(v as LoginStatus) ? (v as LoginStatus) : "idle");
const asText = (v: unknown): string | null => (typeof v === "string" && v ? v.slice(0, 500) : null);

export function instagramHelper(baseUrl = process.env.INSTAGRAM_HELPER_URL || DEFAULT_HELPER_URL, timeoutMs = TIMEOUT_MS): InstagramHelper {
  const base = baseUrl.replace(/\/+$/, "");

  async function call(path: string, body?: unknown): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new HelperOfflineError();
    }
    if (!res.ok) throw new HelperError(res.status);
    return (await res.json().catch(() => ({}))) as Record<string, unknown>;
  }

  return {
    async status() {
      const d = await call("/status");
      return { ready: d.ready === true, session: asStatus(d.session_status) };
    },
    async start(projectId) {
      await call("/login/start", { projectId });
    },
    async progress() {
      // Only the fields the UI needs -- nothing else the helper might add.
      const d = await call("/login/status");
      return { status: asStatus(d.status), handle: asText(d.handle), error: asText(d.error), elapsed: Number(d.elapsed) || 0 };
    },
    async cancel() {
      await call("/login/cancel", {});
    },
  };
}

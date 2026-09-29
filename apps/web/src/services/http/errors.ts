import axios, { type AxiosError } from "axios";

/** Every failed API call surfaces as one of these, whatever went wrong:
 * an HTTP error from the API, a network failure, a timeout or a cancel. */
export class ApiError extends Error {
  /** HTTP status; 0 for network errors, timeouts and cancellations. */
  readonly status: number;
  /** Machine-readable code: the API's `error` field, or network/timeout/cancelled. */
  readonly code: string;
  /** Anything else the API sent (validation issues, …). */
  readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetwork() {
    return this.code === "network";
  }
  get isCancelled() {
    return this.code === "cancelled";
  }
}

interface ErrorBody {
  message?: unknown;
  error?: unknown;
  details?: unknown;
  issues?: unknown;
}

/** Normalises anything thrown by axios (or elsewhere) into an ApiError. The
 * API puts the human-readable text in `message` (central validation errors)
 * or `error` (older routes); both are honoured, `message` first. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (axios.isCancel(err)) return new ApiError("Request cancelled", 0, "cancelled");
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<ErrorBody>;
    if (e.code === "ECONNABORTED" || e.code === "ETIMEDOUT") return new ApiError("The request timed out", 0, "timeout");
    if (!e.response) return new ApiError("Can't reach the server — check your connection", 0, "network");
    const { status, statusText, data } = e.response;
    const body: ErrorBody = data && typeof data === "object" ? data : {};
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
    // Non-JSON bodies (e.g. an HTML gateway page) fall back to the status text.
    const message = text(body.message) ?? text(body.error) ?? (statusText || `Request failed: ${status}`);
    const code = text(body.error) && text(body.message) ? (body.error as string) : `http_${status}`;
    return new ApiError(message, status, code, body.details ?? body.issues);
  }
  return new ApiError(err instanceof Error ? err.message : String(err), 0, "unknown");
}

/** The plain (serialisable) form of an ApiError, as stored in the Redux
 * cache and returned as `error` by RTK Query hooks. */
export interface ApiErrorShape {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export const toErrorShape = (e: ApiError): ApiErrorShape => ({ status: e.status, code: e.code, message: e.message, details: e.details });

/** The message of whatever a hook or thunk failed with. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;
  if (typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") return (err as { message: string }).message;
  return fallback;
}

import crypto from "node:crypto";

/** Simulated OAuth/login flows (Google dev login, social "dev_mock" connect)
 * are only available when explicitly opted into, and never in production. A
 * query-string flag alone must never be able to mint a session or account. */
export function devMocksEnabled(): boolean {
  return process.env.AGENTRY_DEV_MOCKS === "true" && process.env.NODE_ENV !== "production";
}

const STATE_TTL_MS = 10 * 60 * 1000;

function stateKey(): Buffer {
  const secret = process.env.AGENTRY_CREDENTIALS_KEY;
  if (!secret) throw new Error("AGENTRY_CREDENTIALS_KEY is not set -- required to sign OAuth state");
  // Derive a dedicated key so the signing key is never the encryption key itself.
  return crypto.createHmac("sha256", secret).update("agentry-oauth-state-v1").digest();
}

/** Encodes `payload` as a tamper-proof, expiring OAuth `state` value:
 * base64url(json).base64url(hmac). */
export function signState(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", stateKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Returns the payload of a state produced by `signState`, or null if it was
 * forged, tampered with, or has expired. */
export function verifyState<T extends Record<string, unknown>>(state: string | undefined): T | null {
  if (!state) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", stateKey()).update(body).digest();
  const provided = Buffer.from(sig, "base64url");
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as T & { iat?: number };
    if (typeof payload.iat !== "number" || Date.now() - payload.iat > STATE_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

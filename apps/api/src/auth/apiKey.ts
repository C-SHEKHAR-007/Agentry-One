import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveSession, SESSION_COOKIE } from "./session.js";

const EXEMPT_PATHS = new Set([
  "/health",
  "/version",
  "/auth/setup-status",
  "/auth/setup",
  "/auth/login",
]);

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export type Principal = { kind: "apiKey" } | { kind: "user"; user: SessionUser };

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
  }
}

/** Dual-accept auth: the static API key (header or ?key=, unchanged from
 * Phase 1 -- workers/curl/SSE keep working, treated as owner-equivalent)
 * is checked FIRST; otherwise a session cookie from the browser login flow.
 * Neither -> 401. Real per-resource RBAC stays roadmap; role checks exist
 * only where they matter (user management). */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const pathOnly = req.url.split("?")[0];
  if (EXEMPT_PATHS.has(pathOnly)) return;

  const expected = process.env.AGENTRY_API_KEY;
  if (!expected) {
    // Fail closed: if the operator hasn't configured a key, refuse rather
    // than silently allowing unauthenticated access to a credential store.
    reply.code(500).send({ error: "AGENTRY_API_KEY is not configured on the server" });
    return;
  }

  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    const session = await resolveSession(token);
    if (session) {
      req.principal = { kind: "user", user: session.user };
      return;
    }
  }

  const provided = req.headers["x-api-key"] ?? (req.query as Record<string, string> | undefined)?.key;
  if (provided === expected) {
    req.principal = { kind: "apiKey" };
    return;
  }

  reply.code(401).send({ error: "missing or invalid credentials" });
}

/** Owner gate for user management. API-key callers count as owner (the key
 * is the operator's root credential). */
export function requireOwner(req: FastifyRequest, reply: FastifyReply): boolean {
  const p = req.principal;
  if (p?.kind === "apiKey" || (p?.kind === "user" && p.user.role === "owner")) return true;
  reply.code(403).send({ error: "owner role required" });
  return false;
}

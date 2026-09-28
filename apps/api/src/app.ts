import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { Prisma } from "@prisma/client";
import Fastify, { type FastifyError } from "fastify";
import sjson from "secure-json-parse";
import { ValidationError } from "./http/validate.js";
import { registerMetrics } from "./http/metrics.js";
import { prisma } from "./db/client.js";
import { getRedisConnection } from "./queue/connection.js";
import { agentsRoutes } from "./modules/agents/routes.js";
import { projectsRoutes } from "./modules/projects/routes.js";
import { workflowsRoutes } from "./modules/workflows/routes.js";
import { jobsRoutes } from "./modules/jobs/routes.js";
import { artifactsRoutes } from "./modules/artifacts/routes.js";
import { providersRoutes } from "./modules/providers/routes.js";
import { templatesRoutes } from "./modules/templates/routes.js";
import { settingsRoutes } from "./modules/settings/routes.js";
import { statsRoutes } from "./modules/stats/routes.js";
import { eventsRoutes } from "./modules/events/routes.js";
import { promptsRoutes } from "./modules/prompts/routes.js";
import { requireAuth } from "./auth/apiKey.js";
import { authRoutes } from "./modules/auth/routes.js";
import { usersRoutes } from "./modules/users/routes.js";

import { socialAccountsRoutes } from "./modules/socialAccounts/routes.js";
import { contentBriefsRoutes } from "./modules/contentBriefs/routes.js";
import { notificationsRoutes } from "./modules/notifications/routes.js";

function parseTrustProxy(value: string | undefined): boolean | string {
  if (value === undefined || value === "") return "loopback,uniquelocal";
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

const REDACTED_QUERY_PARAMS = ["key", "code", "state", "token", "access_token"];

function redactUrl(url: string): string {
  const q = url.indexOf("?");
  if (q === -1) return url;
  const params = new URLSearchParams(url.slice(q + 1));
  for (const name of REDACTED_QUERY_PARAMS) if (params.has(name)) params.set(name, "[REDACTED]");
  return `${url.slice(0, q)}?${params.toString()}`;
}

/** Comma-separated list of browser origins allowed to make credentialed
 * cross-origin calls. The web UI is served same-origin via the /api proxy, so
 * the default (no cross-origin access) is correct for normal deployments. */
function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
}

export function buildApp() {
  const app = Fastify({
    // Behind the web tier's nginx (or any reverse proxy) req.ip must be the
    // real client, or per-IP rate limits would be shared by every user.
    // Default trusts proxies on loopback/private networks (e.g. the compose
    // network); set TRUST_PROXY to "true", "false", or a list of addresses.
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      serializers: {
        // Never write the API key (accepted as ?key=) or other secrets in request logs.
        req: (req) => ({ method: req.method, url: redactUrl(req.url), remoteAddress: req.ip }),
      },
    },
  });

  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (!body || (typeof body === "string" && body.trim() === "")) {
      done(null, {});
      return;
    }
    try {
      // secure-json-parse keeps Fastify's default protection against
      // __proto__ / constructor.prototype poisoning.
      done(null, sjson.parse(body as string, undefined, { protoAction: "error", constructorAction: "error" }));
    } catch (err) {
      const e = err as FastifyError;
      e.statusCode = 400;
      done(e, undefined);
    }
  });

  const origins = allowedOrigins();
  app.register(cors, { origin: origins.length > 0 ? origins : false, credentials: true });
  app.register(cookie);
  // Opt-in per route (credential endpoints); in-memory, i.e. per API instance.
  app.register(rateLimit, { global: false });
  app.addHook("preHandler", requireAuth);
  registerMetrics(app);

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof ValidationError) {
      return reply.code(400).send({ error: "invalid_request", message: err.message, issues: err.issues });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return reply.code(404).send({ error: "not_found" });
      if (err.code === "P2002") return reply.code(409).send({ error: "conflict", message: "a record with these values already exists" });
      if (err.code === "P2003") return reply.code(409).send({ error: "conflict", message: "this record is referenced by or references another record" });
    }
    if (err instanceof Prisma.PrismaClientValidationError) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    const status = err.statusCode ?? 500;
    if (status < 500) return reply.code(status).send({ error: err.code ?? "request_error", message: err.message });
    // Never leak internals (Prisma/SQL details, stack traces) to clients.
    req.log.error({ err }, "unhandled error");
    return reply.code(500).send({ error: "internal_error" });
  });

  app.get("/health", async (_req, reply) => {
    const [dbOk, redisOk] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      getRedisConnection().ping().then(() => true).catch(() => false),
    ]);
    const healthy = dbOk && redisOk;
    return reply.code(healthy ? 200 : 503).send({ status: healthy ? "ok" : "degraded", db: dbOk, redis: redisOk });
  });

  app.get("/version", async () => ({ name: "agentry-api", version: "0.1.0" }));

  app.register(agentsRoutes);
  app.register(projectsRoutes);
  app.register(workflowsRoutes);
  app.register(jobsRoutes);
  app.register(artifactsRoutes);
  app.register(providersRoutes);
  app.register(templatesRoutes);
  app.register(settingsRoutes);
  app.register(statsRoutes);
  app.register(eventsRoutes);
  app.register(promptsRoutes);
  app.register(authRoutes);
  app.register(usersRoutes);
  app.register(socialAccountsRoutes);
  app.register(contentBriefsRoutes);
  app.register(notificationsRoutes);

  return app;
}

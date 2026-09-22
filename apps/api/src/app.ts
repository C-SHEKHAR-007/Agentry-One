import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
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
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  const origins = allowedOrigins();
  app.register(cors, { origin: origins.length > 0 ? origins : false, credentials: true });
  app.register(cookie);
  app.addHook("preHandler", requireAuth);

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

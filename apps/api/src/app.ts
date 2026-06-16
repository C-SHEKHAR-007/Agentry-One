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

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true, credentials: true });
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

  return app;
}

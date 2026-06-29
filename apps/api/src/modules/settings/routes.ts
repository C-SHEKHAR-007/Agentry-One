import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";

/** Settings precedence (docs/05-database-schema.md): for a given (agentId, key),
 * a project-scoped row overrides a global row; if neither exists the agent's
 * own code default applies (not represented as a row here). */
export async function settingsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { projectId?: string; agentId?: string } }>("/settings", async (req) => {
    const { projectId, agentId } = req.query;

    const globals = await prisma.setting.findMany({ where: { scope: "global", ...(agentId ? { agentId } : {}) } });
    const projectRows = projectId
      ? await prisma.setting.findMany({ where: { scope: "project", projectId, ...(agentId ? { agentId } : {}) } })
      : [];

    // Merge: project rows win over global rows sharing the same (agentId, key).
    const effective = new Map<string, (typeof globals)[number]>();
    for (const row of globals) effective.set(`${row.agentId ?? ""}:${row.key}`, row);
    for (const row of projectRows) effective.set(`${row.agentId ?? ""}:${row.key}`, row);

    return Array.from(effective.values());
  });

  app.put<{
    Body: { scope: "global" | "project"; projectId?: string; agentId?: string; key: string; value: unknown };
  }>("/settings", async (req, reply) => {
    const { scope, projectId, agentId, key, value } = req.body;
    if (scope === "project" && !projectId) {
      return reply.code(400).send({ error: "projectId is required when scope is 'project'" });
    }

    // Not prisma.upsert: compound uniques containing nullable columns can't
    // be used as an upsert where-input, so emulate it. (Postgres also treats
    // NULLs as distinct in unique constraints, so the DB-level constraint is
    // advisory for null-bearing rows -- app-level check is the real guard.)
    const existing = await prisma.setting.findFirst({
      where: { scope, projectId: projectId ?? null, agentId: agentId ?? null, key },
    });
    const setting = existing
      ? await prisma.setting.update({ where: { id: existing.id }, data: { value: value as object } })
      : await prisma.setting.create({ data: { scope, projectId, agentId, key, value: value as object } });
    return setting;
  });
}

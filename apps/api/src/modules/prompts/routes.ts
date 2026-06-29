import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";

export async function promptsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { agentId?: string } }>("/prompts", async (req) =>
    prisma.prompt.findMany({
      where: req.query.agentId ? { agentId: req.query.agentId } : undefined,
      orderBy: [{ key: "asc" }, { version: "desc" }],
    }),
  );

  app.post<{ Body: { agentId: string; key: string; template: string } }>(
    "/prompts",
    async (req, reply) => {
      const { agentId, key, template } = req.body;
      if (!agentId || !key?.trim() || !template?.trim()) {
        return reply.code(400).send({ error: "agentId, key, and template are required" });
      }
      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!agent) return reply.code(404).send({ error: "agent_not_found" });

      const create = () =>
        prisma.$transaction(async (tx) => {
          const latest = await tx.prompt.findFirst({
            where: { agentId, key: key.trim() },
            orderBy: { version: "desc" },
            select: { version: true },
          });
          return tx.prompt.create({
            data: { agentId, key: key.trim(), template, version: (latest?.version ?? 0) + 1 },
          });
        });

      try {
        return reply.code(201).send(await create());
      } catch (err) {
        // Unique (agentId, key, version) lost a race -- recompute once.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          return reply.code(201).send(await create());
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string } }>("/prompts/:id", async (req, reply) => {
    await prisma.prompt.delete({ where: { id: req.params.id } }).catch(() => null);
    return reply.code(204).send();
  });
}

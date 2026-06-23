import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { encryptSecret } from "./crypto.js";

function serialize(config: { encryptedSecret: string | null; [k: string]: unknown }) {
  // Secrets are write-only -- never redisplayed after save (see docs/17-frontend-architecture.md's providers page).
  const { encryptedSecret, ...rest } = config;
  return { ...rest, hasSecret: Boolean(encryptedSecret) };
}

export async function providersRoutes(app: FastifyInstance) {
  app.get("/capabilities", async () => prisma.capability.findMany({ orderBy: { key: "asc" } }));

  app.get<{ Querystring: { capability?: string } }>("/providers", async (req) => {
    const where = req.query.capability ? { capability: { key: req.query.capability } } : {};
    const configs = await prisma.providerConfig.findMany({ where, include: { capability: true } });
    return configs.map(serialize);
  });

  app.post<{
    Body: {
      capabilityKey: string;
      providerType: string;
      name: string;
      baseUrl?: string;
      authMode: string;
      secret?: string;
      config?: Record<string, unknown>;
      isDefault?: boolean;
      scope?: string;
      projectId?: string;
    };
  }>("/providers", async (req, reply) => {
    const capability = await prisma.capability.findUnique({ where: { key: req.body.capabilityKey } });
    if (!capability) return reply.code(400).send({ error: `unknown capability: ${req.body.capabilityKey}` });

    if (req.body.isDefault) {
      await prisma.providerConfig.updateMany({
        where: { capabilityId: capability.id, scope: req.body.scope ?? "global", projectId: req.body.projectId ?? null },
        data: { isDefault: false },
      });
    }

    const created = await prisma.providerConfig.create({
      data: {
        capabilityId: capability.id,
        providerType: req.body.providerType,
        name: req.body.name,
        baseUrl: req.body.baseUrl,
        authMode: req.body.authMode,
        encryptedSecret: req.body.secret ? encryptSecret(req.body.secret) : null,
        config: (req.body.config ?? {}) as object,
        isDefault: req.body.isDefault ?? false,
        scope: req.body.scope ?? "global",
        projectId: req.body.projectId,
      },
    });
    return reply.code(201).send(serialize(created));
  });

  app.get<{ Params: { id: string } }>("/providers/:id", async (req, reply) => {
    const config = await prisma.providerConfig.findUnique({ where: { id: req.params.id } });
    if (!config) return reply.code(404).send({ error: "provider_not_found" });
    return serialize(config);
  });

  app.put<{ Params: { id: string }; Body: { name?: string; baseUrl?: string; secret?: string; config?: Record<string, unknown>; status?: string } }>(
    "/providers/:id",
    async (req) => {
      const updated = await prisma.providerConfig.update({
        where: { id: req.params.id },
        data: {
          name: req.body.name,
          baseUrl: req.body.baseUrl,
          encryptedSecret: req.body.secret ? encryptSecret(req.body.secret) : undefined,
          config: req.body.config as object | undefined,
          status: req.body.status,
        },
      });
      return serialize(updated);
    },
  );

  app.delete<{ Params: { id: string } }>("/providers/:id", async (req, reply) => {
    await prisma.providerConfig.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/providers/:id/set-default", async (req, reply) => {
    const config = await prisma.providerConfig.findUnique({ where: { id: req.params.id } });
    if (!config) return reply.code(404).send({ error: "provider_not_found" });

    await prisma.providerConfig.updateMany({
      where: { capabilityId: config.capabilityId, scope: config.scope, projectId: config.projectId },
      data: { isDefault: false },
    });
    const updated = await prisma.providerConfig.update({ where: { id: req.params.id }, data: { isDefault: true } });
    return serialize(updated);
  });
}

import type { FastifyInstance } from "fastify";
import { adminForWrites } from "../../auth/access.js";
import { prisma } from "../../db/client.js";
import { encryptSecret } from "./crypto.js";
import { discoverProviderModels } from "./discovery.js";
import { assertSafeOutboundUrl, UnsafeUrlError } from "../../http/ssrf.js";

/** Validates a user-supplied provider baseUrl; returns an error reply body or null. */
async function checkBaseUrl(baseUrl: string | undefined | null): Promise<string | null> {
  if (!baseUrl?.trim()) return null;
  try {
    await assertSafeOutboundUrl(baseUrl.trim());
    return null;
  } catch (err) {
    if (err instanceof UnsafeUrlError) return err.message;
    throw err;
  }
}

function serialize(config: { encryptedSecret: string | null; [k: string]: unknown }) {
  // Secrets are write-only -- never redisplayed after save (see docs/17-frontend-architecture.md's providers page).
  const { encryptedSecret, ...rest } = config;
  return { ...rest, hasSecret: Boolean(encryptedSecret) };
}

export async function providersRoutes(app: FastifyInstance) {
  // Global configuration: readable by any signed-in user, writable by admins only.
  app.addHook("preHandler", adminForWrites);

  app.get("/capabilities", async () => prisma.capability.findMany({ orderBy: { key: "asc" } }));

  app.get<{ Querystring: { capability?: string } }>("/providers", async (req) => {
    const where = req.query.capability ? { capability: { key: req.query.capability } } : {};
    const configs = await prisma.providerConfig.findMany({
      where,
      orderBy: [{ capability: { key: "asc" } }, { createdAt: "asc" }],
      include: { capability: true, models: { where: { isActive: true }, orderBy: { name: "asc" } } },
    });
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
    if (!req.body.name?.trim() || !req.body.providerType?.trim()) {
      return reply.code(400).send({ error: "name and providerType are required" });
    }
    const urlError = await checkBaseUrl(req.body.baseUrl);
    if (urlError) return reply.code(400).send({ error: urlError });

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
      include: { capability: true, models: true },
    });

    // Proactively attempt auto-discovery if possible
    try {
      await discoverProviderModels(created.id);
    } catch {
      // Non-fatal if immediate discovery fails
    }

    const refreshed = await prisma.providerConfig.findUniqueOrThrow({
      where: { id: created.id },
      include: { capability: true, models: true },
    });

    return reply.code(201).send(serialize(refreshed));
  });

  app.get<{ Params: { id: string } }>("/providers/:id", async (req, reply) => {
    const config = await prisma.providerConfig.findUnique({
      where: { id: req.params.id },
      include: { capability: true, models: true },
    });
    if (!config) return reply.code(404).send({ error: "provider_not_found" });
    return serialize(config);
  });

  app.put<{ Params: { id: string }; Body: { name?: string; baseUrl?: string; secret?: string; config?: Record<string, unknown>; status?: string } }>(
    "/providers/:id",
    async (req, reply) => {
      const existing = await prisma.providerConfig.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) return reply.code(404).send({ error: "provider_not_found" });

      if (req.body.baseUrl !== undefined) {
        const urlError = await checkBaseUrl(req.body.baseUrl);
        if (urlError) return reply.code(400).send({ error: urlError });
        // Pointing a saved key at a new host would let anyone who can edit the
        // provider exfiltrate it -- the key must be re-entered with the change.
        const newBase = req.body.baseUrl.trim() || null;
        if (newBase !== existing.baseUrl && existing.encryptedSecret && !req.body.secret?.trim()) {
          return reply.code(400).send({ error: "re-enter the API key when changing the base URL" });
        }
      }

      const currentConfig = (existing.config as Record<string, unknown>) || {};
      const newConfig = req.body.config !== undefined
        ? { ...currentConfig, ...req.body.config }
        : currentConfig;

      let encryptedSecret = existing.encryptedSecret;
      if (req.body.secret !== undefined) {
        if (req.body.secret.trim() === "") {
          encryptedSecret = null;
        } else {
          encryptedSecret = encryptSecret(req.body.secret.trim());
        }
      }

      const updated = await prisma.providerConfig.update({
        where: { id: req.params.id },
        data: {
          name: req.body.name !== undefined ? req.body.name : existing.name,
          baseUrl: req.body.baseUrl !== undefined ? (req.body.baseUrl.trim() || null) : existing.baseUrl,
          encryptedSecret,
          config: newConfig as object,
          status: req.body.status !== undefined ? req.body.status : existing.status,
        },
        include: { capability: true, models: true },
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
    const updated = await prisma.providerConfig.update({
      where: { id: req.params.id },
      data: { isDefault: true },
      include: { capability: true, models: true },
    });
    return serialize(updated);
  });

  // Dynamic Model Discovery endpoint
  app.post<{ Params: { id: string } }>("/providers/:id/discover-models", async (req, reply) => {
    try {
      const discovered = await discoverProviderModels(req.params.id);
      return { success: true, count: discovered.length, models: discovered };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || "Failed to discover models" });
    }
  });

  // Set default model for a provider
  app.post<{ Params: { id: string }; Body: { modelId: string } }>(
    "/providers/:id/set-default-model",
    async (req, reply) => {
      const { modelId } = req.body;
      if (!modelId) {
        return reply.code(400).send({ error: "modelId is required" });
      }

      const existing = await prisma.providerConfig.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) return reply.code(404).send({ error: "provider_not_found" });

      const currentConfig = (existing.config as Record<string, unknown>) || {};
      const updatedConfig = { ...currentConfig, model: modelId };

      const updated = await prisma.providerConfig.update({
        where: { id: req.params.id },
        data: { config: updatedConfig },
        include: { capability: true, models: true },
      });

      return serialize(updated);
    },
  );

  // Get models for a specific provider
  app.get<{ Params: { id: string } }>("/providers/:id/models", async (req) => {
    return prisma.model.findMany({
      where: { providerConfigId: req.params.id, isActive: true },
      orderBy: { name: "asc" },
    });
  });

  // Global list of models with multimodal filter queries
  app.get<{
    Querystring: {
      inputType?: string;
      outputType?: string;
      capability?: string;
    };
  }>("/models", async (req) => {
    const { inputType, outputType, capability } = req.query;

    const where: any = { isActive: true };
    if (inputType) {
      where.inputTypes = { has: inputType };
    }
    if (outputType) {
      where.outputTypes = { has: outputType };
    }
    if (capability) {
      where.providerConfig = { capability: { key: capability } };
    }

    return prisma.model.findMany({
      where,
      include: {
        providerConfig: {
          select: {
            id: true,
            name: true,
            providerType: true,
            capability: { select: { key: true, label: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  });

  // Add a custom model manually
  app.post<{
    Body: {
      providerConfigId: string;
      modelId: string;
      name: string;
      description?: string;
      inputTypes: string[];
      outputTypes: string[];
      contextLength?: number;
      metadata?: Record<string, unknown>;
    };
  }>("/models", async (req, reply) => {
    const { providerConfigId, modelId, name, description, inputTypes, outputTypes, contextLength, metadata } = req.body;

    const provider = await prisma.providerConfig.findUnique({ where: { id: providerConfigId } });
    if (!provider) return reply.code(404).send({ error: "Provider not found" });

    const model = await prisma.model.upsert({
      where: { providerConfigId_modelId: { providerConfigId, modelId } },
      create: {
        providerConfigId,
        modelId,
        name: name || modelId,
        description,
        inputTypes: inputTypes?.length ? inputTypes : ["text"],
        outputTypes: outputTypes?.length ? outputTypes : ["text"],
        contextLength,
        metadata: (metadata || {}) as object,
        isActive: true,
      },
      update: {
        name,
        description,
        inputTypes,
        outputTypes,
        contextLength,
        metadata: (metadata || {}) as object,
      },
    });

    return reply.code(201).send(model);
  });

  // Delete / deactivate a model
  app.delete<{ Params: { id: string } }>("/models/:id", async (req, reply) => {
    await prisma.model.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}


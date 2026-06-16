import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/client.js";
import { resolveArtifactPath } from "./storage.js";

export async function artifactsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/workflows/:id/artifacts", async (req) =>
    prisma.artifact.findMany({ where: { workflowStep: { workflowId: req.params.id } }, orderBy: { createdAt: "asc" } }),
  );

  // Flat cross-project listing for the gallery. Registered before the :id
  // routes only for readability -- Fastify routes static/param segments
  // independently, so there is no conflict.
  app.get<{ Querystring: { limit?: string; projectId?: string; kind?: string } }>(
    "/artifacts",
    async (req) => {
      const limit = Math.min(Number(req.query.limit ?? 50) || 50, 100);
      const artifacts = await prisma.artifact.findMany({
        where: {
          ...(req.query.kind ? { kind: req.query.kind } : {}),
          ...(req.query.projectId
            ? { workflowStep: { workflow: { projectId: req.query.projectId } } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          workflowStep: {
            select: {
              workflowId: true,
              workflow: {
                select: {
                  projectId: true,
                  agentId: true,
                  project: { select: { name: true } },
                },
              },
            },
          },
        },
      });
      return artifacts.map((a) => ({
        id: a.id,
        kind: a.kind,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        checksum: a.checksum,
        createdAt: a.createdAt,
        workflowId: a.workflowStep.workflowId,
        projectId: a.workflowStep.workflow.projectId,
        projectName: a.workflowStep.workflow.project.name,
        agentId: a.workflowStep.workflow.agentId,
      }));
    },
  );

  app.get<{ Params: { id: string } }>("/artifacts/:id", async (req, reply) => {
    const artifact = await prisma.artifact.findUnique({ where: { id: req.params.id } });
    if (!artifact) return reply.code(404).send({ error: "artifact_not_found" });
    return artifact;
  });

  app.get<{ Params: { id: string } }>("/artifacts/:id/download", async (req, reply) => {
    const artifact = await prisma.artifact.findUnique({ where: { id: req.params.id } });
    if (!artifact) return reply.code(404).send({ error: "artifact_not_found" });

    const filePath = resolveArtifactPath(artifact.storageKey);
    try {
      const info = await stat(filePath);
      reply.header("Content-Type", artifact.mimeType);
      reply.header("Content-Length", info.size);
      return reply.send(createReadStream(filePath));
    } catch {
      return reply.code(404).send({ error: "artifact_file_missing" });
    }
  });
}
